# Database provisioning

One-time, manual, per machine ([DEPLOYMENT_AND_BACKUP](../../docs/architecture/DEPLOYMENT_AND_BACKUP.md) §1.5).
The app never creates a database, a role or a password.

## Where the credentials live

**One file: `.env` at the repository root** (`D:\tryoutsim\.env`).

```ini
DATABASE_URL="postgresql://tryoutsim_migrator:<migrator-password>@127.0.0.1:5432/tryoutsim"
DATABASE_URL_APP="postgresql://tryoutsim_app:<app-password>@127.0.0.1:5432/tryoutsim"
NODE_ENV=development
```

- It carries the two **role** passwords. The **superuser** password is never stored: the
  provisioning script asks for it at the console, without echo.
- `.gitignore` covers `.env`; `provision.ps1` refuses a path Git does not ignore.
- It must be readable by the current Windows account alone (`Assert-OwnerOnly`). One-time fix if
  it is not: `icacls .env /inheritance:r /grant:r "$env:USERNAME:(F)"`.
- Backend reads only `DATABASE_URL_APP` (`src/config.js`); Prisma Migrate reads `DATABASE_URL`
  (`prisma.config.ts`). Neither process reads the other's URL.

## The steps

Run from `D:\tryoutsim\backend`. Nothing prints a password.

```powershell
# 1. Roles + database. Asks for the postgres password once; generates a password per role only
#    when the file has no connection string for that role yet.
.\db\provision.ps1

# 2. Migrations, as the migrator role.
. .\db\Load-Env.ps1
npm run migrate:deploy

# 3. Grants (provisioning SQL, never a migration).
psql -X -v ON_ERROR_STOP=1 -d tryoutsim -U tryoutsim_migrator `
  -v app_role=tryoutsim_app -v migrator_role=tryoutsim_migrator -v database=tryoutsim `
  -f .\db\provision-grants.sql

# 4. Prove both roles connect.
npm test
```

## Re-running, and recovery

`provision.ps1` is idempotent, and "idempotent" is decided by a connection, not by the file: before
it plans anything it tries each stored connection string with `SELECT 1`. A credential the server
accepts is left alone; one it rejects is treated exactly like a missing one.

| State | What the script does |
|---|---|
| role missing, URL in the file | creates the role **with the file's password** (recovery) |
| role missing, no URL | new password, written to the file first, then `CREATE ROLE` |
| role exists, URL accepted | nothing; `AUTH` tried once, then reported |
| role exists, URL rejected | stops, changes nothing; names the role and `-ResetPassword` |
| role exists, no URL | stops, changes nothing; names `-ResetPassword` |

Recovery, when a role's password is known but the file lost it:

```powershell
.\db\Set-Secret.ps1 -Name DATABASE_URL_APP      # prompts without echo; URL-encodes the password
.\db\Set-Secret.ps1 -Name DATABASE_URL
.\db\provision.ps1                              # applies exactly those passwords
```

Rotate one role's password (writes the new URL first, then `ALTER ROLE`):

```powershell
.\db\Reset-Password.ps1 -Role tryoutsim_app
```

Repair both roles when the file and the server disagree — the passwords are **not** known:

```powershell
.\db\provision.ps1 -ResetPassword               # both roles; a role that still authenticates is untouched
```

The file is written before `ALTER ROLE` in every reset path, so a failure in between leaves a file
the next run installs, never a role whose password nobody holds. Re-run the same command to finish.

## After step 2 — the two open verifications

These cannot be answered without a live server and are **not yet claimed**:

1. **Custom-object drift.** `prisma migrate dev` replays history in a shadow database and compares
   it to the dev database. It is unknown whether it reports the triggers, `CHECK`s and the delete
   function as drift on every run (top open risk — `SCHEMA_CONTRACT_REVIEW` §5.0 blocker 6). Run
   `npx prisma migrate dev` once after provisioning and record what it does.
2. **Migration atomicity.** Prisma CLI 7 does not promise one transaction per migration
   (`MIGRATION_STRATEGY` §7). The custom migration is written to be safely re-runnable; if step 2
   fails part-way, use `npx prisma migrate resolve --rolled-back <migration>`, inspect, fix,
   redeploy — never `migrate reset` on a database with data.
