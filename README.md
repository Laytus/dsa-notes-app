# DSA Notes

DSA Notes is a local web application for storing, organizing, and reviewing notes about solved and planned data structures and algorithms problems.

The application is intended primarily for tracking NeetCode and LeetCode problems during technical interview preparation.

## Project status

The project has a working monorepo foundation:

- a minimal Angular shell;
- a minimal Fastify API with a health endpoint;
- a local PostgreSQL Docker Compose service;
- workspace-wide validation commands.

The database schema and application features have not been implemented yet.

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

No database client or ORM is installed in this foundation phase.

## Configure the environment

Create an ignored local environment file from the committed example:

```bash
cp .env.example .env
```

The example contains local-only development credentials. Change them in `.env`
if the defaults conflict with another local PostgreSQL installation. Do not
commit `.env`.

## Start PostgreSQL

PostgreSQL 18 runs as the only Docker Compose service:

```bash
docker compose up -d postgres
docker compose ps
```

The service uses the `postgres-data` named volume. Normal start and stop
commands preserve that volume:

```bash
docker compose stop postgres
```

There is no application database schema or migration command yet.

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

The health endpoint and API startup do not require PostgreSQL. The Angular
application does not call the API yet, so no development proxy or CORS
middleware is configured.

## Validation

Run individual workspace checks:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
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
