# Deployment and Backup

Canonical source for **how the app is started and stopped on the user's machine**, and for **backup,
restore and retention**. Referenced by [PRD.md](../product/PRD.md) NFR-1…NFR-4,
[SYSTEM_ARCHITECTURE.md](./SYSTEM_ARCHITECTURE.md) §4, [SECRETS.md](../backend/SECRETS.md) §2,
[MIGRATION_STRATEGY.md](../backend/MIGRATION_STRATEGY.md) §5,
[NOTIFICATION_SPECIFICATION.md](../backend/NOTIFICATION_SPECIFICATION.md) §2.

---

## 1. Running the app

### 1.1 Shape

- Frontend and backend run **on the user's machine**. There is no cloud server for app data
  ([PRD.md](../product/PRD.md) O-6, ADR-001).
- The backend binds `127.0.0.1` only ([SECURITY.md](./SECURITY.md) §2).
- **One command or shortcut starts both.** There is no separate "start the API" step for the user.
- **Everything works offline except AI calls.** Selecting a package, sitting a session, scoring, analytics,
  reports, materials, backup and restore all work with no network and no provider
  ([PRD.md](../product/PRD.md) NFR-1).

### 1.2 Startup sequence

Ordered; each step must complete before the next:

1. Launcher starts the backend process.
2. Backend acquires the single-instance lock on the data directory; a second instance exits with a clear
   message instead of sharing the same database and credentials.
   The backend then connects to the local **PostgreSQL 18** server (`127.0.0.1:5432` by default,
   [ADR-002](../decisions/ADR-002-sqlite.md)). If the server is unreachable, or the role/database does
   not exist, the launcher shows the backend's error and the remedy (§1.5) — it never opens a blank page.
3. Backend applies pending migrations ([MIGRATION_STRATEGY.md](../backend/MIGRATION_STRATEGY.md) §2) and
   refuses to serve if a migration fails (a failed migration is a hard stop, never a partial start).
4. Backend inspects leftover jobs ([GENERATION_JOBS.md](../backend/GENERATION_JOBS.md) §5) and decides
   resume vs retry per job.
5. Backend reports ready on a health route (`GET /health`) only after 1–4 succeed.
6. **Only after ready** does the launcher open the browser to the app URL. If readiness is not reported
   within a bounded wait, the launcher shows the backend's error output instead of opening a blank page.

### 1.3 Shutdown

- Clean shutdown: the launcher signals the backend, which stops accepting new work, finishes or marks
  in-flight jobs `interrupted` (§[GENERATION_JOBS] §2/§5), flushes autosave state that is already
  transactional, and releases its PostgreSQL connections.
- Killing the process is tolerated: PostgreSQL rolls back any uncommitted transaction, so the database
  is consistent on next start, and leftover jobs are handled by step 4 above. The launcher does **not**
  stop the PostgreSQL server on exit — other databases and the operating system's service may depend on
  it. No user action is needed.

### 1.4 Not in scope

- No service install, no auto-start-on-login in MVP, no remote/self-host option, no container image.
- No multi-user or multi-machine sharing of one live database.

### 1.5 Database provisioning (one-time, manual)

The **server** is installed separately; the app does not install PostgreSQL.

**What the app requires — created once by the user, not by the app silently:**

| Item | Example | Note |
|---|---|---|
| Server | PostgreSQL 18 on `127.0.0.1:5432` | installed and running as a Windows service; the app only connects |
| Role | `tryoutsim_app` | login role, **owns nothing**, no `CREATEDB`, no DDL; runtime DML only |
| Migration role | `tryoutsim_migrator` | login role, owns the tables, holds `CREATEDB` for the shadow database; never used by the runtime |
| Password | chosen by the user, one per role | stored outside the data directory and outside backups |
| Database | `tryoutsim` | **created by the operator, not the app**; the app never creates a database |

- Connection settings come from environment variables read at start
  (`PGHOST`, `PGPORT`, `PGDATABASE`, `PGUSER`, `PGPASSWORD`), never from a checked-in file. A missing or
  rejected connection is a start failure with a stated remedy, not a silent fallback (§1.2).
- **A missing server, role, database or password is not a degraded mode.** It is a configuration
  error the user fixes once; the app does not fall back to another datastore.
- **Prisma Migrate needs a shadow database** ([ADR-011](../decisions/ADR-011-orm-selection.md) §5), and on
  PostgreSQL the datasource user must be superuser or hold `CREATEDB` — a configured `shadowDatabaseUrl`
  points at a pre-created database but does not remove the requirement.
- **Two roles, and the app role never holds `CREATEDB`.** A migration role owns the database, schema and
  tables and runs `migrate dev` / `migrate deploy`; the app role gets table DML only. Migrations are an
  explicit step, never part of serving; the app's start path runs `migrate status` and fails hard on drift
  or a pending migration. The split is recommended in
  [SCHEMA_CONTRACT_REVIEW](../backend/SCHEMA_CONTRACT_REVIEW.md) §2.2 and awaits the Product Owner
  decision in its §5.5.
- Neither role is created by the app; provisioning is always manual.
- The exact role/database names and the credential storage location are implementation details
  recorded at Gate 3; this section fixes only that provisioning is manual once and outside backups.
- **The role passwords live in one file, `.env` at the repository root** (Decision 2026-11-11). It
  is covered by `.gitignore`, must be readable by the current Windows account alone, holds
  `DATABASE_URL` (migrator) and `DATABASE_URL_APP` (app), and never the superuser password — the
  provisioning script reads that from the console without echo. The serving process reads only
  `DATABASE_URL_APP`. Windows Credential Manager is not used for these credentials; the AI
  provider keys remain in the OS credential store ([SECRETS.md](../backend/SECRETS.md) §2).
  Steps: [backend/db/README.md](../../backend/db/README.md).

## 2. Backup

### 2.1 What a backup contains

A backup is a **single archive file** written to a folder the user chooses. Contents:

| Included | Excluded by default |
|---|---|
| Database dump (all records as of the snapshot, `pg_dump` plain SQL) | Provider API keys ([SECRETS.md](../backend/SECRETS.md) §2) |
| | The DB role's password (provisioning, not app data) |
| Config export (versions, basis, approvals) | Local logs |
| Package and material definitions with versions | The app's own cache/temp files |
| App settings that are not machine-specific | Machine-specific paths and the OS keychain reference |

**API keys are not exported by default.** On restore the user re-enters the key; the app verifies it with
a connection test ([AI_PROVIDER_ARCHITECTURE.md](../ai/AI_PROVIDER_ARCHITECTURE.md) §3). An opt-in
"include keys" export is **not** in MVP.

### 2.2 Automatic and manual

| Mode | Trigger | Destination |
|---|---|---|
| Automatic | on clean shutdown, and on a scheduled interval while running (at most one per day) | the user-chosen backup folder |
| Manual | user action in **Kelola → Pengaturan** | the same folder, or another folder chosen for that run |

- A backup is written to a temporary file in the destination folder, **verified** (archive opens, its
  schema version and manifest are readable, expected tables are present per the manifest) and only then
  renamed to its final name.
- The dump is taken with `pg_dump` against the running server. A server that is unreachable at backup
  time is a `failed` run with that reason — never an empty "successful" archive.
- **A backup that is not verified is not a success.** If the folder is missing, unwritable, on a
  disconnected drive, or verification fails, the run is `failed` with the reason recorded, a
  `backup_failed` notification is raised
  ([NOTIFICATION_SPECIFICATION.md](../backend/NOTIFICATION_SPECIFICATION.md) §2), and the UI never shows
  success. The last known-good backup timestamp is shown separately and is not overwritten by a failure.
- Backups never run concurrently; a manual run during an automatic run reports "backup in progress".
- The backup folder may be a synced folder (OneDrive, etc.). The app does not depend on it and never
  claims the file left the machine.

### 2.3 Retention

- Retention is by **count and age**, both user-visible in **Kelola → Pengaturan**:
  keep the last *N* automatic backups (default **7**) and never keep an automatic backup older than
  *D* days (default **30**). Manual backups are never pruned automatically.
- Pruning happens **after** a new backup verifies, never before. A failed backup never prunes.
- Deleting the backup folder contents outside the app is the user's act; the app then reports "no backup
  found" rather than recreating silently.

## 3. Restore and cross-device migration

Restore runs from **Kelola → Pengaturan → Pulihkan**, as a wizard:

1. **Choose archive** — the user picks a backup file.
2. **Compatibility validation** (before any write):
   - archive manifest readable and schema version known;
   - archive schema version ≤ current app schema version (downgrade is refused, not attempted);
   - required tables present; integrity check passes;
   - **no destructive downgrade**: an archive newer than the app cannot be restored.
3. **Preview** — the wizard states what will be replaced: database contents, configs, packages, materials,
   settings; and what will **not** be restored: API keys, logs.
4. **Confirm** — an explicit confirmation is required; this step is destructive.
5. **Restore** — migrations run forward if the archive is older; a failure aborts **before** the live
   database is replaced (the current database is dumped aside as a recovery file first, using the same
   `pg_dump` mechanism as §2). The archive is loaded with `pg_restore`/`psql` inside one transaction so a
   failed restore leaves the previous data intact.
6. **Post-restore checks** — key presence for each provider, connection test offered, migration of
   keychain references (a reference from another machine is invalid → marked "key missing").
7. **Done** — a `restore_completed` notification is raised; analysis screens re-read their contracts.

### 3.1 Cross-device rules

- The archive is machine-independent except for **provider key references**: keys live in OS secure
  storage and never travel ([SECRETS.md](../backend/SECRETS.md) §2). After restore, providers exist but
  report `hasKey = false` until re-entered.
- Sessions, results, history and reports restore **verbatim**; immutable results are never recomputed
  ([SCORING_METHODOLOGY.md](../examination/SCORING_METHODOLOGY.md) §7).
- A restore never merges two databases. The archive replaces the current data after the confirmation.

## 4. Data location

- One data directory, resolved at first run, holding backups settings and local logs.
- The **database lives in the PostgreSQL server's own data directory**, not in the app's data directory.
  The app's data directory never holds a database file; it may hold the provisioning template that
  names the connection target, but never the role's password (§1.5).
- The path is shown in **Kelola → Pengaturan** with a copy action, so a user can find their data without
  documentation.
- Provider keys are **not** in that directory; they are in OS secure storage
  ([SECRETS.md](../backend/SECRETS.md) §2).

## 5. What this file does not own

- Migration mechanics → [MIGRATION_STRATEGY.md](../backend/MIGRATION_STRATEGY.md).
- Key storage and masking → [SECRETS.md](../backend/SECRETS.md).
- Job restart policy → [GENERATION_JOBS.md](../backend/GENERATION_JOBS.md) §5.
- Notification records → [NOTIFICATION_SPECIFICATION.md](../backend/NOTIFICATION_SPECIFICATION.md).
