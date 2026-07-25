import { describe, expect, it } from 'vitest';
import { serializeProblem } from '../src/http/problem-serialization.js';
import {
  normalizeLink,
  parseProblemBody,
  parseStrictDate,
} from '../src/http/problem-validation.js';

describe('problem request helpers', () => {
  it.each([
    ['2024-02-29', '2024-02-29'],
    ['2026-02-29', null],
    ['2026-02-30', null],
    ['2026-04-31', null],
    ['2026-7-25', null],
    ['2026-07-25T00:00:00Z', null],
    ['0000-01-01', null],
  ])('strictly parses date %s', (value, expected) => {
    expect(parseStrictDate(value)).toBe(expected);
  });

  it('trims links and applies a default label', () => {
    expect(
      normalizeLink({ url: ' https://example.com/a?q=1 ' }, 'View solution'),
    ).toEqual({
      url: 'https://example.com/a?q=1',
      label: 'View solution',
    });
  });

  it.each([
    'relative/path',
    'ftp://example.com/file',
    '',
    '   ',
    'https://',
  ])('rejects invalid link URL %s', (url) => {
    expect(normalizeLink({ url }, 'LeetCode')).toMatchObject({
      code: 'INVALID_URL',
    });
  });

  it('rejects an empty supplied label', () => {
    expect(
      normalizeLink({ url: 'https://example.com', label: ' ' }, 'LeetCode'),
    ).toMatchObject({ code: 'INVALID_LINK_LABEL' });
  });

  it('preserves notes and internal name whitespace', () => {
    expect(
      parseProblemBody(
        {
          name: ' Dynamic  Programming ',
          categoryId: '1',
          notes: '  # Notes\n\nKeep spacing  ',
        },
        'create',
      ),
    ).toEqual({
      ok: true,
      value: {
        name: 'Dynamic  Programming',
        categoryId: 1n,
        notes: '  # Notes\n\nKeep spacing  ',
      },
    });
  });

  it('rejects duplicate tag IDs after canonical parsing', () => {
    expect(
      parseProblemBody({ tagIds: ['2', '2'] }, 'update'),
    ).toMatchObject({
      ok: false,
      error: { code: 'DUPLICATE_TAG_IDS' },
    });
  });

  it.each([-1, 1.5, '2', 2_147_483_648, Number.NaN])(
    'rejects invalid times solved %s',
    (timesSolved) => {
      expect(
        parseProblemBody({ timesSolved }, 'update'),
      ).toMatchObject({
        ok: false,
        error: { code: 'INVALID_TIMES_SOLVED' },
      });
    },
  );
});

describe('problem serialization', () => {
  it('serializes a complete problem without raw database fields', () => {
    expect(
      serializeProblem(
        {
          id: 9_007_199_254_740_993n,
          name: 'Two Sum',
          categoryId: 1n,
          categoryName: 'Arrays',
          difficulty: 'Easy',
          status: 'Solved',
          lastReviewedOn: '2026-07-25',
          timesSolved: 2,
          solutionUrl: 'https://example.com/solution',
          solutionLabel: 'View solution',
          sourceUrl: null,
          sourceLabel: null,
          notes: '',
          createdAt: new Date('2026-07-25T18:30:00.000Z'),
          updatedAt: new Date('2026-07-25T19:30:00.000Z'),
        },
        [
          { problemId: 9_007_199_254_740_993n, id: 3n, name: 'Hash Map' },
        ],
      ),
    ).toEqual({
      id: '9007199254740993',
      name: 'Two Sum',
      category: { id: '1', name: 'Arrays' },
      difficulty: 'Easy',
      status: 'Solved',
      tags: [{ id: '3', name: 'Hash Map' }],
      solution: {
        url: 'https://example.com/solution',
        label: 'View solution',
      },
      source: null,
      notes: '',
      timesSolved: 2,
      lastReviewedOn: '2026-07-25',
      createdAt: '2026-07-25T18:30:00.000Z',
      updatedAt: '2026-07-25T19:30:00.000Z',
    });
  });
});
