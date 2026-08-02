import { readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import {
  PERFORMANCE_CATEGORIES,
  PERFORMANCE_PROBLEMS,
  PERFORMANCE_TAGS,
} from '../../web/src/testing/problem-performance.fixture.js';
import { categories, problems, problemTags, tags } from '../src/db/schema.js';

const stateFile = join(tmpdir(), 'dsa-notes-performance-1000.json');
const migrationsFolder = fileURLToPath(new URL('../drizzle', import.meta.url));

interface PerformanceDatabaseState {
  readonly databaseName: string;
}

function testDatabaseUrl(): URL {
  const value = process.env['DATABASE_TEST_URL'];
  if (!value) {
    throw new Error('DATABASE_TEST_URL is required for the temporary performance database.');
  }

  const url = new URL(value);
  const name = decodeURIComponent(url.pathname.replace(/^\//u, ''));
  if (!name.toLowerCase().includes('test') || !/^[a-zA-Z0-9_]+$/u.test(name)) {
    throw new Error('DATABASE_TEST_URL must name a safe database containing "test".');
  }
  return url;
}

async function prepare(): Promise<void> {
  try {
    await readFile(stateFile, 'utf8');
    throw new Error(`A performance database is already recorded in ${stateFile}. Run perf:1000:cleanup first.`);
  } catch (error) {
    if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) throw error;
  }

  const baseUrl = testDatabaseUrl();
  const configuredName = decodeURIComponent(baseUrl.pathname.replace(/^\//u, ''));
  const databaseName = `${configuredName.slice(0, 32)}_perf_${Date.now()}`.toLowerCase();
  const adminUrl = new URL(baseUrl);
  adminUrl.pathname = '/postgres';
  const performanceUrl = new URL(baseUrl);
  performanceUrl.pathname = `/${databaseName}`;
  const admin = postgres(adminUrl.toString(), { max: 1 });
  let client: ReturnType<typeof postgres> | undefined;

  try {
    await admin.unsafe(`CREATE DATABASE "${databaseName}"`);
    client = postgres(performanceUrl.toString(), { max: 1 });
    const database = drizzle(client, { schema: { categories, problems, problemTags, tags } });
    await migrate(database, { migrationsFolder });

    const categoryRows = await database
      .insert(categories)
      .values(PERFORMANCE_CATEGORIES.map(({ name }) => ({ name })))
      .returning({ id: categories.id, name: categories.name });
    const tagRows = await database
      .insert(tags)
      .values(PERFORMANCE_TAGS.map(({ name }) => ({ name })))
      .returning({ id: tags.id, name: tags.name });
    const categoryIds = new Map(categoryRows.map(({ id, name }) => [name, id]));
    const tagIds = new Map(tagRows.map(({ id, name }) => [name, id]));

    const problemRows = await database
      .insert(problems)
      .values(PERFORMANCE_PROBLEMS.map((problem) => ({
        name: problem.name,
        categoryId: categoryIds.get(problem.category.name)!,
        difficulty: problem.difficulty,
        status: problem.status,
        lastReviewedOn: problem.lastReviewedOn,
        timesSolved: problem.timesSolved,
        solutionUrl: problem.solution?.url ?? null,
        solutionLabel: problem.solution?.label ?? null,
        sourceUrl: problem.source?.url ?? null,
        sourceLabel: problem.source?.label ?? null,
        notes: problem.notes,
      })))
      .returning({ id: problems.id });
    await database.insert(problemTags).values(
      PERFORMANCE_PROBLEMS.flatMap((problem, index) =>
        problem.tags.map((tag) => ({
          problemId: problemRows[index]!.id,
          tagId: tagIds.get(tag.name)!,
        })),
      ),
    );

    await writeFile(stateFile, JSON.stringify({ databaseName } satisfies PerformanceDatabaseState));
    console.info(`Prepared isolated database ${databaseName} with 1,000 Problems.`);
    console.info('Use this database name with DATABASE_TEST_URL credentials to start the local API, then run perf:1000:cleanup.');
  } catch (error) {
    if (client) {
      await client.end();
      client = undefined;
    }
    await admin.unsafe(`DROP DATABASE IF EXISTS "${databaseName}" WITH (FORCE)`);
    throw error;
  } finally {
    if (client) await client.end();
    await admin.end();
  }
}

async function cleanup(): Promise<void> {
  const state = JSON.parse(await readFile(stateFile, 'utf8')) as PerformanceDatabaseState;
  if (!/^[a-zA-Z0-9_]+$/u.test(state.databaseName) || !state.databaseName.includes('_perf_')) {
    throw new Error('The recorded performance database name is invalid.');
  }

  const adminUrl = testDatabaseUrl();
  adminUrl.pathname = '/postgres';
  const admin = postgres(adminUrl.toString(), { max: 1 });
  try {
    await admin.unsafe(`DROP DATABASE IF EXISTS "${state.databaseName}" WITH (FORCE)`);
    await rm(stateFile);
    console.info(`Removed isolated performance database ${state.databaseName}.`);
  } finally {
    await admin.end();
  }
}

const command = process.argv[2];
if (command === 'prepare') {
  await prepare();
} else if (command === 'cleanup') {
  await cleanup();
} else {
  throw new Error('Use either "prepare" or "cleanup".');
}
