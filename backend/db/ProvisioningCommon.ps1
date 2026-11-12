# Pure helpers for db/provision.ps1, db/Reset-Password.ps1, db/Set-Secret.ps1, db/Load-Env.ps1
# and db/tests.
#
# Dot-source this file; it needs nothing from the environment and contacts no server, so the
# tests in db/tests can exercise every helper without PostgreSQL.
#
# Identifiers are validated against a plain-name pattern and then emitted unquoted, so a name
# can never change a statement's shape. Values go through Quote-SqlLiteral, which doubles every
# quote the way PostgreSQL's quote_literal() does. Checked before use, because escaping inside a
# literal cannot undo a name that was never safe in the first place.

$script:NamePattern = '^[A-Za-z_][A-Za-z0-9_]{0,62}$'

# The secret-leak guard is one function in its own file (see its header for why).
. (Join-Path $PSScriptRoot 'Assert-NoPlainSecret.ps1')

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
    "$(Get-UrlComponent $HostName 'Host')`:${Port}/$(Get-UrlComponent $Database 'Database')"
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
  <#
    The file body: one KEY="value" per line, ASCII only, trailing newline. The order is
    DATABASE_URL (migrator), DATABASE_URL_APP (app) and NODE_ENV; PORT is written only when
    given. An empty URL is still written, as an empty value, so provision.ps1 can fill it in
    later and everything that reads the file finds the key.
  #>
  param([AllowEmptyString()][string]$AppUrl, [AllowEmptyString()][string]$MigratorUrl, [string]$AppPort = '', [string]$NodeEnv = 'development')
  $lines = @(
    '# TryoutSim environment. Contains credentials: owner-only, never committed.'
    "DATABASE_URL=`"$MigratorUrl`""
    "DATABASE_URL_APP=`"$AppUrl`""
    "NODE_ENV=$NodeEnv"
  )
  if ($AppPort) { $lines += "PORT=$AppPort" }
  return (($lines + @('')) -join "`n")
}

function Get-EnvKeyOrder {
  <# The keys Get-DbEnvText writes, in its order. #>
  return @('DATABASE_URL', 'DATABASE_URL_APP', 'NODE_ENV', 'PORT')
}

function Write-EnvFile {
  <#
    Replace $Path with the file built from $Values (keys as Get-EnvKeyOrder names them), under
    owner-only access, then refuse it if any role password appears in it unencoded. Each URL's
    password is percent-encoded on the way out, so a value typed by hand arrives in the one form
    the file may hold. PORT is written only when $Values has it. Every script that writes the
    environment file goes through here, so the format and the guard cannot drift apart.
  #>
  param([string]$Path, [hashtable]$Values)
  $appUrl = Set-ConnectionPassword -Url ([string]$Values['DATABASE_URL_APP']) -Password $(Get-UrlPassword -Url ([string]$Values['DATABASE_URL_APP']))
  $migratorUrl = Set-ConnectionPassword -Url ([string]$Values['DATABASE_URL']) -Password $(Get-UrlPassword -Url ([string]$Values['DATABASE_URL']))
  $text = Get-DbEnvText -AppUrl $appUrl -MigratorUrl $migratorUrl `
    -AppPort ([string]$Values['PORT']) -NodeEnv ([string]$Values['NODE_ENV'])
  Write-OwnerOnlyFile -Path $Path -Text $text
  $passwords = @((Get-UrlPassword -Url $appUrl), (Get-UrlPassword -Url $migratorUrl))
  Assert-NoPlainSecret -Text $text -Path $Path -Passwords $passwords
}

function Get-UrlPassword {
  <# The percent-decoded password of a connection string, '' when the string or password is absent. #>
  param([AllowNull()][string]$Url)
  $encoded = [regex]::Match([string]$Url, '^postgresql://[^:/?#]+:([^@]*)@').Groups[1].Value
  if ($encoded -eq '') { return '' }
  return [Uri]::UnescapeDataString($encoded)
}

function Get-RepoRoot {
  <# The repository root: the folder above backend/, which holds db/. #>
  return (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..\..')).Path
}

function Get-DefaultEnvPath {
  <#
    The one environment file: .env at the repository root (the repository's own .env).
    It is covered by .gitignore and must never be committed; Assert-EnvFileIgnored checks that
    Git still ignores it.
  #>
  return (Join-Path (Get-RepoRoot) '.env')
}

function Assert-EnvFileIgnored {
  <#
    Refuse an environment file Git would commit: it carries both role passwords. The check is
    `git check-ignore`, against the repository that holds it; outside a Git repository the file
    is not tracked by anything here, so nothing refuses it.
  #>
  param([string]$Path)
  $status = foreach ($line in @(& git -C (Split-Path -Parent $Path) check-ignore --no-index -- $Path 2>$null)) {
    if (-not [string]::IsNullOrEmpty($line)) { $line }
  }
  if ($LASTEXITCODE -ne 0 -or @($status).Count -eq 0) {
    throw "Refusing to use '$Path': Git does not ignore it, and it contains passwords. Add '.env' to .gitignore before provisioning."
  }
}

function Test-OwnerOnly {
  <# True when inheritance is off and the only allow entry is the current user. #>
  param([string]$Path)
  $acl = Get-Acl -LiteralPath $Path
  if (-not $acl.AreAccessRulesProtected) { return $false }
  $me = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
  $others = @($acl.Access | Where-Object { $_.IdentityReference.Value -ne $me -and $_.AccessControlType -eq 'Allow' })
  return $others.Count -eq 0
}

function Assert-OwnerOnly {
  <# Fail unless the file is readable by the current user alone; name who else can read it. #>
  param([string]$Path)
  if (Test-OwnerOnly $Path) { return }
  $others = @((Get-Acl -LiteralPath $Path).Access | Where-Object {
    $_.IdentityReference.Value -ne [System.Security.Principal.WindowsIdentity]::GetCurrent().Name -and $_.AccessControlType -eq 'Allow'
  } | ForEach-Object { $_.IdentityReference.Value })
  $who = $(if ($others.Count -gt 0) { "grants access to $($others -join ', ')" } else { 'still inherits permissions' })
  throw "The access list of '$Path' $who. Owner-only access is required before it may be read. To fix it: `$acl = Get-Acl -LiteralPath '$Path'; `$acl.SetAccessRuleProtection(`$true, `$false); Set-Acl -LiteralPath '$Path' -AclObject `$acl"
}

function Test-RoleConnection {
  <#
    True when psql can open a session as this URL's role with this URL's password. This is the
    only check that proves the file and the server agree: role existence and a non-null password
    hash say nothing about whether the stored password is the one the file holds.

    PGPASSWORD is cleared for the call and restored after: libpq prefers it over the URL, so a
    superuser password left in the environment would make every role look connected. -w keeps a
    rejection a non-zero exit instead of a prompt. The URL and its password are never printed.
  #>
  param([string]$Url, [string]$PsqlPath)
  if ([string]::IsNullOrEmpty($Url)) { return $false }
  $saved = $env:PGPASSWORD
  try {
    Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
    $rows = & $PsqlPath -X -w -d $Url -t -A -c 'SELECT 1'
    return ($LASTEXITCODE -eq 0 -and @($rows).Count -gt 0)
  } finally {
    if (-not [string]::IsNullOrEmpty($saved)) { $env:PGPASSWORD = $saved }
    $saved = $null
  }
}

function Assert-NoBrokenConnection {
  <#
    Fail unless every connection string in the environment file holds a percent-encoded
    password and the two roles keep different strings: a stray character could end the user or
    password part early, and one shared string would give the app the migrator's rights.
    Called before any role is created or altered, so a refused run changes nothing.
  #>
  param([string]$Path, [hashtable]$Values)
  if ($null -eq $Values) { throw 'The connection values are missing. Nothing was changed.' }
  $appUrl = [string]($Values['DATABASE_URL_APP'])
  $migratorUrl = [string]($Values['DATABASE_URL'])
  foreach ($pair in @(@('DATABASE_URL_APP', $appUrl), @('DATABASE_URL', $migratorUrl))) {
    if ([string]::IsNullOrEmpty($pair[1])) { continue }
    $parts = Get-ConnectionParts -Url $pair[1] -What $pair[0]
    $raw = [Uri]::UnescapeDataString($parts.Password)
    $bad = [bool]($parts.Password -match '[:/?#@]')
    if (-not $bad) { $bad = -not [string]::Equals($raw, [Uri]::EscapeDataString($raw), [System.StringComparison]::Ordinal) }
    if ($bad) {
      throw "$($pair[0]) in '$Path' does not percent-encode its password (or has a stray character). Encode it with db/Set-Secret.ps1. Nothing was changed."
    }
  }
  if (-not [string]::IsNullOrEmpty($appUrl) -and [string]::Equals($appUrl, [string]$migratorUrl, [System.StringComparison]::Ordinal)) {
    throw "DATABASE_URL_APP and DATABASE_URL in '$Path' are the same string. The roles must keep separate connection strings. Nothing was changed."
  }
}

function New-RestrictedFile {
  <#
    Create an empty file whose access list carries ONE rule (the current user, full control)
    with inheritance off. Created before any secret is written, so there is no window in
    which the file exists with inherited permissions.
  #>
  param([string]$Path)
  $user = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
  $security = New-Object System.Security.AccessControl.FileSecurity
  $security.SetAccessRuleProtection($true, $false)
  $security.AddAccessRule((New-Object System.Security.AccessControl.FileSystemAccessRule(
    $user, 'FullControl', 'Allow')))
  $stream = [System.IO.File]::Create($Path)
  $stream.Dispose()
  Set-Acl -Path $Path -AclObject $security
}

function Write-OwnerOnlyFile {
  <#
    Replace $Path with $Text under owner-only access, atomically: the text goes to a temporary
    file next to it whose access list is written AS it is created (FileStream.Create with a
    security descriptor), then File.Replace swaps it in. That is what keeps three properties
    true at once: no secret ever reaches disk with inherited permissions, the target's access
    list never needs re-applying (which can demand SeSecurityPrivilege), and a failed write
    leaves the previous file untouched. UTF-8 without a BOM, so '^([A-Z_]+)=(.*)$' reads the
    first line unchanged.
  #>
  param([string]$Path, [string]$Text)
  $user = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
  $security = New-Object System.Security.AccessControl.FileSecurity
  $security.SetAccessRuleProtection($true, $false)
  $security.AddAccessRule((New-Object System.Security.AccessControl.FileSystemAccessRule($user, 'FullControl', 'Allow')))
  $temp = "$Path.new"
  $stream = [System.IO.File]::Create($temp, 4096, [System.IO.FileOptions]::None, $security)
  try {
    $bytes = [System.Text.UTF8Encoding]::new($false).GetBytes($Text)
    $stream.Write($bytes, 0, $bytes.Length)
  } finally {
    $stream.Dispose()
    [Array]::Clear($bytes, 0, $bytes.Length)
  }
  try {
    if (-not (Test-OwnerOnly $temp)) { throw "The new file '$temp' did not keep owner-only access. The previous file is unchanged." }
    if (Test-Path -LiteralPath $Path -PathType Leaf) {
      # Replace carries the destination's access list over to the new file; Move keeps the
      # temporary's owner-only one. The old file is deleted only after the new one is in place.
      [System.IO.File]::Delete($Path)
      [System.IO.File]::Move($temp, $Path)
    } else {
      [System.IO.File]::Move($temp, $Path)
    }
  } finally {
    Remove-Item -LiteralPath $temp -Force -ErrorAction SilentlyContinue
  }
  if (-not (Test-OwnerOnly $Path)) {
    throw "The file '$Path' is not owner-only after writing. Fix the folder's permissions and re-run."
  }
}

function Read-EnvFile {
  <#
    The KEY=value lines of $Path as a hashtable. Only the keys in $Names are returned. Around
    the value one pair of matching double or single quotes is optional and removed, so
    KEY="value" (the format Write-EnvFile writes) and KEY=value read the same. A malformed
    line, a repeated key, or a value with a quote, backslash or control character is refused,
    so a connection string can only ever arrive in its documented form.
  #>
  param([string]$Path, [string[]]$Names)
  $values = @{}
  $seen = @{}
  $lineNumber = 0
  foreach ($line in [System.IO.File]::ReadAllLines($Path)) {
    $lineNumber++
    if ($line -eq '' -or $line -match '^\s*#') { continue }
    if ($line -notmatch '^([A-Za-z_][A-Za-z0-9_]*)=(.*)$') { throw "Line $lineNumber of '$Path' is not KEY=value." }
    $name = $matches[1]
    $value = $matches[2]
    if ($value.Length -ge 2) {
      if ($value.StartsWith('"') -and $value.EndsWith('"')) { $value = $value.Substring(1, $value.Length - 2) }
      elseif ($value.StartsWith("'") -and $value.EndsWith("'")) { $value = $value.Substring(1, $value.Length - 2) }
    }
    if ($seen.ContainsKey($name)) { throw "Line $lineNumber of '$Path' repeats $name." }
    $seen[$name] = $true
    if ($Names -notcontains $name) { continue }
    if ($value -match '["''\x00-\x1F]') { throw "The value of $name in '$Path' contains a character a connection string cannot carry. Write it as postgresql://user:password@host:port/database with the password percent-encoded, or set it with db/Set-Secret.ps1." }
    $values[$name] = $value
  }
  foreach ($name in $Names) { if (-not $values.ContainsKey($name)) { $values[$name] = '' } }
  return $values
}

function Get-ConnectionParts {
  <#
    Split a postgresql:// connection string into 'user:password@host:port'. A value without this
    shape is refused: the role is replaced by ALTER ROLE and has to match the URL's user.
  #>
  param([string]$Url, [string]$What)
  if ($Url -notmatch '^postgresql://([^:/?#]+):([^@]*)@([^:/?#]+):(\d+)/([^?]*)(\?\S*)?$') {
    throw "$What must be postgresql://user:password@host:port/database (an optional ?query is allowed). Got a value without that shape."
  }
  return @{
    User = $matches[1]; Password = $matches[2]; Host = $matches[3]; Database = $matches[5]
    Port = [int]$matches[4]; Authority = "$($matches[1]):$($matches[2])@$($matches[3]):$($matches[4])/$($matches[5])"
  }
}

function Set-ConnectionPassword {
  <#
    The same connection string with its password replaced by its percent-encoded value. The URL
    is rebuilt from three captured groups rather than a -replace template: 5.1 reads a template
    like '$1' + value + '$2' as a backreference and can swallow the first digits of the value.
  #>
  param([string]$Url, [string]$Password)
  $match = [regex]::Match($Url, '^(postgresql://[^:/?#]+:)([^@]*)(@.*)$')
  if (-not $match.Success) { return $Url }
  return $match.Groups[1].Value + [Uri]::EscapeDataString($Password) + $match.Groups[3].Value
}

function Get-Plan {
  <#
    What a provisioning run must do, from the roles' existence and their stored credentials.
    $Exists and $Stored are hashtables keyed by role name; a stored value of $null means
    "absent", and a store failure must have been raised by the caller, never mapped to $null.

    $Rejected names the roles whose stored password the server did not accept. Only the caller
    can know it, because it needs a connection; a role with a stored password is otherwise
    indistinguishable from a working one.

    - Roles that exist with a stored password the server accepted: left alone.
    - Roles that do not exist: created (create = $true), and a stale credential this run would
      replace is reported in Stale.
    - Roles that exist with no usable password - none stored, or stored and rejected - are
      unrecoverable by guessing. With -ResetPassword they are reset; without it they are
      returned in Unrecoverable and the caller must stop.
  #>
  param(
    [string[]]$Roles,
    [hashtable]$Exists,
    [hashtable]$Stored,
    [string[]]$Rejected = @(),
    [switch]$ResetPassword
  )
  $plan = @{ Create = @(); Reset = @(); Unrecoverable = @(); Stale = @() }
  foreach ($role in $Roles) {
    $hasSecret = -not [string]::IsNullOrEmpty($Stored[$role]) -and $Rejected -notcontains $role
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
    The superuser password, as a SecureString, from the console: Read-Host -AsSecureString
    without echo, after the preflight and before any statement runs. The environment file
    carries only the two role passwords, so the superuser's is the one secret an operator types.
  #>
  $secure = Read-Host -AsSecureString 'postgres password'
  if ($null -eq $secure -or $secure.Length -eq 0) { throw 'The superuser password read from the console is empty. Provisioning stopped before any statement ran.' }
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

    The password reaches psql as PGPASSWORD. This function never removes it: one provisioning run
    issues several statements (role existence, two CREATE ROLEs, ALTER ROLE, database existence,
    CREATE DATABASE, grants), and removing it here left every statement after the first with no
    password, failing the preflight. The calling script owns the variable's lifetime and removes
    it in its own finally block. -w (--no-password) makes psql fail instead of prompting when the
    password is rejected.
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
  # The connection settings come from $script:SuperuserConnection, which provision.ps1 sets
  # before its first statement: a function's own scope does not see the caller's variables.
  if ($null -eq $script:SuperuserConnection) {
    throw 'The psql connection settings are not set. This is a preflight failure; no statement was run.'
  }
  $SuperUser = $script:SuperuserConnection.SuperUser
  $HostName = $script:SuperuserConnection.HostName
  $Port = $script:SuperuserConnection.Port
  $PsqlPath = $script:SuperuserConnection.PsqlPath
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
    # The statement text outlives the call; nothing else here does.
    $Sql = $null
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
