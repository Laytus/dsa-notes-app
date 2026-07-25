import { fileURLToPath } from 'node:url';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
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
