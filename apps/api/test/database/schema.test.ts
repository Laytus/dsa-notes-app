import { fileURLToPath } from 'node:url';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres, { type Sql } from 'postgres';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import {
  categories,
  problemTags,
  problems,
  tags,
} from '../../src/db/schema.js';
import * as schema from '../../src/db/schema.js';

const migrationsFolder = fileURLToPath(
  new URL('../../drizzle', import.meta.url),
);

let adminClient: Sql | undefined;
let testClient: Sql | undefined;
let database: PostgresJsDatabase<typeof schema> | undefined;
let testDatabaseName: string | undefined;

function requireDatabase(): PostgresJsDatabase<typeof schema> {
  if (!database) {
    throw new Error('The test database has not been initialized.');
  }

  return database;
}

async function createCategory(name = 'Algorithms'): Promise<bigint> {
  const [category] = await requireDatabase()
    .insert(categories)
    .values({ name })
    .returning({ id: categories.id });

  if (!category) {
    throw new Error('Failed to create a category fixture.');
  }

  return category.id;
}

async function createProblem(categoryId: bigint): Promise<bigint> {
  const [problem] = await requireDatabase()
    .insert(problems)
    .values({ categoryId, name: 'Two Sum' })
    .returning({ id: problems.id });

  if (!problem) {
    throw new Error('Failed to create a problem fixture.');
  }

  return problem.id;
}

beforeAll(async () => {
  const configuredUrl = process.env['DATABASE_TEST_URL'];

  if (!configuredUrl) {
    throw new Error(
      'DATABASE_TEST_URL is required for database integration tests.',
    );
  }

  const baseUrl = new URL(configuredUrl);
  const configuredDatabaseName = decodeURIComponent(
    baseUrl.pathname.replace(/^\//u, ''),
  );

  if (!configuredDatabaseName.toLowerCase().includes('test')) {
    throw new Error(
      'DATABASE_TEST_URL must name a database containing "test".',
    );
  }

  if (!/^[a-zA-Z0-9_]+$/u.test(configuredDatabaseName)) {
    throw new Error(
      'DATABASE_TEST_URL database name may contain only letters, numbers, and underscores.',
    );
  }

  testDatabaseName =
    `${configuredDatabaseName.slice(0, 40)}_${process.pid}_${Date.now()}`.toLowerCase();

  const adminUrl = new URL(baseUrl);
  adminUrl.pathname = '/postgres';
  adminClient = postgres(adminUrl.toString(), { max: 1 });
  await adminClient.unsafe(`CREATE DATABASE "${testDatabaseName}"`);

  const isolatedUrl = new URL(baseUrl);
  isolatedUrl.pathname = `/${testDatabaseName}`;
  testClient = postgres(isolatedUrl.toString(), { max: 1 });
  database = drizzle(testClient, { schema });

  await migrate(database, { migrationsFolder });
}, 30_000);

afterEach(async () => {
  if (!database) {
    return;
  }

  await database.delete(problemTags);
  await database.delete(problems);
  await database.delete(tags);
  await database.delete(categories);
});

afterAll(async () => {
  if (testClient) {
    await testClient.end();
  }

  if (adminClient && testDatabaseName) {
    await adminClient.unsafe(
      `DROP DATABASE "${testDatabaseName}" WITH (FORCE)`,
    );
  }

  if (adminClient) {
    await adminClient.end();
  }
}, 30_000);

describe('initial database migration', () => {
  it('applies all expected tables to an empty database', async () => {
    if (!testClient) {
      throw new Error('The test client has not been initialized.');
    }

    const rows = await testClient<{ table_name: string }[]>`
      select table_name
      from information_schema.tables
      where table_schema = 'public'
        and table_name in ('categories', 'tags', 'problems', 'problem_tags')
      order by table_name
    `;

    expect(rows.map(({ table_name: tableName }) => tableName)).toEqual([
      'categories',
      'problem_tags',
      'problems',
      'tags',
    ]);
  });

  it('rejects case-insensitive duplicate category names', async () => {
    const db = requireDatabase();
    await db.insert(categories).values({ name: 'Dynamic Programming' });

    await expect(
      db.insert(categories).values({ name: 'dynamic programming' }),
    ).rejects.toMatchObject({ cause: { code: '23505' } });
  });

  it('rejects whitespace-only category names', async () => {
    await expect(
      requireDatabase().insert(categories).values({ name: '   ' }),
    ).rejects.toMatchObject({ cause: { code: '23514' } });
  });

  it('rejects case-insensitive duplicate tag names', async () => {
    const db = requireDatabase();
    await db.insert(tags).values({ name: 'Array' });

    await expect(
      db.insert(tags).values({ name: 'array' }),
    ).rejects.toMatchObject({ cause: { code: '23505' } });
  });

  it('rejects whitespace-only tag names', async () => {
    await expect(
      requireDatabase().insert(tags).values({ name: '\t' }),
    ).rejects.toMatchObject({ cause: { code: '23514' } });
  });

  it('rejects a problem referencing a nonexistent category', async () => {
    await expect(
      requireDatabase()
        .insert(problems)
        .values({ categoryId: 9_223_372_036_854_775_000n, name: 'Two Sum' }),
    ).rejects.toMatchObject({ cause: { code: '23503' } });
  });

  it('rejects a negative times solved value', async () => {
    const categoryId = await createCategory();

    await expect(
      requireDatabase().insert(problems).values({
        categoryId,
        name: 'Two Sum',
        timesSolved: -1,
      }),
    ).rejects.toMatchObject({ cause: { code: '23514' } });
  });

  it('removes tag associations when a problem is deleted', async () => {
    const db = requireDatabase();
    const categoryId = await createCategory();
    const problemId = await createProblem(categoryId);
    const [tag] = await db
      .insert(tags)
      .values({ name: 'Array' })
      .returning({ id: tags.id });

    if (!tag) {
      throw new Error('Failed to create a tag fixture.');
    }

    await db.insert(problemTags).values({ problemId, tagId: tag.id });
    await db.delete(problems);

    await expect(db.select().from(problemTags)).resolves.toEqual([]);
  });

  it('removes tag associations without deleting problems when a tag is deleted', async () => {
    const db = requireDatabase();
    const categoryId = await createCategory();
    const problemId = await createProblem(categoryId);
    const [tag] = await db
      .insert(tags)
      .values({ name: 'Array' })
      .returning({ id: tags.id });

    if (!tag) {
      throw new Error('Failed to create a tag fixture.');
    }

    await db.insert(problemTags).values({ problemId, tagId: tag.id });
    await db.delete(tags);

    await expect(db.select().from(problemTags)).resolves.toEqual([]);
    await expect(db.select().from(problems)).resolves.toHaveLength(1);
  });

  it('rejects deletion of a referenced category', async () => {
    const categoryId = await createCategory();
    await createProblem(categoryId);

    await expect(
      requireDatabase().delete(categories),
    ).rejects.toMatchObject({ cause: { code: '23001' } });
  });

  it('stores absent optional links and last reviewed date as null', async () => {
    const db = requireDatabase();
    const categoryId = await createCategory();
    const problemId = await createProblem(categoryId);
    const [problem] = await db.select().from(problems);

    expect(problem).toMatchObject({
      id: problemId,
      lastReviewedOn: null,
      solutionUrl: null,
      solutionLabel: null,
      sourceUrl: null,
      sourceLabel: null,
      timesSolved: 0,
    });
  });
});
