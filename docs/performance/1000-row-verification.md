# 1,000-Problem performance verification

## Scope and environment

This verification covers the MVP's local frontend derivations and immutable
reconciliation paths. It uses Node.js 24.15.0, pnpm 10.32.1, Vitest 4.1.10,
and the Angular workspace dependencies on macOS. Timings are diagnostic rather
than a cross-machine performance contract.

The deterministic test-only fixture in
`apps/web/src/testing/problem-performance.fixture.ts` creates exactly 1,000
fully hydrated Problems. It includes decimal-string IDs beyond
`Number.MAX_SAFE_INTEGER`, repeated names, accented text, null values, varied
links, Categories, Tags, statuses, date-only values, and long Names, Tags, and
Notes. It does not write to PostgreSQL or application state.

## Commands and automated coverage

Run the diagnostic benchmark:

```bash
pnpm --filter @dsa-notes/web test:performance
```

Run the regular frontend suite for the rendered table and workflow regressions:

```bash
pnpm --filter @dsa-notes/web test
```

The fixture tests verify search normalization, Category/Difficulty/Status/Tag
filter semantics, all supported sort modes, exact decimal-string ID ordering,
ID-keyed expansion, and immutable local Problem/Category/Tag reconciliation.
The page test verifies that only the first 100-row render block enters the DOM
from the complete 1,000-Problem collection, then checks explicit block loading,
reset behavior, and stable string-ID tracking. Existing workflow tests cover the actual
Create, Edit, inline-edit, Delete, Duplicate, Review, and reference-management
request/reconciliation paths without a database.

## Measured local operations

The command warms every operation three times, records 15 samples with
`performance.now()`, and reports the median. On the environment above, the
representative run recorded:

| Operation | Median | Result size |
| --- | ---: | ---: |
| Search derivation | 1.140 ms | 35 rows |
| Combined filtering | 1.161 ms | 1 row |
| Sort by Name | 0.323 ms | 1,000 rows |
| Sort by Category | 0.597 ms | 1,000 rows |
| Sort by Difficulty | 0.352 ms | 1,000 rows |
| Sort by Last reviewed | 0.349 ms | 1,000 rows |
| Filtered and sorted derivation | 1.097 ms | 1 row |
| Immutable insertion | 0.305 ms | 1,001 rows |
| Immutable replacement | 0.011 ms | 1,000 rows |
| Immutable deletion | 0.014 ms | 999 rows |
| Category rename reconciliation | 0.013 ms | 1,000 rows |
| Tag rename reconciliation | 0.048 ms | 1,000 rows |
| Tag deletion reconciliation | 0.052 ms | 1,000 rows |

These figures measure pure local operation time, not browser layout, paint,
network, or PostgreSQL time. There are deliberately no machine-sensitive timing
assertions in the normal test suite.

## Rendering and completed manual browser verification

The application keeps the complete loaded collection in memory, applies search,
filters, and sorting to that full collection, then renders a final 100-row
slice. **Show 100 more** appends another local block; it neither paginates the
backend nor changes canonical state. Search, filter, sorting, and **Clear
filters** reset the slice to its first block. Backend pagination was rejected
because the full hydrated collection remains necessary for local derivations and
mutations. Stable `track problem.id` identity preserves row
DOM identity through derived sorting, loading more rows, and local mutations.
No row virtualization is present. It may be evaluated after the MVP only if
progressive rendering remains insufficient in measured browser use.

The fixture is deliberately test-only and does not seed a user database. For a
manual browser run, start PostgreSQL and load an isolated temporary database
using `DATABASE_TEST_URL` (whose name must contain `test`):

```bash
export DATABASE_TEST_URL="$(grep '^DATABASE_TEST_URL=' .env | cut -d '=' -f2-)"
pnpm --filter @dsa-notes/api perf:1000:prepare
# Copy the database name printed by the command.
PERFORMANCE_DATABASE_NAME=the_printed_name
DATABASE_URL="${DATABASE_TEST_URL%/*}/${PERFORMANCE_DATABASE_NAME}" pnpm dev:api
pnpm dev:web
```

After stopping both development servers, remove only that generated database:

```bash
pnpm --filter @dsa-notes/api perf:1000:cleanup
```

The preparation command applies the committed migrations and inserts the same
deterministic fixture data into a uniquely named temporary database. It refuses
to use a non-test database and records only the generated database name in the
system temporary directory for cleanup. Do not use the normal development
database for this purpose.

Manual browser verification completed successfully with the isolated
1,000-Problem dataset. It confirmed that the application loads the dataset;
starts with 100 rendered Problems; appends rows in 100-row Show more blocks;
and preserves Search, filters, sorting, expansion, inline editing, and mutation
workflows. No functional errors were observed.

The result distinguishes two performance characteristics:

- Local computation remains fast: the recorded search, filter, sort, and
  immutable reconciliation timings apply to the complete collection.
- DOM rendering is the limiting factor: initial usability is substantially
  better than rendering all 1,000 rows simultaneously, but the interface is
  not perfectly fluid and degradation becomes noticeable after roughly 300
  visible rows.

That rendering limitation is accepted for the MVP. The manual check does not
claim that all 1,000 rows rendered simultaneously are smooth, and it does not
claim persistence/restart verification.

## Conclusion

The deterministic local measurements show no concrete derivation or immutable
reconciliation bottleneck at 1,000 Problems. The completed manual result
confirms that progressive 100-row local rendering substantially improves initial
usability and preserves all tested workflows. The observed degradation after
roughly 300 visible rows is accepted for the MVP. No backend pagination,
virtualization, or server-side filtering was added. Virtual scrolling may be
evaluated after MVP completion if progressive rendering remains insufficient; it
is not a committed future implementation.
