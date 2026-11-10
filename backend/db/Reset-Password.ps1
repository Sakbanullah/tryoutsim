# Reset a database role's password (recovery path for provision.ps1).
#
# Equivalent to `.\db\provision.ps1 -ResetPassword`; kept as its own entry point because the
# recovery message in provision.ps1 names it, and because the operation is worth finding by
# name. It stores a fresh random password in Windows Credential Manager FIRST and only then
# applies it with ALTER ROLE, so a failure in between always leaves a credential the next run
# can use, never a role whose password nobody holds.
#
# The superuser password is read from stdin, without echo, after the preflight. Nothing about
# it touches a command line, an environment variable, a file or a log.

[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)][string]$Role,
  [string]$SuperUser = $(if ($env:PGSUPERUSER) { $env:PGSUPERUSER } else { 'postgres' }),
  [string]$HostName = '127.0.0.1',
  [int]$Port = 5432,
  [string]$PsqlPath = ''
)

$ErrorActionPreference = 'Stop'

. (Join-Path $PSScriptRoot 'ProvisioningCommon.ps1')
. (Join-Path $PSScriptRoot 'CredentialStore.ps1')

# --- Preflight -----------------------------------------------------------------------------

Assert-SqlIdentifier $Role 'Role name'
Assert-SqlIdentifier $SuperUser 'Superuser name'
if ($Port -lt 1 -or $Port -gt 65535) { throw "Port '$Port' is not a valid TCP port." }
$psql = Resolve-PsqlPath $PsqlPath
$target = Get-CredentialTarget $Role

Write-Host "Resetting the password for $Role on ${HostName}:$Port"
$plain = Get-SecureStringText (Get-SuperuserPassword)
if ([string]::IsNullOrEmpty($plain)) { throw 'The superuser password is empty. Nothing was changed.' }
$env:PGPASSWORD = $plain
$plain = $null

try {
  $present = @(Invoke-SuperuserSql -Sql (Get-RoleExistsSql @($Role)) -SuperUser $SuperUser -HostName $HostName -Port $Port -PsqlPath $psql)
  if ($present.Count -eq 0) {
    throw "Role $Role does not exist. Run .\db\provision.ps1 to create it; nothing was changed."
  }

  $secret = New-RandomPassword
  $sql = Get-AlterRolePasswordSql $Role $secret
  if (-not (Test-PasswordInSql $sql $secret)) { throw 'The generated password failed the statement guard. No password was changed.' }

  $outcome = TryoutSimCredInvoke -Operation Write -Target $target -User $Role -Secret $secret
  if ($outcome) {
    $secret = $null
    throw (Get-StoreFailureMessage $outcome 'store the new password for ' 'The role keeps its old password. Re-run once the store is available.' $Role)
  }

  try {
    $null = Invoke-SuperuserSql -Sql $sql -SuperUser $SuperUser -HostName $HostName -Port $Port -PsqlPath $psql
  } catch {
    throw "The ALTER ROLE for $Role failed after its new password was stored: $($_.Exception.Message) Re-run this script to retry."
  } finally {
    $secret = $null
  }
  Write-Host "Reset the password for $Role; the new one is stored as '$target'. Run .\db\make-env.ps1 again to refresh db.env."
} finally {
  Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
  $plain = $null
}
