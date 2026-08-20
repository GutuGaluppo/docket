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
    (app)/          docket, board, calendar, archive, analytics, import, settings
                    — behind the session gate
    api/            auth callbacks, POST /api/import
    sign-in/
  components/
    docket/         Stamp, StampForm, EntriesTable, CityField, CompanyLogo
    archive/        the rejection archive: RejectionsTable, ReopenButton
    settings/
  server/
    actions/        one server action per use case
    auth/session.ts requireScope() / getScope()
    db/schema.ts    Drizzle schema
    db/queries/     the only place that touches a table
    import/         shared import runner
    posting/        the guarded fetch and the pipeline that drives it
  lib/
    stack-detector/ dictionary + algorithm (pure, tested)
    cities/         city → country base (pure, tested)
    import/         CSV and JSON parsing (pure, tested)
    posting/        pasted link → draft entry (pure, tested)
    validation/     Zod schemas shared by form and action
docs/
  entry-form.md     the entry form and the link pipeline, kept true by a test
  loading.md        what waits on a query in each section, kept true by a test
  pitch.md          the product in a paragraph, in English and Portuguese
```

## The rules that hold this up

1. **Every query filters by owner in the query layer.** Query functions take a `Scope` and build
   their WHERE through `scope.owned()`. ESLint blocks `@/server/db` and `drizzle-orm` imports from
   `src/app`, `src/components` and `src/lib`, and `scope.test.ts` reads the query sources and fails
   if any read, update or delete escapes the owner predicate.
2. **Server actions check the session first, then Zod, then touch the database.** No exceptions:
   an action is a public endpoint regardless of which button called it.
   A correlated subquery names its outer column as `${applications}."id"`, never
   `${applications.id}`. Drizzle renders the short form without the table name when the fragment
   is a select field, and inside a subquery over a table that has an `id` of its own — `interviews`,
   `status_events` — that bare name binds to the inner table. Nothing errors; the field is simply
   null or zero for every row. `correlated.test.ts` fails on the short form.
3. **A page's shell never waits on a query.** The heading, the prose and the forms of a section
   do not depend on the database, so they are returned first and the queries are awaited inside
   `<Suspense>` boundaries drawn around the regions that actually need them — the register's rows,
   the board's columns, the month grid. A page-wide skeleton is the wrong answer: it hides work
   that was already done. `src/components/Skeleton.tsx` holds the shapes, drawn at the size of what
   they stand in for so nothing jumps. A section with nothing to fetch — `/docket/import` — has no
   loader at all.
4. **No `any`.** `strict` and `noUncheckedIndexedAccess` are on.
5. **The version in the footer is bumped by hand, on releases worth marking.**
   `package.json` is the single source and `src/lib/version.ts` is the only reader, so
   `pnpm version minor` moves the number everywhere it appears. It marks a release someone
   decided was worth marking — a judgement no commit count can make — so it does not move on
   every merge. Hovering it shows the commit the running deployment was built from, which is the
   separate question of whether a fix is live yet.
6. **The entry form documents itself, or the build fails.** [`docs/entry-form.md`](docs/entry-form.md)
   describes the form and the four phases of the link pipeline;
   `src/lib/posting/documentation.test.ts` reads the source and fails when a module, board, field,
   refused host or phase in the code is missing from the document, or when the document points at a
   file that no longer exists. Change the form, change the document, same commit.

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

## The rejection archive

Applications that ended in a refusal leave the register and the board, and are kept at `/archive`.
Nothing is deleted: the entry keeps its protocol number, its stamp and its history, and **Reopen**
puts it back in the column it was in when the refusal landed.

There is one way in, reached from two places. **Rejected** on a docket row, with an optional line
about what they said, and dropping a card into the board's last column both call the same code —
so the board, the funnel and the archive can never disagree about where an entry ended up. The
column the process had reached is copied onto the entry by name, the way `status_events` copies it,
so the archive still reads correctly after that column is renamed or removed.

The figure worth reading there is not the total but how many refusals arrived before a single
interview was booked: applications dying at the door and applications dying after someone has met
you are different problems, and only one of them is answered by sending more.

Filed entries stay out of the follow-up reminders — the answer already came — and out of the
docket's default listing and its exports, while the `In total` figure above the register keeps
counting every entry ever stamped.

## Your data

Export the register at any time from `/docket/export`, in the form that suits where it is going:

| `?format=` | What it is                                                                           | What it is for                            |
| ---------- | ------------------------------------------------------------------------------------ | ----------------------------------------- |
| `pdf`      | A4 landscape, header repeated and pages numbered, long cells wrapped rather than cut | Reading, printing, attaching to something |
| `xlsx`     | A real workbook: numbers as numbers, stamps as dates, header frozen, stack wrapped   | Opening in Excel without an import wizard |
| `csv`      | Every column quoted, every value text, with a BOM                                    | Anything that has to accept anything      |

A request with no `format` is a CSV, which is what that route meant before it had any.

Each is written by hand — `src/lib/export/` — rather than through a document library: the formats
are small and specified, and the register is the only thing being written into them. The search on
screen is carried through, so a filtered docket exports the rows on screen; the order is always by
protocol number, because a register is read in the order it was written.

Complete JSON, including the job descriptions no table carries, is at `/settings/export`. The
account can be deleted from `/settings`; deletion cascades to every entry, tag and status event
immediately.
