# Load the environment file into this PowerShell session (Prisma, provisioning, the app).
#
# Dot-source it, so the variables land in the calling session:
#   . .\db\Load-Env.ps1
#   . .\db\Load-Env.ps1 -EnvFile "$env:LOCALAPPDATA\TryoutSim\.env"    # another file
#
# Every line becomes an environment variable, unchanged: DATABASE_URL_APP (the only database
# URL the serving process reads, src/config.js), DATABASE_URL (Prisma Migrate only), NODE_ENV
# and PORT. Nothing is printed but the file's path.
# Contract: docs/architecture/DEPLOYMENT_AND_BACKUP.md §1.5.

[CmdletBinding()]
param(
  [string]$EnvFile = ''
)

$ErrorActionPreference = 'Stop'

. (Join-Path $PSScriptRoot 'ProvisioningCommon.ps1')

$full = $(if ($EnvFile) { [System.IO.Path]::GetFullPath($EnvFile) } else { Get-DefaultEnvPath })
if (-not (Test-Path -LiteralPath $full -PathType Leaf)) {
  throw "No environment file at '$full'. Run .\db\provision.ps1 first; it creates one."
}
Assert-OwnerOnly $full
Assert-EnvFileIgnored -Path $full

# All four keys, so a missing NODE_ENV is reported here instead of half-way through a start.
$values = Read-EnvFile -Path $full -Names @('DATABASE_URL_APP', 'DATABASE_URL', 'NODE_ENV', 'PORT')
foreach ($name in @('DATABASE_URL_APP', 'DATABASE_URL', 'NODE_ENV')) {
  if ([string]::IsNullOrEmpty($values[$name])) { throw "$name is empty in '$full'. Set it there; nothing was loaded." }
}
$values['PORT'] = (Get-AppPort $values['PORT']).ToString()
foreach ($name in $values.Keys) { Set-Item -Path "Env:$name" -Value $values[$name] }
$values = @{}
Write-Host "Loaded $full - DATABASE_URL_APP, DATABASE_URL, NODE_ENV, PORT (values not shown)."
