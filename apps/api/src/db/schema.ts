import { sql } from 'drizzle-orm';
import {
  bigint,
  check,
  date,
  index,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

export const problemStatus = pgEnum('problem_status', [
  'To solve',
  'Attempted',
  'Solved',
  'Needs review',
  'Mastered',
]);

export const problemDifficulty = pgEnum('problem_difficulty', [
  'Easy',
  'Medium',
  'Hard',
]);

const timestamps = {
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
};

export const categories = pgTable(
  'categories',
  {
    id: bigint('id', { mode: 'bigint' })
      .primaryKey()
      .generatedAlwaysAsIdentity(),
    name: text('name').notNull(),
    ...timestamps,
  },
  (table) => [
    check(
      'categories_name_not_blank',
      sql`${table.name} !~ '^[[:space:]]*$'`,
    ),
    uniqueIndex('categories_name_lower_unique').on(sql`lower(${table.name})`),
  ],
);

export const tags = pgTable(
  'tags',
  {
    id: bigint('id', { mode: 'bigint' })
      .primaryKey()
      .generatedAlwaysAsIdentity(),
    name: text('name').notNull(),
    ...timestamps,
  },
  (table) => [
    check('tags_name_not_blank', sql`${table.name} !~ '^[[:space:]]*$'`),
    uniqueIndex('tags_name_lower_unique').on(sql`lower(${table.name})`),
  ],
);

export const problems = pgTable(
  'problems',
  {
    id: bigint('id', { mode: 'bigint' })
      .primaryKey()
      .generatedAlwaysAsIdentity(),
    name: text('name').notNull(),
    categoryId: bigint('category_id', { mode: 'bigint' })
      .notNull()
      .references(() => categories.id, {
        onDelete: 'restrict',
        onUpdate: 'no action',
      }),
    difficulty: problemDifficulty('difficulty'),
    status: problemStatus('status').default('To solve').notNull(),
    lastReviewedOn: date('last_reviewed_on', { mode: 'string' }),
    timesSolved: integer('times_solved').default(0).notNull(),
    solutionUrl: text('solution_url'),
    solutionLabel: text('solution_label'),
    sourceUrl: text('source_url'),
    sourceLabel: text('source_label'),
    notes: text('notes').default('').notNull(),
    ...timestamps,
  },
  (table) => [
    check('problems_name_not_blank', sql`${table.name} !~ '^[[:space:]]*$'`),
    check('problems_times_solved_nonnegative', sql`${table.timesSolved} >= 0`),
    index('problems_category_id_idx').on(table.categoryId),
  ],
);

export const problemTags = pgTable(
  'problem_tags',
  {
    problemId: bigint('problem_id', { mode: 'bigint' })
      .notNull()
      .references(() => problems.id, {
        onDelete: 'cascade',
        onUpdate: 'no action',
      }),
    tagId: bigint('tag_id', { mode: 'bigint' })
      .notNull()
      .references(() => tags.id, {
        onDelete: 'cascade',
        onUpdate: 'no action',
      }),
  },
  (table) => [
    primaryKey({
      name: 'problem_tags_pk',
      columns: [table.problemId, table.tagId],
    }),
    index('problem_tags_tag_id_problem_id_idx').on(
      table.tagId,
      table.problemId,
    ),
  ],
);
