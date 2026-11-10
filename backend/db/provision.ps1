# Provisioning for the local PostgreSQL 18 instance (one-time).
#
# Creates the migrator and app roles with random passwords, stores each password in Windows
# Credential Manager, creates the database, and never prints or writes a password.
#
# The superuser user name is a parameter (PGSUPERUSER); the superuser password is NOT: it is
# read from stdin, without echo, after the preflight and before any statement runs. Nothing in
# this repository stores it, no environment variable carries it, no command line carries it.
#
# Order and recovery. Each role's password is written to the credential store BEFORE the role
# is created, so the database never holds a role whose password nobody has:
#   - store write fails        -> no role was created; the script stops and says so.
#   - CREATE ROLE fails        -> the credential stays and the run stops; the next run creates
#                                 the role and keeps that password, so the two recover together.
#   - role exists, credential exists -> left alone (re-running is safe).
#   - role exists, no credential -> the password cannot be recovered by guessing, so the run
#     stops before changing anything and names the one recovery: -ResetPassword, which stores a
#     fresh random password and only then applies it with ALTER ROLE.
#
# Findings addressed: 1 (user name and password are separate inputs), 3 (preflight before any
# statement), 4/5 (no role is left unrecoverable; the recovery is exactly once and explicit),
# 6 (identifiers validated, values quoted), 9 (no password in argv, environment, temp file or
# log), 10 (credential-store errors are named, never reported as "absent").

[CmdletBinding()]
param(
  [string]$Database = 'tryoutsim',
  [string]$AppRole = 'tryoutsim_app',
  [string]$MigratorRole = 'tryoutsim_migrator',
  [string]$SuperUser = $(if ($env:PGSUPERUSER) { $env:PGSUPERUSER } else { 'postgres' }),
  [string]$HostName = '127.0.0.1',
  [int]$Port = 5432,
  [string]$PsqlPath = '',
  [switch]$ResetPassword
)

$ErrorActionPreference = 'Stop'

. (Join-Path $PSScriptRoot 'ProvisioningCommon.ps1')
. (Join-Path $PSScriptRoot 'CredentialStore.ps1')

# --- Preflight: everything that can fail without touching a server is checked first --------

foreach ($pair in @(@($MigratorRole, 'Migrator role'), @($AppRole, 'App role'), @($Database, 'Database name'), @($SuperUser, 'Superuser name'))) {
  Assert-SqlIdentifier $pair[0] $pair[1]
}
if ($MigratorRole -eq $AppRole) { throw 'The migrator and app roles must be different.' }
if ($Port -lt 1 -or $Port -gt 65535) { throw "Port '$Port' is not a valid TCP port." }
if ([string]::IsNullOrWhiteSpace($HostName)) { throw 'HostName must not be empty.' }
$psql = Resolve-PsqlPath $PsqlPath

$roles = @($MigratorRole, $AppRole)
$targets = @{}
foreach ($role in $roles) { $targets[$role] = Get-CredentialTarget $role }

Write-Host "Provisioning $Database as $SuperUser on ${HostName}:$Port"
$plain = Get-SecureStringText (Get-SuperuserPassword)
$env:PGPASSWORD = $plain
$plain = $null
if ([string]::IsNullOrEmpty($env:PGPASSWORD)) { throw 'The superuser password is empty. Nothing was changed.' }

try {
  # 1. Roles that already exist. Read-only.
  $exists = @{}
  foreach ($role in $roles) { $exists[$role] = $false }
  foreach ($name in (Invoke-SuperuserSql -Sql (Get-RoleExistsSql $roles))) { $exists[$name] = $true }

  # 2. What the credential store holds. A store error is reported as a store error, never as
  #    "no credential".
  $stored = @{}
  foreach ($role in $roles) {
    $stored[$role] = $null
    $outcome = TryoutSimCredInvoke -Operation Read -Target $targets[$role]
    if ($outcome -is [hashtable] -and $outcome.ContainsKey('Exception')) { throw (Get-StoreFailureMessage $outcome 'read' 'No role or database was changed.') }
    $stored[$role] = $outcome
  }

  # 3. Decide, then refuse the one state that needs the owner's decision.
  $plan = Get-Plan -Roles $roles -Exists $exists -Stored $stored -ResetPassword:$ResetPassword
  if ($plan.Unrecoverable.Count -gt 0) {
    throw ("Role(s) $($plan.Unrecoverable -join ', ') already exist, but no password for them is stored in Windows Credential Manager, so nothing can connect with them. " +
      'The password cannot be recovered by guessing. Re-run with -ResetPassword: it stores a fresh random password first and only then applies it with ALTER ROLE. ' +
      'Nothing else was changed by this run.')
  }
  foreach ($role in $plan.Stale) {
    Write-Host "A stale credential for $role is stored without its role; it is replaced before the role is created."
  }

  # 4. Create missing roles: store the password first, create the role second. The credential
  #    is the commit point. If CREATE ROLE fails, the credential stays and the next run sees a
  #    stored password for a role that does not exist (Stale): that run replaces it, keeps the
  #    password it just wrote, and creates the role - the two recover together.
  foreach ($role in $plan.Create) {
    $secret = New-RandomPassword
    $outcome = TryoutSimCredInvoke -Operation Write -Target $targets[$role] -User $role -Secret $secret
    if ($outcome) {
      $secret = $null
      throw (Get-StoreFailureMessage $outcome 'store the password for ' "No role was created and nothing was changed. Fix the credential store and re-run." $role)
    }
    try {
      $null = Invoke-SuperuserSql -Sql (Get-CreateRoleSql $role $secret)
    } catch {
      throw "Creating $role failed. Its password is already stored as '$($targets[$role])', so no state is lost: fix the cause and re-run - the next run creates $role and keeps this password. $($_.Exception.Message)"
    } finally {
      $secret = $null
    }
    Write-Host "Created $role; its password is stored as '$($targets[$role])'."
  }
  foreach ($role in $roles) {
    if ($plan.Create -notcontains $role -and $plan.Reset -notcontains $role) {
      Write-Host "Role $role already exists and its password is stored; unchanged."
    }
  }

  # 5. -ResetPassword: the only path that overwrites an existing password, in the same order.
  foreach ($role in $plan.Reset) {
    $secret = New-RandomPassword
    $outcome = TryoutSimCredInvoke -Operation Write -Target $targets[$role] -User $role -Secret $secret
    if ($outcome) {
      $secret = $null
      throw (Get-StoreFailureMessage $outcome 'store the new password for ' "The role still has its old password. Re-run -ResetPassword once the store is available." $role)
    }
    if (-not (Test-PasswordInSql (Get-AlterRolePasswordSql $role $secret) $secret)) {
      throw "The generated password for $role failed the statement guard. No password was changed."
    }
    try {
      $null = Invoke-SuperuserSql -Sql (Get-AlterRolePasswordSql $role $secret)
    } catch {
      throw "The ALTER ROLE for $role failed after its new password was stored: $($_.Exception.Message) Re-run -ResetPassword to retry; the stored credential is replaced again."
    } finally {
      $secret = $null
    }
    Write-Host "Reset the password for $role."
  }

  # 6. Attributes, database, grants: idempotent, safe on every run.
  $null = Invoke-SuperuserSql -Sql (Get-AlterRolePrivilegesSql $MigratorRole $AppRole)

  if ((Invoke-SuperuserSql -Sql (Get-DatabaseExistsSql $Database)).Count -eq 0) {
    $null = Invoke-SuperuserSql -Sql (Get-CreateDatabaseSql $Database $MigratorRole)
    Write-Host "Created database $Database owned by $MigratorRole."
  } else {
    Write-Host "Database $Database already exists."
  }
  $null = Invoke-SuperuserSql -Sql (Get-DatabaseGrantsSql $Database $AppRole $MigratorRole)
} finally {
  # The superuser password never outlives this process.
  Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
  foreach ($role in $roles) { $stored[$role] = $null }
  $plain = $null
}

Write-Host 'Done. Next: .\db\make-env.ps1 -OutFile "$env:LOCALAPPDATA\TryoutSim\db.env", then prisma migrate deploy, then db/provision-grants.sql.'
