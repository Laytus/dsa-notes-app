import { describe, expect, it } from 'vitest';
import {
  findPostgreSqlError,
  isPostgreSqlConstraintError,
} from '../src/http/errors.js';
import { serializeNamedResource } from '../src/http/serialization.js';
import { normalizeName, parseId } from '../src/http/validation.js';

describe('HTTP helpers', () => {
  it.each(['0', '-1', '1.5', '1e3', 'abc', '+1', '01'])(
    'rejects the noncanonical ID %s',
    (id) => {
      expect(() => parseId(id)).toThrow();
    },
  );

  it('parses valid IDs as bigint without numeric precision loss', () => {
    expect(parseId('9223372036854775807')).toBe(9_223_372_036_854_775_807n);
    expect(() => parseId('9223372036854775808')).toThrow();
  });

  it('trims only surrounding name whitespace', () => {
    expect(normalizeName(' Dynamic  Programming ')).toBe(
      'Dynamic  Programming',
    );
  });

  it('serializes bigint IDs and Date timestamps explicitly', () => {
    expect(
      serializeNamedResource({
        id: 9_007_199_254_740_993n,
        name: 'Arrays',
        createdAt: new Date('2026-07-25T18:30:00.000Z'),
        updatedAt: new Date('2026-07-25T18:31:00.000Z'),
      }),
    ).toEqual({
      id: '9007199254740993',
      name: 'Arrays',
      createdAt: '2026-07-25T18:30:00.000Z',
      updatedAt: '2026-07-25T18:31:00.000Z',
    });
  });

  it('finds only PostgreSQL-shaped errors in a cause chain', () => {
    const postgresError = {
      code: '23505',
      constraint_name: 'categories_name_lower_unique',
    };
    const wrapped = { cause: { cause: postgresError } };

    expect(findPostgreSqlError(wrapped)).toBe(postgresError);
    expect(
      isPostgreSqlConstraintError(
        wrapped,
        '23505',
        'categories_name_lower_unique',
      ),
    ).toBe(true);
    expect(isPostgreSqlConstraintError(new Error('secret'), '23505', 'x')).toBe(
      false,
    );
  });
});
