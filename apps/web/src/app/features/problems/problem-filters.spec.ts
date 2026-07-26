import type { Problem } from '../../core/api/api.models';
import {
  EMPTY_PROBLEM_FILTERS,
  filterProblems,
  normalizeSearchText,
  type ProblemFilters,
} from './problem-filters';

const problems: readonly Problem[] = [
  {
    id: '9007199254740993',
    name: 'House Robber',
    category: { id: '10', name: 'Dinámica' },
    difficulty: 'Medium',
    status: 'Needs review',
    tags: [
      { id: '100', name: '1D DP' },
      { id: '200', name: 'Array' },
    ],
    solution: null,
    source: null,
    notes: 'Use the **recurrence** relation.',
    timesSolved: 2,
    lastReviewedOn: null,
    createdAt: '2026-07-25T18:30:00.000Z',
    updatedAt: '2026-07-25T18:30:00.000Z',
  },
  {
    id: '2',
    name: 'Two Sum',
    category: { id: '20', name: 'Arrays' },
    difficulty: 'Easy',
    status: 'Solved',
    tags: [{ id: '300', name: 'Hash Map' }],
    solution: null,
    source: null,
    notes: 'Complement lookup.',
    timesSolved: 1,
    lastReviewedOn: '2026-07-25',
    createdAt: '2026-07-25T18:30:00.000Z',
    updatedAt: '2026-07-25T18:30:00.000Z',
  },
  {
    id: '3',
    name: 'Mystery Problem',
    category: { id: '10', name: 'Dinámica' },
    difficulty: null,
    status: 'To solve',
    tags: [{ id: '200', name: 'Array' }],
    solution: null,
    source: null,
    notes: '',
    timesSolved: 0,
    lastReviewedOn: null,
    createdAt: '2026-07-25T18:30:00.000Z',
    updatedAt: '2026-07-25T18:30:00.000Z',
  },
  {
    id: '4',
    name: 'Graph Paths',
    category: { id: '30', name: 'Graphs' },
    difficulty: 'Hard',
    status: 'Attempted',
    tags: [{ id: '400', name: 'DFS' }],
    solution: null,
    source: null,
    notes: 'Track visited nodes.',
    timesSolved: 0,
    lastReviewedOn: null,
    createdAt: '2026-07-25T18:30:00.000Z',
    updatedAt: '2026-07-25T18:30:00.000Z',
  },
];

function withFilters(
  changes: Partial<ProblemFilters>,
): ProblemFilters {
  return { ...EMPTY_PROBLEM_FILTERS, ...changes };
}

describe('problem filtering', () => {
  it('normalizes case and diacritics deterministically', () => {
    expect(normalizeSearchText('DINÁMICA')).toBe('dinamica');
  });

  it('returns every problem in canonical order for empty filters', () => {
    expect(filterProblems(problems, EMPTY_PROBLEM_FILTERS)).toEqual(problems);
    expect(filterProblems(problems, EMPTY_PROBLEM_FILTERS).map(({ id }) => id)).toEqual([
      '9007199254740993',
      '2',
      '3',
      '4',
    ]);
  });

  it.each([
    ['name', '  HOUSE  ', ['9007199254740993']],
    ['category', 'dinamica', ['9007199254740993', '3']],
    ['tag name', 'hash', ['2']],
    ['raw Markdown notes', '**RECURRENCÉ**', ['9007199254740993']],
  ])('searches %s with trimmed, partial, normalized matching', (_field, query, ids) => {
    expect(
      filterProblems(problems, withFilters({ query })).map(({ id }) => id),
    ).toEqual(ids);
  });

  it('treats a whitespace-only query as unrestricted', () => {
    expect(filterProblems(problems, withFilters({ query: '   ' }))).toEqual(
      problems,
    );
  });

  it('matches categories by exact string ID without changing large IDs', () => {
    const result = filterProblems(
      problems,
      withFilters({ categoryId: '10' }),
    );
    expect(result.map(({ id }) => id)).toEqual(['9007199254740993', '3']);
    expect(result[0]?.id).toBe('9007199254740993');
  });

  it.each([
    ['Easy', ['2']],
    ['Medium', ['9007199254740993']],
    ['Hard', ['4']],
    ['unspecified', ['3']],
  ] as const)('matches the %s difficulty filter', (difficulty, ids) => {
    expect(
      filterProblems(problems, withFilters({ difficulty })).map(({ id }) => id),
    ).toEqual(ids);
  });

  it('matches status exactly', () => {
    expect(
      filterProblems(
        problems,
        withFilters({ status: 'Needs review' }),
      ).map(({ id }) => id),
    ).toEqual(['9007199254740993']);
  });

  it('matches one selected tag', () => {
    expect(
      filterProblems(problems, withFilters({ tagIds: ['200'] })).map(
        ({ id }) => id,
      ),
    ).toEqual(['9007199254740993', '3']);
  });

  it('uses OR semantics for multiple selected tags', () => {
    expect(
      filterProblems(
        problems,
        withFilters({ tagIds: ['100', '300'] }),
      ).map(({ id }) => id),
    ).toEqual(['9007199254740993', '2']);
  });

  it('combines filter groups with AND', () => {
    expect(
      filterProblems(
        problems,
        withFilters({
          query: 'dinamica',
          categoryId: '10',
          difficulty: 'Medium',
          status: 'Needs review',
          tagIds: ['300', '100'],
        }),
      ).map(({ id }) => id),
    ).toEqual(['9007199254740993']);
  });

  it('does not mutate the problems, tags, or filter inputs', () => {
    const problemSnapshot = structuredClone(problems);
    const tagIds = ['100', '300'];
    const filters = withFilters({ tagIds });

    filterProblems(problems, filters);

    expect(problems).toEqual(problemSnapshot);
    expect(tagIds).toEqual(['100', '300']);
    expect(filters.tagIds).toBe(tagIds);
  });
});
