# DSA Notes Architecture

## 1. Architecture objective

The project uses a small monorepo with a clear separation between:

- presentation and browser interaction;
- HTTP API behavior;
- database persistence;
- shared contracts where genuinely useful.

The architecture must remain simple enough for a single-user local application.

The project must not introduce distributed-system patterns, cloud abstractions, or speculative framework layers.

## 2. Technology decisions

### Frontend: Angular and TypeScript

Angular is used because:

- the project has interactive forms and a stateful table;
- reactive forms suit record creation and editing;
- Angular provides routing, dependency injection, HTTP integration, and test support;
- the project owner is already familiar with Angular;
- familiarity improves the ability to review agent-generated changes.

The frontend should use standalone Angular APIs unless the selected Angular version provides a compelling reason otherwise.

The first read-only integration defines explicit Angular contract types matching
the Fastify JSON responses. Problem, category, and tag IDs remain strings in
the browser; they are never converted to `number` or `bigint`. Three focused
`HttpClient` services use relative `/api/problems`, `/api/categories`, and
`/api/tags` URLs without a generic SDK layer.

The Problems page owns local signal state for the three collections, loading,
error, and auxiliary-warning states. Problems are the primary request. Failed
category or tag requests produce a nonblocking warning rather than discarding
successfully loaded problems. No global state library is justified at this
stage.

The read-only page consumes the API-hydrated category and tag representations
directly. It does not reconstruct relationships or reorder tags. Date-only
`lastReviewedOn` values are rendered exactly as `YYYY-MM-DD`, without creating
a JavaScript `Date`, so local timezone offsets cannot shift the calendar day.
Technical timestamps are rendered deterministically in UTC.

During development, Angular proxies `/api` to the Fastify server at
`http://localhost:3000`. Production hostnames are not embedded in frontend
code, and development-only CORS middleware is unnecessary.

Problem creation uses a focused typed Angular Reactive Form in a nonmodal side
panel. The panel owns form validation, request normalization, saving state,
safe API error mapping, and dirty-close confirmation. The Problems page owns
panel visibility, loaded reference collections, and the canonical problem
collection. No global state or generic form abstraction is introduced.

Creation requires a successfully loaded, nonempty Category collection. Tags
remain optional: a Tags load failure leaves creation enabled without tag
selection and can be retried independently from the Problems request.

Empty link URLs become `null`. Present URLs and labels are trimmed; an empty
label uses the documented `View solution` or `LeetCode` default in Angular
before submission. Notes are passed through verbatim. Date-only values remain
strings.

The hydrated Problem returned by `POST /api/problems` is inserted into local
page state and sorted case-insensitively by name with decimal-string ID
tie-breaking. This avoids a redundant collection request and leaves the new
row collapsed. Successful creation closes and resets the panel; failures retain
entered values.

Creation and full-record editing share one focused typed Reactive Forms panel.
The panel uses explicit create and edit modes, while retaining separate POST and
PATCH request branches. Edit sends the complete normalized editable
representation: nullable clears are explicit `null` values and an empty Tag
selection is `tagIds: []`. Notes remain verbatim, and no Times solved/Last
reviewed coupling occurs in this general form.

The Problems page owns the active panel and allows only one Create or Edit
session at a time. Switching away from dirty form state uses the same discard
confirmation as closing. A hydrated PATCH response replaces the matching local
Problem and the existing name/decimal-ID comparator is reapplied. The table
component retains expansion state by immutable Problem ID, so an edited row
remains expanded.

Categories must be available and contain the Problem's current Category before
Edit is enabled. A Tags load failure does not block editing other fields: tag
controls are unavailable and the original tag IDs are included unchanged in
the complete PATCH body. This prevents an auxiliary failure from silently
clearing associations.

### Backend: Node.js, TypeScript, and Fastify

Fastify is used for a minimal HTTP API because:

- its runtime overhead is low;
- route schemas and validation integrate cleanly;
- it requires less architecture than a full backend framework;
- the application does not need modules, decorators, queues, authentication, or microservices.

The API must remain organized by domain, not placed entirely in one file.

### Database: PostgreSQL

PostgreSQL is used because:

- it provides reliable local persistence;
- categories and tags have natural relational models;
- it supports constraints and transactions;
- it is already familiar to the project owner;
- it leaves room for future query improvements without requiring them now.

### ORM: Drizzle ORM

Drizzle is preferred because:

- its schema remains close to SQL;
- migrations can be reviewed directly;
- relationships and constraints remain visible;
- it adds less abstraction than heavier ORMs.

Raw SQL is acceptable for focused operations when it is clearer than forcing an ORM abstraction.

### Workspace: pnpm

pnpm workspaces manage the monorepo because they:

- support multiple applications cleanly;
- avoid unnecessary dependency duplication;
- allow commands to be orchestrated from the root;
- remain simpler than introducing an additional monorepo framework.

Nx, Turborepo, and similar tools must not be added unless a demonstrated need appears.

### Local database: Docker Compose

Docker Compose manages PostgreSQL only.

The frontend and API may run directly on the host during development.

Containerizing every development process is unnecessary for the MVP.

## 3. Repository structure

Expected structure after scaffolding:

```text
dsa-notes/
├── apps/
│   ├── api/
│   │   ├── src/
│   │   │   ├── app/
│   │   │   ├── db/
│   │   │   ├── modules/
│   │   │   │   ├── categories/
│   │   │   │   ├── problems/
│   │   │   │   └── tags/
│   │   │   ├── plugins/
│   │   │   ├── server.ts
│   │   │   └── app.ts
│   │   ├── test/
│   │   ├── drizzle/
│   │   ├── drizzle.config.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   └── web/
│       ├── src/
│       │   ├── app/
│       │   │   ├── core/
│       │   │   ├── features/
│       │   │   │   ├── categories/
│       │   │   │   ├── problems/
│       │   │   │   └── tags/
│       │   │   └── shared/
│       │   ├── styles/
│       │   └── main.ts
│       ├── package.json
│       └── tsconfig.json
├── packages/
│   └── shared/
├── docs/
│   ├── architecture.md
│   └── product-spec.md
├── .env.example
├── AGENTS.md
├── README.md
├── docker-compose.yml
├── package.json
└── pnpm-workspace.yaml
```

This structure is directional, not a requirement to create empty folders preemptively.

Folders should be created when they contain real code.

## 4. Frontend responsibilities

The Angular application is responsible for:

- displaying the problem table;
- maintaining the currently loaded problem collection;
- performing client-side search;
- performing client-side tag filtering;
- performing client-side sorting;
- managing row expansion state;
- managing inline edit state;
- displaying creation and edit panels;
- validating forms before submission;
- rendering Markdown safely;
- reporting API errors;
- triggering export generation.

The frontend must not:

- access PostgreSQL directly;
- reproduce database constraints as its only validation;
- own permanent category or tag truth independently from the API;
- issue writes on every keystroke;
- silently discard failed edits.

## 5. Backend responsibilities

The Fastify API is responsible for:

- validating all incoming requests;
- enforcing domain rules;
- executing database operations;
- managing transactions;
- returning stable API representations;
- mapping database failures to appropriate HTTP errors;
- ensuring atomic Times solved and Last reviewed updates;
- preventing deletion of categories that are in use;
- removing tag associations safely when tags are deleted.

The backend must not:

- render frontend HTML;
- contain table presentation logic;
- perform browser-specific search normalization;
- introduce authentication during the MVP;
- expose database-specific structures unnecessarily.

## 6. Database model

### `problems`

Suggested fields:

```text
id
name
category_id
difficulty
status
last_reviewed_on
times_solved
solution_url
solution_label
source_url
source_label
notes
created_at
updated_at
```

Constraints:

- `id`: PostgreSQL `bigint` identity primary key, represented as TypeScript
  `bigint` to avoid JavaScript number precision loss.
- `name`: non-empty text.
- `category_id`: required foreign key.
- `difficulty`: nullable PostgreSQL enum.
- `status`: required PostgreSQL enum with `To solve` as its default.
- `times_solved`: integer greater than or equal to zero.
- URLs and labels: nullable text, with `NULL` representing absence.
- Notes: non-null text with an empty-string default.
- `last_reviewed_on`: nullable PostgreSQL `date`.
- Timestamps: timezone-aware PostgreSQL timestamps defaulting to `now()`.

### `categories`

Suggested fields:

```text
id
name
created_at
updated_at
```

Constraints:

- `bigint` identity primary key;
- unique case-insensitive name through an index on `lower(name)`;
- non-empty name.

The problem foreign key uses `ON DELETE RESTRICT`, so a referenced category
cannot be deleted and problems are never cascade-deleted with a category.

### `tags`

Suggested fields:

```text
id
name
color
created_at
updated_at
```

Constraints:

- `bigint` identity primary key;
- unique case-insensitive name through an index on `lower(name)`;
- non-empty name;

Tag color is omitted until the optional product requirement is retained.

### `problem_tags`

Suggested fields:

```text
problem_id
tag_id
```

Constraints:

- composite primary key;
- `problem_id` references problems with `ON DELETE CASCADE`;
- `tag_id` references tags with `ON DELETE CASCADE`;
- the composite primary key supports joins beginning with `problem_id`;
- a separate `(tag_id, problem_id)` index supports reverse joins.

Deleting a tag removes join-table associations, not problem rows.

## 7. Database enum strategy

`Difficulty` and `Status` use PostgreSQL enum types because both are closed
product vocabularies with exact values defined by the product specification.

The values are:

```text
Difficulty: Easy, Medium, Hard
Status: To solve, Attempted, Solved, Needs review, Mastered
```

Changing either vocabulary requires a deliberate migration. Lookup tables are
not justified for these fixed values.

## 7.1 Database connection lifecycle

The database module creates one lazy `postgres` client and typed Drizzle
database instance when database access is first requested. Importing or
starting the health-only Fastify application does not read `DATABASE_URL` or
connect to PostgreSQL. The module exposes an explicit asynchronous shutdown
function for tests and future server shutdown handling.

Only the category foreign-key index and the two join directions are indexed in
the initial schema. Status, difficulty, and last-review indexes are deferred
because the MVP loads the full problem collection and performs filtering and
sorting in the frontend.

## 8. Automatic review transaction

The Times solved update must be implemented as an atomic backend operation.

Conceptual behavior:

```text
newTimesSolved > currentTimesSolved
    → update times_solved
    → set last_reviewed to current local application date
otherwise
    → update times_solved only
```

The backend should not trust the frontend to calculate whether the value increased.

The API may accept the requested new value and compare it with the persisted current value inside a transaction.

Date semantics must be documented. Since the application is local and single-user, a date without time is sufficient for `Last reviewed`.

## 9. API shape

Initial API surface:

```text
GET    /api/health

GET    /api/problems
POST   /api/problems
GET    /api/problems/:id
PATCH  /api/problems/:id
DELETE /api/problems/:id
POST   /api/problems/:id/duplicate

GET    /api/categories
POST   /api/categories
PATCH  /api/categories/:id
DELETE /api/categories/:id

GET    /api/tags
POST   /api/tags
PATCH  /api/tags/:id
DELETE /api/tags/:id
```

The API should use JSON.

API contracts must be validated at runtime.

A shared package may contain schemas or generated types only when it reduces actual duplication without coupling the frontend to database implementation details.

Category and tag routes use Fastify JSON Schema validation at the HTTP
boundary. Request objects reject unknown fields. Names are trimmed at this
boundary, whitespace-only names are rejected, and internal whitespace and
capitalization are preserved. PostgreSQL remains authoritative for
case-insensitive uniqueness through the committed `lower(name)` indexes.

Path identifiers accept only canonical positive decimal strings within the
PostgreSQL `bigint` range. They are parsed directly to TypeScript `bigint` and
are never converted through JavaScript `number`.

## 10. API response representation

A problem response should be shaped around UI needs without exposing join-table rows.

Example:

```json
{
  "id": "1",
  "name": "House Robber",
  "category": {
    "id": "2",
    "name": "Dynamic Programming"
  },
  "tags": [
    {
      "id": "3",
      "name": "1D DP",
      "color": null
    }
  ],
  "difficulty": "Medium",
  "status": "Needs review",
  "lastReviewed": "2026-07-24",
  "timesSolved": 2,
  "solution": {
    "url": "https://example.com/solution",
    "label": "View solution"
  },
  "source": {
    "url": "https://leetcode.com/problems/house-robber/",
    "label": "LeetCode"
  },
  "notes": "Use **1D dynamic programming**.",
  "createdAt": "2026-07-20T18:00:00.000Z",
  "updatedAt": "2026-07-24T21:30:00.000Z"
}
```

The database may use separate URL and label columns even though the API groups them as link objects.

Database IDs are TypeScript `bigint` values. Future JSON API contracts must
serialize them as decimal strings because JSON does not support `bigint` and
JavaScript numbers cannot safely represent every PostgreSQL `bigint`.

Category and tag responses apply this rule explicitly. Their database `Date`
timestamps are serialized as ISO-8601 strings and database field names are
mapped to camelCase response fields. Route handlers never return raw Drizzle
records.

Problem responses follow the same representation rules. Collection hydration
uses one query for problems joined to categories and one query for all relevant
problem-tag rows joined to tags. Tags are grouped in memory. This avoids N+1
queries while keeping the Drizzle queries explicit. Problems are ordered by
case-insensitive name then ID; tags are ordered by case-insensitive name then
ID.

Problem creation and partial updates run in database transactions. The
transaction verifies category and tag references, writes the problem, writes or
replaces join rows, and hydrates the response. Supplying `tagIds` on PATCH
replaces the complete association set; omitting it preserves associations.
Invalid related-resource references consistently return `400`.

Problem names, link URLs, and link labels are trimmed at the request boundary;
Notes are preserved verbatim. Link objects require absolute HTTP or HTTPS URLs.
Missing labels use `View solution` for Solution and `LeetCode` for Source.
Absent links use `null`.

`lastReviewedOn` accepts only real calendar dates in exact `YYYY-MM-DD` form
and is stored without timezone conversion. General CRUD validates and persists
`timesSolved` independently of status. Automatic review-date mutation remains
part of the later atomic review-semantics phase.

## 11. Search, filter, and sorting architecture

For up to approximately 1,000 records:

1. The frontend loads the problem collection.
2. The canonical collection remains in application state.
3. A derived view applies search.
4. The derived view applies OR-based tag filtering.
5. The derived view applies the selected sorting mode.
6. Angular renders the resulting rows.

Search normalization should use a pure utility function equivalent to:

```ts
export function normalizeSearchText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}
```

Filtering and sorting functions must remain pure and independently testable.

The application must not perform a backend request per search input change.

## 12. Frontend state

The initial implementation should prefer straightforward Angular state management:

- services;
- signals;
- computed values;
- reactive forms.

A third-party state-management library must not be introduced during the MVP without a demonstrated need.

The agent must not add NgRx solely because the application uses Angular.

Suggested state division:

```text
Canonical data:
- problems
- categories
- tags

View state:
- search query
- selected tag IDs
- sorting mode
- expanded row IDs
- active edit row
- active side panel
```

Expansion state is client-only and is not persisted in PostgreSQL.

## 13. Table implementation strategy

The initial table should use standard semantic table markup or an accessible grid implementation.

Requirements:

- sticky header;
- sticky leading columns;
- horizontal overflow inside the table container;
- vertical overflow inside the table container;
- explicit buttons;
- compact collapsed rows;
- expanded rows without destroying alignment.

A large commercial data-grid dependency must not be introduced automatically.

Before adding a table library, Codex must explain:

- which requirement cannot be met reasonably with Angular and CSS;
- dependency cost;
- bundle and maintenance impact;
- licensing implications.

## 14. Markdown architecture

Notes remain raw Markdown in PostgreSQL.

The frontend may render Markdown through a small established parser.

Rendered content must be sanitized.

Collapsed rows should not render the entire Markdown document.

A collapsed preview may derive plain text from the raw Markdown or display a limited escaped substring.

## 15. Error handling

API errors must use a consistent structure, for example:

```json
{
  "error": {
    "code": "CATEGORY_IN_USE",
    "message": "The category cannot be deleted while problems reference it."
  }
}
```

Validation, not-found, conflict, and internal failures all use this envelope
with stable application error codes. Expected database conflicts are translated
only when both the PostgreSQL error code and the known constraint or index name
match. Wrapped driver errors may be inspected through their `cause` chain.
Unexpected failures are logged by Fastify and returned as a generic `500`
without SQL, constraint details, stack traces, connection strings, or driver
objects.

Category and tag rename operations set `updated_at` explicitly. Deleting a
referenced category translates the restrictive foreign-key failure to
`CATEGORY_IN_USE` without modifying problems. Deleting a tag relies on the
documented database cascade to remove `problem_tags` rows while preserving
problems.

The frontend must:

- show meaningful messages;
- preserve unsaved form input when appropriate;
- revert optimistic inline changes if persistence fails;
- avoid exposing raw database errors.

Optimistic updates are optional. A simpler save-then-update approach is acceptable for the MVP.

## 16. Validation

Validation exists at two levels.

### Frontend

Provides immediate feedback for:

- required fields;
- invalid URLs;
- invalid dates;
- negative or fractional Times solved values.

### Backend

Enforces all domain and persistence constraints independently.

Frontend validation must never be treated as sufficient security or correctness.

## 17. Testing architecture

### Pure frontend logic

Unit tests for:

- search normalization;
- substring search;
- diacritic-insensitive search;
- OR tag filtering;
- combined search and filtering;
- each sorting mode;
- empty-value ordering;
- Times solved control behavior.

### Angular components and services

Tests for:

- row expansion;
- inline editing;
- panel save and cancel;
- confirmation dialogs;
- API error handling;
- sticky-table behavior where practical without brittle pixel assertions.

### API

Tests for:

- request validation;
- problem CRUD;
- category CRUD;
- tag CRUD;
- duplication;
- category-in-use errors;
- tag association cleanup;
- automatic Last reviewed updates;
- invalid enum values;
- non-negative Times solved.

### End to end

A later Playwright test should cover:

```text
create problem
→ display problem
→ edit problem
→ reload application
→ verify persistence
→ delete problem
```

## 18. Local configuration

Environment variables must be documented in `.env.example`.

Real secrets must never be committed.

Docker Compose should:

- start PostgreSQL;
- use a named volume;
- expose the configured local port;
- include a health check where useful.

Database migrations must be committed.

Automatic destructive schema synchronization must not replace migrations.

## 19. Dependency policy

Dependencies are allowed when they materially reduce risk or complexity.

Before adding a significant dependency, Codex must consider:

- whether native Angular, browser, Node.js, or PostgreSQL functionality is sufficient;
- maintenance activity;
- license;
- bundle impact;
- type support;
- whether the dependency creates framework lock-in.

Likely justified dependencies include:

- Fastify;
- Drizzle and PostgreSQL driver;
- runtime schema validation;
- a small Markdown parser and sanitizer;
- an Excel export library when that feature is implemented.

## 20. Evolution path

Expected implementation order:

1. Repository scaffolding.
2. PostgreSQL Docker configuration.
3. API health endpoint.
4. Database schema and migrations.
5. Category and tag API.
6. Problem CRUD API.
7. Backend tests.
8. Static frontend table using fixtures.
9. Table scrolling and row expansion.
10. Frontend API integration.
11. Creation and side-panel editing.
12. Inline editing.
13. Category and tag administration.
14. Search and filtering.
15. Sorting.
16. Markdown preview.
17. Excel export.
18. End-to-end validation.
19. Documentation and cleanup.

Dynamic columns require a separate architecture proposal and are not part of this sequence.

---
