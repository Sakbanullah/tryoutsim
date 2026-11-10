# Run one of the provisioning scripts end to end with every external edge doubled.
#
# The script's own parameters and statements run — not a restatement of them:
#   Invoke-SuperuserSql    -> the double in Double.ps1 (nothing reaches psql or PostgreSQL);
#   Get-SuperuserPassword  -> removed; the scenario supplies the password the prompt would read,
#                             through the $TestPlain variable the test file defines;
#   TryoutSimCredInvoke    -> the double in Double.ps1 (CredentialStore.ps1 is not loaded);
#   Local host access      -> the scenario's temporary directory, deleted afterwards.
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
    # ProvisioningCommon.ps1 and the script location are supplied by the test file.
    if ($text -match 'ProvisioningCommon\.ps1|CredentialStore\.ps1') { continue }
    # The console prompt is replaced by the password the test supplies.
    if ($text -match 'Get-SuperuserPassword') { [void]$out.Append('$plain = $TestPlain' + $end); continue }
    if ($text -match 'Get-SecureStringText|^\$ErrorActionPreference') { continue }
    [void]$out.Append($text + $end)
  }
  return $out.ToString()
}

function Invoke-ProvisioningScenario {
  <#
    Run one script against the doubles.

    @param Script   'Provision.ps1' | 'Make-Env.ps1' | 'Reset-Password.ps1'
    @param Bound    @{ Name = value } for the parameters the script declares
    @param Psql     It.Psql entries
    @param StdIn    the superuser password ('' = the prompt returns nothing)
    @param CredMode 'ok' | 'readfail' | 'writefail' | 'deletefail'
    @param Store    the fake credential store's initial contents
    @returns @{ Threw; Message; Output; Calls; Store; Writes; Work }
  #>
  param(
    [Parameter(Mandatory = $true)][string]$Script,
    [hashtable]$Bound = @{},
    [object[]]$Psql = @(),
    [string]$StdIn = 'superuser-secret',
    [string]$CredMode = 'ok',
    [hashtable]$Store = @{}
  )

  $path = Join-Path $script:DbDir $Script
  $DbDir = $script:DbDir
  $ast = [System.Management.Automation.Language.Parser]::ParseFile($path, [ref]$null, [ref]$null)
  $block = $ast.Find({ param($node) $node -is [System.Management.Automation.Language.ParamBlockAst] }, $true)
  $parameterNames = @()
  if ($block) { $parameterNames = @($block.Parameters | ForEach-Object { $_.Name.VariablePath.UserPath }) }

  # The generated block reads $TestPlain and $DbDir from the frame that runs it.
  $TestPlain = $StdIn
  $It = New-Object System.Collections.Hashtable
  $It.Psql = $Psql
  $It.Stdin = $StdIn
  $It.CredMode = $CredMode
  $It.Store = $Store.Clone()
  $It.Calls = New-Object System.Collections.ArrayList
  $It.Writes = 0

  $work = Join-Path ([System.IO.Path]::GetTempPath()) ('tryoutsim-test-' + [guid]::NewGuid().ToString('n'))
  New-Item -ItemType Directory -Path $work | Out-Null
  $splat = @{}
  foreach ($name in $parameterNames) { if ($Bound.ContainsKey($name)) { $splat[$name] = $Bound[$name] } }

  # Parsed in memory and run as a block, so $TestPlain, $DbDir and $It resolve in the frames
  # this function and the test file define, and nothing is written for the script to read.
  # The parameter block must lead: with a statement before it, a list whose defaults hold a
  # comma is read as an expression. The caller binds every parameter, so nothing is defaulted.
  $text = (Get-ScenarioScriptText -Path $path).Replace("`r`n", "`n").TrimStart()
  $text = [regex]::Replace($text, '^param\(\s*', 'param(')
  $threw = $null
  $output = ''
  Push-Location -LiteralPath $work
  try {
    $output = (& ([scriptblock]::Create($text)) @splat 2>&1 | Out-String)
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
    Calls = @($script:It.Calls)
    Store = $script:It.Store.Clone()
    Writes = $script:It.Writes
    Work = $work
  }
}

function Remove-Scenario([object]$Result) {
  <# Delete the temporary directory a scenario ran in. #>
  if ($Result -and $Result.Work -and (Test-Path -LiteralPath $Result.Work)) {
    Remove-Item -LiteralPath $Result.Work -Recurse -Force -ErrorAction SilentlyContinue
  }
}
