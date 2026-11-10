# Emit the environment file for this machine (connection URLs + app port).
#
# Reads each role's password from Windows Credential Manager and composes the connection
# strings. Every component of each URL (user, password, host, database) is percent-encoded,
# so a password containing '@', ':', '/' or '%' survives the trip.
#
# The file necessarily contains the passwords, so:
#   - the access list is written FIRST, on a new empty file, before any secret is in it: the
#     owner gets full control, inheritance is removed, every other account is denied;
#   - it is written as UTF-8 WITHOUT a byte-order mark, so a line loader that matches
#     '^([A-Z_]+)=(.*)$' reads the first line unchanged (PowerShell 5.1 -Encoding utf8 adds a BOM);
#   - it must live OUTSIDE the repository; the script refuses to write inside it.
#
# A credential-store failure is reported as such, never as "credential missing".
#
# Usage:
#   .\db\make-env.ps1 -OutFile "$env:LOCALAPPDATA\TryoutSim\db.env"

[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)][string]$OutFile,
  [string]$Database = 'tryoutsim',
  [string]$AppRole = 'tryoutsim_app',
  [string]$MigratorRole = 'tryoutsim_migrator',
  [string]$HostName = '127.0.0.1',
  [int]$Port = 5432,
  [string]$AppPort = ''
)

$ErrorActionPreference = 'Stop'

. (Join-Path $PSScriptRoot 'ProvisioningCommon.ps1')
. (Join-Path $PSScriptRoot 'CredentialStore.ps1')

# --- Preflight: no secret is read before the destination is known to be acceptable -------

Assert-SqlIdentifier $Database 'Database name'
Assert-SqlIdentifier $AppRole 'App role'
Assert-SqlIdentifier $MigratorRole 'Migrator role'
if ($Port -lt 1 -or $Port -gt 65535) { throw "Port '$Port' is not a valid TCP port." }
if ([string]::IsNullOrWhiteSpace($HostName)) { throw 'HostName must not be empty.' }
$port = Get-AppPort $AppPort

$full = [System.IO.Path]::GetFullPath($OutFile)
$dir = Split-Path -Parent $full
$repo = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..\..')).Path
if ($full.StartsWith($repo + [System.IO.Path]::DirectorySeparatorChar, [System.StringComparison]::OrdinalIgnoreCase)) {
  throw "Refusing to write '$full': it is inside the repository, and the file contains passwords. Use -OutFile `"`$env:LOCALAPPDATA\TryoutSim\db.env`"."
}
if (-not (Test-Path -LiteralPath $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }

function New-RestrictedFile([string]$Path) {
  <#
    Create an empty file whose access list carries ONE rule (the current user, full control)
    with inheritance off. Created before any secret is written, so there is no window in
    which the file exists with inherited permissions.
  #>
  $user = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
  $security = New-Object System.Security.AccessControl.FileSecurity
  $security.SetAccessRuleProtection($true, $false)
  $security.AddAccessRule((New-Object System.Security.AccessControl.FileSystemAccessRule(
    $user, 'FullControl', 'Allow')))
  $stream = [System.IO.File]::Create($Path)
  $stream.Dispose()
  Set-Acl -Path $Path -AclObject $security
}

function Write-SecretFile([string]$Path, [string]$Text) {
  <#
    Write UTF-8 without a BOM. Returns the file's bytes so the caller can check them.
  #>
  [System.IO.File]::WriteAllText($Path, $Text, [System.Text.UTF8Encoding]::new($false))
  return [System.IO.File]::ReadAllBytes($Path)
}

function Assert-NoInheritedAccess([string]$Path) {
  <#
    Fail if any account other than the current user can read the file, or if inheritance is
    still on. Checked after the write, because that is the state the file is left in.
  #>
  $acl = Get-Acl -Path $Path
  if (-not $acl.AreAccessRulesProtected) {
    throw "The access list of '$Path' still inherits permissions. Fix the ACL before relying on this file."
  }
  $me = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
  $others = @($acl.Access | Where-Object { $_.IdentityReference.Value -ne $me -and $_.AccessControlType -eq 'Allow' })
  if ($others.Count -gt 0) {
    throw "The access list of '$Path' grants access to $($others.IdentityReference -join ', '). Remove those entries before relying on this file."
  }
}

# --- Read the credentials, with store errors reported as store errors ----------------------

$secrets = @{}
foreach ($role in @($AppRole, $MigratorRole)) {
  $target = Get-CredentialTarget $role
  $outcome = TryoutSimCredInvoke -Operation Read -Target $target
  if ($outcome -is [hashtable] -and $outcome.ContainsKey('Exception')) {
    throw (Get-StoreFailureMessage $outcome "read '$target'" 'No file was written. Fix the store and re-run.')
  }
  $secrets[$role] = $outcome
  if ([string]::IsNullOrEmpty($secrets[$role])) {
    throw "No password is stored for '$target'. Run .\db\provision.ps1 first. No file was written."
  }
}

$appUrl = Get-ConnectionUrl -User $AppRole -Secret $secrets[$AppRole] -HostName $HostName -Port $Port -Database $Database
$migratorUrl = Get-ConnectionUrl -User $MigratorRole -Secret $secrets[$MigratorRole] -HostName $HostName -Port $Port -Database $Database
$text = Get-DbEnvText -AppUrl $appUrl -MigratorUrl $migratorUrl -AppPort $port
$secrets[$AppRole] = $null
$secrets[$MigratorRole] = $null
$secrets = @{}

if ($text -match '[^\x20-\x7E\r\n]') {
  throw 'The generated file would contain a character outside printable ASCII. Nothing was written.'
}

# --- Write ---------------------------------------------------------------------------------

New-RestrictedFile $full
try {
  $bytes = Write-SecretFile $full $text
} finally {
  $text = $null
  $appUrl = $null
  $migratorUrl = $null
}
$bom = [byte[]](0xEF, 0xBB, 0xBF)
if ($bytes.Length -ge 3 -and $bytes[0] -eq $bom[0] -and $bytes[1] -eq $bom[1] -and $bytes[2] -eq $bom[2]) {
  throw "The file '$full' was written with a byte-order mark."
}
$bytes = $null
Assert-NoInheritedAccess $full

Write-Host "Wrote $full (owner-only access, UTF-8 without BOM)."
Write-Host 'Load it before starting the app: Get-Content <file> | ForEach-Object { if ($_ -match ''^([A-Z_]+)=(.*)$'') { Set-Item "env:$($matches[1])" $matches[2] } }; npm start'
