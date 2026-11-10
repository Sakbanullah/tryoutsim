# Failure and recovery scenarios for db/provision.ps1, db/make-env.ps1 and db/Reset-Password.ps1.
#
# Run one file at a time, because the doubles replace module-scoped state:
#   powershell -NoProfile -File db\tests\Run-All.ps1
#   pwsh -NoProfile -File db\tests\Run-All.ps1
#
# Every scenario below is a state an operator can actually reach. The scripts' own statements
# run; only psql, the credential store and the console prompt are doubled, and every file lands
# in a temporary directory. Nothing here contacts PostgreSQL or writes to Windows Credential
# Manager. A failing assertion names the scenario and stops that file's run.
#
# Exit code: 0 when every scenario passed, 1 when one failed.

[CmdletBinding()]
param([switch]$ContinueOnFailure)

$ErrorActionPreference = 'Stop'
$script:DbDir = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$script:Failures = New-Object System.Collections.ArrayList
$script:Checks = 0

function Test-Name([string]$Name) {
  if (-not $Name) { throw 'Every scenario needs a name.' }
}

function Assert-True([object]$Condition, [string]$Name, [string]$Detail = '') {
  $script:Checks++
  if (-not $Condition) {
    [void]$script:Failures.Add("$Name`: $Detail")
    Write-Host "  FAIL $Name - $Detail" -ForegroundColor Red
  }
}

function Assert-Match([string]$Text, [string]$Pattern, [string]$Name) {
  Assert-True ($Text -match $Pattern) $Name "output does not match /$Pattern/"
}

function Assert-NoPassword([string]$Text, [string]$Secret, [string]$Name) {
  Assert-True (-not $Text.Contains($Secret)) $Name 'the password appears in the output'
}

# --- Shared fixtures -----------------------------------------------------------------------

$AppRole = 'tryoutsim_app'
$MigratorRole = 'tryoutsim_migrator'
$Targets = @{ $AppRole = "tryoutsim/$AppRole"; $MigratorRole = "tryoutsim/$MigratorRole" }
$Stored = @{ "tryoutsim/$AppRole" = 'app-secret'; "tryoutsim/$MigratorRole" = 'migrator-secret' }

# The scenario's own parameters, bound by name. Every script parameter is present, because the
# scenario runs its parameter block and nothing else supplies a default.
$Base = @{
  Database = 'tryoutsim'; AppRole = $AppRole; MigratorRole = $MigratorRole
  SuperUser = 'postgres'; HostName = '127.0.0.1'; Port = 5432; PsqlPath = ''
  OutFile = 'db.env'; AppPort = ''; Role = $AppRole
}

function Bound([hashtable]$Overrides = @{}) {
  <# The base parameters with a scenario's own values on top. #>
  $parameters = $Base.Clone()
  foreach ($key in $Overrides.Keys) { $parameters[$key] = $Overrides[$key] }
  return $parameters
}

# Answers a healthy server: roles exist (Roles), the database exists (Database).
function Psql-Healthy([string[]]$Roles = @($AppRole, $MigratorRole), [bool]$Database = $true) {
  return @(
    @{ Sql = 'FROM pg_roles'; Rows = $Roles },
    @{ Sql = 'FROM pg_database'; Rows = $(if ($Database) { @('tryoutsim') } else { @() }) }
  )
}

. (Join-Path $PSScriptRoot '..\ProvisioningCommon.ps1')
. (Join-Path $PSScriptRoot '..\CredentialStore.ps1')
. (Join-Path $PSScriptRoot 'Double.ps1')
. (Join-Path $PSScriptRoot 'Scenario.ps1')

# --- provision.ps1 -------------------------------------------------------------------------

$r = Invoke-ProvisioningScenario -Script 'Provision.ps1' -StdIn '' -Psql (Psql-Healthy) -Store $Stored -Bound (Bound)
Assert-True ($null -ne $r.Threw) 'preflight: empty password stops the run'
Assert-Match $r.Message 'superuser password is empty' 'preflight: empty password stops the run'
Assert-True ($r.Calls.Count -eq 0) 'preflight: empty password stops the run' 'no statement reached the server'
Assert-True ($r.Writes -eq 0) 'preflight: empty password stops the run' 'nothing was written to the store'

$r = Invoke-ProvisioningScenario -Script 'Provision.ps1' -Psql (Psql-Healthy) -Store $Stored -CredMode 'readfail' -Bound (Bound)
Assert-Match $r.Message 'could not be read' 'credential read failure is named'
Assert-Match $r.Message 'Access is denied' 'credential read failure is named'
Assert-True (-not ($r.Message -match 'No password is stored')) 'credential read failure is named' 'reported as a store error, not as a missing credential'

$r = Invoke-ProvisioningScenario -Script 'Provision.ps1' -Psql (Psql-Healthy) -Store @{} -CredMode 'writefail' -Bound (Bound)
Assert-Match $r.Message 'Could not store the password for tryoutsim_migrator' 'credential write failure stops role creation'
Assert-True (-not ($r.Calls -match 'CREATE ROLE')) 'credential write failure stops role creation' 'no CREATE ROLE was issued'
Assert-NoPassword $r.Output 'superuser-secret' 'credential write failure stops role creation'

$r = Invoke-ProvisioningScenario -Script 'Provision.ps1' -Psql (Psql-Healthy) -Store @{} -Bound (Bound)
Assert-True ($null -eq $r.Threw) 'fresh machine: both roles created' "unexpected failure: $($r.Message)"
Assert-True (($r.Calls | Where-Object { $_ -match 'CREATE ROLE tryoutsim_migrator' }).Count -eq 1) 'fresh machine: both roles created' 'migrator CREATE ROLE'
Assert-True (($r.Calls | Where-Object { $_ -match 'CREATE ROLE tryoutsim_app' }).Count -eq 1) 'fresh machine: both roles created' 'app CREATE ROLE'
Assert-True ($r.Store.Count -eq 2) 'fresh machine: both roles created' 'both passwords stored'
Assert-True ($r.Store[$Targets[$AppRole]] -match '^[A-Za-z0-9_-]{43}$') 'fresh machine: both roles created' 'stored password has the generated shape'
Assert-True ($r.Store[$Targets[$AppRole]] -ne $r.Store[$Targets[$MigratorRole]]) 'fresh machine: both roles created' 'the two passwords differ'
Assert-Match ($r.Calls -join "`n") 'CREATE DATABASE tryoutsim OWNER tryoutsim_migrator' 'fresh machine: both roles created'
Assert-Match ($r.Calls -join "`n") 'GRANT CONNECT, TEMPORARY ON DATABASE tryoutsim TO tryoutsim_app, tryoutsim_migrator' 'fresh machine: both roles created'
Assert-NoPassword $r.Output 'superuser-secret' 'fresh machine: both roles created'
Assert-NoPassword ($r.Calls -join "`n") 'superuser-secret' 'fresh machine: both roles created'

$r = Invoke-ProvisioningScenario -Script 'Provision.ps1' -Psql (Psql-Healthy) -Store $Stored -Bound (Bound)
Assert-True ($null -eq $r.Threw) 're-run: nothing replaced' "$($r.Message)"
Assert-True (-not ($r.Calls -match 'CREATE ROLE')) 're-run: nothing replaced' 'no role was created again'
Assert-True ($r.Writes -eq 0) 're-run: nothing replaced' 'no password was overwritten'
Assert-True ($r.Store[$Targets[$AppRole]] -eq 'app-secret' -and $r.Store[$Targets[$MigratorRole]] -eq 'migrator-secret') 're-run: nothing replaced' 'stored passwords unchanged'
Assert-Match $r.Output 'already exists and its password is stored' 're-run: nothing replaced'

$createFailed = @(
  @{ Sql = 'FROM pg_roles'; Rows = @() },
  @{ Sql = 'CREATE ROLE tryoutsim_migrator'; Throw = 'role is reserved' }
)
$r = Invoke-ProvisioningScenario -Script 'Provision.ps1' -Psql $createFailed -Store @{} -Bound (Bound)
Assert-Match $r.Message 'Creating tryoutsim_migrator failed' 'CREATE ROLE failure: credential kept, recovery stated'
Assert-Match $r.Message 'already stored' 'CREATE ROLE failure: credential kept, recovery stated'
Assert-Match $r.Message 're-run' 'CREATE ROLE failure: credential kept, recovery stated'
Assert-True ($r.Store.ContainsKey($Targets[$MigratorRole]) -and $r.Store[$Targets[$MigratorRole]] -match '^[A-Za-z0-9_-]{43}$') 'CREATE ROLE failure: credential kept, recovery stated' 'the generated password is stored'
Assert-True (-not $r.Store.ContainsKey($Targets[$AppRole])) 'CREATE ROLE failure: credential kept, recovery stated' 'the second role was not attempted'

# Recovery: the run failed after storing the migrator password; the role now does not exist.
$r = Invoke-ProvisioningScenario -Script 'Provision.ps1' -Psql (Psql-Healthy -Roles @($AppRole)) -Store @{ $Targets[$MigratorRole] = 'kept-secret' } -Bound (Bound)
Assert-True ($null -eq $r.Threw) 'recovery: a stale credential is reused, not replaced' "$($r.Message)"
Assert-True (($r.Calls | Where-Object { $_ -match 'CREATE ROLE tryoutsim_migrator' }).Count -eq 1) 'recovery: a stale credential is reused, not replaced' 'the missing role was created'
Assert-True ($r.Store[$Targets[$MigratorRole]] -eq 'kept-secret') 'recovery: a stale credential is reused, not replaced' 'the stored password was kept, not replaced'
Assert-Match $r.Calls[-1] 'GRANT CONNECT' 'recovery: a stale credential is reused, not replaced'

$r = Invoke-ProvisioningScenario -Script 'Provision.ps1' -Psql (Psql-Healthy) -Store @{ $Targets[$AppRole] = 'app-secret' } -Bound (Bound)
Assert-Match $r.Message 'tryoutsim_migrator already exist' 'role without a credential stops instead of guessing'
Assert-Match $r.Message '-ResetPassword' 'role without a credential stops instead of guessing'
Assert-True (-not ($r.Calls -match 'CREATE ROLE|CREATE DATABASE|ALTER ROLE')) 'role without a credential stops instead of guessing' 'nothing was changed'
Assert-True ($r.Writes -eq 0) 'role without a credential stops instead of guessing' 'nothing was written to the store'

$r = Invoke-ProvisioningScenario -Script 'Provision.ps1' -Psql (Psql-Healthy) -Store @{ $Targets[$AppRole] = 'app-secret' } -Bound (Bound @{ ResetPassword = $true })
Assert-True ($null -eq $r.Threw) '-ResetPassword recovers the role' "$($r.Message)"
Assert-True (($r.Calls | Where-Object { $_ -match 'ALTER ROLE tryoutsim_migrator PASSWORD' }).Count -eq 1) '-ResetPassword recovers the role' 'one ALTER ROLE'
Assert-Match $r.Calls[0] 'ALTER ROLE tryoutsim_migrator PASSWORD' '-ResetPassword recovers the role' 'the reset is the first change issued'
Assert-True ($r.Store[$Targets[$MigratorRole]] -match '^[A-Za-z0-9_-]{43}$') '-ResetPassword recovers the role' 'a new password was stored'
Assert-True (-not ($r.Calls -match 'tryoutsim_app PASSWORD')) '-ResetPassword recovers the role' 'the healthy role was not touched'

$r = Invoke-ProvisioningScenario -Script 'Provision.ps1' -Psql (Psql-Healthy) -Store @{ $Targets[$MigratorRole] = 'x' } -Bound (Bound @{ MigratorRole = 'tryoutsim app; DROP ROLE postgres; --' })
Assert-Match $r.Message 'not a plain identifier' 'an unsafe identifier never reaches SQL'
Assert-True ($r.Calls.Count -eq 0) 'an unsafe identifier never reaches SQL' 'no statement was issued'

# --- make-env.ps1 --------------------------------------------------------------------------

$r = Invoke-ProvisioningScenario -Script 'Make-Env.ps1' -Store $Stored -Bound (Bound @{ OutFile = 'sub\db.env' })
Assert-True ($null -eq $r.Threw) 'db.env: written' "$($r.Message)"
$envPath = Join-Path $r.Work 'sub\db.env'
Assert-True (Test-Path -LiteralPath $envPath) 'db.env: written' 'file exists'
$bytes = [System.IO.File]::ReadAllBytes($envPath)
Assert-True (-not ($bytes.Length -ge 3 -and $bytes[0] -eq 0xEF -and $bytes[1] -eq 0xBB -and $bytes[2] -eq 0xBF)) 'db.env: written' 'no BOM'
$text = [System.IO.File]::ReadAllText($envPath)
Assert-Match $text '^# Generated by db/make-env\.ps1' 'db.env: written'
$text = [System.IO.File]::ReadAllText($envPath)
Assert-Match $text 'DATABASE_URL_APP=postgresql://tryoutsim_app:app-secret@127\.0\.0\.1:5432/tryoutsim\?schema=public' 'db.env: written'
Assert-Match $text 'DATABASE_URL=postgresql://tryoutsim_migrator:migrator-secret@127\.0\.0\.1:5432/tryoutsim\?schema=public' 'db.env: written'
Assert-Match $text 'PORT=4317' 'db.env: written'
$loaded = @{}
foreach ($line in ($text -split "`n")) { if ($line -match '^([A-Z_]+)=(.*)$') { $loaded[$matches[1]] = $matches[2] } }
Assert-True ($loaded.Keys.Count -eq 3) 'db.env: written' 'the documented loader finds every line, including the first'
$acl = Get-Acl -LiteralPath $envPath
Assert-True $acl.AreAccessRulesProtected 'db.env: owner-only' 'inheritance is off'
$me = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
$owners = @($acl.Access | Where-Object { $_.AccessControlType -eq 'Allow' })
Assert-True ($owners.Count -eq 1 -and $owners[0].IdentityReference.Value -eq $me) 'db.env: owner-only' "one allow entry, the current user (found: $($owners.IdentityReference -join ', '))"
Assert-NoPassword $r.Output 'app-secret' 'db.env: no password on the console'
Remove-Scenario $r

$specialStore = @{ "tryoutsim/tryoutsim_app" = "p@ss:w/rd%#?"; "tryoutsim/tryoutsim_migrator" = 'm' }
$r = Invoke-ProvisioningScenario -Script 'Make-Env.ps1' -Store $specialStore -Bound (Bound @{ OutFile = 'db.env'; HostName = 'db.example'; AppPort = '8080' })
Assert-True ($null -eq $r.Threw) 'db.env: password metacharacters are encoded' "$($r.Message)"
$text = [System.IO.File]::ReadAllText((Join-Path $r.Work 'db.env'))
Assert-Match $text 'tryoutsim_app:p%40ss%3Aw%2Frd%25%23%3F@db\.example:5432' 'db.env: password metacharacters are encoded'
Assert-Match $text 'PORT=8080' 'db.env: password metacharacters are encoded'
Assert-NoPassword $r.Output 'p@ss:w/rd%#?' 'db.env: password metacharacters are encoded'
Remove-Scenario $r

$r = Invoke-ProvisioningScenario -Script 'Make-Env.ps1' -Store $Stored -Bound (Bound @{ OutFile = 'db.env' }) -CredMode 'readfail'
Assert-Match $r.Message 'could not be read' 'db.env: a store failure is not a missing credential'
Assert-True (-not (Test-Path -LiteralPath (Join-Path $r.Work 'db.env'))) 'db.env: a store failure is not a missing credential' 'no file was written'
Remove-Scenario $r

$r = Invoke-ProvisioningScenario -Script 'Make-Env.ps1' -Store @{ "tryoutsim/tryoutsim_app" = 'app-secret' } -Bound (Bound @{ OutFile = 'db.env' })
Assert-Match $r.Message 'No password is stored for' 'db.env: a missing credential names provision.ps1'
Assert-Match $r.Message 'provision\.ps1' 'db.env: a missing credential names provision.ps1'
Remove-Scenario $r

$r = Invoke-ProvisioningScenario -Script 'Make-Env.ps1' -Store $Stored -Bound (Bound @{ OutFile = (Join-Path $script:DbDir '..\db.env') })
Assert-Match $r.Message 'inside the repository' 'db.env: refuses a destination inside the repository'
Remove-Scenario $r

# --- Reset-Password.ps1 --------------------------------------------------------------------

$r = Invoke-ProvisioningScenario -Script 'Reset-Password.ps1' -Psql (Psql-Healthy) -Store $Stored -Bound (Bound @{ Role = $AppRole })
Assert-True ($null -eq $r.Threw) 'Reset-Password: stores then applies' "$($r.Message)"
Assert-True (($r.Calls | Where-Object { $_ -match 'ALTER ROLE tryoutsim_app PASSWORD' }).Count -eq 1) 'Reset-Password: stores then applies' 'one ALTER ROLE'
Assert-True ($r.Store[$Targets[$AppRole]] -match '^[A-Za-z0-9_-]{43}$') 'Reset-Password: stores then applies' 'new password stored'
Assert-NoPassword $r.Output 'superuser-secret' 'Reset-Password: stores then applies'

$r = Invoke-ProvisioningScenario -Script 'Reset-Password.ps1' -Psql (Psql-Healthy) -Store $Stored -CredMode 'writefail' -Bound (Bound @{ Role = $AppRole })
Assert-Match $r.Message 'Could not store the new password' 'Reset-Password: a store failure leaves the old password'
Assert-True (-not ($r.Calls -match 'ALTER ROLE')) 'Reset-Password: a store failure leaves the old password' 'no password was changed'

$r = Invoke-ProvisioningScenario -Script 'Reset-Password.ps1' -Psql (Psql-Healthy -Roles @()) -Store $Stored -Bound (Bound @{ Role = $AppRole })
Assert-Match $r.Message 'does not exist' 'Reset-Password: a missing role is named'
Assert-True (-not ($r.Calls -match 'ALTER ROLE')) 'Reset-Password: a missing role is named' 'nothing was changed'

$r = Invoke-ProvisioningScenario -Script 'Reset-Password.ps1' -Psql (Psql-Healthy) -Store $Stored -Bound (Bound @{ Role = 'tryoutsim app' })
Assert-Match $r.Message 'not a plain identifier' 'Reset-Password: an unsafe role name is refused'

# --- Report --------------------------------------------------------------------------------

Write-Host ''
Write-Host "Scenarios: $($script:Checks) checks, $(@($script:Failures).Count) failed."
if (@($script:Failures).Count -gt 0) {
  foreach ($failure in $script:Failures) { Write-Host "  - $failure" -ForegroundColor Red }
  exit 1
}
exit 0
