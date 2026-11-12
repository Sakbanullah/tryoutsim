# Guard for a just-written environment file: a password that needs encoding must appear encoded.
#
# Kept in its own file, with one function, so the rule is readable in one place and a test can
# exercise it without the provisioning scripts.
#
# What it checks, and why not more. `Get-ConnectionUrl` percent-encodes every password before it
# writes it. A password of letters and digits (e.g. '132109') is unchanged by that encoding, so
# it legitimately appears in the file verbatim; such a password is skipped. Only a password the
# encoder actually changes (one with '@', ':', '/', '%', ... ) must not appear in its raw form.
# Dot-sourced by ProvisioningCommon.ps1 for the provisioning scripts:
#   Assert-NoPlainSecret -Text $text -Path $path -Passwords $passwords

function Assert-NoPlainSecret {
  <#
    Throw when $Text holds a password in the form it should have been encoded out of. $Passwords
    are the raw passwords; a password whose encoded form equals it needs no check and is skipped,
    and so is an empty entry.
  #>
  param([string]$Text, [string]$Path, [string[]]$Passwords)
  foreach ($password in $Passwords) {
    if ($password.Length -lt 3) { continue }
    $encoded = [Uri]::EscapeDataString($password)
    if ($encoded -ceq $password) { continue }
    if ($Text.IndexOf($password) -ge 0) {
      throw "A connection string in '$Path' holds its password unencoded. Fix the file by hand, then re-run."
    }
  }
}
