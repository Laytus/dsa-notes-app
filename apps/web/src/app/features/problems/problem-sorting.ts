import type { Problem } from '../../core/api/api.models';

export type ProblemSortField = 'name' | 'category' | 'difficulty' | 'lastReviewedOn';
export type ProblemSortDirection = 'ascending' | 'descending';

export interface ProblemSort {
  readonly field: ProblemSortField;
  readonly direction: ProblemSortDirection;
}

const difficultyRank: Readonly<Record<NonNullable<Problem['difficulty']>, number>> = {
  Easy: 0,
  Medium: 1,
  Hard: 2,
};

export function compareDecimalIds(left: string, right: string): number {
  const leftId = BigInt(left);
  const rightId = BigInt(right);
  return leftId < rightId ? -1 : leftId > rightId ? 1 : 0;
}

export function compareDefaultProblems(left: Problem, right: Problem): number {
  return compareText(left.name, right.name) || compareDecimalIds(left.id, right.id);
}

export function sortProblems(
  problems: readonly Problem[],
  sort: ProblemSort | null,
): readonly Problem[] {
  if (sort === null) return problems;
  return [...problems].sort((left, right) => compareBySort(left, right, sort));
}

function compareBySort(left: Problem, right: Problem, sort: ProblemSort): number {
  const direction = sort.direction === 'ascending' ? 1 : -1;
  const primary = (() => {
    switch (sort.field) {
      case 'name':
        return compareText(left.name, right.name) * direction;
      case 'category': {
        const byName = compareText(left.category.name, right.category.name);
        return byName !== 0
          ? byName * direction
          : compareDecimalIds(left.category.id, right.category.id) * direction;
      }
      case 'difficulty':
        return compareDifficulty(left, right, direction);
      case 'lastReviewedOn':
        return compareLastReviewed(left, right, direction);
    }
  })();
  return primary || compareDecimalIds(left.id, right.id);
}

function compareText(left: string, right: string): number {
  const normalizedLeft = left.toLowerCase();
  const normalizedRight = right.toLowerCase();
  return normalizedLeft < normalizedRight ? -1 : normalizedLeft > normalizedRight ? 1 : 0;
}

function compareDifficulty(left: Problem, right: Problem, direction: number): number {
  if (left.difficulty === null || right.difficulty === null) {
    if (left.difficulty === right.difficulty) return 0;
    return left.difficulty === null ? 1 : -1;
  }
  return (difficultyRank[left.difficulty] - difficultyRank[right.difficulty]) * direction;
}

function compareLastReviewed(left: Problem, right: Problem, direction: number): number {
  if (left.lastReviewedOn === null || right.lastReviewedOn === null) {
    if (left.lastReviewedOn === right.lastReviewedOn) return 0;
    return left.lastReviewedOn === null ? 1 : -1;
  }
  return (left.lastReviewedOn < right.lastReviewedOn ? -1 : left.lastReviewedOn > right.lastReviewedOn ? 1 : 0) * direction;
}
