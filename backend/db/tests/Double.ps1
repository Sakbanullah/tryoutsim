# Test doubles for the database provisioning scripts.
#
# Each script is run as a hollowed copy: its parameters and its own statements are kept, and
# every function it defines is replaced by a double. The doubles answer from:
#   It.Psql     - entries of @{ Sql = '<regex>'; Rows = @(..) | Throw = '<message>' }, answered
#                 in order, so a test both returns rows and asserts a statement was issued;
#   It.Stdin    - the superuser password the console prompt would have returned;
#   It.CredMode - 'ok', or a store that refuses reads / writes / deletes the way Win32 does.
# Nothing here touches PostgreSQL, psql or Windows Credential Manager. CredentialStore.ps1 is
# not loaded; the scripts reach the store only through TryoutSimCredInvoke, which is what this
# file replaces, and a store failure is worded exactly as the real one words it.

$script:It = @{
  Stdin = ''
  Psql = @()
  CredMode = 'ok'
  Calls = New-Object System.Collections.ArrayList
  Store = @{}
  Writes = 0
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
  if ([string]::IsNullOrEmpty($SuperUser)) { throw 'The superuser name is not set. This is a preflight failure.' }
  [void]$script:It.Calls.Add($Sql)
  foreach ($entry in @($script:It.Psql)) {
    if ($null -eq $entry) { continue }
    if ($entry.Sql -and ($Sql -notmatch $entry.Sql)) { continue }
    if ($entry.Throw) { throw "psql exited with code 1. $($entry.Throw)" }
    if ($entry.Rows) { return @($entry.Rows) }
    return @()
  }
  return @()
}

function Resolve-PsqlPath {
  <# The double never runs psql; a path keeps the scripts' own flow unchanged. #>
  param([string]$Explicit)
  if ($Explicit -and -not (Test-Path -LiteralPath $Explicit)) { throw "psql not found at '$Explicit'." }
  return $(if ($Explicit) { $Explicit } else { 'psql' })
}

function Get-SuperuserPassword {
  <# The superuser password the test supplies, instead of the console prompt. #>
  if ([string]::IsNullOrEmpty($script:It.Stdin)) {
    throw 'The superuser password read from stdin is empty. Provisioning stopped before any statement ran.'
  }
  $secure = New-Object System.Security.SecureString
  foreach ($character in $script:It.Stdin.ToCharArray()) { $secure.AppendChar($character) }
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

# --- The credential-store double -----------------------------------------------------------

function New-CredStoreFailure([int]$NativeError, [string]$Message) {
  <# A store failure worded the way CredentialStore.ps1 words it, raised with Win32Error. #>
  $exception = New-Object System.Exception "Could not access the credential store (Win32 error $NativeError). $Message"
  return @{ Exception = $exception; Win32Error = $NativeError; ErrorCode = 'CredentialStoreFailed' }
}

function TryoutSimCredInvoke {
  <#
    The scripts' only door to the credential store. Each operation reads It.CredMode at call
    time, so a test switches the store's health between runs without reloading anything.
  #>
  param([string]$Operation, [string]$Target, [string]$User = '', [string]$Secret = '')

  $fail = {
    param($code, $message, $win32)
    $exception = New-Object System.Exception "Could not access the credential store (Win32 error $win32). $message"
    $exception.Data['ErrorCode'] = $code
    $exception.Data['NativeErrorCode'] = $win32
    return $exception
  }

  switch ($Operation) {
    'Write' {
      if ($script:It.CredMode -eq 'writefail') { throw (& $fail 'CredentialStoreFailed' 'The parameter is incorrect.' 1312) }
      $script:It.Writes++
      $script:It.Store[$Target] = $Secret
      return $null
    }
    'Read' {
      if ($script:It.CredMode -eq 'readfail') { throw (& $fail 'CredentialStoreFailed' 'Access is denied.' 5) }
      if ($script:It.Store.ContainsKey($Target)) { return $script:It.Store[$Target] }
      return $null
    }
    'Delete' {
      if ($script:It.CredMode -eq 'deletefail') { throw (& $fail 'CredentialStoreFailed' 'Access is denied.' 5) }
      $script:It.Store.Remove($Target)
      return $null
    }
    default { throw "Unknown credential-store operation '$Operation'." }
  }
}
