# Pure helpers for db/provision.ps1, db/make-env.ps1, db/Reset-Password.ps1 and db/tests.
#
# Dot-source this file; it needs nothing from the environment and contacts no server, so the
# tests in db/tests can exercise every helper without PostgreSQL or a credential store.
#
# Identifiers are validated against a plain-name pattern and then emitted unquoted, so a name
# can never change a statement's shape. Values go through Quote-SqlLiteral, which doubles every
# quote the way PostgreSQL's quote_literal() does. Checked before use, because escaping inside a
# literal cannot undo a name that was never safe in the first place.

$script:NamePattern = '^[A-Za-z_][A-Za-z0-9_]{0,62}$'

function Test-SqlIdentifier {
  <# True when $Name is a plain identifier we are willing to create (no quoting needed). #>
  param([string]$Name)
  return ($null -ne $Name -and $Name -cmatch $script:NamePattern)
}

function Assert-SqlIdentifier {
  <# Throw with the accepted form when $Name is not a plain identifier. #>
  param([string]$Name, [string]$What)
  if (-not (Test-SqlIdentifier $Name)) {
    throw "$What '$Name' is not a plain identifier (letters, digits and underscore, starting with a letter or underscore, at most 63 characters)."
  }
}

function Quote-SqlLiteral {
  <# A SQL string literal that PostgreSQL parses back to exactly $Value. #>
  param([string]$Value)
  return "'" + $Value.Replace("'", "''") + "'"
}

function Get-RoleExistsSql {
  <# Statement returning each of $Names (do not exist yet) that already exists. #>
  param([string[]]$Names)
  foreach ($name in $Names) { Assert-SqlIdentifier $name 'Role name' }
  $list = ($Names | ForEach-Object { Quote-SqlLiteral $_ }) -join ', '
  return "SELECT rolname FROM pg_roles WHERE rolname IN ($list) ORDER BY rolname;"
}

function Get-CreateRoleSql {
  <# CREATE ROLE, with no privileges: those are set separately and idempotently. #>
  param([string]$Name, [string]$Password)
  Assert-SqlIdentifier $Name 'Role name'
  return "CREATE ROLE $Name LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE PASSWORD $(Quote-SqlLiteral $Password);"
}

function Get-AlterRolePasswordSql {
  <# Reset an existing role's password. Used only on the explicit -ResetPassword path. #>
  param([string]$Name, [string]$Password)
  Assert-SqlIdentifier $Name 'Role name'
  return "ALTER ROLE $Name PASSWORD $(Quote-SqlLiteral $Password);"
}

function Get-AlterRolePrivilegesSql {
  <#
    Re-assert both roles' attributes. CREATEDB only on the migrator: it is what
    `prisma migrate dev` needs for its shadow database.
  #>
  param([string]$MigratorRole, [string]$AppRole)
  Assert-SqlIdentifier $MigratorRole 'Migrator role'
  Assert-SqlIdentifier $AppRole 'App role'
  return "ALTER ROLE $MigratorRole CREATEDB NOSUPERUSER NOCREATEROLE; ALTER ROLE $AppRole NOCREATEDB NOSUPERUSER NOCREATEROLE;"
}

function Get-DatabaseExistsSql {
  <# Statement returning the name when the database exists, no row when it does not. #>
  param([string]$Name)
  Assert-SqlIdentifier $Name 'Database name'
  return "SELECT datname FROM pg_database WHERE datname = $(Quote-SqlLiteral $Name);"
}

function Get-CreateDatabaseSql {
  <# PostgreSQL has no IF NOT EXISTS for CREATE DATABASE; the caller checks first. #>
  param([string]$Name, [string]$Owner)
  Assert-SqlIdentifier $Name 'Database name'
  Assert-SqlIdentifier $Owner 'Migrator role'
  return "CREATE DATABASE $Name OWNER $Owner;"
}

function Get-DatabaseGrantsSql {
  <# PUBLIC loses every right on the database; only the two roles may connect. #>
  param([string]$Name, [string]$AppRole, [string]$MigratorRole)
  Assert-SqlIdentifier $Name 'Database name'
  Assert-SqlIdentifier $AppRole 'App role'
  Assert-SqlIdentifier $MigratorRole 'Migrator role'
  return "REVOKE ALL ON DATABASE $Name FROM PUBLIC; GRANT CONNECT, TEMPORARY ON DATABASE $Name TO $AppRole, $MigratorRole;"
}

function Get-StoreFailureMessage {
  <#
    The message for a failed credential-store operation. The outcome is what TryoutSimCredInvoke
    returns for a failure; a store problem is always reported as a store problem, never as a
    missing credential, and the message names what the run did not do.
  #>
  param($Outcome, [string]$Action, [string]$Consequence, [string]$Subject = '')
  $what = $(if ($Subject) { "$Action $Subject" } else { $Action })
  return "Windows Credential Manager could not $what ($($Outcome.ErrorCode), Win32 $($Outcome.NativeErrorCode)). $Consequence"
}

function Remove-CredentialEntry {
  <# Delete a role's stored password; the store's Delete is itself idempotent. #>
  param([string]$Target)
  if ([string]::IsNullOrWhiteSpace($Target)) { throw 'A credential target is required.' }
  return TryoutSimCredInvoke -Operation Delete -Target $Target
}

function Test-PasswordInSql {
  <#
    Guard for every statement that carries a password: the secret must appear only inside a
    quoted literal and must not be able to end that literal early.
  #>
  param([string]$Sql, [string]$Secret)
  return $Sql.Contains($(Quote-SqlLiteral $Secret)) -and
    -not $Secret.Contains("'") -and
    $Secret -match '^[A-Za-z0-9_\-]+$'
}

function Get-UrlComponent {
  <# Percent-encode one component of a connection URI; every component goes through this. #>
  param([AllowEmptyString()][string]$Value, [string]$What)
  if ($null -eq $Value) { throw "$What is required." }
  if ($Value.Length -eq 0) { throw "$What must not be empty." }
  return [Uri]::EscapeDataString($Value)
}

function Get-ConnectionUrl {
  <#
    A postgresql:// URL whose user, password, host and database are each percent-encoded,
    so a password containing '@', ':', '/' or '%' survives the trip.
  #>
  param(
    [string]$User,
    [string]$Secret,
    [string]$HostName,
    [int]$Port,
    [string]$Database
  )
  if ($Port -lt 1 -or $Port -gt 65535) { throw "Port '$Port' is not a valid TCP port." }
  return "postgresql://$(Get-UrlComponent $User 'User')`:$([Uri]::EscapeDataString($Secret))@" +
    "$(Get-UrlComponent $HostName 'Host')`:${Port}/$(Get-UrlComponent $Database 'Database')?schema=public"
}

function Get-AppPort {
  <#
    The port the app listens on. Defaults to 4317, which is the server's own default in
    src/config.js; this is a local single-user machine, so a fixed port is enough.
  #>
  param([AllowNull()][string]$Value)
  if ([string]::IsNullOrWhiteSpace($Value)) { return 4317 }
  $parsed = 0
  if (-not [int]::TryParse($Value, [ref]$parsed) -or $parsed -lt 1 -or $parsed -gt 65535) {
    throw "PORT '$Value' is not a valid TCP port."
  }
  return $parsed
}

function Get-DbEnvText {
  <# The file body the application loads: one KEY=value per line, ASCII only, trailing newline. #>
  param([string]$AppUrl, [string]$MigratorUrl, [int]$AppPort)
  return @(
    '# Generated by db/make-env.ps1. Contains credentials: keep it out of the repository.'
    "DATABASE_URL_APP=$AppUrl"
    "DATABASE_URL=$MigratorUrl"
    "PORT=$AppPort"
    ''
  ) -join "`n"
}

function Get-CredentialTarget {
  <# The Windows Credential Manager target name that holds a role's password. #>
  param([string]$Role)
  Assert-SqlIdentifier $Role 'Role name'
  return "tryoutsim/$Role"
}

function Get-Plan {
  <#
    What a provisioning run must do, from the roles' existence and their stored credentials.
    $Exists and $Stored are hashtables keyed by role name; a stored value of $null means
    "absent", and a store failure must have been raised by the caller, never mapped to $null.

    - Roles that exist with a stored password: left alone.
    - Roles that do not exist: created (create = $true), and a stale credential this run would
      replace is reported in Stale.
    - Roles that exist without a stored password: unrecoverable by guessing. With -ResetPassword
      they are reset; without it they are returned in Unrecoverable and the caller must stop.
  #>
  param(
    [string[]]$Roles,
    [hashtable]$Exists,
    [hashtable]$Stored,
    [switch]$ResetPassword
  )
  $plan = @{ Create = @(); Reset = @(); Unrecoverable = @(); Stale = @() }
  foreach ($role in $Roles) {
    $hasSecret = -not [string]::IsNullOrEmpty($Stored[$role])
    if ($Exists[$role]) {
      if ($hasSecret) { continue }
      if ($ResetPassword) { $plan.Reset += $role } else { $plan.Unrecoverable += $role }
      continue
    }
    $plan.Create += $role
    if ($hasSecret) { $plan.Stale += $role }
  }
  return $plan
}

function Get-SuperuserPassword {
  <#
    The superuser password from stdin, as a SecureString. This is the only source: no
    parameter and no environment variable carries it, so it cannot reach a command line, a
    log, or the PowerShell history. A blank prompt. An empty answer is a preflight failure.
  #>
  $secure = Read-Host -AsSecureString ' '
  if ($null -eq $secure -or $secure.Length -eq 0) { throw 'The superuser password read from stdin is empty. Provisioning stopped before any statement ran.' }
  return $secure
}

function Get-SecureStringText {
  <#
    Read a SecureString back to a plain string, the one moment a superuser password is in
    memory. The caller passes it to the child process and drops it immediately.
  #>
  param([System.Security.SecureString]$SecureString)
  if ($null -eq $SecureString -or $SecureString.Length -eq 0) { return $null }
  $bstr = [IntPtr]::Zero
  try {
    $bstr = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($SecureString)
    return [System.Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
  } finally {
    if ($bstr -ne [IntPtr]::Zero) { [System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr) }
  }
}

function New-RandomPassword {
  <#
    32 bytes of CSPRNG entropy in base64url: no quoting, no URI metacharacters, 256 bits.
    Uses RandomNumberGenerator.Create() because .NET Framework (Windows PowerShell 5.1) has no
    static Fill().
  #>
  $bytes = [byte[]]::new(32)
  $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
  try {
    $rng.GetBytes($bytes)
  } finally {
    $rng.Dispose()
  }
  return [Convert]::ToBase64String($bytes).TrimEnd('=').Replace('+', 'A').Replace('/', 'B')
}

function Invoke-SuperuserSql {
  <#
    Run one SQL file as the superuser and return its rows as strings, one per line of stdout.

    The password reaches psql as PGPASSWORD and is removed from the environment immediately
    after the call; on Windows a child process reads the block's environment at CreateProcess,
    so the removal does not race the child. -w (--no-password) makes psql fail instead of
    prompting when the password is rejected.
  #>
  param(
    [string]$Sql,
    [string]$SuperUser,
    [string]$HostName,
    [int]$Port,
    [string]$PsqlPath
  )
  if ([string]::IsNullOrEmpty($env:PGPASSWORD)) {
    throw 'The superuser password is not in PGPASSWORD. This is a preflight failure; no statement was run.'
  }
  try {
    $OutputEncoding = [System.Text.UTF8Encoding]::new($false)
    # The statement goes through a temporary file, not stdin: the superuser password arrives
    # over stdin, and a 5.1 child process cannot read both from the same handle. The file
    # holds only our own statement (the password is in PGPASSWORD, never in the SQL) and is
    # deleted in the finally block.
    $scriptFile = [System.IO.Path]::GetTempFileName()
    try {
      [System.IO.File]::WriteAllText($scriptFile, $Sql, [System.Text.UTF8Encoding]::new($false))
      $rows = & $PsqlPath -X -w -v ON_ERROR_STOP=1 -h $HostName -p $Port -U $SuperUser -d postgres -q -t -A -f $scriptFile
      $exitCode = $LASTEXITCODE
    } finally {
      Remove-Item -LiteralPath $scriptFile -Force -ErrorAction SilentlyContinue
    }
    if ($exitCode -ne 0) {
      $detail = ($rows -join ' ').Trim()
      throw "psql exited with code $exitCode. $detail"
    }
  } finally {
    Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
  }
  return @($rows | ForEach-Object { "$_".Trim() } | Where-Object { $_.Length -gt 0 })
}

function Resolve-PsqlPath {
  <# The psql executable, or a stated error naming what to install. #>
  param([string]$Explicit)
  if ($Explicit) {
    if (-not (Test-Path -LiteralPath $Explicit)) { throw "psql not found at '$Explicit'." }
    return (Resolve-Path -LiteralPath $Explicit).Path
  }
  $command = Get-Command psql -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1
  if (-not $command) {
    throw 'psql is not on PATH. Install the PostgreSQL 18 client tools, or pass -PsqlPath.'
  }
  return $command.Source
}
