# Failure and recovery scenarios for db/provision.ps1, db/Reset-Password.ps1, db/Set-Secret.ps1
# and db/Load-Env.ps1.
#
# Run one file at a time, because the doubles replace module-scoped state:
#   powershell -NoProfile -File db\tests\Run-All.ps1
#   pwsh -NoProfile -File db\tests\Run-All.ps1
#
# Every scenario below is a state an operator can actually reach. The scripts' own statements
# run; only psql is doubled, and every file lands in a temporary directory. Nothing here
# contacts PostgreSQL. A failing assertion names the scenario and stops that file's run.
#
# Exit code: 0 when every scenario passed, 1 when one failed.

[CmdletBinding()]
param([switch]$ContinueOnFailure)

$ErrorActionPreference = 'Stop'
$script:DbDir = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$script:Failures = New-Object System.Collections.ArrayList
$script:Checks = 0

function Assert-True([object]$Condition, [string]$Name, [string]$Detail = '') {
  $script:Checks++
  if (-not $Condition) {
    [void]$script:Failures.Add("$Name`: $Detail")
    Write-Host "  FAIL $Name - $Detail" -ForegroundColor Red
  }
}

function Assert-Match([string]$Text, [string]$Pattern, [string]$Name, [string]$Detail = '') {
  # Out-String wraps long lines at the console width; the assertions are about wording, so the
  # line breaks are flattened away first.
  # A wrapped word is split across the break, so the breaks are removed, not turned into spaces.
  $flat = "$Text".Replace("`r", '').Replace("`n", '')
  Assert-True ($flat -match $Pattern) $Name $(if ($Detail) { "$Detail (no match for /$Pattern/)" } else { "output does not match /$Pattern/" })
}

function Assert-NoSecret([string]$Text, [string]$Secret, [string]$Name) {
  <# Requirement 8: no generated password or connection string reaches the console. #>
  Assert-True (-not $Text.Contains($Secret)) $Name 'a password appears in the output'
}

# --- Shared fixtures -----------------------------------------------------------------------

$AppRole = 'tryoutsim_app'
$MigratorRole = 'tryoutsim_migrator'
$AppUrl = 'postgresql://tryoutsim_app:app-secret@127.0.0.1:5432/tryoutsim'
$MigratorUrl = 'postgresql://tryoutsim_migrator:migrator-secret@127.0.0.1:5432/tryoutsim'
$Both = @("DATABASE_URL=`"$MigratorUrl`"", "DATABASE_URL_APP=`"$AppUrl`"", 'NODE_ENV=development', 'PORT=4317')

# The scenario's own parameters, bound by name. Every script parameter is present, because the
# scenario runs its parameter block and nothing else supplies a default. -EnvFile is a script
# block evaluated in the test's frame (it reads $EnvPath), so every script's environment file is
# the scenario's own: the real D:\tryoutsim\.env is never read or written.
$Base = @{
  Database = 'tryoutsim'; AppRole = $AppRole; MigratorRole = $MigratorRole
  SuperUser = 'postgres'; HostName = '127.0.0.1'; Port = 5432; PsqlPath = ''
  EnvFile = { $EnvPath }; Role = $AppRole; Name = 'DATABASE_URL_APP'; Value = ''; Path = ''
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

function EnvLine {
  <# The value of one line of the scenario's environment file, quotes removed, '' when absent. #>
  param($Result, [string]$Key)
  # The file is written with CRLF line endings: the trailing CR belongs to the line ending.
  foreach ($line in ("$($Result.EnvText)" -split "`n")) {
    $line = $line.TrimEnd("`r")
    if ($line -match "^$Key=(.*)$") {
      $value = $matches[1]
      if ($value.Length -ge 2 -and $value.StartsWith('"') -and $value.EndsWith('"')) { return $value.Substring(1, $value.Length - 2) }
      return $value
    }
  }
  return ''
}

. (Join-Path $PSScriptRoot '..\ProvisioningCommon.ps1')
. (Join-Path $PSScriptRoot 'Double.ps1')
. (Join-Path $PSScriptRoot 'Scenario.ps1')

# --- provision.ps1 -------------------------------------------------------------------------

$r = Invoke-ProvisioningScenario -Script 'Provision.ps1' -StdIn '' -Psql (Psql-Healthy) -Bound (Bound)
Assert-True ($null -ne $r.Threw) 'an empty console password stops the run'
Assert-Match $r.Message 'superuser password is empty' 'an empty console password stops the run'
Assert-True ($r.Calls.Count -eq 0) 'an empty console password stops the run' 'no statement reached the server'
Remove-Scenario $r

# A file Git would commit is refused: the repository's own .env is ignored, this one is not.
$inside = Join-Path $script:DbDir '..\inside-the-repo.env'
$r = Invoke-ProvisioningScenario -Script 'Provision.ps1' -Psql @() -Bound (Bound @{ EnvFile = $inside })
Assert-True ($null -ne $r.Threw) 'a file Git does not ignore is refused'
Assert-Match $r.Message 'Git does not ignore it' 'a file Git does not ignore is refused'
Assert-True (-not (Test-Path -LiteralPath $inside)) 'a file Git does not ignore is refused' 'no file was created there'
Assert-True ($r.Calls.Count -eq 0) 'a file Git does not ignore is refused' 'no statement was issued'
Remove-Scenario $r

# A fresh machine: neither role and no database yet.
$r = Invoke-ProvisioningScenario -Script 'Provision.ps1' -Psql (Psql-Healthy -Roles @() -Database $false) -EnvLines @('NODE_ENV=development') -Bound (Bound)
Assert-True ($null -eq $r.Threw) 'fresh machine: both roles created' "unexpected failure: $($r.Message)"
Assert-True (($r.Calls | Where-Object { $_ -match 'CREATE ROLE tryoutsim_migrator' }).Count -eq 1) 'fresh machine: both roles created' 'migrator CREATE ROLE'
Assert-True (($r.Calls | Where-Object { $_ -match 'CREATE ROLE tryoutsim_app' }).Count -eq 1) 'fresh machine: both roles created' 'app CREATE ROLE'
$writtenApp = EnvLine $r 'DATABASE_URL_APP'
$writtenMigrator = EnvLine $r 'DATABASE_URL'
Assert-Match $writtenApp '^postgresql://tryoutsim_app\:[A-Za-z0-9_-]{43}@127\.0\.0\.1\:5432/tryoutsim$' 'fresh machine: both roles created' "app URL in the file (found: $writtenApp)" 
Assert-Match $writtenMigrator '^postgresql://tryoutsim_migrator\:[A-Za-z0-9_-]{43}@127\.0\.0\.1\:5432/tryoutsim$' 'fresh machine: both roles created' "migrator URL in the file (found: $writtenMigrator)" 
Assert-True ($writtenApp -ne $writtenMigrator) 'fresh machine: both roles created' 'the two passwords differ'
$appSecret = Get-UrlPassword -Url $writtenApp
Assert-True ($r.Calls -join "`n" -match "tryoutsim_app LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE PASSWORD '$([regex]::Escape($appSecret))'") 'fresh machine: both roles created' 'the role gets the password the file holds'
Assert-Match ($r.Calls -join "`n") 'CREATE DATABASE tryoutsim OWNER tryoutsim_migrator' 'fresh machine: both roles created'
Assert-Match ($r.Calls -join "`n") 'GRANT CONNECT, TEMPORARY ON DATABASE tryoutsim TO tryoutsim_app, tryoutsim_migrator' 'fresh machine: both roles created'
Assert-Match ($r.EnvText) 'NODE_ENV=development' 'fresh machine: both roles created' 'NODE_ENV carried over'
Assert-NoSecret $r.Output 'superuser-secret' 'fresh machine: both roles created'
Assert-NoSecret $r.Output $appSecret 'fresh machine: both roles created'
Remove-Scenario $r

$r = Invoke-ProvisioningScenario -Script 'Provision.ps1' -Psql (Psql-Healthy) -EnvLines $Both -Bound (Bound)
Assert-True ($null -eq $r.Threw) 're-run: nothing replaced' "$($r.Message)"
Assert-True (-not ($r.Calls -match 'CREATE ROLE|ALTER ROLE PASSWORD')) 're-run: nothing replaced' 'no role was created and no password replaced'
Assert-Match ($r.Calls -join "`n") 'ALTER ROLE tryoutsim_migrator CREATEDB' 're-run: nothing replaced' 'idempotent attributes/grant statements still run'
Assert-True ((EnvLine $r 'DATABASE_URL_APP') -eq $AppUrl) 're-run: nothing replaced' 'the app URL is unchanged'
Assert-True ((EnvLine $r 'DATABASE_URL') -eq $MigratorUrl) 're-run: nothing replaced' 'the migrator URL is unchanged'
Assert-Match $r.Output 'Role tryoutsim_migrator already exists and its connection string is in the environment file' 're-run: nothing replaced'
Remove-Scenario $r

$createFailed = @(
  @{ Sql = 'FROM pg_roles'; Rows = @() },
  @{ Sql = 'CREATE ROLE tryoutsim_migrator'; Throw = 'role is reserved' }
)
$r = Invoke-ProvisioningScenario -Script 'Provision.ps1' -Psql $createFailed -EnvLines @('NODE_ENV=development') -Bound (Bound)
Assert-Match $r.Message 'Creating tryoutsim_migrator failed' 'CREATE ROLE failure: the URL is kept'
Assert-Match $r.Message 'connection string is already in' 'CREATE ROLE failure: the URL is kept'
Assert-Match $r.Message 're-run' 'CREATE ROLE failure: the URL is kept'
Assert-Match (EnvLine $r 'DATABASE_URL') '^postgresql://tryoutsim_migrator\:[A-Za-z0-9_-]{43}@' 'CREATE ROLE failure: the URL is kept' 'the generated URL is in the file'
Assert-True ((EnvLine $r 'DATABASE_URL_APP') -eq '') 'CREATE ROLE failure: the URL is kept' 'the second role was not attempted'
Remove-Scenario $r

# Recovery: the run failed after writing the migrator URL; the role now does not exist.
$keptUrl = 'postgresql://tryoutsim_migrator:kept-secret@127.0.0.1:5432/tryoutsim'
$r = Invoke-ProvisioningScenario -Script 'Provision.ps1' -Psql (Psql-Healthy -Roles @($AppRole)) -EnvLines @("DATABASE_URL=`"$keptUrl`"", "DATABASE_URL_APP=`"$AppUrl`"") -Bound (Bound)
Assert-True ($null -eq $r.Threw) 'recovery: a stale URL is reused, not replaced' "$($r.Message)"
Assert-True (($r.Calls | Where-Object { $_ -match "CREATE ROLE tryoutsim_migrator LOGIN .* PASSWORD 'kept-secret'" }).Count -eq 1) 'recovery: a stale URL is reused, not replaced' 'the missing role was created with the file password'
Assert-True ((EnvLine $r 'DATABASE_URL') -eq $keptUrl) 'recovery: a stale URL is reused, not replaced' 'the URL was kept, not replaced'
Assert-Match (@($r.Calls | Where-Object { $_ -match '^REVOKE|^GRANT' })[-1]) 'GRANT CONNECT' 'recovery: a stale URL is reused, not replaced' 'grants are re-applied after the roles'
Remove-Scenario $r

# A URL whose user is another role does not prove its own role's password.
# A URL whose user is another role does not prove this role's password: it is treated as absent,
# and the role is created with a fresh password of its own.
$swapped = 'postgresql://tryoutsim_migrator:app-secret@127.0.0.1:5432/tryoutsim'
$r = Invoke-ProvisioningScenario -Script 'Provision.ps1' -Psql (Psql-Healthy -Roles @($MigratorRole)) -EnvLines @("DATABASE_URL_APP=`"$swapped`"", "DATABASE_URL=`"$MigratorUrl`"", 'NODE_ENV=development') -Bound (Bound)
Assert-True ($null -eq $r.Threw) 'a URL for another user is treated as absent' "$($r.Message)"
Assert-True ((@($r.Calls | Where-Object { $_ -match '^CREATE ROLE tryoutsim_app ' })).Count -eq 1) 'a URL for another user is treated as absent' 'the app role was created'
Assert-Match @($r.Calls | Where-Object { $_ -match '^CREATE ROLE tryoutsim_app ' })[0] "PASSWORD '(?!app-secret)" 'a URL for another user is treated as absent' 'not created with the other role password'
Assert-Match (EnvLine $r 'DATABASE_URL_APP') '^postgresql://tryoutsim_app\:[A-Za-z0-9_-]{43}@' 'a URL for another user is treated as absent' 'the file now names the app role'
Remove-Scenario $r

# Both roles exist, and the file (just created) has no URL for either.
$r = Invoke-ProvisioningScenario -Script 'Provision.ps1' -Psql (Psql-Healthy) -EnvLines @('NODE_ENV=development') -Bound (Bound)
Assert-Match $r.Message 'already exist' 'role without a URL stops instead of guessing'
Assert-Match $r.Message '-ResetPassword' 'role without a URL stops instead of guessing'
Assert-Match $r.Message 'Set DATABASE_URL_APP and DATABASE_URL in that file first' 'role without a URL stops instead of guessing' 'the manual route is named'
Assert-True (@($r.Calls | Where-Object { $_ -match 'CREATE ROLE|CREATE DATABASE|ALTER ROLE' }).Count -eq 0) 'role without a URL stops instead of guessing' 'nothing was changed'
Assert-True (@($r.Calls | Where-Object { $_ -match 'FROM pg_roles' }).Count -eq 1) 'role without a URL stops instead of guessing' 'only the read ran'
Remove-Scenario $r

$r = Invoke-ProvisioningScenario -Script 'Provision.ps1' -Psql (Psql-Healthy) -EnvLines @("DATABASE_URL_APP=`"$AppUrl`"", 'DATABASE_URL=', 'NODE_ENV=development') -Bound (Bound @{ ResetPassword = $true })
Assert-True ($null -eq $r.Threw) '-ResetPassword recovers the role' "$($r.Message)"
Assert-True (($r.Calls | Where-Object { $_ -match 'ALTER ROLE tryoutsim_migrator PASSWORD' }).Count -eq 1) '-ResetPassword recovers the role' 'one ALTER ROLE'
$firstChange = @($r.Calls | Where-Object { $_ -match '^(CREATE|ALTER|DROP|REVOKE|GRANT)' })
Assert-Match $firstChange[0] 'ALTER ROLE tryoutsim_migrator PASSWORD' '-ResetPassword recovers the role' 'the reset is the first change issued'
Assert-Match (EnvLine $r 'DATABASE_URL') '^postgresql://tryoutsim_migrator\:[A-Za-z0-9_-]{43}@' '-ResetPassword recovers the role' 'a new URL was written'
$alterReset = @($r.Calls | Where-Object { $_ -match '^ALTER ROLE tryoutsim_migrator PASSWORD' })[0]
Assert-Match $alterReset ([regex]::Escape("PASSWORD '" + (Get-UrlPassword -Url (EnvLine $r 'DATABASE_URL')) + "'")) '-ResetPassword recovers the role' 'ALTER ROLE applied the URL password'
Assert-True (-not ($r.Calls -match 'tryoutsim_app PASSWORD')) '-ResetPassword recovers the role' 'the healthy role was not touched'
Remove-Scenario $r

$r = Invoke-ProvisioningScenario -Script 'Provision.ps1' -Psql (Psql-Healthy) -EnvLines @("DATABASE_URL_APP=`"$AppUrl`"", 'DATABASE_URL="postgresql://tryoutsim_migrator:pa:ss@127.0.0.1:5432/tryoutsim"') -Bound (Bound)
Assert-Match $r.Message 'DATABASE_URL in' 'a broken connection string is refused before any change'
Assert-Match $r.Message 'percent-encode' 'a broken connection string is refused before any change'
Assert-True (-not ($r.Calls -match 'CREATE ROLE|ALTER ROLE')) 'a broken connection string is refused before any change' 'nothing was changed'
Remove-Scenario $r

$r = Invoke-ProvisioningScenario -Script 'Provision.ps1' -Psql (Psql-Healthy) -EnvLines @("DATABASE_URL_APP=`"$AppUrl`"", "DATABASE_URL=`"$AppUrl`"") -Bound (Bound)
Assert-Match $r.Message 'must keep separate connection strings' 'the two roles never share one connection string'
Remove-Scenario $r

$r = Invoke-ProvisioningScenario -Script 'Provision.ps1' -Psql (Psql-Healthy) -EnvLines $Both -Bound (Bound @{ MigratorRole = 'tryoutsim app; DROP ROLE postgres; --' })
Assert-Match $r.Message 'not a plain identifier' 'an unsafe identifier never reaches SQL'
Assert-True ($r.Calls.Count -eq 0) 'an unsafe identifier never reaches SQL' 'no statement was issued'
Remove-Scenario $r

# --- Reset-Password.ps1 --------------------------------------------------------------------

$r = Invoke-ProvisioningScenario -Script 'Reset-Password.ps1' -Psql (Psql-Healthy) -EnvLines $Both -Bound (Bound @{ Role = $AppRole })
Assert-True ($null -eq $r.Threw) 'Reset-Password: writes the URL then applies' "$($r.Message)"
Assert-True (($r.Calls | Where-Object { $_ -match 'ALTER ROLE tryoutsim_app PASSWORD' }).Count -eq 1) 'Reset-Password: writes the URL then applies' 'one ALTER ROLE'
$newAppUrl = EnvLine $r 'DATABASE_URL_APP'
Assert-Match $newAppUrl '^postgresql://tryoutsim_app\:[A-Za-z0-9_-]{43}@' 'Reset-Password: writes the URL then applies' 'a new app URL was written'
$alterApp = @($r.Calls | Where-Object { $_ -match '^ALTER ROLE tryoutsim_app PASSWORD' })[0]
Assert-Match $alterApp ([regex]::Escape("PASSWORD '" + (Get-UrlPassword -Url $newAppUrl) + "'")) 'Reset-Password: writes the URL then applies' 'ALTER ROLE applied the URL password'
Assert-True ((EnvLine $r 'DATABASE_URL') -eq $MigratorUrl) 'Reset-Password: writes the URL then applies' 'the migrator URL was not touched'
Assert-NoSecret $r.Output 'superuser-secret' 'Reset-Password: writes the URL then applies'
Assert-NoSecret $r.Output (Get-UrlPassword -Url $newAppUrl) 'Reset-Password: writes the URL then applies'
Remove-Scenario $r

$r = Invoke-ProvisioningScenario -Script 'Reset-Password.ps1' -Psql (Psql-Healthy -Roles @()) -EnvLines $Both -Bound (Bound @{ Role = $AppRole })
Assert-Match $r.Message 'does not exist' 'Reset-Password: a missing role is named'
Assert-True (-not ($r.Calls -match 'ALTER ROLE')) 'Reset-Password: a missing role is named' 'nothing was changed'
Assert-True ((EnvLine $r 'DATABASE_URL_APP') -eq $AppUrl) 'Reset-Password: a missing role is named' 'the file was not changed'
Remove-Scenario $r

$r = Invoke-ProvisioningScenario -Script 'Reset-Password.ps1' -Psql (Psql-Healthy) -EnvLines $Both -Bound (Bound @{ Role = 'postgres' })
Assert-True ($null -ne $r.Threw) 'Reset-Password: only the two application roles are accepted'
Assert-True (-not ($r.Calls -match 'ALTER ROLE')) 'Reset-Password: only the two application roles are accepted' 'nothing was changed'
Remove-Scenario $r

# --- Set-Secret.ps1 ------------------------------------------------------------------------

$r = Invoke-ProvisioningScenario -Script 'Set-Secret.ps1' -Psql @() -EnvLines @('NODE_ENV=development') -Bound (Bound @{ Name = 'DATABASE_URL_APP'; Value = 'postgresql://tryoutsim_app:n%40te@127.0.0.1:5432/tryoutsim' })
Assert-True ($null -eq $r.Threw) 'Set-Secret: an encoded URL is stored' "$($r.Message)"
Assert-True ((EnvLine $r 'DATABASE_URL_APP') -eq 'postgresql://tryoutsim_app:n%40te@127.0.0.1:5432/tryoutsim') 'Set-Secret: an encoded URL is stored'
Assert-Match $r.EnvText 'NODE_ENV=development' 'Set-Secret: an encoded URL is stored' 'NODE_ENV carried over'
Assert-NoSecret $r.Output 'n%40te' 'Set-Secret: an encoded URL is stored'
Remove-Scenario $r

$r = Invoke-ProvisioningScenario -Script 'Set-Secret.ps1' -Psql @() -EnvLines @('NODE_ENV=development') -Bound (Bound @{ Name = 'DATABASE_URL_APP'; Value = 'postgresql://tryoutsim_app:n/te@127.0.0.1:5432/tryoutsim' })
Assert-Match $r.Message 'not percent-encoded' 'Set-Secret: an unencoded password is refused'
Assert-True ((EnvLine $r 'DATABASE_URL_APP') -eq '') 'Set-Secret: an unencoded password is refused' 'the file was not changed'
Remove-Scenario $r

$r = Invoke-ProvisioningScenario -Script 'Set-Secret.ps1' -Psql @() -EnvLines @('NODE_ENV=development') -Bound (Bound @{ Name = 'DATABASE_URL_APP'; Value = 'postgresql://tryoutsim_migrator:x@127.0.0.1:5432/tryoutsim' })
Assert-Match $r.Message 'must name role tryoutsim_app' 'Set-Secret: a URL for the other role is refused'
Assert-Match $r.Message 'must name role tryoutsim_app' 'Set-Secret: a URL for the other role is refused'
Remove-Scenario $r

# --- Load-Env.ps1 --------------------------------------------------------------------------

$r = Invoke-ProvisioningScenario -Script 'Load-Env.ps1' -Psql @() -EnvLines $Both
Assert-True ($null -eq $r.Threw) 'Load-Env: loads the file into the environment' "$($r.Message)"
Assert-Match $r.Output 'DATABASE_URL_APP, DATABASE_URL, NODE_ENV, PORT' 'Load-Env: loads the file into the environment'
Assert-NoSecret $r.Output 'app-secret' 'Load-Env: loads the file into the environment'
Remove-Scenario $r

# A line that is not KEY=value: the reader refuses the whole file before anything is loaded.
$r = Invoke-ProvisioningScenario -Script 'Load-Env.ps1' -Psql @() -EnvLines @("DATABASE_URL=`"$MigratorUrl`"", "DATABASE_URL_APP=`"$AppUrl`"", 'NODE_ENV=development', 'PORT=4317', 'this line has no key at all')
Assert-True ($null -ne $r.Threw) 'Load-Env: a malformed file is refused'
Assert-Match $r.Message 'is not KEY=value' 'Load-Env: a malformed file is refused'
Remove-Scenario $r

# --- credentials the server does not accept ------------------------------------------------

# provision.ps1 must not report success when the file's password is not the server's: this is the
# state that made `prisma migrate deploy` fail with P1000 after a "successful" provisioning.
$r = Invoke-ProvisioningScenario -Script 'Provision.ps1' -Psql (Psql-Healthy) -EnvLines $Both -Bound (Bound) -RoleConnection 'fail'
Assert-True ($null -ne $r.Threw) 'a rejected file password stops the run'
Assert-Match $r.Message 'does not authenticate' 'a rejected file password stops the run'
Assert-Match $r.Message 'tryoutsim_migrator \(DATABASE_URL\)' 'a rejected file password stops the run' 'the failing role and its key are named'
Assert-Match $r.Message '-ResetPassword' 'a rejected file password stops the run' 'the one remedy is named'
Assert-Match $r.Message 'different password' 'a rejected file password stops the run' 'the reason is a mismatch, not a missing file'
# The idempotent privilege/grant statements still ran (re-runs always issue them); what must not
# have run is a role or password change.
Assert-True (@($r.Calls | Where-Object { $_ -match '^(CREATE ROLE|CREATE DATABASE|ALTER ROLE .* PASSWORD)' }).Count -eq 0) 'a rejected file password stops the run' 'no role or password was changed by the check'
Remove-Scenario $r

# The state that made the operator's run fail: both roles exist, both URLs are in the file, and
# the server rejects both passwords. -ResetPassword must reset BOTH roles - a stored credential
# that the server rejects is as unusable as a missing one, and used to be reported as
# "unchanged" because Get-Plan only looked at whether a URL existed.
$r = Invoke-ProvisioningScenario -Script 'Provision.ps1' -Psql (Psql-Healthy) -EnvLines $Both -Bound (Bound @{ ResetPassword = $true }) -RejectedUrls @($MigratorUrl, $AppUrl)
Assert-True ($null -eq $r.Threw) '-ResetPassword repairs a rejected password' "$($r.Message)"
foreach ($role in @($MigratorRole, $AppRole)) {
  $key = $(if ($role -eq $AppRole) { 'DATABASE_URL_APP' } else { 'DATABASE_URL' })
  $alters = @($r.Calls | Where-Object { $_ -match "^ALTER ROLE $role PASSWORD" })
  Assert-True ($alters.Count -eq 1) '-ResetPassword repairs a rejected password' "$role got exactly one ALTER ROLE, got $($alters.Count)"
  Assert-Match (EnvLine $r $key) "^postgresql://$role\:[A-Za-z0-9_-]{43}@" '-ResetPassword repairs a rejected password' "$key was rewritten"
  # The file's password and the installed one are the same value: read the file back and match
  # it against the statement that was issued.
  $written = Get-UrlPassword -Url (EnvLine $r $key)
  Assert-True ($written -ne '') '-ResetPassword repairs a rejected password' "$key holds a password"
  Assert-Match $alters[0] ([regex]::Escape("PASSWORD '" + $written + "'")) '-ResetPassword repairs a rejected password' "$role was installed with $key's password"
}
Assert-True (-not ($r.Output -match 'unchanged')) '-ResetPassword repairs a rejected password' 'neither role is reported as unchanged'
Assert-Match $r.Output 'Both role connection strings authenticate' '-ResetPassword repairs a rejected password' 'the repaired URLs were verified'
Assert-NoSecret $r.Output 'migrator-secret' '-ResetPassword repairs a rejected password' 'the old password is not printed'
Remove-Scenario $r

# Only the role the server rejects is touched; a working credential is left exactly as it was.
$r = Invoke-ProvisioningScenario -Script 'Provision.ps1' -Psql (Psql-Healthy) -EnvLines $Both -Bound (Bound @{ ResetPassword = $true }) -RejectedUrls @($MigratorUrl)
Assert-True ($null -eq $r.Threw) '-ResetPassword leaves a working role alone' "$($r.Message)"
Assert-True (@($r.Calls | Where-Object { $_ -match '^ALTER ROLE tryoutsim_migrator PASSWORD' }).Count -eq 1) '-ResetPassword leaves a working role alone' 'the rejected role was reset'
Assert-True (@($r.Calls | Where-Object { $_ -match '^ALTER ROLE tryoutsim_app PASSWORD' }).Count -eq 0) '-ResetPassword leaves a working role alone' 'the accepted role was not touched'
Assert-True ((EnvLine $r 'DATABASE_URL_APP') -eq $AppUrl) '-ResetPassword leaves a working role alone' 'the accepted URL was kept'
Remove-Scenario $r

# Mid-reset failure: the file is written before ALTER ROLE, so the run stops with the file and
# the server disagreeing in ONE direction only - the file holds a password the role does not
# have yet. The error must say so and name the retry; the next run repairs it.
$psql = (Psql-Healthy) + @(@{ Sql = '^ALTER ROLE tryoutsim_app PASSWORD'; Throw = 'role is locked' })
$r = Invoke-ProvisioningScenario -Script 'Provision.ps1' -Psql $psql -EnvLines $Both -Bound (Bound @{ ResetPassword = $true }) -RejectedUrls @($MigratorUrl, $AppUrl)
Assert-True ($null -ne $r.Threw) '-ResetPassword: a failed ALTER ROLE stops the run'
Assert-Match $r.Message 'Re-run -ResetPassword' '-ResetPassword: a failed ALTER ROLE stops the run' 'the retry is named'
Assert-Match $r.Message 'after its new connection string was written' '-ResetPassword: a failed ALTER ROLE stops the run' 'the file-first order is stated'
Assert-Match (EnvLine $r 'DATABASE_URL_APP') '^postgresql://tryoutsim_app\:[A-Za-z0-9_-]{43}@' '-ResetPassword: a failed ALTER ROLE stops the run' 'the file holds the password the retry will install'
Remove-Scenario $r

# The check runs once per role, after the grants, so it observes the finished state.
$r = Invoke-ProvisioningScenario -Script 'Provision.ps1' -Psql (Psql-Healthy) -EnvLines $Both -Bound (Bound)
Assert-True ($null -eq $r.Threw) 'an accepted file password finishes the run' "$($r.Message)"
Assert-True (@($r.Calls | Where-Object { $_ -match '^AUTH postgresql://tryoutsim_migrator' }).Count -eq 1) 'an accepted file password finishes the run' 'the migrator URL was tried'
Assert-True (@($r.Calls | Where-Object { $_ -match '^AUTH postgresql://tryoutsim_app' }).Count -eq 1) 'an accepted file password finishes the run' 'the app URL was tried'
Assert-Match $r.Output 'Both role connection strings authenticate' 'an accepted file password finishes the run'
Assert-NoSecret $r.Output 'migrator-secret' 'an accepted file password finishes the run'
Assert-NoSecret $r.Output 'app-secret' 'an accepted file password finishes the run'
Remove-Scenario $r

# --- Report --------------------------------------------------------------------------------

Write-Host ''
Write-Host "Scenarios: $($script:Checks) checks, $(@($script:Failures).Count) failed."
if (@($script:Failures).Count -gt 0) {
  foreach ($failure in $script:Failures) { Write-Host "  - $failure" -ForegroundColor Red }
  exit 1
}
exit 0
