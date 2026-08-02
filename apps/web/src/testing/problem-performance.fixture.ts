import type {
  CategoryResource,
  Difficulty,
  Problem,
  ProblemStatus,
  TagResource,
} from '../app/core/api/api.models';

const categories = [
  'Arrays',
  'Dinámica',
  'Graphs',
  'Linked Lists',
  'Strings',
] as const;
const tags = [
  'Array',
  'Binary Search',
  'DFS',
  'Dynamic Programming',
  'Graph',
  'Hash Map',
  'Heap',
  'Recursion',
] as const;
const difficulties: readonly (Difficulty | null)[] = ['Easy', 'Medium', 'Hard', null];
const statuses: readonly ProblemStatus[] = [
  'To solve',
  'Attempted',
  'Solved',
  'Needs review',
  'Mastered',
];

export const PERFORMANCE_CATEGORIES: readonly CategoryResource[] = categories.map(
  (name, index) => ({
    id: `${index + 1}`,
    name,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  }),
);

export const PERFORMANCE_TAGS: readonly TagResource[] = tags.map((name, index) => ({
  id: `${index + 1}`,
  name,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
}));

function idFor(index: number): string {
  return index % 97 === 0
    ? `${9007199254740993n + BigInt(index)}`
    : `${index + 1}`;
}

export function createPerformanceProblems(count = 1_000): readonly Problem[] {
  return Array.from({ length: count }, (_, index) => {
    const category = PERFORMANCE_CATEGORIES[index % PERFORMANCE_CATEGORIES.length]!;
    const firstTag = PERFORMANCE_TAGS[index % PERFORMANCE_TAGS.length]!;
    const secondTag = PERFORMANCE_TAGS[(index + 3) % PERFORMANCE_TAGS.length]!;
    const isLong = index % 113 === 0;
    const name = index % 25 === 0
      ? 'Repeated benchmark problem'
      : `${category.name} problem ${index + 1}${isLong ? ' with a deliberately long descriptive title' : ''}`;

    return {
      id: idFor(index),
      name,
      category: { id: category.id, name: category.name },
      difficulty: difficulties[index % difficulties.length]!,
      status: statuses[index % statuses.length]!,
      tags: index % 7 === 0
        ? []
        : [
            { id: firstTag.id, name: firstTag.name },
            ...(index % 3 === 0 ? [{ id: secondTag.id, name: secondTag.name }] : []),
          ],
      solution: index % 4 === 0
        ? { url: `https://example.com/solution/${index + 1}`, label: 'View solution' }
        : null,
      source: index % 5 === 0
        ? { url: `https://example.com/problem/${index + 1}`, label: 'LeetCode' }
        : null,
      notes: index % 29 === 0
        ? `Dinámica marker ${index + 1}: raw Markdown with **bold** text and a longer note.`
        : `Benchmark note ${index + 1}${isLong ? ' with additional explanatory text that exercises the compact Notes preview.' : ''}`,
      timesSolved: index % 37,
      lastReviewedOn: index % 6 === 0
        ? null
        : `2026-${String((index % 12) + 1).padStart(2, '0')}-${String((index % 28) + 1).padStart(2, '0')}`,
      createdAt: `2026-01-${String((index % 28) + 1).padStart(2, '0')}T12:00:00.000Z`,
      updatedAt: `2026-02-${String((index % 28) + 1).padStart(2, '0')}T12:00:00.000Z`,
    };
  });
}

export const PERFORMANCE_PROBLEMS = createPerformanceProblems();
