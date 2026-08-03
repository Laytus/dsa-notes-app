# DSA Notes Implementation Plan

## 1. MVP status and historical repository assessment

### Current MVP status

The functional MVP is implemented and committed through persistence/restart
verification. It includes Category and Tag administration; Problems CRUD,
duplication, and review; side-panel and inline editing; local search, filters,
and supported sorting; responsive sticky table layout; progressive rendering;
1,000-row verification; and persistence/restart verification.

Focused validation has passed throughout development. One final clean
repository validation run and final audit confirmation remain before release or
a tag is created. The current MVP intentionally defers safe Markdown rendering
and preview, Excel export, import, optional Playwright/E2E coverage, responsive
Actions-seam polish, and additional UI polish. Virtual scrolling is an
evaluation only after MVP if progressive rendering remains insufficient.

### Historical pre-implementation state

The following was the initial, nonfunctional-skeleton assessment before the
implementation phases. It is retained as historical planning context and does
not describe the current repository:

- `apps/api/`, `apps/web/`, and `packages/shared/` exist but are empty.
- The root `package.json` contains metadata but no scripts or workspace tooling.
- `pnpm-workspace.yaml` contains `app/*`, while the documented directory is `apps/*`.
- `docker-compose.yml` is empty.
- `.env.example` contains plausible local defaults.
- `.gitignore` covers dependencies, generated output, credentials, test artifacts, and local database files.
- There is no lockfile, source code, test code, migration, or generated application configuration.
- Git has no commits. All initial files were untracked when this plan was prepared.

The empty application directories match the intended layout. `packages/shared` should remain empty until genuinely shared contracts exist.

### Documentation agreement

`README.md`, `docs/product-spec.md`, `docs/architecture.md`, and `AGENTS.md` agree on the principal decisions:

- Angular frontend and Fastify API.
- PostgreSQL through Drizzle.
- Docker Compose for PostgreSQL only.
- pnpm workspaces without Nx or Turborepo.
- Fixed problem fields.
- Client-side search, filtering, and sorting.
- Server-owned validation and automatic review behavior.
- Relational categories and many-to-many tags.
- No authentication, cloud architecture, synchronization, or dynamic columns.
- Angular signals, computed state, services, and reactive forms instead of NgRx.
- No large data grid or row virtualization unless measurement justifies it.

The documents are consistent at the architectural level. The remaining issues are mostly behavioral details that must be settled before their corresponding implementation tasks.

### Suitability for 1,000 rows

The proposed design should reasonably support 1,000 problem records:

- Loading 1,000 moderately sized records into browser memory is acceptable.
- Client-side substring search, filtering, and stable sorting are inexpensive at this scale.
- A semantic table can handle 1,000 collapsed rows if change detection and rendering work are controlled.
- Collapsed rows should use escaped/plain-text note excerpts rather than full Markdown rendering.
- Pure derived operations should avoid rebuilding normalized search content unnecessarily.
- Row virtualization should be considered only after measuring a real implementation.

The main performance risks are very large Notes fields, full Markdown rendering in collapsed rows, and excessive interactive component work per row.

## 2. Contradictions and missing decisions

| Issue | Why it matters | Recommended resolution | Blocking status |
|---|---|---|---|
| Workspace glob is `app/*`, but the repository uses `apps/*`. | Application packages would not join the workspace. | Change it to `apps/*` during root scaffolding. | Blocks scaffolding. |
| `docker-compose.yml` is empty. | The documented PostgreSQL workflow cannot run. | Add one pinned PostgreSQL service, named volume, environment interpolation, and health check. | Blocks database work. |
| Toolchain versions are unspecified. | Generated output and compatibility can vary. | Select supported Node, pnpm, Angular, Fastify, Drizzle, and PostgreSQL versions before installation; record Node/pnpm requirements and pin the PostgreSQL major version. | Blocks reproducible installation. |
| PostgreSQL enums versus check-constrained text is unresolved. | It determines migrations and value evolution. | Use text columns with explicit check constraints and TypeScript literal unions. This retains integrity while simplifying deliberate value changes. | Blocks the first migration. |
| “Unique normalized” category/tag names is undefined. | Case-only and whitespace duplicates could be inconsistent. | Trim input, reject empty results, and add unique indexes on `lower(name)`. Do not make diacritic removal part of identity without a product decision. | Blocks category/tag schema. |
| Maximum field lengths are unspecified. | Unlimited names and labels harm validation and layout. | Decide limits before API schemas; suggested: names/category/tag/link label 120 and URL 2,048. Keep Notes as unbounded text. | Blocks final validation contracts. |
| Whitespace handling is unspecified. | Whitespace-only values could satisfy naïve validation. | Trim names and labels at the API boundary; reject trimmed-empty required values; preserve Notes verbatim. | Blocks CRUD contracts. |
| Partial link-state rules are unclear. | URL-only and label-only values can produce inconsistent UI/API behavior. | Treat no URL as no clickable link. Permit a default/stored label without a URL, but require a non-empty label when a URL exists. Normalize empty persistence values consistently. | Blocks problem validation. |
| URL validation details are incomplete. | “Absolute HTTP/HTTPS” needs consistent enforcement. | Parse with the platform `URL` class, allow only `http:`/`https:`, trim first, and reject embedded credentials. | Blocks problem validation. |
| “Current local date” has no timezone authority. | Near midnight, a client-derived or UTC date can be wrong. | Use one injected server-calendar source for the locked update transaction and persist its `YYYY-MM-DD` value as a PostgreSQL `date`. | Blocks safe review behavior. |
| Concurrent `Times solved` updates are not fully specified. | Requests could compare against stale values or lose updates. | Lock the problem row inside a transaction, compare the requested absolute value with the locked value, then update both fields atomically. | Blocks review implementation. |
| A PATCH containing increased `timesSolved` and explicit `lastReviewed` is ambiguous. | Client-supplied review dates can bypass the review rule. | Make `lastReviewedOn` hydrated read state, not a writable PATCH field. The server derives it only when the locked persisted count is increased. | Blocks PATCH semantics. |
| Creation with `timesSolved > 0` is ambiguous. | There is no prior persisted value to “increase” from. | Do not auto-set the date on creation. Accept an explicit date or leave it null. Automatic behavior applies to updates. | Blocks create semantics. |
| `updatedAt` behavior is incomplete. | No-op updates and tag changes may behave inconsistently. | Reject empty PATCH bodies and advance `updatedAt` after successful mutations, including tag changes. | Resolve with API contracts. |
| Category deletion lacks an exact API result. | UI and tests require a stable contract. | Use `409 Conflict`, code `CATEGORY_IN_USE`, and `ON DELETE RESTRICT`. Leave all data unchanged. | Blocks category delete API. |
| Category reassignment before deletion has no dedicated workflow. | Restriction is safe but may be inconvenient. | Use ordinary problem edits for reassignment. Do not add bulk reassignment in MVP. | Deferred. |
| Tag deletion’s transaction guarantees are implicit. | Associations must not be partially removed. | Use `ON DELETE CASCADE` only from `problem_tags.tag_id`; deleting a tag removes joins but not problems. | Blocks tag schema/API. |
| Duplicate naming is vague. | Repeated duplication could be inconsistent. | Use `${originalName} Copy`; do not enforce unique problem names. Copy values and associations transactionally. | Blocks duplication behavior. |
| PATCH tag semantics are unspecified. | Add/remove versus replacement affects transactions. | Treat `tagIds`, when present, as the complete desired set and validate all IDs before replacement. | Blocks problem update API. |
| Default problem ordering is unspecified. | Rendering and tests need deterministic results. | Return `createdAt ASC, id ASC` or another documented deterministic order. | Resolve with list API. |
| Pagination is unspecified. | The frontend expects the complete dataset. | Do not add pagination for MVP. Revisit only after measurement or scope growth. | Not blocking. |
| Status codes and error details are incomplete. | Consumers should not rely on framework/database defaults. | Standardize an error envelope and distinguish validation, not-found, conflict, and internal errors. | Blocks polished APIs. |
| Development CORS/proxy strategy is unspecified. | Web and API use different ports. | Prefer an Angular development proxy for `/api`; add narrow CORS only if direct cross-origin operation is needed. | Blocks frontend integration choice. |
| Accessible table semantics are not settled. | ARIA grid semantics require extensive keyboard behavior. | Begin with semantic `<table>`, native controls, labels, visible focus, and announced errors. Do not use `role="grid"` without implementing its keyboard model. | Blocks table markup choice. |
| Six sticky columns may consume most of a smaller viewport. | The horizontally scrolling area may become unusable. | Define widths and a supported minimum desktop width; change sticky scope only through an explicit specification decision. | Review before sticky implementation. |
| Expanded-row content is described as optional. | Acceptance tests need deterministic behavior. | Require wrapped full scalar values and a bounded larger Notes preview. Reserve full Markdown for preview UI. | Resolve with table behavior. |
| Confirmation UI is unspecified. | Native and custom dialogs have different accessibility/test costs. | Use one small accessible confirmation component for unsaved changes and destructive actions; avoid a general modal framework. | Review before panel UI. |
| Markdown parser/sanitizer is unresolved. | Unsafe rendered HTML is a security risk. | Defer selection until CRUD is stable; evaluate a small parser and explicit sanitizer together, with raw HTML disabled by default. | Not blocking raw-text work. |
| Excel export is conditional. | It can add dependency and test complexity. | Treat it as post-MVP unless core acceptance criteria are complete and the cost remains small. | Not blocking. |
| E2E database lifecycle is unspecified. | Playwright requires isolated, repeatable data. | Establish database integration isolation first, then use a dedicated test DB and deterministic cleanup for E2E. | Deferred. |
| `packages/shared` exists before shared code exists. | It encourages premature abstraction. | Leave it empty until stable contract duplication is demonstrated. | Not blocking. |
| Seed-data policy is unspecified. | Manual/performance testing needs reproducible records. | Add test factories and a non-production benchmark seed later; do not add implicit production seeding. | Deferred. |
| Sorting locale and tie-breaking are unspecified. | Browser locale differences can alter order. | Use one configured `Intl.Collator` and deterministic original-index or ID tie-breaking. | Blocks exact sorting tests. |
| Search whitespace details are incomplete. | Combining marks and whitespace could behave unexpectedly. | Normalize with NFD, remove diacritics, lowercase, and trim. Treat the normalized query as one substring unless the spec changes. | Blocks search utility. |

## 3. Architecture assessment

### Angular

Angular is appropriate for the stateful table and forms. Standalone components, reactive forms, signals, computed values, dependency injection, and HTTP testing cover the requirements without NgRx. Create feature folders only when they contain real code. Attempt a semantic table before considering a grid library.

### Fastify

Fastify is appropriate for a small JSON API. Separate a testable `buildApp()` from the network entry point. Keep routes, domain operations, and database access separable without generic repositories. Select one runtime-validation approach rather than maintaining duplicate schemas.

### PostgreSQL

PostgreSQL is appropriate because it supplies the required constraints, relations, transactions, and durable local storage. Recommended choices include UUID primary keys, PostgreSQL `date` for `last_reviewed`, `timestamptz` metadata, check-constrained text for enums, non-null Notes with an empty default, restrictive category deletion, and cascades only for join rows.

### Drizzle

Drizzle keeps schemas and migrations close to SQL and is suitable here. Commit and inspect generated migrations. Focused raw SQL is acceptable for row locking, expression indexes, or constraints when clearer than an ORM workaround. Do not wrap Drizzle in speculative repository interfaces.

### Docker Compose

Use Compose only for PostgreSQL. One pinned service with a named volume and health check is sufficient. Run the frontend and API on the host during development.

### pnpm workspaces

pnpm workspaces are appropriate and avoid an unnecessary monorepo framework. Root scripts can use filtered or recursive workspace commands. Correct the workspace glob first.

### Repository layout

`apps/api` and `apps/web` are suitable. The architecture tree is directional, not a requirement to pre-create empty folders. Keep API startup, database code, and domain modules separate. Keep Angular feature code under `src/app/features` when justified. Leave `packages/shared` empty initially.

### Frontend state management

Use canonical signals for problems, categories, and tags; computed state for query, selected tag IDs, sorting, and derived rows; local component state for expansion and editing; and reactive forms for panels. Avoid mirroring every form control into global state.

### API design

The proposed resource endpoints are sufficient. Use stable error codes, runtime validation, deterministic collection ordering, transactional tag replacement, and no pagination or generic query layer in MVP. `PATCH` should reject an empty body and treat supplied `tagIds` as a full replacement.

### Database modeling

The relational model is correct and avoids EAV/JSON complexity. Add check constraints for non-empty names, case-insensitive unique indexes for category/tag names, a composite primary key for `problem_tags`, appropriate foreign-key indexes, and link consistency constraints where practical.

### Testing strategy

Use:

1. Pure unit tests for normalization, search, filtering, sorting, and small domain helpers.
2. Fastify injection tests plus real PostgreSQL integration tests for constraints and transactions.
3. Angular component/service tests for rendering, forms, HTTP behavior, keyboard interaction, and error handling.
4. Playwright only after a complete vertical CRUD workflow exists.

Category/tag deletion and automatic review behavior must be tested against PostgreSQL rather than mocked away.

## 4. Proposed implementation phases

1. **Foundation:** Correct workspace discovery, select versions, scaffold the API and web applications minimally, and establish validation commands.
2. **Local persistence:** Configure PostgreSQL, settle schema policies, add Drizzle migrations, and create isolated database tests.
3. **Reference-data API:** Implement categories and tags with validation and deletion integrity.
4. **Problem API:** Implement reads, writes, relationship replacement, duplication/deletion, and atomic review behavior.
5. **Static table foundation:** Build table structure, scrolling, sticky regions, and expansion with fixtures.
6. **Frontend data workflows:** Integrate API state and add creation, editing, deletion, and administration.
7. **Derived table behavior:** Add search, OR filtering, combined predicates, and deterministic sorting.
8. **Notes and optional export:** Add safe Markdown preview and decide whether Excel remains in MVP.
9. **System validation:** Add E2E coverage, measure 1,000-row behavior, optimize only measured bottlenecks, and finalize documentation.

## 5. Detailed action plan

### Task 1 — Root workspace foundation

- **Objective:** Make the skeleton a valid pnpm workspace without application code.
- **Scope:** Correct `apps/*`; add selected package-manager/engine metadata; add only meaningful root scripts; keep `packages/shared` empty.
- **Areas:** `package.json`, `pnpm-workspace.yaml`, optional version metadata.
- **Dependencies:** Toolchain version decision.
- **Acceptance:** Intended packages are discoverable; metadata is valid; no feature code exists.
- **Validation:** Parse JSON/YAML; check local Node/pnpm versions; later run `pnpm list -r --depth -1`.
- **Commands:** `node --version`, `pnpm --version`, later `pnpm list -r --depth -1`.
- **Risks/decisions:** Pin compatible Node/pnpm versions; add no monorepo framework.
- **Commit boundary:** `chore: establish pnpm workspace foundation`.

### Task 2 — PostgreSQL Compose configuration

- **Objective:** Provide reproducible local PostgreSQL.
- **Scope:** One pinned service, named volume, health check, environment/port interpolation.
- **Areas:** `docker-compose.yml`, `.env.example`, README database instructions.
- **Dependencies:** Task 1 only for conventions.
- **Acceptance:** Compose resolves; DB becomes healthy; named-volume data survives ordinary restarts.
- **Validation:** `docker compose config` and an authorized startup smoke test.
- **Commands:** `docker compose config`, `docker compose up -d postgres`, `docker compose ps`, `docker compose down`.
- **Risks/decisions:** PostgreSQL major version and host-port conflicts; never delete volumes as routine validation.
- **Commit boundary:** `chore: configure local PostgreSQL`.

### Task 3 — Fastify scaffold and health endpoint

- **Objective:** Create the smallest testable API.
- **Scope:** Strict TypeScript package, `buildApp()`, server entry, `/api/health`, and an injection test.
- **Areas:** `apps/api/**`.
- **Dependencies:** Task 1.
- **Acceptance:** Health returns stable JSON/200 without PostgreSQL; compilation succeeds.
- **Validation:** API lint, typecheck, test, and build.
- **Commands:** `pnpm --filter api typecheck`, `pnpm --filter api test`, `pnpm --filter api build`.
- **Risks/decisions:** Node module format and Fastify compatibility; defer general validation dependencies.
- **Commit boundary:** `feat(api): scaffold Fastify health endpoint`.

### Task 4 — Angular scaffold and shell

- **Objective:** Create a minimal standalone Angular application.
- **Scope:** Standalone bootstrap, title/shell, generator-required routing, and smoke test; no table.
- **Areas:** `apps/web/**`.
- **Dependencies:** Task 1.
- **Acceptance:** A basic DSA Notes shell builds and renders without CRUD/table behavior.
- **Validation:** Angular test and production build.
- **Commands:** `pnpm --filter web test`, `pnpm --filter web build`.
- **Risks/decisions:** Use plain CSS; retain generator conventions unless there is a documented problem.
- **Commit boundary:** `feat(web): scaffold Angular application shell`.

### Task 5 — Workspace quality commands

- **Objective:** Provide consistent root validation.
- **Scope:** Root `lint`, `typecheck`, `test`, `build`, and development orchestration; align strict TypeScript without replacing working generated config.
- **Areas:** Root and application scripts/config.
- **Dependencies:** Tasks 3–4.
- **Acceptance:** Root commands invoke relevant workspaces and propagate failures.
- **Validation/commands:** `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`.
- **Risks/decisions:** Avoid redundant formatters and conflicting lint stacks.
- **Commit boundary:** `chore: add workspace validation commands`.

### Task 6 — Database conventions decision

- **Objective:** Resolve migration-affecting semantics.
- **Scope:** Document check-constrained text, null/default policy, normalized uniqueness, timezone, link rules, timestamps, and delete actions.
- **Areas:** Architecture documentation.
- **Dependencies:** Tasks 1–2.
- **Acceptance:** All schema-affecting ambiguities in this plan have explicit decisions.
- **Validation:** Documentation review and `git diff --check`; no migration.
- **Risks/decisions:** Approval point for enum and timezone choices.
- **Commit boundary:** `docs: define database conventions`.

### Task 7 — Drizzle schema and initial migration

- **Objective:** Add the relational schema and reviewable SQL migration.
- **Scope:** Connection config, four tables, constraints/indexes/FKs/timestamps, initial migration; no routes.
- **Areas:** API database code, Drizzle config, migrations, scripts.
- **Dependencies:** Tasks 2, 3, 6.
- **Acceptance:** Migration applies cleanly and database constraints reject invalid values/deletes.
- **Validation:** Generate, inspect, and apply the migration to a fresh database.
- **Commands:** `pnpm db:generate`, `pnpm db:migrate`, API typecheck/test.
- **Risks/decisions:** Focused raw SQL may be clearer for expression indexes and checks.
- **Commit boundary:** `feat(api): add initial database schema`.

### Task 8 — Database integration-test harness

- **Objective:** Make persistence behavior safely testable.
- **Scope:** Dedicated test DB config, migrations, deterministic cleanup, and basic factories.
- **Areas:** API test helpers, scripts, test environment docs.
- **Dependencies:** Task 7.
- **Acceptance:** Tests cannot target development data and pass repeatedly in isolation.
- **Validation:** Run the integration suite twice.
- **Commands:** API integration-test script and typecheck.
- **Risks/decisions:** Validate the test database target before destructive cleanup.
- **Commit boundary:** `test(api): add PostgreSQL integration harness`.

### Task 9 — Category read/create API

- **Objective:** List and create categories.
- **Scope:** `GET`/`POST`, trimmed names, normalized conflicts, stable representations/errors.
- **Areas:** Category routes, schemas/domain logic, integration tests.
- **Dependencies:** Task 8.
- **Acceptance:** Valid creation/listing works; invalid/duplicate input fails predictably.
- **Validation/commands:** API test, typecheck, and lint.
- **Risks/decisions:** Confirm maximum length and list ordering.
- **Commit boundary:** `feat(api): add category listing and creation`.

### Task 10 — Category rename/delete API

- **Objective:** Complete category administration safely.
- **Scope:** Rename and deletion with `404`, conflict, and `CATEGORY_IN_USE`.
- **Areas:** Category module/tests.
- **Dependencies:** Task 9.
- **Acceptance:** Rename propagates by reference; unused delete succeeds; referenced delete returns 409 without mutation.
- **Validation/commands:** PostgreSQL integration tests, API typecheck/lint.
- **Risks/decisions:** No bulk reassignment.
- **Commit boundary:** `feat(api): add category rename and guarded deletion`.

### Task 11 — Tag read/create/rename API

- **Objective:** Add core tag administration.
- **Scope:** `GET`, `POST`, and `PATCH`; omit color UI/behavior unless separately approved.
- **Areas:** Tag module/tests.
- **Dependencies:** Task 8.
- **Acceptance:** Stable list/create/rename; normalized duplicates rejected; immutable IDs.
- **Validation/commands:** API integration tests, typecheck, lint.
- **Risks/decisions:** Avoid implementing unused color functionality.
- **Commit boundary:** `feat(api): add tag listing and mutation`.

### Task 12 — Tag deletion API

- **Objective:** Delete a tag without deleting problems.
- **Scope:** `DELETE`, join-row cleanup, stable missing-ID response.
- **Areas:** Tag delete logic/tests.
- **Dependencies:** Task 11 and schema FK behavior.
- **Acceptance:** Target tag and joins disappear; problems and unrelated tags remain.
- **Validation/commands:** Real DB integration tests, API typecheck/lint.
- **Risks/decisions:** Confirmation belongs to the frontend.
- **Commit boundary:** `feat(api): add safe global tag deletion`.

### Task 13 — Problem read API

- **Objective:** Return UI-oriented problem objects.
- **Scope:** `GET /api/problems` with category, tags, grouped links, dates, timestamps, and deterministic order.
- **Areas:** Problem query/mapper/route/tests.
- **Dependencies:** Tasks 9–12.
- **Acceptance:** Empty and populated results serialize correctly without join duplication or raw DB structure.
- **Validation/commands:** Integration tests, API typecheck/lint.
- **Risks/decisions:** Avoid N+1 queries.
- **Commit boundary:** `feat(api): add problem listing`.

### Task 14 — Problem creation API

- **Objective:** Create complete validated records.
- **Scope:** `POST`, fixed fields, defaults, category/tag existence, links, transactional associations.
- **Areas:** Problem validation/domain/route/tests.
- **Dependencies:** Task 13.
- **Acceptance:** Valid create returns 201; invalid input causes no partial write.
- **Validation/commands:** Route and DB integration tests, typecheck/lint.
- **Risks/decisions:** Creation does not infer review date from a positive count unless the spec changes.
- **Commit boundary:** `feat(api): add problem creation`.

### Task 15 — General problem update API

- **Objective:** Update fixed fields and tag sets.
- **Scope:** Partial `PATCH`, reject empty bodies, validate references, replace supplied `tagIds` transactionally.
- **Areas:** Problem update logic/tests.
- **Dependencies:** Task 14.
- **Acceptance:** Omitted fields remain unchanged; invalid references roll back; tags replace the complete set.
- **Validation/commands:** Integration tests, API typecheck/lint.
- **Risks/decisions:** Coordinate `timesSolved` implementation with Task 17.
- **Commit boundary:** `feat(api): add problem updates`.

### Task 16 — Problem duplication and deletion API

- **Objective:** Add safe lifecycle actions.
- **Scope:** Transactional duplication including tags and deletion including associations.
- **Areas:** Problem command routes/domain/tests.
- **Dependencies:** Tasks 14–15.
- **Acceptance:** Duplicate has new identity/timestamps and ` Copy` name; delete affects only the target.
- **Validation/commands:** Integration/rollback tests, API typecheck/lint.
- **Risks/decisions:** Do not add unique-name suffix sequencing.
- **Commit boundary:** `feat(api): add problem duplication and deletion`.

### Task 17 — Atomic review semantics

- **Objective:** Enforce `Times solved` and `Last reviewed` safely.
- **Scope:** Lock/compare/update transaction, injected server-calendar source, precedence rule, concurrency coverage where practical.
- **Areas:** Problem update domain, date config/utility, tests, docs.
- **Dependencies:** Tasks 6 and 15.
- **Acceptance:** Increase sets the server calendar date; equal/decrease and unrelated updates preserve it; invalid counts fail atomically.
- **Validation:** Increase/decrease/unrelated-update/server-date/concurrency integration tests.
- **Commands:** API test, typecheck, lint.
- **Risks/decisions:** Confirm server-calendar source and row-lock implementation.
- **Commit boundary:** `feat(api): enforce atomic review updates`.

### Task 18 — Static problem table

- **Objective:** Establish accessible fixed-column table semantics with fixtures.
- **Scope:** Documented columns/order, native buttons/links, compact fixture rows; no API/editing.
- **Areas:** Angular problem types, fixture, table component/styles/tests.
- **Dependencies:** Task 4.
- **Acceptance:** Columns render in order; missing URLs are not clickable; external links use safe attributes.
- **Validation/commands:** Web component tests, typecheck/lint/build.
- **Risks/decisions:** Keep contracts local; do not create shared package code.
- **Commit boundary:** `feat(web): add static problem table`.

### Task 19 — Table scrolling

- **Objective:** Support constrained desktop viewports.
- **Scope:** Horizontal/vertical overflow and container sizing; no sticky behavior yet.
- **Areas:** Table template/styles/tests.
- **Dependencies:** Task 18.
- **Acceptance:** Both axes scroll within the container and focus is not clipped.
- **Validation:** Component tests and manual browser checks at supported sizes.
- **Commands:** Web test/build.
- **Risks/decisions:** Define supported minimum viewport; avoid pixel-brittle tests.
- **Commit boundary:** `feat(web): add table scrolling`.

### Task 20 — Sticky header and leading columns

- **Objective:** Add non-overlapping sticky regions.
- **Scope:** Sticky header and six specified leading columns with explicit widths, offsets, backgrounds, and layering.
- **Areas:** Table styles/template/tests.
- **Dependencies:** Task 19.
- **Acceptance:** No overlap or transparency artifacts during two-axis scrolling; focus remains visible.
- **Decision implemented:** Use a viewport-relative scroll region with stable
  scrollbar space; wide mode above 1540px freezes
  Expand/Name/Category/Tags/Difficulty/Status plus right Actions while retaining
  a 24rem central viewport; medium mode from 1051px through 1540px freezes
  Expand/Name/Category plus Actions; narrow mode from 761px through 1050px
  freezes Expand/Name plus Actions; Actions returns to normal flow at 760px.
- **Validation:** Manual browser inspection at multiple widths plus structural tests.
- **Commands:** Web test/build.
- **Risks/decisions:** Six sticky columns may require a documented minimum viewport.
- **Commit boundary:** `feat(web): add sticky table regions`.

### Task 21 — Collapsed and expanded rows

- **Objective:** Add independent expansion without edit mode.
- **Scope:** Default collapsed state, per-row controls, compact excerpts, expanded wrapping, multiple expanded IDs.
- **Areas:** Table state/template/styles/tests.
- **Dependencies:** Task 20.
- **Acceptance:** Rows start collapsed; controls expose state and work by keyboard; collapsed Notes do not increase height; multiple rows remain open.
- **Validation/commands:** Component tests, manual alignment check, web build.
- **Risks/decisions:** Keep Notes plain until Markdown work.
- **Commit boundary:** `feat(web): add row expansion behavior`.

### Task 22 — Frontend API client and canonical state

- **Objective:** Replace fixtures with API-loaded data.
- **Scope:** Typed clients, development proxy, loading/error/empty states, signal-based canonical state.
- **Areas:** Web models/services/store/config/tests.
- **Dependencies:** Tasks 13 and 21.
- **Acceptance:** One collection request populates the table; errors are visible; search input cannot trigger requests.
- **Validation/commands:** HTTP/component tests and web/API builds.
- **Risks/decisions:** Keep contracts local until real duplication justifies sharing.
- **Commit boundary:** `feat(web): integrate problem listing API`.

### Task 23 — Problem creation panel

- **Objective:** Create problems through an accessible explicit-save form.
- **Scope:** All creation fields/defaults, validation, save/cancel, dirty-close confirmation, error preservation.
- **Areas:** Problem form/panel/store/tests.
- **Dependencies:** Tasks 14 and 22.
- **Acceptance:** Valid saves display new records; invalid forms make no request; failure preserves input; keyboard/focus behavior works.
- **Validation/commands:** Component/HTTP tests, manual accessibility check, web typecheck/lint/build.
- **Risks/decisions:** Keep selectors and confirmation UI simple and accessible.
- **Commit boundary:** `feat(web): add problem creation panel`.

### Task 24 — Full editing and lifecycle UI

- **Objective:** Edit complex fields and expose duplicate/delete.
- **Scope:** Full edit panel, tags/links/notes, save/cancel, duplicate, confirmed delete, failure handling.
- **Areas:** Problem panel/actions/store/tests.
- **Dependencies:** Tasks 16 and 22–23.
- **Acceptance:** Save updates canonical state; duplicate is distinct; delete requires confirmation; failures do not discard data.
- **Validation/commands:** Component/HTTP tests, manual workflow, web checks.
- **Risks/decisions:** Prefer save-then-update over optimistic mutation initially.
- **Commit boundary:** `feat(web): add problem editing and lifecycle actions`.

### Task 25 — Inline editing

- **Objective:** Add deferred persistence for simple fields.
- **Scope:** Name, category, difficulty, status, and count; explicit Save/Cancel,
  Enter commit, Escape cancel, and one request per confirmed edit. Last reviewed
  remains server-derived read state and is not inline editable.
- **Areas:** Table editing state/components/tests.
- **Dependencies:** Tasks 17, 22, 24.
- **Acceptance:** No writes per keystroke; invalid edits preserve valid state; failures restore server state; backend review-date response is authoritative.
- **Validation/commands:** Keyboard/blur/failure/count component and HTTP tests; web checks.
- **Risks/decisions:** Prevent duplicate blur-plus-Enter submissions and announce busy/error states.
- **Commit boundary:** `feat(web): add inline problem editing`.

### Task 26 — Category and tag administration UI

- **Objective:** Expose reference-data CRUD.
- **Scope:** List/create/rename/delete, category-in-use explanation, tag confirmation and state reconciliation.
- **Areas:** Category/tag features/services/store/tests.
- **Dependencies:** Tasks 10–12 and 22.
- **Acceptance:** Supported actions work; category conflict is non-destructive; deleting a tag removes it from displayed problems only.
- **Validation/commands:** Component/HTTP tests, manual integration, web checks.
- **Risks/decisions:** No bulk reassignment or color controls.
- **Commit boundary:** `feat(web): add category and tag administration`.

### Task 27 — Search, filtering, and sorting

- **Objective:** Implement all derived table behavior.
- **Scope:** Normalization, search predicate, OR tag filter, combined pipeline,
  product-defined Name/Category/Difficulty/Last-reviewed sort modes, stable
  tie-breaking, and controls. Status and Times solved are excluded by the
  current product specification.
- **Areas:** Pure utilities/tests, computed store state, toolbar.
- **Dependencies:** Task 22.
- **Acceptance:** Required search fields and normalization work; tag filtering is OR; empty selections have no effect; empty sort values remain last; no API requests occur.
- **Validation/commands:** Exhaustive pure unit tests, component wiring tests, web checks.
- **Risks/decisions:** Approve collator locale and deterministic tie-break.
- **Commit boundary:** `feat(web): add search filtering and sorting`.

### Task 28 — Markdown editing and safe preview (deferred post-MVP)

- **Objective:** Evaluate safe rendered Markdown preview after the MVP.
- **Scope:** The MVP already stores and edits raw multiline Markdown source and
  displays escaped plain text. A future phase may select a parser/sanitizer,
  add Edit/Preview UI, and retain a plain collapsed excerpt.
- **Areas:** Dependency records, Markdown service/component/tests, panel/table integration, docs.
- **Dependencies:** Tasks 24 and 27.
- **Acceptance:** Deferred; no Markdown renderer or sanitizer is part of the
  MVP release.
- **Validation/commands:** Security fixtures, component tests, bundle/performance spot check, web checks.
- **Risks/decisions:** Maintenance, license, bundle size, and raw HTML policy.
- **Commit boundary:** `feat(web): add sanitized Markdown preview`.

### Task 29 — Excel export decision and optional implementation (deferred post-MVP)

- **Objective:** Evaluate export after the MVP; import is not part of the MVP.
- **Scope:** Decision record; if retained, export all canonical rows with hyperlinks, dates, tags, and multiline Notes.
- **Areas:** Export service/tests, toolbar, dependency docs.
- **Dependencies:** Stable API plus Task 27; preferably Task 28.
- **Acceptance:** Deferred; export and import do not block the MVP release.
- **Validation:** Reopen the workbook programmatically and assert cells/hyperlinks; build web.
- **Commands:** Web test/typecheck/lint/build.
- **Risks/decisions:** Library size/license and browser memory; defer post-MVP if disproportionate.
- **Commit boundary:** `feat(web): add Excel export` or `docs: defer Excel export`.

### Task 30 — Final validation, 1,000-row performance, and documentation

- **Objective:** Validate the complete system and close documentation gaps.
- **Scope:** Final clean validation, isolated test data, 1,000-row measurement,
  only justified optimization, and final README/spec reconciliation. The current
  frontend verification uses deterministic data and local 100-row progressive
  rendering after the complete search/filter/sort derivation; it is not backend
  pagination or virtual scrolling. Manual browser verification found the
  initial block substantially improves usability, with accepted rendering
  degradation after roughly 300 visible rows; virtual scrolling remains a
  post-MVP evaluation only. The completed persistence utility verifies an
  isolated PostgreSQL fixture across fresh Fastify/database-client reconnect
  and migration reapplication. The documented manual Angular/API/PostgreSQL
  full restart checkpoint also completed with retained data and named volume.
- **Areas:** Validation commands, benchmark data/script, targeted performance
  changes, docs. Playwright/E2E is optional post-MVP coverage.
- **Dependencies:** Completed Tasks 2–27; Tasks 28–29 are explicitly deferred.
- **Acceptance:** The table is demonstrably usable at 1,000 rows; MVP criteria
  map to automated or documented manual checks; final clean validation passes.
- **Validation:** Full root checks, production builds, Compose startup, isolated
  PostgreSQL checks, persistence verification, and recorded performance evidence.
- **Commands:** `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`,
  `pnpm validate`, `pnpm test:db`, `verify:persistence`, and `docker compose config`.
- **Risks/decisions:** Define responsiveness criteria before measuring; virtualization requires evidence; E2E must never target development data.
- **Commit boundary:** Separate focused commits for E2E, any measured optimization, and final documentation.

## 6. Historical first recommended implementation task

The following prompt is retained as historical scaffolding context. It is not
an instruction for the completed repository.

Give Codex this prompt:

> You are working in the `dsa-notes` repository. Implement only the root pnpm workspace foundation.
>
> Before modifying anything:
>
> 1. Read `AGENTS.md`, `README.md`, `docs/product-spec.md`, and `docs/architecture.md`.
> 2. Inspect `git status` and the current root configuration.
> 3. Report any unexpected changes that overlap this task.
>
> Scope:
>
> - Correct `pnpm-workspace.yaml` so it includes `apps/*` and `packages/*`.
> - Select and document compatible Node.js and pnpm versions in the smallest conventional way.
> - Update the root `package.json` with the correct package-manager and engine metadata.
> - Add only root scripts that are meaningful before application packages have been scaffolded; do not add placeholder scripts that falsely succeed.
> - Preserve the existing `apps/api`, `apps/web`, and `packages/shared` directories.
> - Keep `packages/shared` empty.
>
> Do not:
>
> - install dependencies;
> - run package installation;
> - scaffold Angular or Fastify;
> - modify `docker-compose.yml`;
> - add database code or migrations;
> - implement the problem table or CRUD;
> - add Nx, Turborepo, or another orchestration framework;
> - commit changes.
>
> Acceptance criteria:
>
> - The workspace glob matches the documented `apps/` layout.
> - Root JSON and YAML are syntactically valid.
> - Version declarations are internally consistent and justified.
> - No feature code or unnecessary configuration is introduced.
> - The final diff contains only root workspace foundation changes.
>
> Run only read-only or non-installing validation commands, such as parsing the files and checking locally available Node/pnpm versions. Do not claim workspace-package validation if no packages or installation are available.
>
> Finish with the repository-required sections: Summary, Modified files, Validation, and Remaining issues.

## 7. Risks and deferred decisions

- **Markdown library:** Defer until raw-text editing works. Evaluate parser and sanitizer together, disable raw HTML by default, and test hostile inputs.
- **Excel export:** Treat as post-MVP by default. Retain only if a maintained browser-compatible library meets the requirements without disproportionate cost.
- **Table strategy:** Start with semantic HTML/CSS. Revisit only after measuring the actual 1,000-row implementation. Do not adopt an ARIA grid or large data-grid merely for sticky columns.
- **E2E timing:** Add Playwright after a full CRUD workflow exists. Prioritize API integration and pure frontend behavior first.
- **Performance optimization:** Establish a repeatable 1,000-row scenario and responsiveness criteria. Likely first improvements are cached normalized text, reduced collapsed-row work, and avoiding Markdown rendering—not virtualization.
- **`packages/shared`:** Keep empty until stable, harmful contract duplication exists. Never share Drizzle models or framework-specific code.
- **Timezone:** Decide before automatic-review behavior. An explicit IANA timezone is safer than host-local or browser-provided dates.
- **Validation limits:** Approve lengths and whitespace normalization before database/API contracts stabilize.
- **Test database safety:** Integration and E2E scripts must prove they cannot clean or migrate development data accidentally.
- **Sticky widths:** Six sticky columns may be impractical at smaller widths; test before marking the requirement complete.
- **Dependency selection:** Pin a compatible toolchain before installation and avoid unrelated upgrades.
- **Tag color:** Omit or leave dormant until a visible requirement exists.
- **Pagination/server search:** Not justified for 1,000 rows; revisit only if data size or Notes volume materially increases.
