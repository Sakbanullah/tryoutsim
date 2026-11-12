/**
 * The OS credential-store boundary (SECRETS.md §2).
 *
 * Keys are write-only: this module writes them, reads them back only for the
 * provider transport at send time, and never returns, logs or throws one. The
 * only value that leaves it towards the database or a response is the masked
 * tail (`keyLast4`) computed here.
 *
 * `storeKind` values are the closed set of DATABASE_SCHEMA `secret_ref.storeKind`
 * (C-17). Entry names are `tryoutsim/<installId>/provider/<providerId>`, so two
 * installs on one machine never overwrite each other (SECRETS §2).
 *
 * ponytail: only the Windows Credential Manager implementation exists. Keychain /
 * Secret Service are a `storeKind` the schema reserves; an implementation is added
 * when the app actually ships on that platform, not before.
 */

import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

/** The helper shipped beside this module. */
export const DEFAULT_SCRIPT_PATH = fileURLToPath(new URL('./CredentialStore.ps1', import.meta.url));

/** The store kinds the schema accepts (DATABASE_SCHEMA C-17). */
export const STORE_KINDS = Object.freeze(['windows_credential_manager', 'macos_keychain', 'secret_service']);

/** Credential-entry name prefix; the install id is appended by `entryName`. */
const ENTRY_PREFIX = 'tryoutsim';

/**
 * Build a credential-store entry name for a provider.
 *
 * @param {string} installId stable per-install id (not a secret)
 * @param {string} providerId the `provider` row id
 * @returns {string}
 */
export function entryName(installId, providerId) {
  if (typeof installId !== 'string' || installId.length === 0) throw new Error('installId is required.');
  if (typeof providerId !== 'string' || providerId.length === 0) throw new Error('providerId is required.');
  return `${ENTRY_PREFIX}/${installId}/provider/${providerId}`;
}

/**
 * The masked tail shown to the user. `Authorization` is materialised at send time
 * from the key itself, so `hasKey` — never this value — decides whether a key exists.
 *
 * @param {string} key
 * @returns {string} the last 4 characters, or the whole key when shorter
 */
export function keyLast4(key) {
  if (typeof key !== 'string' || key.length === 0) throw new Error('A non-empty key is required.');
  return key.slice(-4);
}

/**
 * The store kind of the current platform, or `null` when unsupported.
 * @returns {'windows_credential_manager' | null}
 */
export function platformStoreKind() {
  return process.platform === 'win32' ? 'windows_credential_manager' : null;
}

/**
 * An install-scoped id that is stable across restarts without configuration, and
 * is neither the username nor any secret. It only namespaces entries.
 * @returns {string}
 */
export function defaultInstallId() {
  return createHash('sha256').update(process.env.USERPROFILE ?? process.env.HOME ?? 'local').digest('hex').slice(0, 12);
}

/**
 * Windows Credential Manager store (ADVAPI32 `CredWriteW`/`CredReadW`/`CredDeleteW`
 * through one PowerShell helper, `src/secrets/CredentialStore.ps1`).
 *
 * The key reaches the helper on **stdin** as UTF-8 and never on a command line,
 * an environment variable or a temporary file: an argument appears in the Win32
 * process command line, which any local process can read.
 *
 * @param {{scriptPath: string, powershell?: string}} options
 * @returns {{kind: string, write: (name: string, key: string) => Promise<void>, read: (name: string) => Promise<string | null>, delete: (name: string) => Promise<boolean>}}
 */
export function createWindowsCredentialStore({ scriptPath = DEFAULT_SCRIPT_PATH, powershell = 'powershell.exe' } = {}) {
  /**
   * Run one helper command; the secret, when there is one, goes through stdin.
   * `spawn` with an array of arguments starts no shell, so no value is ever
   * interpolated into a command line.
   * @param {'write'|'read'|'delete'} command
   * @param {string} name
   * @param {string} [key]
   * @returns {Promise<string>} trimmed stdout
   */
  function invoke(command, name, key) {
    return new Promise((resolve, reject) => {
      const child = spawn(
        powershell,
        ['-NoProfile', '-NoLogo', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', scriptPath, command, name],
        { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] },
      );
      /** @type {Buffer[]} */
      const out = [];
      child.stdout.on('data', (chunk) => out.push(chunk));
      // stderr is drained, never surfaced: it could echo output, and the message
      // a caller sees names the command only.
      child.stderr.resume();
      child.on('error', () => reject(new Error(`Credential store ${command} failed (spawn).`)));
      child.on('close', (code) => {
        if (code === 0) resolve(Buffer.concat(out).toString('utf8').trim());
        else reject(new Error(`Credential store ${command} failed (exit ${code}).`));
      });
      child.stdin.on('error', () => undefined);
      child.stdin.end(key ?? '');
    });
  }

  return {
    kind: /** @type {'windows_credential_manager'} */ ('windows_credential_manager'),
    /** Store or replace a key under `name`. */
    async write(name, key) {
      if (typeof key !== 'string' || key.length === 0) throw new Error('A non-empty key is required.');
      await invoke('write', name, key);
    },
    /** Read a key, or `null` when the entry is absent (deleted outside the app). */
    async read(name) {
      const value = await invoke('read', name);
      return value.length === 0 ? null : value;
    },
    /** Delete an entry; `false` when it did not exist. */
    async delete(name) {
      return (await invoke('delete', name)) === 'deleted';
    },
  };
}

/**
 * In-memory store for tests and non-persistent runs. It is never the default in
 * the serving process: an in-memory key does not survive a restart.
 * @returns {{kind: string, write: Function, read: Function, delete: Function}}
 */
export function createMemorySecretStore() {
  /** @type {Map<string, string>} */
  const entries = new Map();
  const listEntries = async (/** @type {string} */ prefix) => [...entries.keys()].filter((name) => name.startsWith(prefix));
  return {
    kind: /** @type {'windows_credential_manager'} */ ('windows_credential_manager'),
    /** @param {string} name @param {string} key */
    async write(name, key) {
      if (typeof key !== 'string' || key.length === 0) throw new Error('A non-empty key is required.');
      entries.set(name, key);
    },
    /** @param {string} name @returns {Promise<string | null>} */
    async read(name) {
      return entries.get(name) ?? null;
    },
    /** @param {string} name @returns {Promise<boolean>} */
    async delete(name) {
      return entries.delete(name);
    },
    /** Enumerate entry names under a prefix (tests only; Windows has no prefix enumeration here). */
    listEntries,
    /** Test helper: whatever the store holds, for asserting on a secret's lifetime without touching production code. */
    _entries: entries,
  };
}
