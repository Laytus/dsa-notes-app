import { fileURLToPath } from 'node:url';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import type { InjectOptions } from 'fastify';
import postgres, { type Sql } from 'postgres';
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
} from 'vitest';
import { buildApp } from '../../src/app.js';
import type { Database } from '../../src/db/client.js';
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
let database: Database | undefined;
let testDatabaseName: string | undefined;

function requireDatabase(): Database {
  if (!database) {
    throw new Error('The HTTP test database has not been initialized.');
  }
  return database;
}

async function createCategory(name = 'Algorithms'): Promise<bigint> {
  const [record] = await requireDatabase()
    .insert(categories)
    .values({ name })
    .returning({ id: categories.id });
  if (!record) throw new Error('Failed to create category fixture.');
  return record.id;
}

async function createTag(name = 'Array'): Promise<bigint> {
  const [record] = await requireDatabase()
    .insert(tags)
    .values({ name })
    .returning({ id: tags.id });
  if (!record) throw new Error('Failed to create tag fixture.');
  return record.id;
}

async function createProblem(categoryId: bigint): Promise<bigint> {
  const [record] = await requireDatabase()
    .insert(problems)
    .values({ categoryId, name: 'Two Sum' })
    .returning({ id: problems.id });
  if (!record) throw new Error('Failed to create problem fixture.');
  return record.id;
}

async function injectApi(
  options: InjectOptions,
) {
  const app = buildApp({ database: requireDatabase() });
  try {
    return await app.inject(options);
  } finally {
    await app.close();
  }
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
    `${configuredDatabaseName.slice(0, 40)}_http_${process.pid}_${Date.now()}`.toLowerCase();
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
  if (!database) return;
  await database.delete(problemTags);
  await database.delete(problems);
  await database.delete(tags);
  await database.delete(categories);
});

afterAll(async () => {
  if (testClient) await testClient.end();
  if (adminClient && testDatabaseName) {
    await adminClient.unsafe(
      `DROP DATABASE "${testDatabaseName}" WITH (FORCE)`,
    );
  }
  if (adminClient) await adminClient.end();
}, 30_000);

describe('category HTTP API', () => {
  it('returns an empty collection', async () => {
    const app = buildApp({ database: requireDatabase() });
    const response = await app.inject({ method: 'GET', url: '/api/categories' });
    await app.close();

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual([]);
  });

  it('trims, creates, and serializes a category', async () => {
    const app = buildApp({ database: requireDatabase() });
    const response = await app.inject({
      method: 'POST',
      url: '/api/categories',
      payload: { name: ' Dynamic  Programming ' },
    });
    await app.close();
    const body = response.json<{
      id: string;
      name: string;
      createdAt: string;
      updatedAt: string;
    }>();

    expect(response.statusCode).toBe(201);
    expect(response.headers.location).toBe(`/api/categories/${body.id}`);
    expect(body.name).toBe('Dynamic  Programming');
    expect(body.id).toMatch(/^[1-9][0-9]*$/u);
    expect(new Date(body.createdAt).toISOString()).toBe(body.createdAt);
    expect(new Date(body.updatedAt).toISOString()).toBe(body.updatedAt);
  });

  it.each([
    { payload: {}, label: 'missing name' },
    { payload: { name: 42 }, label: 'non-string name' },
    { payload: { name: '   ' }, label: 'empty name' },
    { payload: { name: 'Arrays', extra: true }, label: 'unknown field' },
    { payload: ['Arrays'], label: 'non-object body' },
  ])('rejects $label', async ({ payload }) => {
    const app = buildApp({ database: requireDatabase() });
    const response = await app.inject({
      method: 'POST',
      url: '/api/categories',
      payload,
    });
    await app.close();

    expect(response.statusCode).toBe(400);
    expect(response.json()).toHaveProperty('error.code');
  });

  it('rejects malformed JSON without leaking parser details', async () => {
    const app = buildApp({ database: requireDatabase() });
    const response = await app.inject({
      method: 'POST',
      url: '/api/categories',
      headers: { 'content-type': 'application/json' },
      payload: '{"name":',
    });
    await app.close();

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      error: { code: 'VALIDATION_ERROR', message: 'The request is invalid.' },
    });
  });

  it('returns a conflict for a case-insensitive duplicate', async () => {
    await createCategory('Arrays');
    const app = buildApp({ database: requireDatabase() });
    const response = await app.inject({
      method: 'POST',
      url: '/api/categories',
      payload: { name: 'arrays' },
    });
    await app.close();

    expect(response.statusCode).toBe(409);
    expect(response.json()).toEqual({
      error: {
        code: 'CATEGORY_NAME_CONFLICT',
        message: 'A category with this name already exists.',
      },
    });
  });

  it('sorts names case-insensitively with an ID tie-breaker', async () => {
    await requireDatabase()
      .insert(categories)
      .values([{ name: 'graphs' }, { name: 'Arrays' }, { name: 'binary' }]);
    const app = buildApp({ database: requireDatabase() });
    const response = await app.inject({ method: 'GET', url: '/api/categories' });
    await app.close();

    expect(
      response
        .json<Array<{ id: string; name: string }>>()
        .map(({ name }) => name),
    ).toEqual(['Arrays', 'binary', 'graphs']);
  });

  it('renames, trims, and advances updatedAt', async () => {
    const id = await createCategory();
    const oldDate = new Date('2020-01-01T00:00:00.000Z');
    await requireDatabase()
      .update(categories)
      .set({ updatedAt: oldDate })
      .where(eq(categories.id, id));
    const app = buildApp({ database: requireDatabase() });
    const response = await app.inject({
      method: 'PATCH',
      url: `/api/categories/${id}`,
      payload: { name: ' Graphs ' },
    });
    await app.close();
    const body = response.json<{ name: string; updatedAt: string }>();

    expect(response.statusCode).toBe(200);
    expect(body.name).toBe('Graphs');
    expect(new Date(body.updatedAt).getTime()).toBeGreaterThan(oldDate.getTime());
  });

  it.each([
    { payload: {}, label: 'empty body' },
    { payload: { name: 'Graphs', id: '1' }, label: 'unknown field' },
  ])('rejects PATCH with an $label', async ({ payload }) => {
    const id = await createCategory();
    const app = buildApp({ database: requireDatabase() });
    const response = await app.inject({
      method: 'PATCH',
      url: `/api/categories/${id}`,
      payload,
    });
    await app.close();

    expect(response.statusCode).toBe(400);
  });

  it('returns not found when patching a missing category', async () => {
    const app = buildApp({ database: requireDatabase() });
    const response = await app.inject({
      method: 'PATCH',
      url: '/api/categories/9223372036854775807',
      payload: { name: 'Graphs' },
    });
    await app.close();

    expect(response.statusCode).toBe(404);
    expect(response.json()).toHaveProperty('error.code', 'CATEGORY_NOT_FOUND');
  });

  it('returns a conflict when renaming to a duplicate category name', async () => {
    await createCategory('Arrays');
    const id = await createCategory('Graphs');
    const app = buildApp({ database: requireDatabase() });
    const response = await app.inject({
      method: 'PATCH',
      url: `/api/categories/${id}`,
      payload: { name: 'arrays' },
    });
    await app.close();

    expect(response.statusCode).toBe(409);
    expect(response.json()).toHaveProperty(
      'error.code',
      'CATEGORY_NAME_CONFLICT',
    );
  });

  it('deletes an unused category', async () => {
    const id = await createCategory();
    const app = buildApp({ database: requireDatabase() });
    const response = await app.inject({
      method: 'DELETE',
      url: `/api/categories/${id}`,
    });
    await app.close();

    expect(response.statusCode).toBe(204);
    await expect(requireDatabase().select().from(categories)).resolves.toEqual(
      [],
    );
  });

  it('returns not found when deleting a missing category', async () => {
    const app = buildApp({ database: requireDatabase() });
    const response = await app.inject({
      method: 'DELETE',
      url: '/api/categories/9223372036854775807',
    });
    await app.close();

    expect(response.statusCode).toBe(404);
  });

  it('rejects deleting a referenced category without changing its problem', async () => {
    const id = await createCategory();
    const problemId = await createProblem(id);
    const app = buildApp({ database: requireDatabase() });
    const response = await app.inject({
      method: 'DELETE',
      url: `/api/categories/${id}`,
    });
    await app.close();

    expect(response.statusCode).toBe(409);
    expect(response.json()).toHaveProperty('error.code', 'CATEGORY_IN_USE');
    await expect(
      requireDatabase()
        .select()
        .from(problems)
        .where(eq(problems.id, problemId)),
    ).resolves.toHaveLength(1);
  });

  it.each(['0', '-1', '1.5', '1e3', 'abc', '+1', '01', '9223372036854775808'])(
    'rejects invalid ID %s',
    async (id) => {
      const app = buildApp({ database: requireDatabase() });
      const response = await app.inject({
        method: 'DELETE',
        url: `/api/categories/${id}`,
      });
      await app.close();
      expect(response.statusCode).toBe(400);
      expect(response.json()).toHaveProperty('error.code', 'INVALID_ID');
    },
  );
});

describe('tag HTTP API', () => {
  it('returns an empty collection', async () => {
    const app = buildApp({ database: requireDatabase() });
    const response = await app.inject({ method: 'GET', url: '/api/tags' });
    await app.close();
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual([]);
  });

  it('trims and creates a tag', async () => {
    const app = buildApp({ database: requireDatabase() });
    const response = await app.inject({
      method: 'POST',
      url: '/api/tags',
      payload: { name: ' Array ' },
    });
    await app.close();

    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({ name: 'Array' });
    expect(response.headers.location).toMatch(/^\/api\/tags\/[1-9][0-9]*$/u);
  });

  it.each([
    {},
    { name: 42 },
    { name: '\t' },
    { name: 'Array', unknown: true },
  ])('rejects invalid body %#', async (payload) => {
    const app = buildApp({ database: requireDatabase() });
    const response = await app.inject({
      method: 'POST',
      url: '/api/tags',
      payload,
    });
    await app.close();
    expect(response.statusCode).toBe(400);
  });

  it('returns a conflict for a case-insensitive duplicate', async () => {
    await createTag('Array');
    const app = buildApp({ database: requireDatabase() });
    const response = await app.inject({
      method: 'POST',
      url: '/api/tags',
      payload: { name: 'array' },
    });
    await app.close();
    expect(response.statusCode).toBe(409);
    expect(response.json()).toHaveProperty('error.code', 'TAG_NAME_CONFLICT');
  });

  it('sorts names case-insensitively', async () => {
    await requireDatabase()
      .insert(tags)
      .values([{ name: 'Tree' }, { name: 'array' }, { name: 'Binary Search' }]);
    const app = buildApp({ database: requireDatabase() });
    const response = await app.inject({ method: 'GET', url: '/api/tags' });
    await app.close();
    expect(
      response
        .json<Array<{ name: string }>>()
        .map(({ name }) => name),
    ).toEqual(['array', 'Binary Search', 'Tree']);
  });

  it('renames a tag and advances updatedAt', async () => {
    const id = await createTag();
    const oldDate = new Date('2020-01-01T00:00:00.000Z');
    await requireDatabase()
      .update(tags)
      .set({ updatedAt: oldDate })
      .where(eq(tags.id, id));
    const app = buildApp({ database: requireDatabase() });
    const response = await app.inject({
      method: 'PATCH',
      url: `/api/tags/${id}`,
      payload: { name: ' Hash Map ' },
    });
    await app.close();
    const body = response.json<{ name: string; updatedAt: string }>();

    expect(response.statusCode).toBe(200);
    expect(body.name).toBe('Hash Map');
    expect(new Date(body.updatedAt).getTime()).toBeGreaterThan(oldDate.getTime());
  });

  it('returns not found when patching a missing tag', async () => {
    const app = buildApp({ database: requireDatabase() });
    const response = await app.inject({
      method: 'PATCH',
      url: '/api/tags/9223372036854775807',
      payload: { name: 'Array' },
    });
    await app.close();
    expect(response.statusCode).toBe(404);
    expect(response.json()).toHaveProperty('error.code', 'TAG_NOT_FOUND');
  });

  it.each([{}, { name: 'Array', unknown: true }])(
    'rejects invalid tag PATCH body %#',
    async (payload) => {
      const id = await createTag();
      const app = buildApp({ database: requireDatabase() });
      const response = await app.inject({
        method: 'PATCH',
        url: `/api/tags/${id}`,
        payload,
      });
      await app.close();
      expect(response.statusCode).toBe(400);
    },
  );

  it('returns a conflict when renaming to a duplicate tag name', async () => {
    await createTag('Array');
    const id = await createTag('Tree');
    const app = buildApp({ database: requireDatabase() });
    const response = await app.inject({
      method: 'PATCH',
      url: `/api/tags/${id}`,
      payload: { name: 'array' },
    });
    await app.close();

    expect(response.statusCode).toBe(409);
    expect(response.json()).toHaveProperty('error.code', 'TAG_NAME_CONFLICT');
  });

  it('deletes an unused tag', async () => {
    const id = await createTag();
    const app = buildApp({ database: requireDatabase() });
    const response = await app.inject({
      method: 'DELETE',
      url: `/api/tags/${id}`,
    });
    await app.close();
    expect(response.statusCode).toBe(204);
    await expect(requireDatabase().select().from(tags)).resolves.toEqual([]);
  });

  it('deletes a used tag and its join row but preserves the problem', async () => {
    const categoryId = await createCategory();
    const problemId = await createProblem(categoryId);
    const tagId = await createTag();
    await requireDatabase()
      .insert(problemTags)
      .values({ problemId, tagId });
    const app = buildApp({ database: requireDatabase() });
    const response = await app.inject({
      method: 'DELETE',
      url: `/api/tags/${tagId}`,
    });
    await app.close();

    expect(response.statusCode).toBe(204);
    await expect(requireDatabase().select().from(problemTags)).resolves.toEqual(
      [],
    );
    await expect(
      requireDatabase()
        .select()
        .from(problems)
        .where(eq(problems.id, problemId)),
    ).resolves.toHaveLength(1);
  });

  it('returns not found when deleting a missing tag', async () => {
    const app = buildApp({ database: requireDatabase() });
    const response = await app.inject({
      method: 'DELETE',
      url: '/api/tags/9223372036854775807',
    });
    await app.close();
    expect(response.statusCode).toBe(404);
  });

  it.each(['0', '-1', '1.5', '1e3', 'abc', '+1', '01', '9223372036854775808'])(
    'rejects invalid ID %s',
    async (id) => {
      const app = buildApp({ database: requireDatabase() });
      const response = await app.inject({
        method: 'DELETE',
        url: `/api/tags/${id}`,
      });
      await app.close();
      expect(response.statusCode).toBe(400);
      expect(response.json()).toHaveProperty('error.code', 'INVALID_ID');
    },
  );
});

describe('problem HTTP API', () => {
  it('returns an empty collection', async () => {
    const response = await injectApi({ method: 'GET', url: '/api/problems' });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual([]);
  });

  it('creates a minimal problem with documented defaults and nulls', async () => {
    const categoryId = await createCategory('Arrays');
    const response = await injectApi({
      method: 'POST',
      url: '/api/problems',
      payload: { name: ' Two Sum ', categoryId: categoryId.toString() },
    });
    const body = response.json<{
      id: string;
      name: string;
      category: { id: string; name: string };
      difficulty: null;
      status: string;
      tags: unknown[];
      solution: null;
      source: null;
      notes: string;
      timesSolved: number;
      lastReviewedOn: null;
      createdAt: string;
      updatedAt: string;
    }>();

    expect(response.statusCode).toBe(201);
    expect(response.headers.location).toBe(`/api/problems/${body.id}`);
    expect(body).toMatchObject({
      name: 'Two Sum',
      category: { id: categoryId.toString(), name: 'Arrays' },
      difficulty: null,
      status: 'To solve',
      tags: [],
      solution: null,
      source: null,
      notes: '',
      timesSolved: 0,
      lastReviewedOn: null,
    });
    expect(body.id).toMatch(/^[1-9][0-9]*$/u);
    expect(new Date(body.createdAt).toISOString()).toBe(body.createdAt);
    expect(new Date(body.updatedAt).toISOString()).toBe(body.updatedAt);
  });

  it('creates and retrieves a complete hydrated problem', async () => {
    const categoryId = await createCategory('Arrays');
    const hashMapId = await createTag('Hash Map');
    const arrayId = await createTag('array');
    const created = await injectApi({
      method: 'POST',
      url: '/api/problems',
      payload: {
        name: 'Two Sum',
        categoryId: categoryId.toString(),
        difficulty: 'Easy',
        status: 'Solved',
        tagIds: [hashMapId.toString(), arrayId.toString()],
        solution: {
          url: ' https://example.com/solution ',
          label: ' My solution ',
        },
        source: {
          url: ' https://leetcode.com/problems/two-sum/ ',
          label: ' LeetCode ',
        },
        notes: '  **Keep exactly**  ',
        timesSolved: 2,
        lastReviewedOn: '2026-07-25',
      },
    });
    const createdBody = created.json<{ id: string }>();
    const response = await injectApi({
      method: 'GET',
      url: `/api/problems/${createdBody.id}`,
    });

    expect(created.statusCode).toBe(201);
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      id: createdBody.id,
      name: 'Two Sum',
      category: { id: categoryId.toString(), name: 'Arrays' },
      difficulty: 'Easy',
      status: 'Solved',
      tags: [
        { id: arrayId.toString(), name: 'array' },
        { id: hashMapId.toString(), name: 'Hash Map' },
      ],
      solution: {
        url: 'https://example.com/solution',
        label: 'My solution',
      },
      source: {
        url: 'https://leetcode.com/problems/two-sum/',
        label: 'LeetCode',
      },
      notes: '  **Keep exactly**  ',
      timesSolved: 2,
      lastReviewedOn: '2026-07-25',
    });
  });

  it('hydrates collection categories and deterministically ordered tags', async () => {
    const categoryId = await createCategory('Graphs');
    const problemId = await createProblem(categoryId);
    const zebraId = await createTag('zebra');
    const arrayId = await createTag('Array');
    await requireDatabase().insert(problemTags).values([
      { problemId, tagId: zebraId },
      { problemId, tagId: arrayId },
    ]);

    const response = await injectApi({ method: 'GET', url: '/api/problems' });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject([
      {
        id: problemId.toString(),
        category: { id: categoryId.toString(), name: 'Graphs' },
        tags: [
          { id: arrayId.toString(), name: 'Array' },
          { id: zebraId.toString(), name: 'zebra' },
        ],
      },
    ]);
  });

  it('orders the collection case-insensitively by name and ID', async () => {
    const categoryId = await createCategory();
    await requireDatabase().insert(problems).values([
      { categoryId, name: 'zebra' },
      { categoryId, name: 'Array' },
      { categoryId, name: 'binary' },
    ]);

    const response = await injectApi({ method: 'GET', url: '/api/problems' });
    expect(
      response
        .json<Array<{ name: string }>>()
        .map(({ name }) => name),
    ).toEqual(['Array', 'binary', 'zebra']);
  });

  it('returns not found for a missing problem', async () => {
    const response = await injectApi({
      method: 'GET',
      url: '/api/problems/9223372036854775807',
    });
    expect(response.statusCode).toBe(404);
    expect(response.json()).toHaveProperty('error.code', 'PROBLEM_NOT_FOUND');
  });

  it.each([
    { payload: { categoryId: '1' }, code: 'VALIDATION_ERROR' },
    {
      payload: { name: '   ', categoryId: '1' },
      code: 'INVALID_PROBLEM_NAME',
    },
    {
      payload: { name: 42, categoryId: '1' },
      code: 'INVALID_PROBLEM_NAME',
    },
    {
      payload: { name: 'Two Sum', categoryId: '1', extra: true },
      code: 'VALIDATION_ERROR',
    },
    {
      payload: {
        name: 'Two Sum',
        categoryId: '1',
        source: { url: 'https://example.com', extra: true },
      },
      code: 'VALIDATION_ERROR',
    },
  ])('rejects invalid problem body %#', async ({ payload, code }) => {
    const response = await injectApi({
      method: 'POST',
      url: '/api/problems',
      payload,
    });
    expect(response.statusCode).toBe(400);
    expect(response.json()).toHaveProperty('error.code', code);
  });

  it.each(['0', '-1', '01', '1.5', 'abc', '9223372036854775808'])(
    'rejects malformed category ID %s',
    async (categoryId) => {
      const response = await injectApi({
        method: 'POST',
        url: '/api/problems',
        payload: { name: 'Two Sum', categoryId },
      });
      expect(response.statusCode).toBe(400);
      expect(response.json()).toHaveProperty(
        'error.code',
        'INVALID_CATEGORY_ID',
      );
    },
  );

  it('rejects a nonexistent category without a partial problem', async () => {
    const response = await injectApi({
      method: 'POST',
      url: '/api/problems',
      payload: {
        name: 'Two Sum',
        categoryId: '9223372036854775807',
      },
    });
    expect(response.statusCode).toBe(400);
    expect(response.json()).toHaveProperty(
      'error.code',
      'CATEGORY_REFERENCE_NOT_FOUND',
    );
    await expect(requireDatabase().select().from(problems)).resolves.toEqual([]);
  });

  it.each([
    { field: 'difficulty', value: 'Extreme', code: 'INVALID_DIFFICULTY' },
    { field: 'status', value: 'Done', code: 'INVALID_STATUS' },
  ])('rejects invalid $field', async ({ field, value, code }) => {
    const categoryId = await createCategory();
    const response = await injectApi({
      method: 'POST',
      url: '/api/problems',
      payload: { name: 'Two Sum', categoryId: `${categoryId}`, [field]: value },
    });
    expect(response.statusCode).toBe(400);
    expect(response.json()).toHaveProperty('error.code', code);
  });

  it.each([['abc'], ['0'], [1], '1'])(
    'rejects malformed tag IDs %#',
    async (tagIds) => {
      const categoryId = await createCategory();
      const response = await injectApi({
        method: 'POST',
        url: '/api/problems',
        payload: { name: 'Two Sum', categoryId: `${categoryId}`, tagIds },
      });
      expect(response.statusCode).toBe(400);
      expect(response.json()).toHaveProperty('error.code', 'INVALID_TAG_ID');
    },
  );

  it('rejects duplicate and nonexistent tags without partial writes', async () => {
    const categoryId = await createCategory();
    const tagId = await createTag();
    const duplicate = await injectApi({
      method: 'POST',
      url: '/api/problems',
      payload: {
        name: 'Duplicate',
        categoryId: `${categoryId}`,
        tagIds: [`${tagId}`, `${tagId}`],
      },
    });
    const missing = await injectApi({
      method: 'POST',
      url: '/api/problems',
      payload: {
        name: 'Missing',
        categoryId: `${categoryId}`,
        tagIds: [`${tagId}`, '9223372036854775807'],
      },
    });

    expect(duplicate.statusCode).toBe(400);
    expect(duplicate.json()).toHaveProperty(
      'error.code',
      'DUPLICATE_TAG_IDS',
    );
    expect(missing.statusCode).toBe(400);
    expect(missing.json()).toHaveProperty(
      'error.code',
      'TAG_REFERENCE_NOT_FOUND',
    );
    await expect(requireDatabase().select().from(problems)).resolves.toEqual([]);
    await expect(requireDatabase().select().from(problemTags)).resolves.toEqual(
      [],
    );
  });

  it.each([
    {
      link: { url: 'relative/path' },
      code: 'INVALID_URL',
      label: 'relative URL',
    },
    {
      link: { url: 'ftp://example.com/file' },
      code: 'INVALID_URL',
      label: 'non-HTTP URL',
    },
    {
      link: { url: 'https://example.com', label: ' ' },
      code: 'INVALID_LINK_LABEL',
      label: 'empty label',
    },
  ])('rejects $label', async ({ link, code }) => {
    const categoryId = await createCategory();
    const response = await injectApi({
      method: 'POST',
      url: '/api/problems',
      payload: {
        name: 'Two Sum',
        categoryId: `${categoryId}`,
        solution: link,
      },
    });
    expect(response.statusCode).toBe(400);
    expect(response.json()).toHaveProperty('error.code', code);
  });

  it('applies default labels when link labels are omitted', async () => {
    const categoryId = await createCategory();
    const response = await injectApi({
      method: 'POST',
      url: '/api/problems',
      payload: {
        name: 'Two Sum',
        categoryId: `${categoryId}`,
        solution: { url: 'https://example.com/solution' },
        source: { url: 'https://example.com/source' },
      },
    });
    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({
      solution: {
        url: 'https://example.com/solution',
        label: 'View solution',
      },
      source: { url: 'https://example.com/source', label: 'LeetCode' },
    });
  });

  it.each([-1, 1.5, '1', 2_147_483_648])(
    'rejects invalid times solved %s',
    async (timesSolved) => {
      const categoryId = await createCategory();
      const response = await injectApi({
        method: 'POST',
        url: '/api/problems',
        payload: {
          name: 'Two Sum',
          categoryId: `${categoryId}`,
          timesSolved,
        },
      });
      expect(response.statusCode).toBe(400);
      expect(response.json()).toHaveProperty(
        'error.code',
        'INVALID_TIMES_SOLVED',
      );
    },
  );

  it.each(['2026-02-30', '2026-7-25', '2026-07-25T00:00:00Z'])(
    'rejects invalid date %s',
    async (lastReviewedOn) => {
      const categoryId = await createCategory();
      const response = await injectApi({
        method: 'POST',
        url: '/api/problems',
        payload: {
          name: 'Two Sum',
          categoryId: `${categoryId}`,
          lastReviewedOn,
        },
      });
      expect(response.statusCode).toBe(400);
      expect(response.json()).toHaveProperty(
        'error.code',
        'INVALID_LAST_REVIEWED_ON',
      );
    },
  );

  it('updates all mutable scalar fields without inferring review behavior', async () => {
    const categoryId = await createCategory();
    const problemId = await createProblem(categoryId);
    const createdBefore = (
      await requireDatabase()
        .select()
        .from(problems)
        .where(eq(problems.id, problemId))
    )[0];
    const response = await injectApi({
      method: 'PATCH',
      url: `/api/problems/${problemId}`,
      payload: {
        name: ' Updated ',
        difficulty: 'Hard',
        status: 'Mastered',
        solution: { url: 'https://example.com/s' },
        source: { url: 'https://example.com/p', label: 'Problem' },
        notes: 'raw **Markdown**',
        timesSolved: 3,
        lastReviewedOn: '2026-07-25',
      },
    });
    const body = response.json<{
      createdAt: string;
      updatedAt: string;
      [key: string]: unknown;
    }>();

    expect(response.statusCode).toBe(200);
    expect(body).toMatchObject({
      name: 'Updated',
      difficulty: 'Hard',
      status: 'Mastered',
      solution: { url: 'https://example.com/s', label: 'View solution' },
      source: { url: 'https://example.com/p', label: 'Problem' },
      notes: 'raw **Markdown**',
      timesSolved: 3,
      lastReviewedOn: '2026-07-25',
    });
    expect(body.createdAt).toBe(createdBefore?.createdAt.toISOString());
    expect(new Date(body.updatedAt).getTime()).toBeGreaterThanOrEqual(
      createdBefore?.updatedAt.getTime() ?? 0,
    );
  });

  it('clears nullable fields and preserves absent fields', async () => {
    const categoryId = await createCategory();
    const [problem] = await requireDatabase()
      .insert(problems)
      .values({
        categoryId,
        name: 'Two Sum',
        difficulty: 'Medium',
        solutionUrl: 'https://example.com/s',
        solutionLabel: 'Solution',
        sourceUrl: 'https://example.com/p',
        sourceLabel: 'Source',
        lastReviewedOn: '2026-07-25',
        notes: 'preserve',
      })
      .returning({ id: problems.id });
    if (!problem) throw new Error('Problem fixture failed.');

    const response = await injectApi({
      method: 'PATCH',
      url: `/api/problems/${problem.id}`,
      payload: {
        difficulty: null,
        solution: null,
        source: null,
        lastReviewedOn: null,
      },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      name: 'Two Sum',
      difficulty: null,
      solution: null,
      source: null,
      lastReviewedOn: null,
      notes: 'preserve',
    });
  });

  it('replaces and removes tags atomically', async () => {
    const categoryId = await createCategory();
    const problemId = await createProblem(categoryId);
    const oldTagId = await createTag('Old');
    const newTagId = await createTag('New');
    await requireDatabase()
      .insert(problemTags)
      .values({ problemId, tagId: oldTagId });

    const replaced = await injectApi({
      method: 'PATCH',
      url: `/api/problems/${problemId}`,
      payload: { tagIds: [`${newTagId}`] },
    });
    expect(replaced.statusCode).toBe(200);
    expect(replaced.json()).toMatchObject({
      tags: [{ id: `${newTagId}`, name: 'New' }],
    });

    const removed = await injectApi({
      method: 'PATCH',
      url: `/api/problems/${problemId}`,
      payload: { tagIds: [] },
    });
    expect(removed.statusCode).toBe(200);
    expect(removed.json()).toMatchObject({ tags: [] });
  });

  it('changes category while preserving createdAt and advancing updatedAt', async () => {
    const oldCategoryId = await createCategory('Old');
    const newCategoryId = await createCategory('New');
    const problemId = await createProblem(oldCategoryId);
    const oldDate = new Date('2020-01-01T00:00:00.000Z');
    await requireDatabase()
      .update(problems)
      .set({ updatedAt: oldDate })
      .where(eq(problems.id, problemId));
    const before = (
      await requireDatabase()
        .select()
        .from(problems)
        .where(eq(problems.id, problemId))
    )[0];

    const response = await injectApi({
      method: 'PATCH',
      url: `/api/problems/${problemId}`,
      payload: { categoryId: `${newCategoryId}` },
    });
    const body = response.json<{
      category: { id: string };
      createdAt: string;
      updatedAt: string;
    }>();
    expect(response.statusCode).toBe(200);
    expect(body.category.id).toBe(`${newCategoryId}`);
    expect(body.createdAt).toBe(before?.createdAt.toISOString());
    expect(new Date(body.updatedAt).getTime()).toBeGreaterThan(oldDate.getTime());
  });

  it.each([
    { payload: {}, code: 'VALIDATION_ERROR' },
    { payload: { unknown: true }, code: 'VALIDATION_ERROR' },
  ])('rejects invalid PATCH body %#', async ({ payload, code }) => {
    const categoryId = await createCategory();
    const problemId = await createProblem(categoryId);
    const response = await injectApi({
      method: 'PATCH',
      url: `/api/problems/${problemId}`,
      payload,
    });
    expect(response.statusCode).toBe(400);
    expect(response.json()).toHaveProperty('error.code', code);
  });

  it('rejects invalid references and rolls back every PATCH change', async () => {
    const categoryId = await createCategory();
    const problemId = await createProblem(categoryId);
    const tagId = await createTag();
    await requireDatabase()
      .insert(problemTags)
      .values({ problemId, tagId });

    const response = await injectApi({
      method: 'PATCH',
      url: `/api/problems/${problemId}`,
      payload: {
        name: 'Must roll back',
        tagIds: [`${tagId}`, '9223372036854775807'],
      },
    });
    expect(response.statusCode).toBe(400);
    expect(response.json()).toHaveProperty(
      'error.code',
      'TAG_REFERENCE_NOT_FOUND',
    );
    await expect(
      requireDatabase()
        .select({ name: problems.name })
        .from(problems)
        .where(eq(problems.id, problemId)),
    ).resolves.toEqual([{ name: 'Two Sum' }]);
    await expect(
      requireDatabase()
        .select()
        .from(problemTags)
        .where(eq(problemTags.problemId, problemId)),
    ).resolves.toHaveLength(1);
  });

  it('rejects a nonexistent PATCH category without changing the problem', async () => {
    const categoryId = await createCategory();
    const problemId = await createProblem(categoryId);
    const response = await injectApi({
      method: 'PATCH',
      url: `/api/problems/${problemId}`,
      payload: {
        name: 'Must roll back',
        categoryId: '9223372036854775807',
      },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toHaveProperty(
      'error.code',
      'CATEGORY_REFERENCE_NOT_FOUND',
    );
    await expect(
      requireDatabase()
        .select({ name: problems.name, categoryId: problems.categoryId })
        .from(problems)
        .where(eq(problems.id, problemId)),
    ).resolves.toEqual([{ name: 'Two Sum', categoryId }]);
  });

  it('does not infer review fields from status or count during CRUD', async () => {
    const categoryId = await createCategory();
    const problemId = await createProblem(categoryId);
    const response = await injectApi({
      method: 'PATCH',
      url: `/api/problems/${problemId}`,
      payload: { status: 'Solved', timesSolved: 4 },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      status: 'Solved',
      timesSolved: 4,
      lastReviewedOn: null,
    });
  });

  it('rejects duplicate PATCH tag IDs', async () => {
    const categoryId = await createCategory();
    const problemId = await createProblem(categoryId);
    const tagId = await createTag();
    const response = await injectApi({
      method: 'PATCH',
      url: `/api/problems/${problemId}`,
      payload: { tagIds: [`${tagId}`, `${tagId}`] },
    });
    expect(response.statusCode).toBe(400);
    expect(response.json()).toHaveProperty(
      'error.code',
      'DUPLICATE_TAG_IDS',
    );
  });

  it('returns not found when patching a missing problem', async () => {
    const response = await injectApi({
      method: 'PATCH',
      url: '/api/problems/9223372036854775807',
      payload: { name: 'Missing' },
    });
    expect(response.statusCode).toBe(404);
    expect(response.json()).toHaveProperty('error.code', 'PROBLEM_NOT_FOUND');
  });

  it.each(['0', '-1', '01', '1.5', 'abc', '9223372036854775808'])(
    'rejects malformed problem ID %s',
    async (id) => {
      for (const method of ['GET', 'PATCH', 'DELETE'] as const) {
        const response = await injectApi({
          method,
          url: `/api/problems/${id}`,
          ...(method === 'PATCH' && { payload: { name: 'Valid' } }),
        });
        expect(response.statusCode).toBe(400);
        expect(response.json()).toHaveProperty('error.code', 'INVALID_ID');
      }
    },
  );

  it('duplicates every scalar field, category, and exact tag set with fresh metadata', async () => {
    const categoryId = await createCategory('Dynamic Programming');
    const arrayTagId = await createTag('Array');
    const dpTagId = await createTag('1D DP');
    const oldTimestamp = new Date('2020-01-01T00:00:00.000Z');
    const [source] = await requireDatabase()
      .insert(problems)
      .values({
        name: 'House Robber Copy',
        categoryId,
        difficulty: 'Medium',
        status: 'Needs review',
        lastReviewedOn: '2026-07-25',
        timesSolved: 4,
        solutionUrl: 'https://example.com/solution',
        solutionLabel: 'My solution',
        sourceUrl: 'https://leetcode.com/problems/house-robber/',
        sourceLabel: 'LeetCode',
        notes: 'Keep **all** notes.',
        createdAt: oldTimestamp,
        updatedAt: oldTimestamp,
      })
      .returning();
    if (!source) throw new Error('Problem fixture failed.');
    await requireDatabase().insert(problemTags).values([
      { problemId: source.id, tagId: arrayTagId },
      { problemId: source.id, tagId: dpTagId },
    ]);

    const response = await injectApi({
      method: 'POST',
      url: `/api/problems/${source.id}/duplicate`,
    });
    const body = response.json<{
      id: string;
      name: string;
      category: { id: string; name: string };
      tags: Array<{ id: string; name: string }>;
      createdAt: string;
      updatedAt: string;
      [key: string]: unknown;
    }>();

    expect(response.statusCode).toBe(201);
    expect(response.headers.location).toBe(`/api/problems/${body.id}`);
    expect(body.id).not.toBe(source.id.toString());
    expect(body.id).toMatch(/^[1-9][0-9]*$/u);
    expect(body).toMatchObject({
      name: 'House Robber Copy Copy',
      category: {
        id: categoryId.toString(),
        name: 'Dynamic Programming',
      },
      difficulty: 'Medium',
      status: 'Needs review',
      tags: [
        { id: dpTagId.toString(), name: '1D DP' },
        { id: arrayTagId.toString(), name: 'Array' },
      ],
      solution: {
        url: 'https://example.com/solution',
        label: 'My solution',
      },
      source: {
        url: 'https://leetcode.com/problems/house-robber/',
        label: 'LeetCode',
      },
      notes: 'Keep **all** notes.',
      timesSolved: 4,
      lastReviewedOn: '2026-07-25',
    });
    expect(new Date(body.createdAt).getTime()).toBeGreaterThan(
      oldTimestamp.getTime(),
    );
    expect(new Date(body.updatedAt).getTime()).toBeGreaterThan(
      oldTimestamp.getTime(),
    );

    const persistedProblems = await requireDatabase()
      .select()
      .from(problems);
    expect(persistedProblems).toHaveLength(2);
    expect(
      persistedProblems.find(({ id }) => id === source.id),
    ).toEqual(source);
    const duplicateId = BigInt(body.id);
    await expect(
      requireDatabase()
        .select({ tagId: problemTags.tagId })
        .from(problemTags)
        .where(eq(problemTags.problemId, duplicateId)),
    ).resolves.toHaveLength(2);

    await requireDatabase()
      .update(problems)
      .set({ name: 'Independent duplicate' })
      .where(eq(problems.id, duplicateId));
    await expect(
      requireDatabase()
        .select({ name: problems.name })
        .from(problems)
        .where(eq(problems.id, source.id)),
    ).resolves.toEqual([{ name: 'House Robber Copy' }]);
  });

  it('preserves exact IDs beyond Number.MAX_SAFE_INTEGER', async () => {
    if (!testClient) throw new Error('The test client is unavailable.');
    await testClient`
      alter table problems alter column id restart with 9007199254740993
    `;
    try {
      const categoryId = await createCategory();
      const problemId = await createProblem(categoryId);
      const response = await injectApi({
        method: 'POST',
        url: `/api/problems/${problemId}/duplicate`,
      });
      const body = response.json<{ id: string }>();

      expect(problemId).toBe(9_007_199_254_740_993n);
      expect(response.statusCode).toBe(201);
      expect(body.id).toBe('9007199254740994');
    } finally {
      await testClient`
        alter table problems alter column id restart with 1
      `;
    }
  });

  it('returns safe errors for missing and malformed duplication sources', async () => {
    const missing = await injectApi({
      method: 'POST',
      url: '/api/problems/9223372036854775807/duplicate',
    });
    expect(missing.statusCode).toBe(404);
    expect(missing.json()).toEqual({
      error: { code: 'PROBLEM_NOT_FOUND', message: 'Problem not found.' },
    });

    const malformed = await injectApi({
      method: 'POST',
      url: '/api/problems/01/duplicate',
    });
    expect(malformed.statusCode).toBe(400);
    expect(malformed.json()).toEqual({
      error: { code: 'INVALID_ID', message: 'The problem ID is invalid.' },
    });
    await expect(requireDatabase().select().from(problems)).resolves.toEqual([]);
  });

  it('rolls back the duplicate when copying tag associations fails', async () => {
    if (!testClient) throw new Error('The test client is unavailable.');
    const categoryId = await createCategory();
    const problemId = await createProblem(categoryId);
    const tagId = await createTag();
    await requireDatabase()
      .insert(problemTags)
      .values({ problemId, tagId });
    await testClient`
      create function fail_duplicate_tag_insert()
      returns trigger
      language plpgsql
      as $$
      begin
        raise exception 'forced association failure';
      end;
      $$
    `;
    await testClient`
      create trigger fail_duplicate_tag_insert_trigger
      before insert on problem_tags
      for each row execute function fail_duplicate_tag_insert()
    `;

    try {
      const response = await injectApi({
        method: 'POST',
        url: `/api/problems/${problemId}/duplicate`,
      });

      expect(response.statusCode).toBe(500);
      expect(response.json()).toEqual({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An unexpected error occurred.',
        },
      });
      expect(response.body).not.toContain('forced association failure');
      expect(response.body).not.toContain('problem_tags');
      await expect(
        requireDatabase().select().from(problems),
      ).resolves.toHaveLength(1);
      await expect(
        requireDatabase().select().from(problemTags),
      ).resolves.toHaveLength(1);
    } finally {
      await testClient`
        drop trigger if exists fail_duplicate_tag_insert_trigger on problem_tags
      `;
      await testClient`
        drop function if exists fail_duplicate_tag_insert()
      `;
    }
  });

  it('deletes only the problem and its join rows', async () => {
    const categoryId = await createCategory();
    const problemId = await createProblem(categoryId);
    const tagId = await createTag();
    await requireDatabase()
      .insert(problemTags)
      .values({ problemId, tagId });
    const response = await injectApi({
      method: 'DELETE',
      url: `/api/problems/${problemId}`,
    });

    expect(response.statusCode).toBe(204);
    await expect(requireDatabase().select().from(problems)).resolves.toEqual([]);
    await expect(requireDatabase().select().from(problemTags)).resolves.toEqual(
      [],
    );
    await expect(
      requireDatabase().select().from(categories),
    ).resolves.toHaveLength(1);
    await expect(requireDatabase().select().from(tags)).resolves.toHaveLength(
      1,
    );
  });

  it('returns not found when deleting a missing problem', async () => {
    const response = await injectApi({
      method: 'DELETE',
      url: '/api/problems/9223372036854775807',
    });
    expect(response.statusCode).toBe(404);
    expect(response.json()).toHaveProperty('error.code', 'PROBLEM_NOT_FOUND');
  });
});
