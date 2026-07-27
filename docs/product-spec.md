# DSA Notes Product Specification

## 1. Product purpose

DSA Notes is a desktop-oriented local web application for storing and reviewing data structures and algorithms problem notes.

Its main purpose is to support technical interview preparation by allowing the user to record:

- problems already solved;
- problems still to solve;
- personal solution links;
- source problem links;
- categories and tags;
- review status;
- review history indicators;
- Markdown notes.

The main interface is a horizontally and vertically scrollable data table.

## 2. MVP scope

The MVP must provide:

- a fixed set of problem fields;
- problem creation;
- problem editing;
- problem duplication;
- problem deletion;
- category administration;
- tag administration;
- inline editing of simple fields;
- side-panel editing of complex fields;
- collapsible rows;
- normalized text search;
- OR-based tag filtering;
- basic row sorting;
- PostgreSQL persistence;
- local execution without cloud dependencies;
- automated tests for important behavior.

Excel export is desirable but may be moved immediately after the MVP if it introduces disproportionate complexity.

## 3. Problem fields

Each problem contains the following user-facing fields.

| Field | Data type | Required | Example |
|---|---|---:|---|
| Name | Text | Yes | `House Robber` |
| Category | Category reference | Yes | `Dynamic Programming` |
| Tags | Multiple tag references | No | `1D DP`, `Array` |
| Difficulty | Enum | No | `Medium` |
| Status | Enum | Yes | `Needs review` |
| Last reviewed | Nullable date | No | `2026-07-24` |
| Times solved | Non-negative integer | Yes | `2` |
| Solution | Link with label | No | `View solution` |
| Source | Link with label | No | `LeetCode` |
| Notes | Markdown text | No | Personal explanation |

Each record must also include internal metadata:

- immutable unique identifier;
- creation timestamp;
- last-update timestamp.

## 4. Difficulty values

Allowed values:

```text
Easy
Medium
Hard
```

Difficulty may be empty.

The sorting order is:

```text
Easy < Medium < Hard
```

Rows without a difficulty must appear after rows with a difficulty when sorting in either direction.

## 5. Status values

Allowed values:

```text
To solve
Attempted
Solved
Needs review
Mastered
```

Default value for a new problem:

```text
To solve
```

## 6. Categories

Each problem belongs to exactly one category.

Categories are administrable entities and are not hard-coded enum values.

The user must be able to:

- create a category;
- rename a category;
- view existing categories;
- assign a category to a problem;
- delete an unused category.

A category associated with one or more problems must not be deleted until those problems have been reassigned.

## 7. Tags

Each problem may contain zero or more tags.

The user must be able to:

- create a tag;
- select existing tags;
- assign multiple tags to a problem;
- rename a tag;
- remove a tag from a problem;
- delete a tag globally.

Deleting a tag globally must:

- require confirmation;
- remove its associations from every problem;
- leave all problem records intact.

Tags must be referenced internally by immutable identifiers. Renaming a tag must therefore update its visible name everywhere without rewriting individual problem records.

Tag colors may be supported, but they are not required for the first implementation.

## 8. Link fields

Both `Solution` and `Source` contain:

```json
{
  "url": "https://leetcode.com/problems/two-sum/",
  "label": "LeetCode"
}
```

The table displays only the label, not the full URL.

Links open in a separate browser tab.

If the URL is empty, the corresponding link must not be rendered as clickable.

Default labels in the creation form:

```text
Solution: View solution
Source: LeetCode
```

## 9. Notes

Notes are stored as raw Markdown text.

The minimum desired Markdown support is:

- paragraphs;
- line breaks;
- bold text;
- italic text;
- unordered lists;
- ordered lists;
- inline code;
- fenced code blocks;
- links.

The initial editor may use:

```text
Edit | Preview
```

A plain multiline textarea is sufficient for editing.

A visual rich-text toolbar is outside the MVP.

If Markdown rendering cannot be introduced cleanly during the MVP, raw multiline text remains acceptable temporarily. The database representation must still allow Markdown to be added later without migration problems.

## 10. Automatic review behavior

`Times solved` is a non-negative integer.

The table should expose a numeric input and, ideally, decrement and increment buttons.

When `Times solved` increases:

- the backend automatically sets `Last reviewed` to its current calendar date;
- the update is persisted as part of the same logical operation.

When `Times solved` decreases:

- `Last reviewed` is not modified automatically.

When `Times solved` is manually replaced with a larger value:

- it is treated as an increase;
- `Last reviewed` is updated automatically.

`Last reviewed` is hydrated read state in the general Problem update contract.
It is not client-writable through `PATCH`; any future manual date editing needs
an explicit server-owned design before it is added.

The minimum value of `Times solved` is `0`.

## 11. Table column order

The visible table columns are:

| Order | Column | Sticky |
|---:|---|:---:|
| 1 | Expand control | Yes |
| 2 | Name | Yes |
| 3 | Category | Yes |
| 4 | Tags | Yes |
| 5 | Difficulty | Yes |
| 6 | Status | Yes |
| 7 | Last reviewed | No |
| 8 | Times solved | No |
| 9 | Solution | No |
| 10 | Source | No |
| 11 | Notes | No |

Sticky offsets must be calculated so that sticky columns do not overlap.

The fixed group must remain usable while scrolling horizontally.

Column resizing and column reordering are outside the MVP.

## 12. Collapsed rows

Rows are collapsed by default.

A collapsed row must:

- have a consistent compact height;
- display single-line or compact previews;
- truncate long text with an ellipsis;
- avoid rendering full Markdown content;
- keep tags compact;
- avoid growing vertically because of Notes.

Each row has an explicit expand/collapse control at its beginning.

Multiple rows may be expanded simultaneously.

An optional `Expand all / Collapse all` control may be added if it does not complicate the table significantly.

## 13. Expanded rows

An expanded row may:

- grow vertically;
- show complete values;
- show a larger Notes preview;
- wrap tags and longer text;
- retain the same column alignment as the table.

Expanding a row does not automatically enter edit mode.

## 14. Editing behavior

### Inline editing

| Field | Editing control |
|---|---|
| Name | Text input |
| Category | Single-select dropdown |
| Difficulty | Single-select dropdown |
| Status | Single-select dropdown |
| Times solved | Numeric input with optional `−` and `+` controls |

`Last reviewed` is read-only server-derived state and is not inline editable.
It changes only through the backend's `Times solved` comparison rule.

Inline edits use explicit Save and Cancel controls. Enter confirms a valid
changed value and Escape cancels; blur alone never persists a change.

The application must not submit one API request per keystroke.

Invalid changes must not silently replace the last valid value.

### Side-panel editing

The side panel handles:

- Tags;
- Solution label and URL;
- Source label and URL;
- Notes;
- optionally all other fields for full-record editing.

The panel must include explicit `Save` and `Cancel` actions.

Closing a panel with unsaved changes should request confirmation.

## 15. Problem creation

Problem creation uses a form presented in a side panel.

Fields:

- Name;
- Category;
- Difficulty;
- Status;
- Tags;
- Solution label;
- Solution URL;
- Source label;
- Source URL;
- Last reviewed;
- Times solved;
- Notes.

Initial values:

```text
Status: To solve
Times solved: 0
Solution label: View solution
Source label: LeetCode
```

Validation:

- Name is required.
- Category is required.
- Status is required.
- Times solved must be an integer greater than or equal to zero.
- Last reviewed must be a valid date or empty.
- URLs must be valid absolute HTTP or HTTPS URLs when supplied.
- Empty link fields are allowed.
- Notes may be empty.

## 16. Problem duplication

The user may duplicate an existing problem.

The duplicate must:

- receive a new identifier;
- receive new creation and update timestamps;
- preserve the original problem values;
- append `Copy` to the name or otherwise make the duplication visible;
- not affect the original problem.

## 17. Problem deletion

Deleting a problem must:

- require explicit confirmation;
- remove the problem and its tag associations;
- leave categories and tags intact;
- produce a clear error if persistence fails.

## 18. Search

Search runs over:

- problem name;
- category name;
- tag names;
- raw Markdown notes.

Search behavior:

- case-insensitive;
- diacritic-insensitive;
- substring-based;
- updated while the user types;
- combinable with tag filters;
- combinable with sorting.

Examples:

```text
dinamica
```

must match:

```text
Dinámica
```

Search is performed in the frontend for the MVP after the dataset has been loaded.

## 19. Tag filtering

The MVP uses OR semantics.

When the selected tags are:

```text
Array
Dynamic Programming
```

a problem is visible when it contains either selected tag.

With no selected tags, tag filtering has no effect.

Search and tag filters must be applied together.

## 20. Sorting

Supported sorting options:

```text
Name ascending
Name descending
Category ascending
Category descending
Difficulty ascending
Difficulty descending
Last reviewed newest first
Last reviewed oldest first
```

Sorting must be stable where practical.

Empty values must appear after non-empty values.

Sorting by category must place problems of the same category next to one another.

Visual category grouping with separate group headers is not required initially.

## 21. Data persistence

The application uses PostgreSQL through a minimal local backend.

The application does not require Internet access or external cloud services.

The following local services must be running:

- Angular development server or built frontend;
- Fastify API;
- PostgreSQL.

The application is not required to accept writes while the local API or database is stopped.

Browser-only offline synchronization is outside the MVP.

## 22. Performance

The application must remain responsive with at least 1,000 problem rows.

For the MVP:

- problems are loaded into frontend memory;
- search, filters, and sorting run locally;
- Markdown is not fully rendered for every collapsed row;
- API requests are not issued for every search keystroke;
- API writes are issued only after confirmed edits.

Row virtualization is not required unless measurements demonstrate a real problem.

## 23. Keyboard behavior

Reasonable keyboard navigation must be supported.

At minimum:

- Tab moves through interactive controls;
- Enter confirms simple inline edits where appropriate;
- Escape cancels an active inline edit or closes a non-destructive panel;
- focus indicators remain visible;
- clickable controls are actual buttons or links.

Spreadsheet-style cell navigation is outside the MVP.

## 24. Excel export

The desired export includes all rows, not only currently filtered rows.

The workbook should contain:

- one worksheet;
- all fixed problem columns;
- clickable Solution and Source links where possible;
- comma-separated tag names;
- readable date values;
- multiline Notes content.

If Excel export materially delays the stable CRUD and table functionality, it may be implemented immediately after the MVP.

## 25. Explicitly out of scope

The MVP does not include:

- authentication;
- user accounts;
- cloud hosting;
- synchronization between devices;
- browser-to-server offline synchronization;
- collaborative editing;
- dynamic columns;
- column creation;
- column deletion;
- column renaming;
- column reordering;
- column resizing;
- spreadsheet-style selection;
- arbitrary formula cells;
- drag and drop;
- mobile-first layouts;
- advanced full-text search;
- tag-filter AND mode;
- audit history;
- rich-text WYSIWYG editing.

## 26. MVP acceptance criteria

The MVP is complete when:

1. The local environment can be started using documented commands.
2. PostgreSQL data survives frontend and backend restarts.
3. Problems can be created, viewed, edited, duplicated, and deleted.
4. Tags and categories can be administered according to this specification.
5. Rows are collapsed by default and independently expandable.
6. Inline editing works for the defined simple fields.
7. The side panel edits tags, links, and notes.
8. Increasing Times solved automatically updates Last reviewed.
9. Search is case-insensitive and diacritic-insensitive.
10. Search covers Name, Category, Tags, and Notes.
11. Tag filtering uses OR semantics.
12. Search and tag filtering work together.
13. Every defined sorting mode works.
14. Sticky columns and horizontal scrolling do not overlap or hide data.
15. The table remains usable with at least 1,000 rows.
16. Destructive operations require confirmation.
17. Important search, filter, sorting, automatic-review, and API behavior is covered by tests.
18. The project passes linting, type checking, tests, and production builds.

---
