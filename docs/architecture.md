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
last_reviewed
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

- `id`: UUID primary key.
- `name`: non-empty text.
- `category_id`: required foreign key.
- `difficulty`: nullable constrained enum-like value.
- `status`: required constrained enum-like value.
- `times_solved`: integer greater than or equal to zero.
- URLs: nullable text or varchar.
- Notes: non-null text with an empty-string default or nullable according to the final schema convention.
- Timestamps: generated by the database or database layer.

### `categories`

Suggested fields:

```text
id
name
created_at
updated_at
```

Constraints:

- unique normalized category name;
- non-empty name.

Category deletion uses restrictive foreign-key behavior or an explicit domain check.

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

- unique normalized tag name;
- non-empty name;
- color nullable.

### `problem_tags`

Suggested fields:

```text
problem_id
tag_id
```

Constraints:

- composite primary key;
- cascade on problem deletion;
- cascade association removal on tag deletion.

Deleting a tag removes join-table associations, not problem rows.

## 7. Database enum strategy

`Difficulty` and `Status` may use either:

- PostgreSQL enum types; or
- text columns with check constraints.

The chosen strategy must:

- prevent invalid values;
- produce reviewable migrations;
- avoid unnecessary lookup tables;
- be easy to extend deliberately.

The agent must explain the choice before creating the first migration.

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

## 10. API response representation

A problem response should be shaped around UI needs without exposing join-table rows.

Example:

```json
{
  "id": "e22a063e-1767-4fd3-a6ec-e92281531d18",
  "name": "House Robber",
  "category": {
    "id": "660ff13c-0195-48dd-a8a7-d1bd0526f9ad",
    "name": "Dynamic Programming"
  },
  "tags": [
    {
      "id": "8cd458e8-1313-4590-a60b-5ba185a14975",
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
