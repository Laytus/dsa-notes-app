# Agent Instructions

## 1. Project purpose

This repository contains DSA Notes, a local desktop-oriented web application for storing and reviewing NeetCode, LeetCode, and other data structures and algorithms problem notes.

The application uses:

- Angular and TypeScript for the frontend;
- Node.js, TypeScript, and Fastify for the API;
- PostgreSQL for persistence;
- Drizzle ORM for database access;
- Docker Compose for the local database;
- pnpm workspaces for the monorepo.

Read the following documents before making architectural or functional changes:

- `README.md`
- `docs/product-spec.md`
- `docs/architecture.md`

## 2. Core engineering principles

- Prefer simple, readable, explicit implementations.
- Implement only the requested scope.
- Do not anticipate hypothetical requirements.
- Do not modify unrelated files.
- Do not add abstraction layers without an immediate use.
- Keep frontend, API, and database responsibilities separated.
- Use strict TypeScript.
- Validate all external input at the API boundary.
- Preserve database integrity with constraints and transactions.
- Add or update tests whenever observable behavior changes.
- Keep changes small enough to review.
- Do not create Git commits unless explicitly requested.
- Do not rewrite working project configuration without explaining why.

## 3. Current scope

The MVP uses a fixed set of problem fields.

Do not implement:

- dynamic columns;
- column creation;
- column deletion;
- column renaming;
- column resizing;
- column reordering;
- spreadsheet-style editing;
- authentication;
- cloud deployment;
- synchronization;
- collaboration;
- microservices;
- browser-offline write synchronization.

Do not introduce architecture intended primarily for those excluded features.

## 4. Frontend rules

- Use Angular standalone APIs where appropriate.
- Prefer Angular signals, computed state, services, and reactive forms.
- Do not add NgRx or another state-management framework without explicit approval.
- Keep search, filtering, and sorting logic pure and testable.
- Do not send API requests for each search keystroke.
- Do not send update requests for each inline-edit keystroke.
- Use semantic and keyboard-accessible controls.
- Preserve visible focus indicators.
- Use real buttons for actions.
- Use real links for external destinations.
- Open Solution and Source links in a separate tab with safe link attributes.
- Do not render unsanitized Markdown-derived HTML.
- Do not render full Markdown content in every collapsed row.
- Avoid large data-grid dependencies unless a concrete requirement cannot reasonably be met otherwise.
- Before adding a major UI dependency, explain the need and trade-offs.

## 5. Backend rules

- Use Fastify route schemas or an approved runtime validation library.
- Keep route handling, domain behavior, and database access separable.
- Do not expose raw database errors.
- Use consistent API error responses.
- Enforce category, tag, status, difficulty, URL, and Times solved rules on the server.
- The backend, not the frontend, must determine whether Times solved increased.
- Update Times solved and Last reviewed atomically.
- Prevent deletion of categories that are still referenced.
- Deleting a tag must remove tag associations without deleting problems.
- Use transactions for multi-step mutations.
- Avoid generic repository or service abstractions unless multiple real implementations justify them.

## 6. Database rules

- Use reviewable committed migrations.
- Do not use destructive schema synchronization as a substitute for migrations.
- Use UUID identifiers unless the approved schema specifies otherwise.
- Add database constraints for required invariants.
- Use proper foreign keys.
- Use a many-to-many join table for problems and tags.
- Store link URLs and labels in separate database columns.
- Store Notes as raw Markdown text.
- Do not model fixed problem fields as generic cell-value rows or JSON blobs.
- Do not implement an entity-attribute-value schema.
- Explain the choice between PostgreSQL enums and check-constrained text before creating the first migration.

## 7. Shared code

`packages/shared` is optional.

Use it only for code that is genuinely shared between the frontend and backend, such as stable runtime schemas or API contract types.

Do not place:

- database-only models;
- Angular-specific code;
- Fastify-specific code;
- miscellaneous utilities;

in the shared package.

Do not create the package merely because the folder already exists.

## 8. Dependency policy

Do not add dependencies automatically when native functionality is sufficient.

For each meaningful new dependency, consider:

- purpose;
- maintenance;
- licensing;
- bundle or runtime impact;
- TypeScript support;
- alternative native implementations.

Do not replace an established dependency without a user-requested reason.

Do not upgrade unrelated dependencies during a feature task.

## 9. Testing requirements

Behavior changes require tests.

Prioritize tests for:

- search normalization;
- diacritic-insensitive search;
- OR-based tag filtering;
- combined filtering;
- sorting;
- API validation;
- CRUD behavior;
- category and tag deletion rules;
- duplication;
- automatic Last reviewed updates;
- persistence behavior.

Avoid brittle tests based primarily on implementation details or exact CSS pixels.

Use integration tests for important database behavior.

## 10. Performance rules

The MVP must handle at least 1,000 rows smoothly.

Before introducing optimization complexity:

1. measure the problem;
2. identify the bottleneck;
3. implement the smallest justified optimization.

Do not introduce row virtualization by default.

Avoid unnecessary recalculation and full Markdown rendering for collapsed rows.

## 11. Security and data safety

Even though the application is local:

- validate request data;
- sanitize rendered Markdown;
- confirm destructive operations;
- never commit real credentials;
- never print secrets;
- keep `.env` files out of Git;
- avoid executing untrusted content.

Do not add authentication unless the project scope changes explicitly.

## 12. Git rules

- Do not commit unless explicitly requested.
- Do not amend, reset, rebase, force-push, or delete branches without explicit instruction.
- Do not discard user changes.
- Inspect `git status` before and after substantial work.
- Keep changes scoped to the current task.
- Report unexpected pre-existing changes before modifying the same files.

## 13. Required task workflow

Before implementing a task:

1. Read the relevant documentation.
2. Inspect the current repository state.
3. Identify the smallest valid scope.
4. State any material ambiguity.
5. Avoid modifying files until the task is understood.

During implementation:

1. Make focused changes.
2. Preserve existing conventions.
3. Add tests with the behavior.
4. Avoid unrelated cleanup.
5. Run the narrowest useful validations early.

Before reporting completion:

1. Review the diff.
2. Run the relevant validation commands.
3. Confirm no unrelated files changed.
4. Report unresolved risks honestly.

## 14. Validation commands

Use the relevant subset of the root workspace commands once they exist:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Use application-specific commands when a root command would be unnecessarily expensive.

Database tasks may additionally require:

```bash
pnpm db:generate
pnpm db:migrate
```

Never claim that a command passed unless it was actually executed successfully.

If a command cannot be executed, explain:

- which command was skipped;
- why it was skipped;
- what risk remains.

## 15. Completion report

End each coding task with:

### Summary

A concise description of the completed behavior.

### Modified files

List every created, modified, or deleted file.

### Validation

List the commands executed and whether they passed.

### Remaining issues

Report:

- failing checks;
- skipped checks;
- incomplete requirements;
- design risks;
- follow-up work.

Do not describe a task as complete while known acceptance criteria remain unmet.

## 16. First-agent task

The first Codex task must inspect this repository and documentation without modifying files.

It should:

1. review the selected stack;
2. review the proposed monorepo;
3. identify contradictions or missing decisions;
4. identify unnecessary complexity;
5. propose small independently verifiable implementation tasks.

It must not:

- install dependencies;
- scaffold applications;
- create configuration files;
- implement features;
- commit changes.