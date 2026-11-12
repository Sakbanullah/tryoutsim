# Test doubles for the database provisioning scripts.
#
# Each script is run as a hollowed copy: its parameters and its own statements are kept, and
# every function it defines is replaced by a double. The doubles answer from:
#   It.Psql     - entries of @{ Sql = '<regex>'; Rows = @(..) | Throw = '<message>' }, answered
#                 in order, so a test both returns rows and asserts a statement was issued;
#   It.Stdin    - the superuser password the console prompt would have returned.
# Nothing here touches PostgreSQL or psql, and no credential store is involved: the two role
# passwords live in the scenario's own environment file.

# One global record per run: Double.ps1, Scenario.ps1 and each generated script block all read
# it, and a function's own script scope is not the one the test file writes to.
$global:TryoutSimIt = @{
  Stdin = ''
  Psql = @()
  Calls = New-Object System.Collections.ArrayList
  # What the role-connection check answers; '' means "as the server would": every role accepts
  # the file's password. 'fail' rejects all of them; otherwise each URL named in RejectedUrls is
  # rejected and every other one accepted, which is how a run that resets a password looks.
  RoleConnection = ''
  RejectedUrls = @()
}

# --- The psql double -----------------------------------------------------------------------

function Invoke-SuperuserSql {
  <# Record the batch and answer it from It.Psql; the first matching entry wins. #>
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
  # Mirrors the real helper: callers pass only -Sql and the connection settings live in the
  # script scope (the scenario sets them where the script it runs expects them).
  if ($null -eq $script:SuperuserConnection -and [string]::IsNullOrEmpty($SuperUser)) {
    throw 'The psql connection settings are not set. This is a preflight failure; no statement was run.'
  }
  if ($null -ne $script:SuperuserConnection) {
    $SuperUser = $script:SuperuserConnection.SuperUser
  }
  if ([string]::IsNullOrEmpty($SuperUser)) {
    throw 'The superuser name is not set. This is a preflight failure.'
  }
  [void]$global:TryoutSimIt.Calls.Add($Sql)
  foreach ($entry in @($global:TryoutSimIt.Psql)) {
    if ($null -eq $entry) { continue }
    if ($entry.Sql -and ($Sql -notmatch $entry.Sql)) { continue }
    if ($entry.Throw) { throw "psql exited with code 1. $($entry.Throw)" }
    if ($entry.Rows) { return @($entry.Rows) }
    return @()
  }
  return @()
}

function Test-RoleConnection {
  <#
    The role-authentication probe, without a server: the scenario says whether the URL in the
    file is accepted. Nothing here opens a connection.
  #>
  param([string]$Url, [string]$PsqlPath)
  if ([string]::IsNullOrEmpty($Url)) { return $false }
  [void]$global:TryoutSimIt.Calls.Add("AUTH $Url")
  if ($global:TryoutSimIt.RoleConnection -eq 'fail') { return $false }
  if (@($global:TryoutSimIt.RejectedUrls) -contains $Url) { return $false }
  return $true
}

function Resolve-PsqlPath {
  <# The double never runs psql; a path keeps the scripts' own flow unchanged. #>
  param([string]$Explicit)
  if ($Explicit -and -not (Test-Path -LiteralPath $Explicit)) { throw "psql not found at '$Explicit'." }
  return $(if ($Explicit) { $Explicit } else { 'psql' })
}

function Get-SuperuserPassword {
  <# The superuser password the test supplies, instead of the console prompt. #>
  if ([string]::IsNullOrEmpty($global:TryoutSimIt.Stdin)) {
    throw 'The superuser password read from the console is empty. Provisioning stopped before any statement ran.'
  }
  $secure = New-Object System.Security.SecureString
  foreach ($character in $global:TryoutSimIt.Stdin.ToCharArray()) { $secure.AppendChar($character) }
  $secure.MakeReadOnly()
  return $secure
}

function Get-SecureStringText {
  <# Unwrap with the real implementation, so the scripts see the real SecureString path. #>
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
