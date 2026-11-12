/**
 * `db/ProvisioningCommon.ps1`: the pure helpers provisioning and db.env generation depend on.
 *
 * These run in PowerShell 5.1 if it is installed and PowerShell 7 otherwise, and never touch
 * psql or PostgreSQL: they dot-source the helper file into a throwaway session, call one function
 * per test, and compare the string it returns. The recovery flow that needs both a database and a
 * credential store is covered by db/tests/Run-All.ps1.
 */

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const COMMON = fileURLToPath(new URL('../db/ProvisioningCommon.ps1', import.meta.url));

/** Whether a PowerShell host is available; the suite reports one skip if none is. */
const hosts = ['powershell.exe', 'pwsh'].filter((exe) => spawnSync(exe, ['-NoProfile', '-Command', 'exit 0']).status === 0);

/**
 * Run `expr` after dot-sourcing the helpers, in a fresh process (no state leaks between tests).
 * @param {string} expr
 * @returns {string} trimmed stdout
 */
function pwsh(expr) {
  const script = `. '${COMMON.replace(/'/g, "''")}'; $ErrorActionPreference = 'Stop'; ${expr}`;
  const result = spawnSync(hosts[0], ['-NoProfile', '-NonInteractive', '-Command', script], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return String(result.stdout).replace(/\r\n/g, '\n').trim();
}

test('sql literals: a quote is doubled, nothing else changes', { skip: hosts.length === 0 ? 'no PowerShell host' : false }, () => {
  // The assertion is on the literal including its quotes: Quote-SqlLiteral returns one value.
  assert.equal(pwsh("Write-Host -NoNewline (Quote-SqlLiteral \"a'b\")"), "'a''b'", 'quote doubled, still one literal');
  assert.equal(pwsh("Write-Host -NoNewline (Quote-SqlLiteral 'plain')"), "'plain'");
  assert.equal(pwsh("Write-Host -NoNewline (Quote-SqlLiteral \"x';DROP ROLE app;--\")"), "'x'';DROP ROLE app;--'");
});

test('identifiers: plain names pass, anything that could change a statement does not', { skip: hosts.length === 0 }, () => {
  for (const ok of ['tryoutsim_app', '_x', 'A1', 'a'.repeat(63)]) {
    assert.equal(pwsh(`Test-SqlIdentifier '${ok}'`), 'True', ok);
  }
  for (const bad of ['', '1abc', 'app role', 'app;--', 'a"b', 'a'.repeat(64)]) {
    assert.equal(pwsh(`Test-SqlIdentifier '${bad.replace(/'/g, "''")}'`), 'False', bad);
  }
  // A bad identifier never reaches SQL: the builder refuses before producing a statement.
  const refusal = spawnSync(hosts[0], ['-NoProfile', '-NonInteractive', '-Command',
    `. '${COMMON.replace(/'/g, "''")}'; try { Get-CreateRoleSql 'sys"tem' 'x' } catch { $_.Exception.Message }`], { encoding: 'utf8' });
  assert.match(String(refusal.stdout), /not a plain identifier/);
});

test('every builder quotes values and refuses an unsafe identifier', { skip: hosts.length === 0 }, () => {
  assert.equal(pwsh("Get-RoleExistsSql @('a','b')"), "SELECT rolname FROM pg_roles WHERE rolname IN ('a', 'b') ORDER BY rolname;");
  assert.equal(pwsh("Get-CreateRoleSql 'r' \"p'q\""), "CREATE ROLE r LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE PASSWORD 'p''q';");
  assert.equal(pwsh("Get-AlterRolePasswordSql 'r' 'p'"), "ALTER ROLE r PASSWORD 'p';");
  assert.equal(pwsh("Get-DatabaseExistsSql 'd'"), "SELECT datname FROM pg_database WHERE datname = 'd';");
  assert.equal(pwsh("Get-CreateDatabaseSql 'd' 'm'"), 'CREATE DATABASE d OWNER m;');
  assert.equal(pwsh("Get-DatabaseGrantsSql 'd' 'a' 'm'"), 'REVOKE ALL ON DATABASE d FROM PUBLIC; GRANT CONNECT, TEMPORARY ON DATABASE d TO a, m;');
  assert.equal(pwsh("Get-AlterRolePrivilegesSql 'm' 'a'"), 'ALTER ROLE m CREATEDB NOSUPERUSER NOCREATEROLE; ALTER ROLE a NOCREATEDB NOSUPERUSER NOCREATEROLE;');
});

test('connection URL: every component is percent-encoded', { skip: hosts.length === 0 }, () => {
  const url = pwsh("Get-ConnectionUrl -User 'tryoutsim_app' -Secret 'p@ss:w/rd%' -HostName '127.0.0.1' -Port 5432 -Database 'tryoutsim'");
  assert.equal(url, 'postgresql://tryoutsim_app:p%40ss%3Aw%2Frd%25@127.0.0.1:5432/tryoutsim');
  // The user and the host are encoded too: an '@' in either cannot move the authority boundary.
  assert.match(pwsh("Get-ConnectionUrl -User 'a@b' -Secret 's' -HostName 'h/x' -Port 1 -Database 'd'"), /^postgresql:\/\/a%40b:s@h%2Fx:1\/d$/);
  const empty = spawnSync(hosts[0], ['-NoProfile', '-NonInteractive', '-Command',
    `. '${COMMON.replace(/'/g, "''")}'; try { Get-ConnectionUrl -User '' -Secret 's' -HostName 'h' -Port 1 -Database 'd' } catch { $_.Exception.Message }`], { encoding: 'utf8' });
  assert.match(String(empty.stdout), /must not be empty/);
});

test('db.env: one KEY=value per line, ASCII only, trailing newline, app port parsed', { skip: hosts.length === 0 }, () => {
  const text = pwsh("Get-DbEnvText -AppUrl 'a=1' -MigratorUrl 'm=2' -AppPort 4317 | ForEach-Object { $_ }");
  assert.equal(text, '# TryoutSim environment. Contains credentials: owner-only, never committed.\nDATABASE_URL="m=2"\nDATABASE_URL_APP="a=1"\nNODE_ENV=development\nPORT=4317');
  assert.equal(pwsh('Get-AppPort $null'), '4317', 'the server default when PORT is unset');
  assert.equal(pwsh("Get-AppPort '8080'"), '8080');
  const bad = spawnSync(hosts[0], ['-NoProfile', '-NonInteractive', '-Command',
    `. '${COMMON.replace(/'/g, "''")}'; try { Get-AppPort 'eighty' } catch { $_.Exception.Message }`], { encoding: 'utf8' });
  assert.match(String(bad.stdout), /not a valid TCP port/);
});

test('password guard: a generated password is safe inside the statement it is placed in', { skip: hosts.length === 0 }, () => {
  assert.equal(pwsh("$p = New-RandomPassword; if (Test-PasswordInSql (Get-CreateRoleSql 'r' $p) $p) { 'ok' } else { 'fail' }"), 'ok');
  assert.equal(pwsh("Test-PasswordInSql \"ALTER ROLE r PASSWORD 'abc'\" 'abc'"), 'True');
  assert.equal(pwsh("Test-PasswordInSql \"ALTER ROLE r PASSWORD 'abc'\" \"ab'c\""), 'False', "a quote in the secret is refused");
});

test('password shape: base64url, 43 characters, and two runs differ', { skip: hosts.length === 0 }, () => {
  const [a, b] = pwsh("[string](New-RandomPassword) + '|' + [string](New-RandomPassword)").split('|');
  assert.match(a, /^[A-Za-z0-9_-]{43}$/);
  assert.notEqual(a, b);
});

/**
 * `Get-Plan`, the one function that decides what a run does. Each case is a recovery state the
 * operator can actually land in.
 */
test('plan: every role/credential combination resolves to exactly one action', { skip: hosts.length === 0 }, () => {
  const plan = (exists, stored, reset = '$false') => pwsh(
    `$plan = Get-Plan -Roles @('m','a') -Exists @{m=$${exists[0]};a=$${exists[1]}} -Stored @{m=${stored[0] === null ? '$null' : `'${stored[0]}'`};a=${stored[1] === null ? '$null' : `'${stored[1]}'`}} -ResetPassword:${reset}; ` +
    `"create=$($plan.Create -join ',') reset=$($plan.Reset -join ',') unrecoverable=$($plan.Unrecoverable -join ',') stale=$($plan.Stale -join ',')"`,
  );

  assert.equal(plan([false, false], [null, null]), 'create=m,a reset= unrecoverable= stale=', 'fresh machine');
  assert.equal(plan([true, true], ['x', 'x']), 'create= reset= unrecoverable= stale=', 're-run: nothing to do');
  assert.equal(plan([true, false], ['x', null]), 'create=a reset= unrecoverable= stale=', 'one role missing');
  assert.equal(plan([false, true], ['x', null]), 'create=m reset= unrecoverable=a stale=m',
    'CREATE ROLE failed after the credential was stored: the stale credential is replaced and the role created');
  assert.equal(plan([true, true], [null, 'x']), 'create= reset= unrecoverable=m stale=',
    'a role whose password was lost stops the run instead of guessing');
  assert.equal(plan([true, true], [null, 'x'], '$true'), 'create= reset=m unrecoverable= stale=',
    'the same state with -ResetPassword is recoverable, and only that role is touched');
});

/**
 * `Invoke-SuperuserSql` against a stub psql. This is the one test that uses the real helper: the
 * scenario suite replaces it with a double, which is how a regression in its own environment
 * handling (it used to delete PGPASSWORD after the first statement) went unnoticed.
 *
 * The stub records each call's environment and exits 0, so nothing here contacts PostgreSQL.
 */
test('superuser psql: one password survives every statement of a run', { skip: hosts.length === 0 }, () => {
  const result = spawnSync(hosts[0], ['-NoProfile', '-NonInteractive', '-Command', `
    $ErrorActionPreference = 'Stop'
    . '${COMMON.replace(/'/g, "''")}'
    $stub = Join-Path $env:TEMP ('psql-stub-' + [guid]::NewGuid().ToString('n') + '.cmd')
    $log = Join-Path $env:TEMP ('psql-log-' + [guid]::NewGuid().ToString('n') + '.txt')
    Set-Content -LiteralPath $stub -Value ('@echo off' + "\`r\`n" + 'echo %PGPASSWORD%>>"' + $log + '"' + "\`r\`n" + 'echo 1') -Encoding ascii
    $script:SuperuserConnection = @{ SuperUser = 'postgres'; HostName = '127.0.0.1'; Port = 5432; PsqlPath = $stub }
    try {
      $env:PGPASSWORD = 'op-test-password'
      $null = Invoke-SuperuserSql -Sql 'SELECT 1;'
      $null = Invoke-SuperuserSql -Sql 'SELECT 2;'
      $null = Invoke-SuperuserSql -Sql 'SELECT 3;'
      $seen = @(Get-Content -LiteralPath $log | Where-Object { $_ -ne '' } | ForEach-Object { $_.TrimEnd([char]13) })
      "calls=$($seen.Count) same=$(@($seen | Select-Object -Unique).Count -eq 1) value=$($seen[0]) live=$([bool]$env:PGPASSWORD)"
    } finally {
      Remove-Item -LiteralPath $stub, $log -Force -ErrorAction SilentlyContinue
      Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
    }
  `], { encoding: 'utf8' });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const out = String(result.stdout).trim();
  assert.equal(out, 'calls=3 same=True value=op-test-password live=True',
    'each of the three statements saw the same password, and the caller still holds it');
});

test('superuser psql: a missing password is refused before psql runs', { skip: hosts.length === 0 }, () => {
  const refusal = spawnSync(hosts[0], ['-NoProfile', '-NonInteractive', '-Command', `
    . '${COMMON.replace(/'/g, "''")}'
    $script:SuperuserConnection = @{ SuperUser = 'postgres'; HostName = '127.0.0.1'; Port = 5432; PsqlPath = 'psql-does-not-exist' }
    Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
    try { $null = Invoke-SuperuserSql -Sql 'SELECT 1;' } catch { $_.Exception.Message }
  `], { encoding: 'utf8' });

  assert.match(String(refusal.stdout), /not in PGPASSWORD/, 'the preflight stays and still refuses an empty password');
});
