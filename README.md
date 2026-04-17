# Progress Tracker

Monorepo with:
- `apps/api` - NestJS + Prisma + PostgreSQL
- `apps/web` - Angular SSR app
- `packages/contracts` - shared TypeScript contracts

All commands below are run from repository root.

## 1) First-time setup

1. Install dependencies:

```bash
npm install
```

2. Create API environment file:

```bash
cp apps/api/.env.example apps/api/.env
```

3. Ensure PostgreSQL is running and `DATABASE_URL` in `apps/api/.env` points to your DB.

## 2) Prepare database

Generate Prisma client:

```bash
npm run db:generate
```

Run migrations:

```bash
npm run db:deploy
```

For local iterative development migrations:

```bash
npm run db:migrate
```

Optional DB UI:

```bash
npm run db:studio
```

## 3) Start application

Run backend + frontend together (recommended):

```bash
npm run dev
```

Or run separately:

```bash
npm run start:api
npm run start:web
```

Default endpoints:
- API: `http://localhost:3000`
- Web: `http://localhost:4200`

## 4) Build and production-style start

Build all workspaces:

```bash
npm run build
```

Start API in prod mode:

```bash
npm run start:api:prod
```

Start Angular SSR server (after build):

```bash
npm run start:web:ssr
```

## 5) Manually add a user to database

Create user with username/password:

```bash
npm run user:create -- <username> <password>
```

Example:

```bash
npm run user:create -- igor myStrongPassword123
```

## Useful root scripts

- `npm run dev` - run API and Web in parallel
- `npm run start:api` - API dev server
- `npm run start:web` - Angular dev server
- `npm run build` - build all packages/apps
- `npm run test` - run all tests
- `npm run lint` - run all linters
- `npm run db:generate` - Prisma client generate
- `npm run db:migrate` - Prisma migrate dev
- `npm run db:deploy` - Prisma migrate deploy
- `npm run db:studio` - Prisma Studio
- `npm run user:create -- <username> <password>` - manual user creation
