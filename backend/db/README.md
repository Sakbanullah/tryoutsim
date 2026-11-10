# Database provisioning

One-time, manual, per machine ([DEPLOYMENT_AND_BACKUP](../../docs/architecture/DEPLOYMENT_AND_BACKUP.md) §1.5).
The app never creates a database, a role or a password.

## Why it is manual

`pg_hba.conf` on this machine authenticates every local connection with `scram-sha-256`, so provisioning
needs the PostgreSQL **superuser** password. That password is not stored anywhere the implementation may
read, and the Product Owner decision forbids changing the global PostgreSQL configuration (including
switching an `hba` line to `trust`) to avoid needing it. So the four steps below need you, once.

## The four steps

Run from `D:\tryoutsim\backend`, in a shell where the superuser password is available. Nothing prints a
password, and none is written to a plaintext file: `provision.ps1` generates a random one per role and
writes it straight into Windows Credential Manager.

```powershell
# 0. Superuser password, this shell only. It is never read by any script in this repo.
$env:PGPASSWORD_SUPERUSER = (Read-Host -AsSecureString 'postgres password')

# 1. Create roles + database, random passwords into Credential Manager.
.\db\provision.ps1

# 2. Apply both migrations as the migrator (the migrator owns everything).
$env:DATABASE_URL = (Get-Content (.\db\make-env.ps1 -OutFile "$env:LOCALAPPDATA\TryoutSim\db.env") | Out-Null; `
  (Select-String '^DATABASE_URL=' "$env:LOCALAPPDATA\TryoutSim\db.env").Line -replace '^DATABASE_URL=','')
npx prisma migrate deploy

# 3. Grants (provisioning SQL, never a migration).
psql -X -v ON_ERROR_STOP=1 -d tryoutsim -U tryoutsim_migrator `
  -v app_role=tryoutsim_app -v migrator_role=tryoutsim_migrator -v database=tryoutsim `
  -f .\db\provision-grants.sql

# 4. Connection strings for the app, written outside the repository.
.\db\make-env.ps1 -OutFile "$env:LOCALAPPDATA\TryoutSim\db.env"
```

Then start the app with that file loaded:

```powershell
Get-Content "$env:LOCALAPPDATA\TryoutSim\db.env" | ForEach-Object {
  if ($_ -match '^([A-Z_]+)=(.*)$') { Set-Item "env:$($matches[1])" $matches[2] }
}
npm start
```

## After step 2 — the two open verifications

These cannot be answered without a live server and are **not yet claimed**:

1. **Custom-object drift.** `prisma migrate dev` replays history in a shadow database and compares it to
   the dev database. It is unknown whether it reports the triggers, `CHECK`s and the delete function as
   drift on every run (top open risk — `SCHEMA_CONTRACT_REVIEW` §5.0 blocker 6). Run `npx prisma migrate dev`
   once after provisioning and record what it does.
2. **Migration atomicity.** Prisma CLI 7 does not promise one transaction per migration
   (`MIGRATION_STRATEGY` §7). The custom migration is written to be safely re-runnable; if step 2 fails
   part-way, use `npx prisma migrate resolve --rolled-back <migration>`, inspect, fix, redeploy — never
   `migrate reset` on a database with data.
