import assert from 'node:assert/strict';
import { readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import type { FastifyInstance, InjectOptions } from 'fastify';
import postgres from 'postgres';
import { buildApp } from '../src/app.js';
import { closeDatabase } from '../src/db/client.js';
import * as schema from '../src/db/schema.js';
import type { ProblemResource } from '../src/http/problem-serialization.js';
import type { NamedResource } from '../src/http/serialization.js';

const stateFile = join(tmpdir(), 'dsa-notes-persistence-verification.json');
const migrationsFolder = fileURLToPath(new URL('../drizzle', import.meta.url));
const verificationDate = () => new Date(2026, 7, 2, 12, 0, 0, 0);

interface PersistenceSnapshot {
  readonly categories: readonly NamedResource[];
  readonly tags: readonly NamedResource[];
  readonly problems: readonly ProblemResource[];
}

interface PersistenceState {
  readonly databaseName: string;
  readonly snapshot: PersistenceSnapshot;
}

export function requireSafeTestDatabaseUrl(value = process.env['DATABASE_TEST_URL']): URL {
  if (!value) {
    throw new Error('DATABASE_TEST_URL is required for persistence verification.');
  }

  const url = new URL(value);
  const databaseName = decodeURIComponent(url.pathname.replace(/^\//u, ''));
  if (!databaseName.toLowerCase().includes('test')) {
    throw new Error('DATABASE_TEST_URL must name a database containing "test".');
  }
  if (!/^[a-zA-Z0-9_]+$/u.test(databaseName)) {
    throw new Error('DATABASE_TEST_URL database name may contain only letters, numbers, and underscores.');
  }
  return url;
}

function databaseUrl(baseUrl: URL, databaseName: string): string {
  const result = new URL(baseUrl);
  result.pathname = `/${databaseName}`;
  return result.toString();
}

async function migrateDatabase(url: string): Promise<void> {
  const client = postgres(url, { max: 1 });
  try {
    await migrate(drizzle(client, { schema }), { migrationsFolder });
  } finally {
    await client.end();
  }
}

async function withTemporaryDatabase<T>(
  operation: (databaseName: string, url: string) => Promise<T>,
): Promise<T> {
  const baseUrl = requireSafeTestDatabaseUrl();
  const configuredName = decodeURIComponent(baseUrl.pathname.replace(/^\//u, ''));
  const databaseName = `${configuredName.slice(0, 28)}_persistence_${process.pid}_${Date.now()}`.toLowerCase();
  const adminUrl = new URL(baseUrl);
  adminUrl.pathname = '/postgres';
  const admin = postgres(adminUrl.toString(), { max: 1 });
  const url = databaseUrl(baseUrl, databaseName);

  try {
    await admin.unsafe(`CREATE DATABASE "${databaseName}"`);
    console.info(`Created isolated persistence verification database ${databaseName}.`);
    await migrateDatabase(url);
    return await operation(databaseName, url);
  } finally {
    await closeDatabase();
    await admin.unsafe(`DROP DATABASE IF EXISTS "${databaseName}" WITH (FORCE)`);
    await admin.end();
    console.info(`Removed isolated persistence verification database ${databaseName}.`);
  }
}

async function request<T>(
  app: FastifyInstance,
  method: NonNullable<InjectOptions['method']>,
  url: string,
  payload?: Record<string, unknown>,
): Promise<T> {
  const options: InjectOptions = payload === undefined
    ? { method, url }
    : {
        method,
        url,
        payload: JSON.stringify(payload),
        headers: { 'content-type': 'application/json' },
      };
  const response = await app.inject(options);
  assert.ok(response.statusCode >= 200 && response.statusCode < 300, response.body);
  return response.json<T>();
}

async function snapshot(app: FastifyInstance): Promise<PersistenceSnapshot> {
  return {
    categories: await request<NamedResource[]>(app, 'GET', '/api/categories'),
    tags: await request<NamedResource[]>(app, 'GET', '/api/tags'),
    problems: await request<ProblemResource[]>(app, 'GET', '/api/problems'),
  };
}

async function withFreshApp<T>(url: string, operation: (app: FastifyInstance) => Promise<T>): Promise<T> {
  const originalUrl = process.env['DATABASE_URL'];
  process.env['DATABASE_URL'] = url;
  await closeDatabase();
  const app = buildApp({ currentDate: verificationDate });
  try {
    return await operation(app);
  } finally {
    await app.close();
    if (originalUrl === undefined) delete process.env['DATABASE_URL'];
    else process.env['DATABASE_URL'] = originalUrl;
  }
}

function assertFixture(snapshotValue: PersistenceSnapshot): void {
  assert.equal(snapshotValue.categories.length, 2);
  assert.equal(snapshotValue.tags.length, 3);
  assert.equal(snapshotValue.problems.length, 4);
  assert.ok(snapshotValue.categories.some(({ name }) => name === 'Arrays and Hashing'));
  assert.ok(snapshotValue.tags.some(({ name }) => name === 'Graph Theory'));

  const source = snapshotValue.problems.find(({ name }) => name === 'Two Sum (edited)');
  const duplicate = snapshotValue.problems.find(({ name }) => name === 'Two Sum Copy');
  const reviewed = snapshotValue.problems.find(({ name }) => name === 'Longest Path');
  const nullable = snapshotValue.problems.find(({ name }) => name === 'Course Schedule (edited)');
  assert.ok(source && duplicate && reviewed && nullable);
  assert.notEqual(source.id, duplicate.id);
  assert.equal(source.notes, 'Line one\nLine two\nEdited after duplication.');
  assert.deepEqual(source.solution, {
    url: 'https://example.com/solutions/two-sum',
    label: 'Two Sum solution',
  });
  assert.deepEqual(source.source, {
    url: 'https://leetcode.com/problems/two-sum/',
    label: 'LeetCode',
  });
  assert.equal(duplicate.name, 'Two Sum Copy');
  assert.equal(duplicate.notes, 'Line one\nLine two');
  assert.equal(nullable.difficulty, null);
  assert.deepEqual(nullable.tags.map(({ name }) => name), ['Graph Theory']);
  assert.equal(reviewed.timesSolved, 2);
  assert.equal(reviewed.lastReviewedOn, '2026-08-02');
  for (const problem of snapshotValue.problems) {
    assert.match(problem.id, /^[1-9][0-9]*$/u);
    assert.match(problem.createdAt, /^\d{4}-\d{2}-\d{2}T/u);
    assert.match(problem.updatedAt, /^\d{4}-\d{2}-\d{2}T/u);
  }
}

async function seedFixture(url: string): Promise<PersistenceSnapshot> {
  return withFreshApp(url, async (app) => {
    const arrays = await request<NamedResource>(app, 'POST', '/api/categories', { name: 'Arrays' });
    const dynamic = await request<NamedResource>(app, 'POST', '/api/categories', { name: 'Dynamic Programming' });
    const renamedArrays = await request<NamedResource>(app, 'PATCH', `/api/categories/${arrays.id}`, { name: 'Arrays and Hashing' });
    const array = await request<NamedResource>(app, 'POST', '/api/tags', { name: 'Array' });
    const dynamicProgramming = await request<NamedResource>(app, 'POST', '/api/tags', { name: 'Dynamic Programming' });
    const graphs = await request<NamedResource>(app, 'POST', '/api/tags', { name: 'Graphs' });
    const graphTheory = await request<NamedResource>(app, 'PATCH', `/api/tags/${graphs.id}`, { name: 'Graph Theory' });

    const source = await request<ProblemResource>(app, 'POST', '/api/problems', {
      name: 'Two Sum', categoryId: renamedArrays.id, difficulty: 'Easy', status: 'Solved',
      tagIds: [array.id, dynamicProgramming.id],
      solution: { url: 'https://example.com/solutions/two-sum', label: 'Two Sum solution' },
      source: { url: 'https://leetcode.com/problems/two-sum/', label: 'LeetCode' },
      notes: 'Line one\nLine two', timesSolved: 0,
    });
    const nullable = await request<ProblemResource>(app, 'POST', '/api/problems', {
      name: 'Course Schedule', categoryId: dynamic.id, difficulty: null, status: 'Attempted',
      tagIds: [array.id, graphTheory.id], notes: 'Graph traversal notes', timesSolved: 1,
    });
    const reviewed = await request<ProblemResource>(app, 'POST', '/api/problems', {
      name: 'Longest Path', categoryId: dynamic.id, difficulty: 'Hard', status: 'Needs review',
      tagIds: [dynamicProgramming.id, graphTheory.id],
      source: { url: 'https://example.com/problems/longest-path', label: 'Reference' },
      notes: 'First line\nSecond line', timesSolved: 0,
    });
    await request<ProblemResource>(app, 'POST', `/api/problems/${source.id}/duplicate`);
    await request<ProblemResource>(app, 'PATCH', `/api/problems/${source.id}`, {
      name: 'Two Sum (edited)', notes: 'Line one\nLine two\nEdited after duplication.',
    });
    await request<ProblemResource>(app, 'PATCH', `/api/problems/${nullable.id}`, {
      name: 'Course Schedule (edited)', tagIds: [graphTheory.id],
    });
    await request<ProblemResource>(app, 'PATCH', `/api/problems/${reviewed.id}`, { timesSolved: 2 });
    const result = await snapshot(app);
    assertFixture(result);
    return result;
  });
}

async function verifySnapshot(url: string, expected: PersistenceSnapshot): Promise<void> {
  const actual = await withFreshApp(url, async (app) => {
    const health = await request<{ status: string }>(app, 'GET', '/api/health');
    assert.equal(health.status, 'ok');
    return snapshot(app);
  });
  assertFixture(actual);
  assert.deepEqual(actual, expected);
}

async function prepare(): Promise<void> {
  try {
    await readFile(stateFile, 'utf8');
    throw new Error(`A persistence database is already recorded in ${stateFile}. Run persistence:cleanup first.`);
  } catch (error) {
    if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) throw error;
  }

  const baseUrl = requireSafeTestDatabaseUrl();
  const configuredName = decodeURIComponent(baseUrl.pathname.replace(/^\//u, ''));
  const databaseName = `${configuredName.slice(0, 28)}_persistence_${process.pid}_${Date.now()}`.toLowerCase();
  const adminUrl = new URL(baseUrl);
  adminUrl.pathname = '/postgres';
  const admin = postgres(adminUrl.toString(), { max: 1 });
  const url = databaseUrl(baseUrl, databaseName);
  try {
    await admin.unsafe(`CREATE DATABASE "${databaseName}"`);
    await migrateDatabase(url);
    const seeded = await seedFixture(url);
    await writeFile(stateFile, JSON.stringify({ databaseName, snapshot: seeded } satisfies PersistenceState));
    console.info(`Prepared isolated persistence verification database ${databaseName}.`);
  } catch (error) {
    await closeDatabase();
    await admin.unsafe(`DROP DATABASE IF EXISTS "${databaseName}" WITH (FORCE)`);
    throw error;
  } finally {
    await admin.end();
  }
}

async function readState(): Promise<PersistenceState> {
  const state = JSON.parse(await readFile(stateFile, 'utf8')) as PersistenceState;
  if (!/^[a-zA-Z0-9_]+$/u.test(state.databaseName) || !state.databaseName.includes('_persistence_')) {
    throw new Error('The recorded persistence verification database name is invalid.');
  }
  return state;
}

async function verify(reapplyMigrations = false): Promise<void> {
  const baseUrl = requireSafeTestDatabaseUrl();
  const state = await readState();
  const url = databaseUrl(baseUrl, state.databaseName);
  if (reapplyMigrations) await migrateDatabase(url);
  await verifySnapshot(url, state.snapshot);
  console.info(`Verified persisted fixture in ${state.databaseName}.`);
}

async function cleanup(): Promise<void> {
  const state = await readState();
  const adminUrl = requireSafeTestDatabaseUrl();
  adminUrl.pathname = '/postgres';
  const admin = postgres(adminUrl.toString(), { max: 1 });
  try {
    await closeDatabase();
    await admin.unsafe(`DROP DATABASE IF EXISTS "${state.databaseName}" WITH (FORCE)`);
    await rm(stateFile);
    console.info(`Removed isolated persistence verification database ${state.databaseName}.`);
  } finally {
    await admin.end();
  }
}

export async function runPersistenceVerification(): Promise<void> {
  await withTemporaryDatabase(async (_databaseName, url) => {
    const expected = await seedFixture(url);
    await verifySnapshot(url, expected);
    await migrateDatabase(url);
    await verifySnapshot(url, expected);
  });
}

async function main(): Promise<void> {
  switch (process.argv[2]) {
    case 'prepare': await prepare(); break;
    case 'verify': await verify(); break;
    case 'migrate-verify': await verify(true); break;
    case 'cleanup': await cleanup(); break;
    case 'run': await runPersistenceVerification(); break;
    default: throw new Error('Use prepare, verify, migrate-verify, cleanup, or run.');
  }
}

if (resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) {
  await main();
}
