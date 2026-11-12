# Provisioning for the local PostgreSQL 18 instance: creates the migrator and app roles,
# creates the database, and writes every connection setting into ONE environment file, .env
# at the repository root (D:\tryoutsim\.env). It never prints a password.
#
# The file is the source of truth for the two role passwords, the .gitignore keeps it out of
# Git (refused otherwise), and it must be readable by the current Windows account alone. The
# superuser password is NOT in it: the script asks for it at the console, without echo, the one
# secret an operator types, and keeps it only in memory for its own psql calls.
#
# If you already know the roles' passwords, put them in the file first (db/Set-Secret.ps1), so
# this script applies that exact value instead of creating a new one.
#
# Order and recovery. Each role's connection string is written BEFORE its CREATE ROLE, so the
# database never holds a role whose password the file does not have:
#   - file write fails        -> no role was created; the script stops and says so.
#   - CREATE ROLE fails       -> the URL stays and the run stops; the next run creates the role
#                                with that password, so the two recover together.
#   - role exists, URL exists -> left alone (re-running is safe and idempotent).
#   - role exists, no URL     -> the password cannot be recovered by guessing, so the run stops
#                                before changing anything and names the one recovery:
#                                -ResetPassword, which writes a fresh URL and only then applies
#                                it with ALTER ROLE.
#
# The URL in the file must be the user's, not this script's: ALTER ROLE replaces the password
# with the file's encoded one, so the file can always connect.

[CmdletBinding()]
param(
  [string]$Database = 'tryoutsim',
  [string]$AppRole = 'tryoutsim_app',
  [string]$MigratorRole = 'tryoutsim_migrator',
  [string]$SuperUser = $(if ($env:PGSUPERUSER) { $env:PGSUPERUSER } else { 'postgres' }),
  [string]$HostName = '127.0.0.1',
  [int]$Port = 5432,
  [string]$PsqlPath = '',
  [string]$EnvFile = '',
  [switch]$ResetPassword
)

$ErrorActionPreference = 'Stop'

. (Join-Path $PSScriptRoot 'ProvisioningCommon.ps1')

# --- Preflight: everything that can fail without touching a server is checked first --------

foreach ($pair in @(@($MigratorRole, 'Migrator role'), @($AppRole, 'App role'), @($Database, 'Database name'), @($SuperUser, 'Superuser name'))) {
  Assert-SqlIdentifier $pair[0] $pair[1]
}
if ($MigratorRole -eq $AppRole) { throw 'The migrator and app roles must be different.' }
if ($Port -lt 1 -or $Port -gt 65535) { throw "Port '$Port' is not a valid TCP port." }
if ([string]::IsNullOrWhiteSpace($HostName)) { throw 'HostName must not be empty.' }
$psql = Resolve-PsqlPath $PsqlPath
$envPath = $(if ($EnvFile) { [System.IO.Path]::GetFullPath($EnvFile) } else { Get-DefaultEnvPath })

$envDir = Split-Path -Parent $envPath
$roles = @($MigratorRole, $AppRole)
$urlKeys = @{ $AppRole = 'DATABASE_URL_APP'; $MigratorRole = 'DATABASE_URL' }

# Invoke-SuperuserSql runs in its own function scope, so it cannot read this script's variables.
# It reads the connection settings from this script scope instead.
$script:SuperuserConnection = @{ SuperUser = $SuperUser; HostName = $HostName; Port = $Port; PsqlPath = $psql }

Write-Host "Provisioning $Database as $SuperUser on ${HostName}:$Port, settings in $envPath"
$env:PGPASSWORD = Get-SecureStringText (Get-SuperuserPassword)
if ([string]::IsNullOrEmpty($env:PGPASSWORD)) { throw 'The superuser password is empty. Nothing was changed.' }

# The Git check comes first, before anything is written: a path Git would commit is refused
# while it is still absent. From here on the file is created (owner-only, empty connection
# strings this run fills in) or used as it stands.
Assert-EnvFileIgnored -Path $envPath
if (-not (Test-Path -LiteralPath $envPath -PathType Leaf)) {
  Write-OwnerOnlyFile -Path $envPath -Text (Get-DbEnvText -AppUrl '' -MigratorUrl '' -NodeEnv 'development')
}
Assert-OwnerOnly $envPath
# The file as it stands, and the live record every write below replaces the whole file from:
# the role URLs exactly as written, plus NODE_ENV and PORT.
$existing = Read-EnvFile -Path $envPath -Names @('DATABASE_URL_APP', 'DATABASE_URL', 'NODE_ENV', 'PORT')
$existing['NODE_ENV'] = $(if ($existing['NODE_ENV']) { $existing['NODE_ENV'] } else { 'development' })
Assert-NoBrokenConnection -Path $envPath -Values $existing

try {
  # 1. Roles that already exist. Read-only.
  $exists = @{}
  foreach ($role in $roles) { $exists[$role] = $false }
  foreach ($name in (Invoke-SuperuserSql -Sql (Get-RoleExistsSql $roles))) { $exists[$name] = $true }

  # 2. What the environment file holds. Read once, by Read-EnvFile, which refuses a malformed
  #    file outright.
  $stored = @{}
  foreach ($role in $roles) {
    $url = $existing[$urlKeys[$role]]
    # Only the file's own user counts: a string for another role cannot connect as this one.
    $user = $(if ($url -match '^postgresql://([^:/?#]+):') { [Uri]::UnescapeDataString($matches[1]) })
    $stored[$role] = $(if ($url -and $user -eq $role) { $url })
  }

  # 3. Which stored credentials the server actually accepts. Read-only, one SELECT 1 per role,
  #    and it is the only way to tell a working credential from a rejected one: the file cannot.
  #    A rejected one is treated exactly like a missing one - both need -ResetPassword - but the
  #    message says which, because the remedy's first step differs.
  $rejected = @()
  foreach ($role in $roles) {
    if ($stored[$role] -and -not (Test-RoleConnection -Url $stored[$role] -PsqlPath $psql)) { $rejected += $role }
  }

  # 4. Decide, then refuse the one state that needs the owner's decision.
  $plan = Get-Plan -Roles $roles -Exists $exists -Stored $stored -Rejected $rejected -ResetPassword:$ResetPassword
  if ($plan.Unrecoverable.Count -gt 0) {
    $url = Get-ConnectionUrl -User $AppRole -Secret 'YOUR-PASSWORD' -HostName $HostName -Port $Port -Database $Database
    $why = @()
    foreach ($role in $plan.Unrecoverable) {
      $reason = $(if ($rejected -contains $role) {
        "the connection string in '$envPath' does not authenticate; the role exists with a different password"
      } else {
        "'$envPath' holds no connection string for it, so nothing can connect with it"
      })
      $why += "$role ($($urlKeys[$role])): $reason"
    }
    throw ("Role(s) $($plan.Unrecoverable -join ', ') already exist and cannot be used. " +
      $(foreach ($line in $why) { "  - $line." }) +
      "If you know their passwords, set DATABASE_URL_APP and DATABASE_URL in that file first (shape: $url). " +
      'The password cannot be recovered by guessing. Re-run with -ResetPassword: it writes a fresh connection string first and only then applies it with ALTER ROLE. ' +
      'Nothing else was changed by this run.')
  }
  foreach ($role in $plan.Stale) {
    Write-Host "$($urlKeys[$role]) in the environment file does not connect as $role; it is replaced before the role is created."
  }

  # 5. Create missing roles: write the connection string first, create the role second. The
  #    file is the commit point. If CREATE ROLE fails, the URL stays and the next run sees a
  #    URL for a role that does not exist (Stale): that run replaces it, keeps the password it
  #    just wrote, and creates the role - the two recover together.
  foreach ($role in $plan.Create) {
    # A stale URL (left by a run that failed after writing it) already holds this role's
    # password: create the role with it instead of generating a new one, so the file keeps
    # working. With no stale URL, this is the first password for the role.
    $secret = $(if ($stored[$role]) { Get-UrlPassword -Url $stored[$role] } else { New-RandomPassword })
    if (-not $stored[$role]) {
      $existing[$urlKeys[$role]] = Get-ConnectionUrl -User $role -Secret $secret -HostName $HostName -Port $Port -Database $Database
      Write-EnvFile -Path $envPath -Values $existing
    }
    try {
      $null = Invoke-SuperuserSql -Sql (Get-CreateRoleSql $role $secret)
    } catch {
      throw "Creating $role failed. Its connection string is already in '$envPath', so no state is lost: fix the cause and re-run - the next run's $($urlKeys[$role]) keeps its password."
    } finally {
      $secret = $null
    }
    Write-Host "Created $role; its connection string is $($urlKeys[$role]) in the environment file."
  }
  foreach ($role in $roles) {
    if ($plan.Create -notcontains $role -and $plan.Reset -notcontains $role) {
      Write-Host "Role $role already exists and its connection string is in the environment file; unchanged."
    }
  }

  # 6. -ResetPassword: the only path that overwrites an existing password, in the same order.
  foreach ($role in $plan.Reset) {
    $secret = New-RandomPassword
    $existing[$urlKeys[$role]] = Get-ConnectionUrl -User $role -Secret $secret -HostName $HostName -Port $Port -Database $Database
    Write-EnvFile -Path $envPath -Values $existing
    if (-not (Test-PasswordInSql (Get-AlterRolePasswordSql $role $secret) $secret)) {
      throw "The generated password for $role failed the statement guard. No password was changed."
    }
    try {
      $null = Invoke-SuperuserSql -Sql (Get-AlterRolePasswordSql $role $secret)
    } catch {
      throw "The ALTER ROLE for $role failed after its new connection string was written: $($_.Exception.Message) Re-run -ResetPassword to retry; $($urlKeys[$role]) is replaced again."
    } finally {
      $secret = $null
    }
    Write-Host "Reset the password for $role; $($urlKeys[$role]) now holds it."
  }

  # 7. Attributes, database, grants: idempotent, safe on every run.
  $null = Invoke-SuperuserSql -Sql (Get-AlterRolePrivilegesSql $MigratorRole $AppRole)

  if ((Invoke-SuperuserSql -Sql (Get-DatabaseExistsSql $Database)).Count -eq 0) {
    $null = Invoke-SuperuserSql -Sql (Get-CreateDatabaseSql $Database $MigratorRole)
    Write-Host "Created database $Database owned by $MigratorRole."
  } else {
    Write-Host "Database $Database already exists."
  }
  $null = Invoke-SuperuserSql -Sql (Get-DatabaseGrantsSql $Database $AppRole $MigratorRole)

  # 8. Prove what this run just wrote. A role it created or reset must now accept the password
  #    in the file; the ones it left alone were already probed in step 3. Nothing is written and
  #    no password is changed here.
  $failed = @()
  foreach ($role in @($plan.Create) + @($plan.Reset)) {
    $url = [string]$existing[$urlKeys[$role]]
    if (-not (Test-RoleConnection -Url $url -PsqlPath $psql)) { $failed += "$role ($($urlKeys[$role]))" }
  }
  if ($failed.Count -gt 0) {
    throw ("The connection string in '$envPath' does not authenticate these roles: $($failed -join ', '). " +
      'The roles exist with a different password. Run .\db\provision.ps1 -ResetPassword to set a fresh one, ' +
      'or .\db\Set-Secret.ps1 with the password they actually have. Nothing else was changed by this run.')
  }
  Write-Host 'Both role connection strings authenticate.'
} finally {
  # The superuser password never outlives this process.
  Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
  $stored = @{}
}

Write-Host "Done. Next: . .\db\Load-Env.ps1 (loads '$envPath'), then npm run migrate:deploy, then psql -f db/provision-grants.sql, then npm start."
