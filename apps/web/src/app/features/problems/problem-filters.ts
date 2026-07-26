import type {
  Difficulty,
  Problem,
  ProblemStatus,
} from '../../core/api/api.models';

export type DifficultyFilter = Difficulty | 'unspecified' | null;

export interface ProblemFilters {
  readonly query: string;
  readonly categoryId: string | null;
  readonly difficulty: DifficultyFilter;
  readonly status: ProblemStatus | null;
  readonly tagIds: readonly string[];
}

export const EMPTY_PROBLEM_FILTERS: ProblemFilters = {
  query: '',
  categoryId: null,
  difficulty: null,
  status: null,
  tagIds: [],
};

export function normalizeSearchText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
}

export function filterProblems(
  problems: readonly Problem[],
  filters: ProblemFilters,
): readonly Problem[] {
  const query = normalizeSearchText(filters.query.trim());

  return problems.filter((problem) => {
    const searchableText = [
      problem.name,
      problem.category.name,
      ...problem.tags.map(({ name }) => name),
      problem.notes,
    ]
      .map(normalizeSearchText)
      .join('\n');

    const matchesSearch = query.length === 0 || searchableText.includes(query);
    const matchesCategory =
      filters.categoryId === null ||
      problem.category.id === filters.categoryId;
    const matchesDifficulty =
      filters.difficulty === null ||
      (filters.difficulty === 'unspecified'
        ? problem.difficulty === null
        : problem.difficulty === filters.difficulty);
    const matchesStatus =
      filters.status === null || problem.status === filters.status;
    const matchesTags =
      filters.tagIds.length === 0 ||
      filters.tagIds.some((selectedTagId) =>
        problem.tags.some(({ id }) => id === selectedTagId),
      );

    return (
      matchesSearch &&
      matchesCategory &&
      matchesDifficulty &&
      matchesStatus &&
      matchesTags
    );
  });
}
