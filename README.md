# DSA Notes

DSA Notes is a local web application for storing, organizing, and reviewing notes about solved and planned data structures and algorithms problems.

The application is intended primarily for tracking NeetCode and LeetCode problems during technical interview preparation.

## Project status

The project has a working monorepo foundation:

- an Angular read-only Problems screen backed by the API;
- a Fastify API with health, category, and tag endpoints;
- complete Problems CRUD endpoints;
- a committed PostgreSQL schema and migrations;
- a local PostgreSQL Docker Compose service;
- workspace-wide validation commands.

Problem duplication, inline editing, and automatic review-count behavior have
not been implemented yet.

## Main features planned for the MVP

- Create, edit, duplicate, and delete problem records.
- Display problems in a desktop-oriented data table.
- Expand and collapse individual table rows.
- Edit simple fields directly inside the table.
- Edit links, tags, and notes through a side panel.
- Manage categories and tags.
- Search across problem names, categories, tags, and notes.
- Filter problems using one or more tags.
- Sort problems by name, category, difficulty, and last-reviewed date.
- Store application data in PostgreSQL.
- Run entirely on the local machine without cloud services.
- Export all problem records to Excel, if this remains within the MVP scope.

## Technology stack

### Frontend

- Angular
- TypeScript
- Angular reactive forms
- Angular HTTP client

### Backend

- Node.js
- TypeScript
- Fastify
- Drizzle ORM

### Database

- PostgreSQL

### Local infrastructure

- Docker Compose
- pnpm workspace

### Testing

- Vitest
- Angular component and service tests
- API integration tests
- Playwright for end-to-end tests in a later phase

## Repository structure

```text
dsa-notes/
├── apps/
│   ├── api/              # Fastify backend
│   └── web/              # Angular frontend
├── docs/
│   ├── architecture.md
│   ├── implementation-plan.md
│   └── product-spec.md
├── packages/
│   └── shared/           # Shared schemas and types when justified
├── .env.example
├── AGENTS.md
├── README.md
├── docker-compose.yml
├── package.json
└── pnpm-workspace.yaml
```

The `packages/shared` directory remains empty until real duplication exists between
the frontend and backend. It must not become a general dumping ground for
unrelated utilities.

## Prerequisites

- Node.js `>=24.15.0 <25` (Node.js 24 LTS)
- pnpm `10.32.1`
- Docker with Docker Compose

The repository records the pnpm version in its `packageManager` field. With
Corepack available, it can activate the requested pnpm version automatically.

## Install dependencies

```bash
pnpm install
```

The API uses Drizzle ORM with the `postgres` JavaScript driver. Drizzle Kit
generates and applies committed SQL migrations.

## Configure the environment

Create an ignored local environment file from the committed example:

```bash
cp .env.example .env
```

The example contains local-only development credentials. Change them in `.env`
if the defaults conflict with another local PostgreSQL installation. Do not
commit `.env`.

Load the variables into the current shell before running database commands:

```bash
set -a
source .env
set +a
```

`DATABASE_URL` targets the persistent development database. `DATABASE_TEST_URL`
is a safety-qualified base URL used to create a unique temporary database for
each integration-test run. Its database name must contain `test`.

## Start PostgreSQL

PostgreSQL 18 runs as the only Docker Compose service:

```bash
docker compose up -d postgres
docker compose ps
```

Wait until `docker compose ps` reports the service as healthy, then apply the
committed migrations:

```bash
pnpm db:migrate
```

Generate a new reviewable migration after an approved schema change:

```bash
pnpm db:generate
```

Generated SQL is stored under `apps/api/drizzle/`. Migration files are the
source-of-truth workflow; schema push is not used.

Run the isolated database integration tests:

```bash
pnpm test:db
```

The tests refuse a `DATABASE_TEST_URL` whose database name does not contain
`test`. They create a uniquely named temporary database on the configured
PostgreSQL server, apply migrations, run independently cleaned tests, close all
connections, and drop only that temporary test database.

The Compose service uses the `postgres-data` named volume. Stop it without
deleting development data:

```bash
docker compose stop postgres
```

## Start the applications

Start the API:

```bash
pnpm dev:api
```

Start the Angular frontend in another terminal:

```bash
pnpm dev:web
```

Or start both host processes together:

```bash
pnpm dev
```

`pnpm dev` is a long-running development command. Stop it with `Ctrl+C`.

Expected local services:

```text
Frontend:   http://localhost:4200
API:        http://localhost:3000
PostgreSQL: localhost:5432
```

The API health endpoint is:

```text
GET http://localhost:3000/api/health
```

It returns:

```json
{
  "status": "ok"
}
```

The health endpoint and API startup do not require PostgreSQL. Category and tag
requests connect lazily and require `DATABASE_URL` plus an available migrated
database.

The Angular development server proxies relative `/api` requests to
`http://localhost:3000`. Start the API and frontend through the documented
commands; no CORS middleware or production hostname is required.

## Category and tag API

The reference-data endpoints are:

```text
GET    /api/categories
POST   /api/categories
PATCH  /api/categories/:id
DELETE /api/categories/:id

GET    /api/tags
POST   /api/tags
PATCH  /api/tags/:id
DELETE /api/tags/:id
```

Create or rename a resource with a JSON body:

```json
{
  "name": "Dynamic Programming"
}
```

Leading and trailing whitespace is removed. Unknown fields, empty names, and
invalid IDs are rejected. Collection responses are sorted case-insensitively.
IDs are decimal strings in JSON, and timestamps are ISO-8601 strings:

```json
{
  "id": "1",
  "name": "Dynamic Programming",
  "createdAt": "2026-07-25T18:30:00.000Z",
  "updatedAt": "2026-07-25T18:30:00.000Z"
}
```

Errors use a stable envelope:

```json
{
  "error": {
    "code": "CATEGORY_NAME_CONFLICT",
    "message": "A category with this name already exists."
  }
}
```

Deleting a referenced category returns `409 Conflict`. Deleting a tag removes
its problem-tag associations but does not delete problems.

## Problems API

The problem endpoints are:

```text
GET    /api/problems
POST   /api/problems
GET    /api/problems/:id
PATCH  /api/problems/:id
DELETE /api/problems/:id
```

A minimal creation request requires a name and category:

```json
{
  "name": "Two Sum",
  "categoryId": "1"
}
```

Optional fields use the documented defaults: `status` is `To solve`,
`timesSolved` is `0`, `tags` and `notes` are empty, and nullable fields are
`null`. A complete response includes the category and deterministically sorted
tags:

```json
{
  "id": "12",
  "name": "Two Sum",
  "category": {
    "id": "1",
    "name": "Arrays"
  },
  "difficulty": "Easy",
  "status": "Solved",
  "tags": [
    {
      "id": "3",
      "name": "Hash Map"
    }
  ],
  "solution": {
    "url": "https://example.com/solution",
    "label": "View solution"
  },
  "source": null,
  "notes": "",
  "timesSolved": 2,
  "lastReviewedOn": "2026-07-25",
  "createdAt": "2026-07-25T18:30:00.000Z",
  "updatedAt": "2026-07-25T18:30:00.000Z"
}
```

All IDs are decimal JSON strings. `difficulty`, `solution`, `source`, and
`lastReviewedOn` may be `null`; tags are always an array. Dates must be real
calendar dates in strict `YYYY-MM-DD` form.

Links accept only absolute HTTP or HTTPS URLs. URLs and labels are trimmed.
When a link label is omitted, Solution uses `View solution` and Source uses
`LeetCode`. Empty supplied labels are rejected.

`PATCH` uses true partial-update semantics. Supplying `tagIds` replaces the
complete tag set, while omitted fields remain unchanged. Invalid category or
tag references return `400` using the stable error envelope. Automatic
`Times solved`/`Last reviewed` behavior remains deferred to the dedicated
review-semantics phase.

## Read-only Problems screen

The Angular screen loads Problems, Categories, and Tags once on initial page
load. Problems are the primary request. A Problems failure shows a page-level
error with an explicit retry; a Categories or Tags failure shows a nonblocking
warning while retaining a successfully loaded Problems table.

The semantic table displays the fixed MVP preview columns, an explicit Edit
action, and independent expansion of multiple rows. Expanded rows show
plain-text Notes and UTC creation/update timestamps. Notes are not parsed as
Markdown. Date-only `lastReviewedOn` values are displayed exactly as returned
by the API, avoiding timezone conversion.

Solution and Source use the API-provided labels and URLs, open in a new tab,
and include safe `rel` attributes. Editing uses the side panel; inline editing,
deletion, search, filtering, and review actions are not implemented.

## Create Problem workflow

Use the visible **Add problem** action to open the nonmodal creation side panel.
A successfully loaded, nonempty Category collection is required before creation
is enabled. Tags are optional; if Tags fail to load, creation remains available
without tag selection and the page offers a separate reference-data retry.

The typed reactive form includes Name, Category, Difficulty, Status, Tags,
Solution and Source links, Last reviewed, Times solved, and plain-text Notes.
Defaults follow the product specification:

```text
Status: To solve
Times solved: 0
Solution label: View solution
Source label: LeetCode
```

Names, link URLs, and link labels are trimmed before submission. Empty link
URLs submit `null`; a URL with an empty label receives its documented default.
Notes and line breaks are preserved. Dates remain `YYYY-MM-DD` strings and are
never converted through a JavaScript `Date`.

Frontend validation catches missing required fields, invalid URLs, invalid
dates, and negative or fractional Times solved values. Backend failures appear
as stable safe messages without exposing raw API or database details. Failed
requests preserve the form. Successful creation inserts the hydrated response
into the sorted table without reloading Categories or Tags.

## Edit Problem workflow

Use a row's **Edit** action to open the same nonmodal form shell with every
current value preloaded. Save sends a complete editable representation through
`PATCH /api/problems/:id`. Clearing Difficulty, either link, or Last reviewed
sends `null`; clearing every selected Tag sends `tagIds: []`. Notes remain
verbatim, IDs remain decimal strings, and date-only values are not converted
through JavaScript dates.

Editing requires the current Category to be present in the loaded Category
collection. If Categories fail to load, Edit is disabled. If Tags fail to load,
editing remains available for other fields, the existing tag IDs are preserved,
and tag controls are unavailable until reference data is reloaded.

Failed saves retain the entered form values and display a safe message.
Successful saves replace the matching hydrated Problem in local state, reapply
the deterministic name and exact decimal-ID ordering, and preserve row expansion
state. Opening Create, another Edit panel, or closing a dirty panel requires
discard confirmation. Automatic coupling between Times solved and Last reviewed
remains deferred to the dedicated review-action phase.

## Delete Problem workflow

Each row includes a **Delete** action. Deletion requires confirmation naming the
Problem and calls `DELETE /api/problems/:id` with its decimal-string ID. A dirty
editor for that same Problem uses a combined confirmation that also warns about
discarding unsaved changes. Deleting another Problem never closes a dirty Edit
or Create panel.

Only the pending row's Edit and Delete actions are disabled. A successful
request removes the Problem locally without reloading Problems, Categories, or
Tags, removes only its expansion state, and focuses Add Problem when available.
If Add Problem is disabled, focus moves to the Problems heading. Failures retain
the Problem and expansion state and show a safe row-level message; a `404`
remains visible locally rather than being treated as an implicit success.

## Validation

Run individual workspace checks:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Run API unit tests without PostgreSQL:

```bash
pnpm --filter @dsa-notes/api test
```

Run Angular service and component tests without a live API or PostgreSQL:

```bash
pnpm --filter @dsa-notes/web test
```

With PostgreSQL running and the environment loaded, run the isolated
PostgreSQL-backed schema and HTTP integration tests:

```bash
pnpm test:db
```

Run the complete validation sequence:

```bash
pnpm validate
```

Validate Docker Compose configuration without starting a container:

```bash
docker compose config
```

## Documentation

- [`docs/product-spec.md`](docs/product-spec.md): functional requirements and MVP behavior.
- [`docs/architecture.md`](docs/architecture.md): technical architecture and engineering decisions.
- [`AGENTS.md`](AGENTS.md): instructions for coding agents working in this repository.

## Current development rule

The MVP uses a fixed set of table columns.

Dynamic creation, deletion, renaming, resizing, and reordering of columns are outside the MVP unless the specification is explicitly changed.

---
