# DSA Notes

DSA Notes is a local web application for storing, organizing, and reviewing notes about solved and planned data structures and algorithms problems.

The application is intended primarily for tracking NeetCode and LeetCode problems during technical interview preparation.

## Project status

The functional MVP is implemented but has not yet completed its final clean
validation run, final audit confirmation, or release/tag step.

Implemented MVP capabilities include:

- Category and Tag administration;
- Problems CRUD, duplication, and review;
- side-panel editing and inline editing of Name, Category, Difficulty, Status,
  and Times solved;
- local search, filters, and supported sorting;
- responsive sticky table layout, expansion, and progressive 100-row rendering;
- deterministic 1,000-Problem verification; and
- PostgreSQL persistence and restart verification.

`Last reviewed` is server-derived, read-only hydrated state. Tags, Solution,
Source, and Notes remain editable through the side panel. Inline edits use
explicit **Save** and **Cancel** controls, and the hydrated `PATCH` response is
authoritative.

Post-MVP candidates are safe Markdown rendering and preview, Excel export,
import, optional Playwright/E2E coverage, responsive Actions-seam polish, and
other UI polish. Virtual scrolling may be evaluated only if progressive
rendering proves insufficient in measured browser use.

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
- Playwright for optional post-MVP end-to-end coverage

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

Do not use `docker compose down -v` for normal development or verification: it
removes named volumes and therefore persisted PostgreSQL data.

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

## 1,000-row verification

The frontend has a deterministic, test-only fixture containing 1,000 hydrated
Problems. It never writes to PostgreSQL or the development database. Run the
diagnostic benchmark separately from normal unit tests:

```bash
pnpm --filter @dsa-notes/web test:performance
```

It records median local-operation timings after warm-up for search, combined
filters, supported sorting modes, immutable Problem mutations, and Category and
Tag reconciliation. See
[`docs/performance/1000-row-verification.md`](docs/performance/1000-row-verification.md)
for the measured environment, manual-browser checklist, and limitations.

The table renders matching Problems progressively in local blocks of 100 after
search, filters, and sorting. **Show 100 more** appends the next block without
making an API request; changing search, a filter, sorting, or using **Clear
filters** returns the rendered slice to its first block. This is local
presentation behavior, not backend pagination: the full hydrated collection is
still needed for local search, filtering, and sorting.
Virtual scrolling may be evaluated after the MVP only if progressive rendering
remains insufficient. Manual verification confirmed the 1,000-Problem dataset,
100-row blocks, and all current workflows work correctly. Initial usability is
substantially better than rendering every row at once, although DOM rendering
becomes noticeably less fluid after roughly 300 visible rows; that tradeoff is
accepted for the MVP.

At some responsive widths, a faint seam may remain beside the sticky Actions
column. It is a known non-blocking visual limitation and does not materially
prevent current table use.

## Persistence and restart verification

PostgreSQL is the persisted source of truth. Categories, Tags, Problems, their
relationships, links, raw Notes, review-derived dates, and timestamps survive
normal API, frontend, and PostgreSQL restarts when the named Compose volume is
retained. UI-only state is intentionally transient: search, filters, sorting,
the visible render limit, expanded rows, open panels, inline drafts, and
pending/error messages are recreated on reload.

Run the automated isolated-database verification after loading `.env` and
starting PostgreSQL:

```bash
pnpm --filter @dsa-notes/api verify:persistence
```

It requires `DATABASE_TEST_URL`, creates a uniquely named database derived
from that test-only base, migrates and seeds it through the API, reconnects
with a fresh Fastify/database client, reapplies committed migrations, verifies
the hydrated state, and removes only the generated database. The utility
refuses a base database name that does not contain `test`.

For the manual Angular/API/container restart sequence and the separate
prepare/verify/cleanup commands, see
[`docs/verification/persistence-restart.md`](docs/verification/persistence-restart.md).

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
POST   /api/problems/:id/duplicate
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
tag references return `400` using the stable error envelope. `timesSolved` is
writable, while `lastReviewedOn` is hydrated read state. When a PATCH increases
the persisted count, the backend sets `lastReviewedOn` from its server calendar
date; equal/decreased counts and unrelated edits preserve it.

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

The table has a viewport-relative two-axis scroll region with a sticky header.
On wide desktops, Expand, Name, Category, Tags, Difficulty, Status, and the
right-side Actions group remain frozen while horizontally scrolling. The wide
mode starts above 1540px, leaving a 24rem central viewport beside the frozen
regions. Medium widths (1051px–1540px) freeze Expand, Name, Category, and
Actions; narrow widths (761px–1050px) freeze Expand and Name with Actions on
the right; Actions returns to normal horizontal-table flow at 760px and below.
Sticky values wrap within their
fixed columns, while non-sticky Notes and link previews may use ellipsis.
Collapsed rows show at most two Tags plus a `+N` indicator and expose full text
through accessible labels, native titles, or expansion. Notes use a single-line
raw-text preview in the collapsed table and remain fully available in the
expanded row.

Solution and Source use the API-provided labels and URLs, open in a new tab,
and include safe `rel` attributes. Name, Category, Difficulty, Status, and
Times solved support explicit Save/Cancel inline editing. Tags, links, and
Notes remain in the side panel. Last reviewed is read-only server-derived state;
changing Times solved sends only the count and uses the hydrated response.

## Problem search and filters

The Problems toolbar filters the already loaded collection locally without
issuing API requests. Search matches partial text across Problem names,
Category names, Tag names, and raw Notes. It is case-insensitive and
diacritic-insensitive, so `dinamica` matches `Dinámica`; Notes remain plain raw
text and are not rendered as Markdown in this phase.

Category, Difficulty, Status, and Tags can be combined with search. Difficulty
includes an explicit **Unspecified** option for Problems whose value is `null`.
Selected Tags use the product-defined OR behavior: a Problem matches when it
contains any selected Tag. The separate filter groups combine with AND.

## Sorting

The table locally sorts the filtered collection by one active field: Name,
Category, Difficulty, or Last reviewed. Activating a sortable header toggles
ascending and descending order; the default before selection remains
case-insensitive Name ascending with exact decimal-string ID tie-breaking.
Difficulty and unreviewed values remain last in either direction, and local
mutations reuse the selected sort without reloading a collection. Status and
Times solved are not sortable in this phase.

The result summary distinguishes filtered and total counts. **Clear filters**
resets only filter state, while canonical Problems, expanded rows, dirty forms,
pending actions, and row errors remain unchanged. A filtered collection with no
matches has its own no-match state and does not replace the true empty-library
state.

If Categories or Tags fail to load, only the corresponding filter is disabled.
Search and the other available filters remain usable, loaded Problems remain
visible, and the existing reference-data retry remains available.

## Category and Tag administration

Use **Manage categories and tags** beside **Add problem** to open the nonmodal
reference-data panel. A new empty database presents a **Manage categories**
action: create the first Category there, then **Add problem**, the Category
filter, and the Problem form become usable immediately without a page reload or
command-line API request.

The panel lists Categories and Tags in the API's case-insensitive name order.
Create and Rename trim surrounding whitespace and use hydrated API responses,
so decimal-string IDs and server timestamps remain authoritative. Renames are
reconciled immediately across the Problems table, normalized search, filters,
and open Problem-form choices while ID-based selections remain stable.

Only unused Categories can be deleted. A referenced Category produces a safe
explanation that its Problems must first be reassigned or deleted; no local
Problem is changed. Global Tag deletion requires confirmation and removes the
Tag from every local Problem association, active Tag filters, and open
Create/Edit selection without resetting other dirty form fields.

Each create, rename, and delete operation owns its pending and accessible error
state. Reference changes use immutable local updates and do not reload Problems,
Categories, or Tags. Opening and closing administration preserves the Problems
table, filters, expansion, row actions, and any active Create/Edit form.

## Create Problem workflow

Use the visible **Add problem** action to open the nonmodal creation side panel.
A successfully loaded, nonempty Category collection is required before creation
is enabled. Tags are optional; if Tags fail to load, creation remains available
without tag selection and the page offers a separate reference-data retry.

The typed creation form includes Name, Category, Difficulty, Status, Tags,
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
current writable value preloaded. Save sends a complete editable representation
through `PATCH /api/problems/:id`. Clearing Difficulty or either link sends
`null`; clearing every selected Tag sends `tagIds: []`. `Last reviewed` is
returned as read state and is not submitted by Edit. Notes remain verbatim and
IDs remain decimal strings.

Editing requires the current Category to be present in the loaded Category
collection. If Categories fail to load, Edit is disabled. If Tags fail to load,
editing remains available for other fields, the existing tag IDs are preserved,
and tag controls are unavailable until reference data is reloaded.

Failed saves retain the entered form values and display a safe message.
Successful saves replace the matching hydrated Problem in local state, reapply
the deterministic name and exact decimal-ID ordering, and preserve row expansion
state. Opening Create, another Edit panel, or closing a dirty panel requires
discard confirmation. Increasing Times solved through any PATCH is coupled to
the server-owned Last reviewed update.

## Duplicate Problem workflow

Each row includes **Duplicate**. It calls
`POST /api/problems/:id/duplicate` without a request body. Inside one database
transaction, the API copies the persisted Category, Difficulty, Status, Tags,
Solution, Source, Notes, Last reviewed, and Times solved values. The new record
receives a new decimal-string ID, fresh timestamps, and the source name followed
by ` Copy`; an existing suffix is retained, so repeated duplication produces
names such as `Two Sum Copy Copy`.

Problem names use unbounded PostgreSQL `text`, and the product specification
defines no arbitrary maximum length. The suffix is therefore appended without
silent truncation.

Only the source row enters the `Duplicating…` state. Its Duplicate, Edit, Mark
reviewed, and Delete actions are unavailable until the request finishes, while
other rows remain interactive. Duplication is unavailable for a Problem
currently open in Edit so unsaved form values cannot be mistaken for persisted
source data.

The hydrated API response is inserted into canonical local state and sorted
with the existing case-insensitive name and exact decimal-ID comparator.
Problems, Categories, and Tags are not reloaded. Active filters remain intact,
so the duplicate appears only when it matches the derived filtered view. Source
and unrelated expansion state are preserved, the duplicate starts collapsed,
and focus returns to the source Duplicate action after success.

Failures leave Problems, filters, expansion, and form state unchanged. A safe
row-level error is shown separately from Delete and Review errors, and retrying
clears the prior duplication error.

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

## Problem Review workflow

Each row includes **Mark reviewed**. It sends a partial
`PATCH /api/problems/:id` containing only the incremented `timesSolved`. The
backend compares that count with the locked persisted value and returns the
hydrated Problem with server-owned `lastReviewedOn` when it increased.

Review is unavailable while that Problem is open in Edit, being deleted, or
already being reviewed. While pending, only that row's Review, Edit, and Delete
actions are disabled. Dirty Create state and an editor for another Problem are
not changed.

The maximum PostgreSQL integer value is `2147483647`. At that value, Mark
reviewed is disabled and sends no request. Successful review uses the hydrated
API response to replace the local Problem without reloading data or changing
expansion state. Failures preserve the count, date, forms, and expansion state
and show a safe row-level message that can be cleared by retrying.

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
