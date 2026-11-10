import { defineConfig } from 'prisma/config';

/**
 * Prisma CLI configuration (Prisma 7). The CLI talks to the migration role
 * (`DATABASE_URL`), which owns every table and holds `CREATEDB` for the shadow
 * database. The runtime talks to the app role (`DATABASE_URL_APP`) and never
 * runs a migration — see docs/backend/MIGRATION_STRATEGY.md §7 and
 * docs/architecture/DEPLOYMENT_AND_BACKUP.md §1.5.
 */
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: process.env.DATABASE_URL,
  },
});
