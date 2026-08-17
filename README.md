# Docket

A _docket_ is a numbered register of items awaiting a decision. Every job application you send
enters it numbered, stamped with the local date and time, and waits for an answer that may never
come. The product is that register.

Phases 1 (foundation) and 2 (parity with the original prototype) are in place. The public landing
page, the funnel, reminders and billing are phases 3–5.

## Stack

Next.js 15 (App Router, TypeScript strict) · Tailwind CSS 4 · Drizzle ORM on Neon Postgres ·
Auth.js v5 (Google, GitHub) · Zod · React Hook Form · Vitest · Playwright. Package manager: pnpm.

## Getting it running

```bash
pnpm install
cp .env.example .env.local     # then fill it in, see below
pnpm db:migrate                # applies drizzle/0000_*.sql
pnpm dev
```

### What you need to create

Nothing in this repo can provision these for you.

1. **Neon** — create a project, copy the _pooled_ connection string into `DATABASE_URL`.
   The serverless driver speaks HTTP, so local development points at a Neon branch too.
2. **`AUTH_SECRET`** — `openssl rand -base64 32`.
3. **Google OAuth** — Cloud Console → Credentials → OAuth client ID (web).
   Redirect URI: `http://localhost:3000/api/auth/callback/google`, plus one per deployed origin.
4. **GitHub OAuth** — Settings → Developer settings → OAuth Apps.
   Callback URL: `http://localhost:3000/api/auth/callback/github`.
5. **Vercel** — import the repo, add the same variables, connect the Neon integration so preview
   deployments get a database branch per pull request.

Providers register only when their variables are present, so the app boots without them — the
sign-in page will simply say none is configured.

## Commands

| Command                     | What it does                                 |
| --------------------------- | -------------------------------------------- |
| `pnpm dev`                  | development server                           |
| `pnpm build` / `pnpm start` | production build and serve                   |
| `pnpm typecheck`            | `tsc --noEmit`                               |
| `pnpm lint`                 | ESLint                                       |
| `pnpm test`                 | Vitest unit and guard tests                  |
| `pnpm test:e2e`             | Playwright (boots `pnpm dev` itself)         |
| `pnpm db:generate`          | new migration from `src/server/db/schema.ts` |
| `pnpm db:migrate`           | apply migrations                             |

## Layout

```
src/
  app/
    (app)/          docket, docket/import, settings — behind the session gate
    api/            auth callbacks, POST /api/import
    sign-in/
  components/
    docket/         Stamp, StampForm, EntriesTable, CityField, CompanyLogo
    settings/
  server/
    actions/        one server action per use case
    auth/session.ts requireScope() / getScope()
    db/schema.ts    Drizzle schema
    db/queries/     the only place that touches a table
    import/         shared import runner
  lib/
    stack-detector/ dictionary + algorithm (pure, tested)
    cities/         city → country base (pure, tested)
    import/         CSV and JSON parsing (pure, tested)
    validation/     Zod schemas shared by form and action
```

## The rules that hold this up

1. **Every query filters by owner in the query layer.** Query functions take a `Scope` and build
   their WHERE through `scope.owned()`. ESLint blocks `@/server/db` and `drizzle-orm` imports from
   `src/app`, `src/components` and `src/lib`, and `scope.test.ts` reads the query sources and fails
   if any read, update or delete escapes the owner predicate.
2. **Server actions check the session first, then Zod, then touch the database.** No exceptions:
   an action is a public endpoint regardless of which button called it.
3. **No `any`.** `strict` and `noUncheckedIndexedAccess` are on.

### Testing isolation for real

`src/server/db/queries/tenant-isolation.test.ts` creates two users and has one try to read, export
and delete the other's entries. It needs a throwaway database:

```bash
TEST_DATABASE_URL="postgresql://…" pnpm test
```

Without that variable it skips, and the source-level guard in `scope.test.ts` still runs.

## Importing from the prototype

`/docket/import` and `POST /api/import` share one parser. Both accept:

- the prototype's JSON export (`empresa`, `posicao`, `stacks[]`, `cidade`, `pais`, `observacoes`,
  `site`, `criadoEm`) and Docket's own JSON export;
- CSV with either Portuguese or English headers, including the prototype's merged
  “País/Cidade” column and its `dd/mm/yyyy HH:MM` dates.

City names are canonicalised to English on the way in — typing or importing “Berlim”, “München” or
“Berlin” all store `Berlin` / `Germany`, which is what makes response-rate-by-country comparable
later. Rows that cannot be read are reported back with their line number; nothing is dropped
silently.

## Your data

Export as CSV (`/docket/export`) or complete JSON (`/settings/export`) at any time, and delete the
account from `/settings`. Deletion cascades to every entry, tag and status event immediately.
