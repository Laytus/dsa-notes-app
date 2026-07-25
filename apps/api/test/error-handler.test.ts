import { afterEach, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import type { Database } from '../src/db/index.js';

const apps: ReturnType<typeof buildApp>[] = [];

afterEach(async () => {
  await Promise.all(apps.splice(0).map(async (app) => app.close()));
});

describe('API error handling', () => {
  it('does not expose unexpected database error details', async () => {
    const database = {
      select() {
        throw new Error('postgresql://user:secret@localhost/private');
      },
    } as unknown as Database;
    const app = buildApp({ database });
    apps.push(app);

    const response = await app.inject({
      method: 'GET',
      url: '/api/categories',
    });

    expect(response.statusCode).toBe(500);
    expect(response.json()).toEqual({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred.',
      },
    });
    expect(response.body).not.toContain('secret');
  });
});
