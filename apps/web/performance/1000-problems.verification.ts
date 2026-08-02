import { filterProblems, type ProblemFilters } from '../src/app/features/problems/problem-filters';
import {
  compareDefaultProblems,
  sortProblems,
  type ProblemSort,
} from '../src/app/features/problems/problem-sorting';
import type { Problem } from '../src/app/core/api/api.models';
import {
  PERFORMANCE_PROBLEMS,
} from '../src/testing/problem-performance.fixture';

interface Measurement {
  readonly operation: string;
  readonly medianMs: number;
  readonly resultCount: number;
}

const samplesPerOperation = 15;
const warmupRuns = 3;

const combinedFilters: ProblemFilters = {
  query: 'dinamica marker',
  categoryId: '4',
  difficulty: 'Hard',
  status: 'Needs review',
  tagIds: ['3', '6'],
};

function median(values: readonly number[]): number {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.floor(sorted.length / 2)] ?? 0;
}

function measure(operation: string, run: () => readonly Problem[]): Measurement {
  for (let index = 0; index < warmupRuns; index += 1) run();

  const timings: number[] = [];
  let resultCount = 0;
  for (let index = 0; index < samplesPerOperation; index += 1) {
    const startedAt = performance.now();
    resultCount = run().length;
    timings.push(performance.now() - startedAt);
  }

  return { operation, medianMs: median(timings), resultCount };
}

function replaceProblem(
  problems: readonly Problem[],
  replacement: Problem,
): readonly Problem[] {
  return problems.map((problem) => problem.id === replacement.id ? replacement : problem);
}

const insertedProblem: Problem = {
  ...PERFORMANCE_PROBLEMS[0]!,
  id: '9007199254741999',
  name: 'Inserted performance verification problem',
};
const replacementProblem: Problem = {
  ...PERFORMANCE_PROBLEMS[500]!,
  name: 'Replaced performance verification problem',
};

const sorts: readonly ProblemSort[] = [
  { field: 'name', direction: 'ascending' },
  { field: 'category', direction: 'ascending' },
  { field: 'difficulty', direction: 'ascending' },
  { field: 'lastReviewedOn', direction: 'ascending' },
];

export function runPerformanceVerification(): readonly Measurement[] {
  return [
    measure('Search derivation', () => filterProblems(PERFORMANCE_PROBLEMS, {
      ...combinedFilters,
      categoryId: null,
      difficulty: null,
      status: null,
      tagIds: [],
    })),
    measure('Combined filtering', () => filterProblems(PERFORMANCE_PROBLEMS, combinedFilters)),
    ...sorts.map((sort) => measure(`Sort by ${sort.field}`, () => sortProblems(PERFORMANCE_PROBLEMS, sort))),
    measure('Filtered and sorted derivation', () => sortProblems(
      filterProblems(PERFORMANCE_PROBLEMS, combinedFilters),
      { field: 'name', direction: 'ascending' },
    )),
    measure('Immutable insertion', () => [...PERFORMANCE_PROBLEMS, insertedProblem].sort(compareDefaultProblems)),
    measure('Immutable replacement', () => replaceProblem(PERFORMANCE_PROBLEMS, replacementProblem)),
    measure('Immutable deletion', () => PERFORMANCE_PROBLEMS.filter(({ id }) => id !== replacementProblem.id)),
    measure('Category rename reconciliation', () => PERFORMANCE_PROBLEMS.map((problem) =>
      problem.category.id === '1'
        ? { ...problem, category: { ...problem.category, name: 'Arrays renamed' } }
        : problem,
    )),
    measure('Tag rename reconciliation', () => PERFORMANCE_PROBLEMS.map((problem) => ({
      ...problem,
      tags: problem.tags.map((tag) => tag.id === '1' ? { ...tag, name: 'Array renamed' } : tag),
    }))),
    measure('Tag deletion reconciliation', () => PERFORMANCE_PROBLEMS.map((problem) => ({
      ...problem,
      tags: problem.tags.filter(({ id }) => id !== '1'),
    }))),
  ];
}
