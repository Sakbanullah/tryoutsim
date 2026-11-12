# Reset a database role's password (recovery path for provision.ps1).
#
# Equivalent to `.\db\provision.ps1 -ResetPassword`; kept as its own entry point because the
# recovery message in provision.ps1 names it, and because the operation is worth finding by
# name. It writes a fresh random password into the role's connection string in the environment
# file FIRST and only then applies it with ALTER ROLE, so a failure in between always leaves a
# file the next run can use, never a role whose password nobody holds.
#
# The environment file holds only the two role passwords and must be readable by the current
# user alone. The superuser password is typed at the console, without echo; no command line or
# log carries it.

[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)][ValidateSet('tryoutsim_app', 'tryoutsim_migrator')][string]$Role,
  [string]$SuperUser = $(if ($env:PGSUPERUSER) { $env:PGSUPERUSER } else { 'postgres' }),
  [string]$HostName = '127.0.0.1',
  [int]$Port = 5432,
  [string]$PsqlPath = '',
  [string]$EnvFile = '',
  [string]$Database = 'tryoutsim'
)

$ErrorActionPreference = 'Stop'

. (Join-Path $PSScriptRoot 'ProvisioningCommon.ps1')

# --- Preflight -----------------------------------------------------------------------------

Assert-SqlIdentifier $Role 'Role name'
Assert-SqlIdentifier $SuperUser 'Superuser name'
Assert-SqlIdentifier $Database 'Database name'
if ($Port -lt 1 -or $Port -gt 65535) { throw "Port '$Port' is not a valid TCP port." }
$psql = Resolve-PsqlPath $PsqlPath
$envPath = $(if ($EnvFile) { [System.IO.Path]::GetFullPath($EnvFile) } else { Get-DefaultEnvPath })
if (-not (Test-Path -LiteralPath $envPath -PathType Leaf)) { throw "No environment file at '$envPath'. Run .\db\provision.ps1 first. Nothing was changed." }
Assert-OwnerOnly $envPath
Assert-EnvFileIgnored -Path $envPath

$key = @{ tryoutsim_app = 'DATABASE_URL_APP'; tryoutsim_migrator = 'DATABASE_URL' }[$Role]
$existing = Read-EnvFile -Path $envPath -Names @('DATABASE_URL_APP', 'DATABASE_URL', 'NODE_ENV', 'PORT')
if (-not $existing['NODE_ENV']) { $existing['NODE_ENV'] = 'development' }

# The connection settings the psql helper reads, from this script's scope.
$script:SuperuserConnection = @{ SuperUser = $SuperUser; HostName = $HostName; Port = $Port; PsqlPath = $psql }
$plain = Get-SecureStringText (Get-SuperuserPassword)
if ([string]::IsNullOrEmpty($plain)) { throw 'The superuser password is empty. Nothing was changed.' }
$env:PGPASSWORD = $plain

Write-Host "Resetting the password for $Role on ${HostName}:$Port"

try {
  $present = @(Invoke-SuperuserSql -Sql (Get-RoleExistsSql @($Role)))
  if ($present.Count -eq 0) {
    throw "Role $Role does not exist. Run .\db\provision.ps1 to create it; nothing was changed."
  }

  $secret = New-RandomPassword
  $sql = Get-AlterRolePasswordSql $Role $secret
  if (-not (Test-PasswordInSql $sql $secret)) { throw 'The generated password failed the statement guard. No password was changed.' }

  # File first: the URL is written (and checked) before the role's password changes, so the two
  # never disagree in the direction that locks the app out.
  $existing[$key] = Get-ConnectionUrl -User $Role -Secret $secret -HostName $HostName -Port $Port -Database $database
  Write-EnvFile -Path $envPath -Values $existing

  try {
    $null = Invoke-SuperuserSql -Sql $sql
  } catch {
    throw "The ALTER ROLE for $Role failed after its new connection string was written: $($_.Exception.Message) Re-run this script to retry."
  } finally {
    $secret = $null
    $existing = @{}
  }
  Write-Host "Reset the password for $Role; $key in '$envPath' now holds it."
} finally {
  Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
  $plain = $null
}
