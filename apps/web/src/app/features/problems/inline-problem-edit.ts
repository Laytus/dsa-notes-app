import type {
  CategoryResource,
  Difficulty,
  Problem,
  ProblemStatus,
  UpdateProblemRequest,
} from '../../core/api/api.models';
import { POSTGRES_INTEGER_MAX } from './problem-review';

export type InlineProblemField =
  | 'name'
  | 'categoryId'
  | 'difficulty'
  | 'status'
  | 'timesSolved';

export interface InlineProblemEdit {
  readonly problemId: string;
  readonly field: InlineProblemField;
  readonly originalValue: string;
  readonly draft: string;
}

export function initialInlineValue(problem: Problem, field: InlineProblemField): string {
  switch (field) {
    case 'name': return problem.name;
    case 'categoryId': return problem.category.id;
    case 'difficulty': return problem.difficulty ?? '';
    case 'status': return problem.status;
    case 'timesSolved': return `${problem.timesSolved}`;
  }
}

export function inlineUpdateRequest(
  edit: InlineProblemEdit,
  categories: readonly CategoryResource[],
): { readonly request: UpdateProblemRequest } | { readonly error: string } | null {
  if (edit.draft === edit.originalValue) return null;

  switch (edit.field) {
    case 'name': {
      const name = edit.draft.trim();
      return name.length > 0
        ? { request: { name } }
        : { error: 'Name cannot be empty.' };
    }
    case 'categoryId':
      return categories.some(({ id }) => id === edit.draft)
        ? { request: { categoryId: edit.draft } }
        : { error: 'Choose an available category.' };
    case 'difficulty':
      return edit.draft === '' || isDifficulty(edit.draft)
        ? { request: { difficulty: edit.draft === '' ? null : edit.draft } }
        : { error: 'Choose a valid difficulty.' };
    case 'status':
      return isStatus(edit.draft)
        ? { request: { status: edit.draft } }
        : { error: 'Choose a valid status.' };
    case 'timesSolved': {
      if (!/^\d+$/u.test(edit.draft)) {
        return { error: 'Times solved must be a non-negative integer.' };
      }
      const timesSolved = Number(edit.draft);
      return Number.isSafeInteger(timesSolved) && timesSolved <= POSTGRES_INTEGER_MAX
        ? { request: { timesSolved } }
        : { error: 'Times solved is outside the supported range.' };
    }
  }
}

function isDifficulty(value: string): value is Difficulty {
  return value === 'Easy' || value === 'Medium' || value === 'Hard';
}

function isStatus(value: string): value is ProblemStatus {
  return ['To solve', 'Attempted', 'Solved', 'Needs review', 'Mastered'].includes(value);
}
