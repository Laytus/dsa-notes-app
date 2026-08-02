# Persistence and restart verification

## Scope

This verification demonstrates PostgreSQL persistence without relying on Angular in-memory state. It uses `DATABASE_TEST_URL` to create one uniquely named temporary database and never writes to the development database named by `DATABASE_URL`.

The generated fixture contains two Categories (including a rename), three Tags (including a rename and changed association), and four Problems. It covers category and Tag relationships, nullable Difficulty, varied Status values, links, multiline raw Notes, a server-derived Last reviewed date, timestamps, an edited Problem, and an independently persisted duplicate.

## Automated verification

Load the local environment and start PostgreSQL:

```bash
set -a
source .env
set +a
docker compose up -d postgres
pnpm --filter @dsa-notes/api verify:persistence
```

`verify:persistence` applies committed migrations to a generated database, seeds the fixture through real Fastify routes, closes and recreates the default database client/Fastify app, verifies the complete hydrated API snapshot, reapplies migrations, verifies it again, and drops only the generated database. The command rejects a missing or unsafe `DATABASE_TEST_URL`: its base database name must contain `test` and use only letters, numbers, and underscores.

The completed run also used the persistent prepare/verify commands around a real `docker compose stop postgres` / `docker compose start postgres` cycle.

The exact fixture snapshot survived the restart and another migration run.

The named `dsa-notes_postgres-data` volume remained present. `docker compose down -v` was not used and is prohibited for this workflow.

## Completed manual restart result

The documented full application procedure was completed against the isolated persistence verification database. Angular was stopped and restarted successfully. Fastify was stopped and restarted successfully with the same `DATABASE_URL`. PostgreSQL was stopped and started through Docker Compose while retaining the named volume, and the committed migrations were rerun against the same verification database.

All manually created and modified data remained present afterward: Categories, Tags, Problems, category and Tag relationships, multiline Notes, links, duplicate identity and copied state, Times solved, and server-derived Last reviewed. No data loss or duplicate records were observed. Transient frontend state was not expected to survive and was not treated as persisted data.

## Manual frontend and process restart procedure

Use this sequence when verifying Angular, a separately running API process, and the full application together. Keep the printed database name until cleanup.

```bash
set -a
source .env
set +a
docker compose up -d postgres
pnpm --filter @dsa-notes/api persistence:prepare
# Copy the printed database name.
PERSISTENCE_DATABASE_NAME=the_printed_name
export DATABASE_URL="${DATABASE_TEST_URL%/*}/${PERSISTENCE_DATABASE_NAME}"
pnpm dev:api
```

In a second terminal with the same exported `DATABASE_URL`, run:

```bash
pnpm dev:web
```

Inspect the Categories, Tags, and four Problems in the browser, then make one additional UI mutation. Stop and restart Angular; the page reloads the same server data. Stop and restart the API with the same `DATABASE_URL`; the browser continues to load that persisted data.

Then stop both host processes and run:

```bash
docker compose stop postgres
docker compose start postgres
DATABASE_URL="${DATABASE_TEST_URL%/*}/${PERSISTENCE_DATABASE_NAME}" pnpm db:migrate
```

Restart API and Angular with that same URL and confirm the fixture plus the UI mutation remain. This is the full normal restart checkpoint. The initial fixture can be checked before manual mutation with:

```bash
pnpm --filter @dsa-notes/api persistence:verify
pnpm --filter @dsa-notes/api persistence:migrate-verify
```

After a manual UI mutation, inspect through the running API/browser instead of comparing against the original fixture snapshot. At the end, stop host processes and remove only the recorded generated database:

```bash
pnpm --filter @dsa-notes/api persistence:cleanup
docker compose stop postgres
docker compose ps
```

Do not run `docker compose down -v`; it removes named PostgreSQL storage.

## Persisted versus transient state

Persisted PostgreSQL state includes Categories, Tags, Problems, foreign-key relationships, Tag associations, nullable fields, links, raw Notes, Times solved, server-derived Last reviewed, and creation/update timestamps.

The frontend does not persist search query, selected filters, active sort, progressive render limit, expanded row IDs, inline drafts, open Create/Edit or administration panels, or pending and error state. Those UI-only values are expected to reset on a browser/application restart; canonical data is loaded again from the API.
