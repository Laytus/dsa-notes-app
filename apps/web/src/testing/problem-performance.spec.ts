import { describe, expect, it } from 'vitest';
import type { Problem } from '../app/core/api/api.models';
import { filterProblems, type ProblemFilters } from '../app/features/problems/problem-filters';
import { compareDecimalIds, sortProblems } from '../app/features/problems/problem-sorting';
import { PERFORMANCE_PROBLEMS } from './problem-performance.fixture';

const filters: ProblemFilters = {
  query: 'dinamica marker',
  categoryId: '4',
  difficulty: 'Hard',
  status: 'Needs review',
  tagIds: ['3'],
};

describe('1,000-Problem correctness fixture', () => {
  it('is deterministic, hydrated, and preserves decimal-string IDs', () => {
    expect(PERFORMANCE_PROBLEMS).toHaveLength(1_000);
    expect(PERFORMANCE_PROBLEMS[0]?.id).toBe('9007199254740993');
    expect(PERFORMANCE_PROBLEMS.some(({ id }) => BigInt(id) > BigInt(Number.MAX_SAFE_INTEGER))).toBe(true);
    expect(PERFORMANCE_PROBLEMS.filter(({ name }) => name === 'Repeated benchmark problem').length).toBeGreaterThan(1);
  });

  it('keeps search, filters, and their AND/OR semantics correct at 1,000 rows', () => {
    const bySearch = filterProblems(PERFORMANCE_PROBLEMS, { ...filters, categoryId: null, difficulty: null, status: null, tagIds: [] });
    expect(bySearch.every(({ notes }) => notes.toLowerCase().includes('dinámica marker'))).toBe(true);

    const byCategory = filterProblems(PERFORMANCE_PROBLEMS, { ...filters, query: '', difficulty: null, status: null, tagIds: [] });
    expect(byCategory.every(({ category }) => category.id === filters.categoryId)).toBe(true);

    const byTags = filterProblems(PERFORMANCE_PROBLEMS, { ...filters, query: '', categoryId: null, difficulty: null, status: null });
    expect(byTags.every(({ tags }) => tags.some(({ id }) => id === '3'))).toBe(true);

    const combined = filterProblems(PERFORMANCE_PROBLEMS, filters);
    expect(combined.length).toBeGreaterThan(0);
    expect(combined.every((problem) =>
      problem.category.id === filters.categoryId &&
      problem.difficulty === filters.difficulty &&
      problem.status === filters.status &&
      problem.tags.some(({ id }) => filters.tagIds.includes(id)),
    )).toBe(true);
  });

  it('sorts all supported fields deterministically and preserves expansion IDs', () => {
    for (const field of ['name', 'category', 'difficulty', 'lastReviewedOn'] as const) {
      const sorted = sortProblems(PERFORMANCE_PROBLEMS, { field, direction: 'ascending' });
      expect(sorted).toHaveLength(1_000);
      expect(new Set(sorted.map(({ id }) => id)).size).toBe(1_000);
    }
    const tied = sortProblems(
      PERFORMANCE_PROBLEMS.filter(({ name }) => name === 'Repeated benchmark problem'),
      { field: 'name', direction: 'ascending' },
    );
    expect(tied.every((problem, index) => index === 0 || compareDecimalIds(tied[index - 1]!.id, problem.id) < 0)).toBe(true);

    const expanded = new Set([PERFORMANCE_PROBLEMS[0]!.id, PERFORMANCE_PROBLEMS[500]!.id]);
    const sorted = sortProblems(PERFORMANCE_PROBLEMS, { field: 'category', direction: 'descending' });
    expect(sorted.filter(({ id }) => expanded.has(id)).map(({ id }) => id)).toHaveLength(2);
  });

  it('keeps immutable problem and reference reconciliation exact at 1,000 rows', () => {
    const target = PERFORMANCE_PROBLEMS[500]!;
    const created: Problem = {
      ...target,
      id: '9007199254741999',
      name: 'Created verification problem',
    };
    const afterCreate = [...PERFORMANCE_PROBLEMS, created];
    const afterInlineEdit = afterCreate.map((problem) =>
      problem.id === target.id ? { ...problem, name: 'Edited verification problem' } : problem,
    );
    const afterReview = afterInlineEdit.map((problem) =>
      problem.id === target.id
        ? { ...problem, timesSolved: problem.timesSolved + 1, lastReviewedOn: '2026-08-01' }
        : problem,
    );
    const afterDuplicate = [...afterReview, { ...target, id: '9007199254742000', name: `${target.name} Copy` }];
    const afterDelete = afterDuplicate.filter(({ id }) => id !== target.id);
    const categoryRenamed = afterDelete.map((problem) =>
      problem.category.id === '1'
        ? { ...problem, category: { ...problem.category, name: 'Arrays renamed' } }
        : problem,
    );
    const tagRenamed = categoryRenamed.map((problem) => ({
      ...problem,
      tags: problem.tags.map((tag) => tag.id === '1' ? { ...tag, name: 'Array renamed' } : tag),
    }));

    expect(afterCreate).toHaveLength(1_001);
    expect(afterInlineEdit.filter(({ id }) => id === target.id)[0]?.name).toBe('Edited verification problem');
    expect(afterReview.filter(({ id }) => id === target.id)[0]?.lastReviewedOn).toBe('2026-08-01');
    expect(afterDuplicate).toHaveLength(1_002);
    expect(afterDelete).toHaveLength(1_001);
    expect(afterDelete.some(({ id }) => id === target.id)).toBe(false);
    expect(categoryRenamed.filter(({ category }) => category.id === '1').every(({ category }) => category.name === 'Arrays renamed')).toBe(true);
    expect(tagRenamed.every(({ tags }) => tags.filter(({ id }) => id === '1').every(({ name }) => name === 'Array renamed'))).toBe(true);
  });
});
