# Set one connection string in the environment file (owner-only) without printing it.
#
#   .\db\Set-Secret.ps1 -Name DATABASE_URL_APP    # prompts without echo
#   .\db\Set-Secret.ps1 -Name DATABASE_URL -Value 'postgresql://tryoutsim_migrator:<encoded>@127.0.0.1:5432/tryoutsim'
#
# Known passwords go here before provision.ps1, so the script applies their percent-encoded
# form instead of generating new ones. A typed -Value lands in the PowerShell history file:
# prefer the prompt for a password, and clear a value you typed after use (Clear-History, and
# the file HistoryPath names).

[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)][ValidateSet('DATABASE_URL_APP', 'DATABASE_URL')][string]$Name,
  [string]$Value = '',
  [string]$EnvFile = ''
)

$ErrorActionPreference = 'Stop'

. (Join-Path $PSScriptRoot 'ProvisioningCommon.ps1')

$full = $(if ($EnvFile) { [System.IO.Path]::GetFullPath($EnvFile) } else { Get-DefaultEnvPath })
if (-not (Test-Path -LiteralPath $full -PathType Leaf)) { throw "No environment file at '$full'. Run .\db\provision.ps1 first; it creates one." }
Assert-OwnerOnly $full
Assert-EnvFileIgnored -Path $full

if (-not $PSBoundParameters.ContainsKey('Value')) {
  $secure = Read-Host -AsSecureString $Name
  $bstr = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
  try { $Value = [System.Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr) }
  finally { [System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr) }
  if ([string]::IsNullOrEmpty($Value)) { throw "Nothing was entered for $Name. The file was not changed." }
}

# A connection string the role cannot use is refused before the file is touched: its user must
# be the role it is meant for, and a password with a character that would break the URL must
# arrive encoded. A password of letters and digits is legal unencoded; the writer encodes it
# anyway, so what lands in the file is always the encoded form.
$role = @{ DATABASE_URL_APP = 'tryoutsim_app'; DATABASE_URL = 'tryoutsim_migrator' }[$Name]
$parts = Get-ConnectionParts -Url $Value -What $Name
if ($parts.User -ne $role) { throw "$Name must name role $role, not $($parts.User). The file was not changed." }
if ($parts.Password -match '[:/?#@]') {
  throw "$Name's password is not percent-encoded. Set the encoded form (for example [Uri]::EscapeDataString('...')). The file was not changed."
}

$values = Read-EnvFile -Path $full -Names @('DATABASE_URL_APP', 'DATABASE_URL', 'NODE_ENV', 'PORT')
if (-not $values['NODE_ENV']) { $values['NODE_ENV'] = 'development' }
$values[$Name] = $Value
Write-EnvFile -Path $full -Values $values
$Value = $null
Write-Host "Set $Name in '$full'."
