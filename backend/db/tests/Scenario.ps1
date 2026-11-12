# Run one of the provisioning scripts end to end with every external edge doubled.
#
# The script's own parameters and statements run — not a restatement of them:
#   Invoke-SuperuserSql    -> the double in Double.ps1 (nothing reaches psql or PostgreSQL);
#   Get-SuperuserPassword  -> replaced; the scenario supplies the password the console prompt
#                             would read, through the $TestSecure value the scenario builds;
#   File locations         -> $Work: the scenario's temporary directory, deleted afterwards.
#
# The generated text is written to a test file and run with & (call), so those variables,
# whose scope encloses the test file, are visible to it.

$script:DbDir = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path

function Get-ScenarioScriptText {
  <#
    A scriptblock equivalent to the script: the parameter block, then its top-level statements
    in order. Functions are left out (the doubles replace the ones that matter; the rest are
    helpers the statements call directly, from ProvisioningCommon.ps1).
  #>
  param([string]$Path)

  $ast = [System.Management.Automation.Language.Parser]::ParseFile($Path, [ref]$null, [ref]$null)
  $lines = [System.IO.File]::ReadAllLines($Path)
  $source = {
    param($node)
    $start = $node.Extent.StartLineNumber
    $end = $node.Extent.EndLineNumber
    if ($start -eq $end) { return $lines[$start - 1] }
    return ($lines[($start - 1)..($end - 1)]) -join "`n"
  }

  # The parameter block leads the text, and the helpers are loaded before it runs. Both must
  # come first: a statement before a param( block makes 5.1 read a list whose defaults hold a
  # comma as an expression. The test binds every parameter it declares, so no default stands.
  $out = New-Object System.Text.StringBuilder
  $end = "`n"
  $paramBlock = $ast.Find({ param($node) $node -is [System.Management.Automation.Language.ParamBlockAst] }, $true)
  if ($paramBlock) { [void]$out.Append($((& $source $paramBlock) -replace '\r?\n', ' ') + $end) }
  [void]$out.Append('function __TestLoad { . (Join-Path $DbDir ''ProvisioningCommon.ps1'') }' + $end)
  [void]$out.Append('__TestLoad' + $end)
  foreach ($statement in $ast.EndBlock.Statements) {
    if ($statement.GetType().Name -eq 'FunctionDefinitionAst') { continue }
    $text = & $source $statement
    # ProvisioningCommon.ps1 is supplied by the test file.
    if ($text -match '\. \(Join-Path \$PSScriptRoot ''ProvisioningCommon') { continue }
    # The environment file is the scenario's own; the scripts' default path is replaced, not
    # dropped, so the binding stays: `-EnvFile` still wins over it.
    if ($text -match 'Get-DefaultEnvPath') {
      $text = $text -replace 'Get-DefaultEnvPath', '$EnvPath'
    }
    # The console prompt is replaced by the password the test supplies, through the real
    # Get-SecureStringText path and the statement's own empty check.
    $text = $text -replace 'Get-SecureStringText \(Get-SuperuserPassword\)', 'Get-SecureStringText $TestSecure'
    if ($text -match '^\$ErrorActionPreference') { continue }
    [void]$out.Append($text + $end)
  }
  return $out.ToString()
}

function Invoke-ProvisioningScenario {
  <#
    Run one script against the doubles.

    @param Script    'Provision.ps1' | 'Reset-Password.ps1' | 'Set-Secret.ps1' | 'Load-Env.ps1'
    @param Bound     @{ Name = value } for the parameters the script declares
    @param Psql      It.Psql entries
    @param StdIn     the superuser password the console prompt would read ('' = empty)
    @param EnvLines  the environment file's existing lines, written before the run
    @param RoleConnection  '' = the server accepts the file's password, 'fail' = it rejects it
    @param RejectedUrls    the URLs whose password the server rejects (all others accepted)
    @returns @{ Threw; Message; Output; Calls; Work; EnvPath; EnvText }
  #>
  param(
    [Parameter(Mandatory = $true)][string]$Script,
    [hashtable]$Bound = @{},
    [object[]]$Psql = @(),
    [string]$StdIn = 'superuser-secret',
    [string[]]$EnvLines = @(),
    [string]$RoleConnection = '',
    [string[]]$RejectedUrls = @()
  )

  $path = Join-Path $script:DbDir $Script
  $DbDir = $script:DbDir
  $ast = [System.Management.Automation.Language.Parser]::ParseFile($path, [ref]$null, [ref]$null)
  $block = $ast.Find({ param($node) $node -is [System.Management.Automation.Language.ParamBlockAst] }, $true)
  $parameterNames = @()
  if ($block) { $parameterNames = @($block.Parameters | ForEach-Object { $_.Name.VariablePath.UserPath }) }

  # The generated block reads $TestSecure and $DbDir from the frame that runs it.
  $Work = Join-Path ([System.IO.Path]::GetTempPath()) ('tryoutsim-test-' + [guid]::NewGuid().ToString('n'))
  New-Item -ItemType Directory -Path $Work | Out-Null
  # The console prompt's answer, as the SecureString Read-Host -AsSecureString would return.
  $TestSecure = New-Object System.Security.SecureString
  foreach ($character in $StdIn.ToCharArray()) { $TestSecure.AppendChar($character) }
  $TestSecure.MakeReadOnly()
  # The environment file: whatever the test wants to find there, PORT when it says nothing.
  # Each scenario directory holds its own Git repository that ignores .env, so the scripts'
  # "Git must ignore the file" check exercises its real command without this repository's state.
  $EnvPath = Join-Path $Work '.env'
  [System.IO.File]::WriteAllText((Join-Path $Work '.gitignore'), ".env`n")
  & git -C $Work init -q 2>$null | Out-Null
  if ($EnvLines.Count -eq 0) { $EnvLines = @('NODE_ENV=development', 'DATABASE_URL_APP=', 'DATABASE_URL=', 'PORT=4317') }
  [System.IO.File]::WriteAllLines($EnvPath, @('# scenario environment') + $EnvLines)

  # Owner-only, as the real file must be before any script reads it.
  $security = New-Object System.Security.AccessControl.FileSecurity
  $security.SetAccessRuleProtection($true, $false)
  $security.AddAccessRule((New-Object System.Security.AccessControl.FileSystemAccessRule(
    [System.Security.Principal.WindowsIdentity]::GetCurrent().Name, 'FullControl', 'Allow')))
  Set-Acl -LiteralPath $EnvPath -AclObject $security
  # The double's state is global: every dot-sourced file and every generated script block sees it.
  $global:TryoutSimIt = New-Object System.Collections.Hashtable
  $global:TryoutSimIt.Psql = $Psql
  $global:TryoutSimIt.Stdin = $StdIn
  $global:TryoutSimIt.Calls = New-Object System.Collections.ArrayList
  $global:TryoutSimIt.RoleConnection = $RoleConnection
  $global:TryoutSimIt.RejectedUrls = $RejectedUrls

  # The generated script looks at $Work for its file paths (the environment file, $urlDatabase).
  $splat = @{}
  foreach ($name in $parameterNames) {
    if (-not $Bound.ContainsKey($name)) { continue }
    # A script block is a value the test computes in its own frame (the scenario directory).
    $value = $Bound[$name]
    if ($value -is [scriptblock]) { $value = & $value }
    $splat[$name] = $value
  }

  # Parsed in memory and run as a block, so $TestSecure, $DbDir and $It resolve in the frames
  # this function and the test file define, and nothing is written for the script to read.
  # The parameter block must lead: with a statement before it, a list whose defaults hold a
  # comma is read as an expression. The caller binds every parameter, so nothing is defaulted.
  $text = (Get-ScenarioScriptText -Path $path).Replace("`r`n", "`n").TrimStart()
  $text = [regex]::Replace($text, '^param\(\s*', 'param(')
  # Invoke-SuperuserSql reads the connection settings from the calling script's scope; this
  # block replaces that script, so it sets them the way the scripts themselves do.
  $script:SuperuserConnection = @{ SuperUser = $splat['SuperUser']; HostName = $splat['HostName']; Port = $splat['Port']; PsqlPath = $splat['PsqlPath'] }
  $threw = $null
  $output = ''
  Push-Location -LiteralPath $Work
  try {
    # *>&1, not 2>&1: Write-Host writes to the host stream, which 2>&1 does not capture in
    # Windows PowerShell 5.1, and the scenarios assert on those progress lines.
    $output = (& ([scriptblock]::Create($text)) @splat *>&1 | Out-String)
  } catch {
    $threw = $_
    $output = "$output`n$($_ | Out-String)"
  } finally {
    Pop-Location
  }

  return @{
    Script = $Script
    Threw = $threw
    Message = $(if ($threw) { $threw.Exception.Message } else { '' })
    Output = $output
    Calls = @($global:TryoutSimIt.Calls)
    Work = $Work
    EnvPath = $EnvPath
    EnvText = $(if (Test-Path -LiteralPath $EnvPath) { [System.IO.File]::ReadAllText($EnvPath) } else { $null })
  }
}

function Remove-Scenario([object]$Result) {
  <# Delete the temporary directory a scenario ran in. #>
  if ($Result -and $Result.Work -and (Test-Path -LiteralPath $Result.Work)) {
    Remove-Item -LiteralPath $Result.Work -Recurse -Force -ErrorAction SilentlyContinue
  }
}
