import type { Problem } from '../../core/api/api.models';
import { sortProblems } from './problem-sorting';

const base: Problem = {
  id: '1', name: 'Two Sum', category: { id: '1', name: 'Arrays' },
  difficulty: 'Easy', status: 'Solved', tags: [], solution: null, source: null,
  notes: '', timesSolved: 2, lastReviewedOn: '2026-07-25', createdAt: '', updatedAt: '',
};

describe('sortProblems', () => {
  it('preserves canonical default order until an explicit sort is chosen', () => {
    const problems = [{ ...base, id: '2', name: 'B' }, { ...base, id: '1', name: 'A' }];
    expect(sortProblems(problems, null)).toBe(problems);
  });

  it('sorts names case-insensitively with exact decimal ID ties', () => {
    const problems = [
      { ...base, id: '10', name: 'same' },
      { ...base, id: '2', name: 'Same' },
      { ...base, id: '9007199254740993', name: 'SAME' },
    ];
    expect(sortProblems(problems, { field: 'name', direction: 'ascending' }).map(({ id }) => id)).toEqual(['2', '10', '9007199254740993']);
  });

  it('sorts categories by name, then category ID, then problem ID', () => {
    const problems = [
      { ...base, id: '3', category: { id: '10', name: 'Arrays' } },
      { ...base, id: '2', category: { id: '2', name: 'Arrays' } },
      { ...base, id: '1', category: { id: '1', name: 'Graphs' } },
    ];
    expect(sortProblems(problems, { field: 'category', direction: 'ascending' }).map(({ id }) => id)).toEqual(['2', '3', '1']);
  });

  it('uses product difficulty rank and always keeps unspecified values last', () => {
    const problems = [
      { ...base, id: '1', difficulty: null },
      { ...base, id: '2', difficulty: 'Hard' as const },
      { ...base, id: '3', difficulty: 'Easy' as const },
    ];
    expect(sortProblems(problems, { field: 'difficulty', direction: 'ascending' }).map(({ id }) => id)).toEqual(['3', '2', '1']);
    expect(sortProblems(problems, { field: 'difficulty', direction: 'descending' }).map(({ id }) => id)).toEqual(['2', '3', '1']);
  });

  it('sorts canonical date strings chronologically and keeps null last', () => {
    const problems = [
      { ...base, id: '1', lastReviewedOn: null },
      { ...base, id: '2', lastReviewedOn: '2026-10-01' },
      { ...base, id: '3', lastReviewedOn: '2026-02-01' },
    ];
    expect(sortProblems(problems, { field: 'lastReviewedOn', direction: 'ascending' }).map(({ id }) => id)).toEqual(['3', '2', '1']);
    expect(sortProblems(problems, { field: 'lastReviewedOn', direction: 'descending' }).map(({ id }) => id)).toEqual(['2', '3', '1']);
  });
});
