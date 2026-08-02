import type { CategoryResource, Problem } from '../../core/api/api.models';
import {
  initialInlineValue,
  inlineUpdateRequest,
  type InlineProblemEdit,
} from './inline-problem-edit';

const categories: readonly CategoryResource[] = [
  { id: '9007199254740993', name: 'Arrays', createdAt: '', updatedAt: '' },
];

const problem: Problem = {
  id: '9007199254740993',
  name: 'Two Sum',
  category: { id: '2', name: 'Arrays' },
  difficulty: 'Medium',
  status: 'Needs review',
  tags: [], solution: null, source: null, notes: '', timesSolved: 10,
  lastReviewedOn: null, createdAt: '', updatedAt: '',
};

function edit(field: InlineProblemEdit['field'], draft: string, originalValue = ''): InlineProblemEdit {
  return { problemId: '9007199254740993', field, originalValue, draft };
}

describe('inlineUpdateRequest', () => {
  it('initializes every inline-editable field from the hydrated Problem', () => {
    expect(initialInlineValue(problem, 'name')).toBe('Two Sum');
    expect(initialInlineValue(problem, 'categoryId')).toBe('2');
    expect(initialInlineValue(problem, 'difficulty')).toBe('Medium');
    expect(initialInlineValue(problem, 'status')).toBe('Needs review');
    expect(initialInlineValue(problem, 'timesSolved')).toBe('10');
    expect(initialInlineValue({ ...problem, difficulty: null }, 'difficulty')).toBe('');
  });
  it('trims names and produces a field-only payload', () => {
    expect(inlineUpdateRequest(edit('name', ' Two Sum ', 'Two Sum'), categories)).toEqual({ request: { name: 'Two Sum' } });
  });

  it('rejects empty names and invalid categories', () => {
    expect(inlineUpdateRequest(edit('name', '   ', 'Two Sum'), categories)).toEqual({ error: 'Name cannot be empty.' });
    expect(inlineUpdateRequest(edit('categoryId', '2', '1'), categories)).toEqual({ error: 'Choose an available category.' });
  });

  it('preserves string category IDs and supports unspecified difficulty', () => {
    expect(inlineUpdateRequest(edit('categoryId', '9007199254740993', '1'), categories)).toEqual({ request: { categoryId: '9007199254740993' } });
    expect(inlineUpdateRequest(edit('difficulty', '', 'Easy'), categories)).toEqual({ request: { difficulty: null } });
  });

  it('validates Times solved without sending Last reviewed', () => {
    expect(inlineUpdateRequest(edit('timesSolved', '-1', '1'), categories)).toEqual({ error: 'Times solved must be a non-negative integer.' });
    expect(inlineUpdateRequest(edit('timesSolved', '1.5', '1'), categories)).toEqual({ error: 'Times solved must be a non-negative integer.' });
    expect(inlineUpdateRequest(edit('timesSolved', '2', '1'), categories)).toEqual({ request: { timesSolved: 2 } });
  });

  it('does not create a request for unchanged values', () => {
    expect(inlineUpdateRequest(edit('status', 'Solved', 'Solved'), categories)).toBeNull();
  });
});
