import { TestBed } from '@angular/core/testing';
import type { Problem } from '../../../core/api/api.models';
import { PERFORMANCE_PROBLEMS } from '../../../../testing/problem-performance.fixture';
import { ProblemTable } from './problem-table';

const completeProblem: Problem = {
  id: '12',
  name: 'Two Sum',
  category: { id: '1', name: 'Arrays' },
  difficulty: 'Easy',
  status: 'Needs review',
  tags: [
    { id: '3', name: 'Hash Map' },
    { id: '4', name: 'Array' },
  ],
  solution: {
    url: 'https://example.com/solution',
    label: 'View solution',
  },
  source: {
    url: 'https://leetcode.com/problems/two-sum/',
    label: 'LeetCode',
  },
  notes: 'First line\nSecond <script>alert(1)</script>',
  timesSolved: 2,
  lastReviewedOn: '2026-07-25',
  createdAt: '2026-07-25T18:30:00.000Z',
  updatedAt: '2026-07-25T19:45:00.000Z',
};

const nullableProblem: Problem = {
  ...completeProblem,
  id: '13',
  name: 'Empty fields',
  difficulty: null,
  tags: [],
  solution: null,
  source: null,
  notes: '',
  lastReviewedOn: null,
};

describe('ProblemTable', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProblemTable],
    }).compileComponents();
  });

  function createFixture(problems: readonly Problem[] = [completeProblem]) {
    const fixture = TestBed.createComponent(ProblemTable);
    fixture.componentRef.setInput('problems', problems);
    fixture.componentRef.setInput(
      'editableIds',
      new Set(problems.map(({ id }) => id)),
    );
    fixture.detectChanges();
    return fixture;
  }

  it('renders every collapsed preview column in product-spec order', () => {
    const fixture = createFixture();
    const headers = Array.from(
      fixture.nativeElement.querySelectorAll('thead th'),
      (header: Element) => header.textContent?.trim(),
    );

    expect(headers).toEqual([
      'Expand',
      'Name ↕',
      'Category ↕',
      'Tags',
      'Difficulty ↕',
      'Status',
      'Last reviewed ↕',
      'Times solved',
      'Solution',
      'Source',
      'Notes',
      'Actions',
    ]);
    expect(fixture.nativeElement.textContent).toContain('Two Sum');
    expect(fixture.nativeElement.textContent).toContain('Arrays');
    expect(fixture.nativeElement.textContent).toContain('Needs review');
    expect(fixture.nativeElement.textContent).toContain('2026-07-25');
  });

  it('renders a supplied 100-row progressive block with stable decimal-string tracking IDs', () => {
    const renderedBlock = PERFORMANCE_PROBLEMS.slice(0, 100);
    const fixture = createFixture(renderedBlock);
    const rows = fixture.nativeElement.querySelectorAll(
      '.problem-row',
    ) as NodeListOf<HTMLTableRowElement>;

    expect(rows).toHaveLength(100);
    expect(rows[0]?.dataset['problemId']).toBe('9007199254740993');
    expect(rows[99]?.dataset['problemId']).toBe(renderedBlock[99]?.id);
  });

  it('exposes only product-supported columns as accessible sort buttons', () => {
    const fixture = createFixture();
    const buttons = fixture.nativeElement.querySelectorAll(
      '.sort-button',
    ) as NodeListOf<HTMLButtonElement>;

    expect(Array.from(buttons, ({ textContent }) => textContent?.trim())).toEqual([
      'Name ↕',
      'Category ↕',
      'Difficulty ↕',
      'Last reviewed ↕',
    ]);
    expect(buttons[0]?.type).toBe('button');
    expect(buttons[0]?.getAttribute('aria-label')).toBe('Sort by Name ascending');
    expect(fixture.nativeElement.querySelector('th[aria-sort="none"]')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.status .sort-button')).toBeNull();
  });

  it('announces the active sort direction and emits the selected field', () => {
    const fixture = createFixture();
    const emitted = vi.fn();
    fixture.componentInstance.sortRequested.subscribe(emitted);
    fixture.componentRef.setInput('activeSort', {
      field: 'name' as const,
      direction: 'ascending' as const,
    });
    fixture.detectChanges();

    const nameHeader = fixture.nativeElement.querySelector(
      'th[aria-sort="ascending"]',
    ) as HTMLTableCellElement;
    const button = nameHeader.querySelector('.sort-button') as HTMLButtonElement;
    expect(button.getAttribute('aria-label')).toBe('Sort by Name descending');
    button.click();
    expect(emitted).toHaveBeenCalledWith('name');
  });

  it('renders tags in API order and explicit placeholders for empty values', () => {
    const fixture = createFixture([completeProblem, nullableProblem]);
    const tagNames = Array.from(
      fixture.nativeElement.querySelectorAll(
        '[data-problem-id="12"] .tag-list li',
      ),
      (tag: Element) => tag.textContent?.trim(),
    );
    expect(tagNames).toEqual(['Hash Map', 'Array']);

    const nullableRow = fixture.nativeElement.querySelector(
      '[data-problem-id="13"]',
    ) as HTMLTableRowElement;
    expect(nullableRow.textContent).toContain('—');
    expect(nullableRow.querySelector('a')).toBeNull();
  });

  it('uses the documented sticky cells and compact previews without making details sticky', () => {
    const fixture = createFixture();
    const stickyHeaders = fixture.nativeElement.querySelectorAll(
      'thead .sticky-cell',
    );
    const row = fixture.nativeElement.querySelector(
      '[data-problem-id="12"]',
    ) as HTMLTableRowElement;

    expect(fixture.nativeElement.querySelector('.table-region')?.getAttribute('aria-label')).toBe('Problems table');
    expect(stickyHeaders).toHaveLength(7);
    expect(row.querySelectorAll('.sticky-cell')).toHaveLength(7);
    expect(row.querySelector('.sticky-actions')).not.toBeNull();
    expect(row.querySelector('.notes-preview')?.textContent).toContain('First line');
    expect(row.querySelector('.notes-preview')?.getAttribute('title')).toContain('Second');

    fixture.componentInstance.toggle('12');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.details-row .sticky-cell')).toBeNull();
    expect(fixture.nativeElement.querySelector('.details-row td')?.getAttribute('colspan')).toBe('12');
  });

  it('groups actions separately and constrains expanded content without sticky cells', () => {
    const fixture = createFixture();
    const row = fixture.nativeElement.querySelector(
      '[data-problem-id="12"]',
    ) as HTMLTableRowElement;

    expect(row.querySelector('.actions-group')).not.toBeNull();
    expect(row.querySelector('.actions-group .edit-button')).not.toBeNull();
    expect(row.querySelector('.actions-group .review-button')).not.toBeNull();
    expect(row.querySelector('.actions-group .delete-button')).not.toBeNull();
    expect(row.querySelector('.sticky-actions.right-sticky-opaque.actions-sticky-layer')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('thead .sticky-actions.right-sticky-opaque.actions-sticky-layer')).not.toBeNull();
    expect(row.querySelector('.left-boundary-wide')).not.toBeNull();
    expect(row.querySelector('.left-boundary-medium')).not.toBeNull();
    expect(row.querySelector('.left-boundary-narrow')).not.toBeNull();
    fixture.componentInstance.toggle('12');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.expanded-content')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.expanded-notes')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.expanded-metadata')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.details-row .sticky-actions')).toBeNull();
    expect(fixture.nativeElement.querySelector('.details-grid .expanded-notes')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.details-grid .expanded-metadata')).not.toBeNull();
  });

  it('initializes inline Category editing with the current exact string ID', () => {
    const fixture = createFixture([
      {
        ...completeProblem,
        category: { id: '9007199254740993', name: 'Graphs' },
      },
    ]);
    fixture.componentRef.setInput('categories', [
      { id: '1', name: 'Arrays', createdAt: '', updatedAt: '' },
      { id: '9007199254740993', name: 'Graphs', createdAt: '', updatedAt: '' },
    ]);
    fixture.componentRef.setInput('inlineEdit', {
      problemId: '12',
      field: 'categoryId',
      originalValue: '9007199254740993',
      draft: '9007199254740993',
    });
    fixture.detectChanges();

    const select = fixture.nativeElement.querySelector(
      'select[aria-label="Edit category for Two Sum"]',
    ) as HTMLSelectElement;
    expect(select.value).toBe('9007199254740993');
    expect(select.options[1]?.selected).toBe(true);

    const emitted = vi.fn();
    fixture.componentInstance.inlineDraftChanged.subscribe(emitted);
    select.value = '1';
    select.dispatchEvent(new Event('change'));
    expect(emitted).toHaveBeenCalledWith('1');
  });

  it('initializes Difficulty and Status editors from their exact hydrated values', () => {
    const fixture = createFixture([{ ...completeProblem, difficulty: 'Medium' }]);
    fixture.componentRef.setInput('difficulties', ['Easy', 'Medium', 'Hard']);
    fixture.componentRef.setInput('statuses', [
      'To solve',
      'Attempted',
      'Solved',
      'Needs review',
      'Mastered',
    ]);
    fixture.componentRef.setInput('inlineEdit', {
      problemId: '12', field: 'difficulty', originalValue: 'Medium', draft: 'Medium',
    });
    fixture.detectChanges();

    const difficulty = fixture.nativeElement.querySelector(
      'select[aria-label="Edit difficulty for Two Sum"]',
    ) as HTMLSelectElement;
    expect(difficulty.value).toBe('Medium');

    const changedDifficulty = vi.fn();
    fixture.componentInstance.inlineDraftChanged.subscribe(changedDifficulty);
    difficulty.value = 'Easy';
    difficulty.dispatchEvent(new Event('change'));
    expect(changedDifficulty).toHaveBeenCalledWith('Easy');

    fixture.componentRef.setInput('inlineEdit', {
      problemId: '12', field: 'status', originalValue: 'Needs review', draft: 'Needs review',
    });
    fixture.detectChanges();
    const status = fixture.nativeElement.querySelector(
      'select[aria-label="Edit status for Two Sum"]',
    ) as HTMLSelectElement;
    expect(status.value).toBe('Needs review');
    status.value = 'To solve';
    status.dispatchEvent(new Event('change'));
    expect(changedDifficulty).toHaveBeenCalledWith('To solve');
  });

  it('selects the Unspecified Difficulty sentinel for a null hydrated value', () => {
    const fixture = createFixture([nullableProblem]);
    fixture.componentRef.setInput('difficulties', ['Easy', 'Medium', 'Hard']);
    fixture.componentRef.setInput('inlineEdit', {
      problemId: '13', field: 'difficulty', originalValue: '', draft: '',
    });
    fixture.detectChanges();

    const select = fixture.nativeElement.querySelector(
      'select[aria-label="Edit difficulty for Empty fields"]',
    ) as HTMLSelectElement;
    expect(select.value).toBe('');
    expect(select.options[0]?.selected).toBe(true);
  });

  it('bounds the visual tag preview while retaining the complete accessible tag label', () => {
    const fixture = createFixture([
      {
        ...completeProblem,
        tags: [
          { id: '1', name: 'Array' },
          { id: '2', name: 'Hash Map' },
          { id: '3', name: 'Two Pointers' },
        ],
      },
    ]);
    const list = fixture.nativeElement.querySelector('.tag-list') as HTMLUListElement;

    expect(Array.from(list.querySelectorAll('li'), ({ textContent }) => textContent?.trim())).toEqual([
      'Array',
      'Hash Map',
      '+1',
    ]);
    expect(list.getAttribute('aria-label')).toContain('Two Pointers');
    expect(list.querySelectorAll('.tag-chip')).toHaveLength(3);
    expect(list.querySelector('.tag-remainder')).not.toBeNull();
  });

  it('renders links with API labels and safe new-tab attributes', () => {
    const fixture = createFixture();
    const links = fixture.nativeElement.querySelectorAll(
      '.problem-row a',
    ) as NodeListOf<HTMLAnchorElement>;

    expect(links).toHaveLength(2);
    expect(links[0]?.textContent).toContain('View solution');
    expect(links[0]?.target).toBe('_blank');
    expect(links[0]?.rel).toBe('noopener noreferrer');
    expect(links[0]?.classList).toContain('problem-link');
    expect(links[1]?.classList).toContain('source-link');
    expect(links[1]?.textContent).toContain('LeetCode');
    expect(fixture.nativeElement.querySelector('.badge.difficulty')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.badge.status')).not.toBeNull();
  });

  it('starts collapsed, expands safely, and collapses again', () => {
    const fixture = createFixture();
    const button = fixture.nativeElement.querySelector(
      '.expand-button',
    ) as HTMLButtonElement;

    expect(button.getAttribute('aria-expanded')).toBe('false');
    expect(button.getAttribute('aria-label')).toContain('Two Sum');
    expect(fixture.nativeElement.querySelector('.details-row')).toBeNull();

    button.click();
    fixture.detectChanges();
    expect(button.getAttribute('aria-expanded')).toBe('true');
    const details = fixture.nativeElement.querySelector(
      '.details-row',
    ) as HTMLTableRowElement;
    expect(details.textContent).toContain('First line\nSecond');
    expect(details.querySelector('script')).toBeNull();
    expect(details.id).toBe(button.getAttribute('aria-controls'));
    expect(details.textContent).toContain('2026-07-25 18:30:00 UTC');

    button.click();
    fixture.detectChanges();
    expect(button.getAttribute('aria-expanded')).toBe('false');
    expect(fixture.nativeElement.querySelector('.details-row')).toBeNull();
  });

  it('supports multiple expanded rows and an empty-notes placeholder', () => {
    const fixture = createFixture([completeProblem, nullableProblem]);
    const buttons = fixture.nativeElement.querySelectorAll(
      '.expand-button',
    ) as NodeListOf<HTMLButtonElement>;
    buttons[0]?.click();
    buttons[1]?.click();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelectorAll('.details-row')).toHaveLength(
      2,
    );
    expect(fixture.nativeElement.textContent).toContain(
      'No notes have been added.',
    );
  });

  it('tracks rendered rows by stable problem ID', () => {
    const fixture = createFixture([completeProblem]);
    const originalRow = fixture.nativeElement.querySelector(
      '[data-problem-id="12"]',
    );
    fixture.componentRef.setInput('problems', [
      { ...completeProblem, name: 'Two Sum updated' },
    ]);
    fixture.detectChanges();

    expect(
      fixture.nativeElement.querySelector('[data-problem-id="12"]'),
    ).toBe(originalRow);
    expect(originalRow.textContent).toContain('Two Sum updated');
  });

  it('exposes an accessible per-problem Edit action without changing expansion', () => {
    const fixture = createFixture();
    const component = fixture.componentInstance;
    const emitted = vi.fn();
    component.editRequested.subscribe(emitted);
    const expandButton = fixture.nativeElement.querySelector(
      '.expand-button',
    ) as HTMLButtonElement;
    expandButton.click();
    fixture.detectChanges();

    const editButton = fixture.nativeElement.querySelector(
      '.edit-button',
    ) as HTMLButtonElement;
    expect(editButton.getAttribute('aria-label')).toBe('Edit Two Sum');
    editButton.click();
    expect(emitted).toHaveBeenCalledWith(completeProblem);
    expect(component.isExpanded(completeProblem.id)).toBe(true);

    component.focusEditButton(completeProblem.id);
    expect(document.activeElement).toBe(editButton);
  });

  it('opens one accessible inline editor and exposes explicit Save and Cancel controls', () => {
    const fixture = createFixture();
    const requested = vi.fn();
    fixture.componentInstance.inlineEditRequested.subscribe(requested);
    const trigger = fixture.nativeElement.querySelector(
      '[data-field="name"]',
    ) as HTMLButtonElement;

    trigger.click();
    expect(requested).toHaveBeenCalledWith({
      problem: completeProblem,
      field: 'name',
    });

    fixture.componentRef.setInput('inlineEdit', {
      problemId: completeProblem.id,
      field: 'name' as const,
      originalValue: completeProblem.name,
      draft: 'Changed',
    });
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.inline-editor')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.inline-save')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.inline-cancel')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.inline-editor')).toHaveProperty(
      'value',
      'Changed',
    );
  });

  it('disables Edit with an accessible explanation when a category is unavailable', () => {
    const fixture = createFixture();
    fixture.componentRef.setInput('editableIds', new Set<string>());
    fixture.detectChanges();

    const editButton = fixture.nativeElement.querySelector(
      '.edit-button',
    ) as HTMLButtonElement;
    const descriptionId = editButton.getAttribute('aria-describedby');
    expect(editButton.disabled).toBe(true);
    expect(descriptionId).not.toBeNull();
    expect(
      fixture.nativeElement.querySelector(`#${descriptionId}`).textContent,
    ).toContain('current category is not loaded');
  });

  it('exposes an accessible Delete action for each problem', () => {
    const fixture = createFixture([completeProblem, nullableProblem]);
    const emitted = vi.fn();
    fixture.componentInstance.deleteRequested.subscribe(emitted);
    const buttons = fixture.nativeElement.querySelectorAll(
      '.delete-button',
    ) as NodeListOf<HTMLButtonElement>;

    expect(buttons).toHaveLength(2);
    expect(buttons[0]?.getAttribute('aria-label')).toBe('Delete Two Sum');
    expect(buttons[1]?.getAttribute('aria-label')).toBe('Delete Empty fields');
    buttons[0]?.click();
    expect(emitted).toHaveBeenCalledWith(completeProblem);
  });

  it('exposes a native accessible Duplicate action without changing expansion', () => {
    const fixture = createFixture();
    const component = fixture.componentInstance;
    const duplicate = fixture.nativeElement.querySelector(
      '.duplicate-button',
    ) as HTMLButtonElement;

    expect(duplicate.tagName).toBe('BUTTON');
    expect(duplicate.getAttribute('aria-label')).toBe('Duplicate Two Sum');
    duplicate.click();

    expect(component.isExpanded(completeProblem.id)).toBe(false);
  });

  it('isolates duplication pending, errors, and same-row action disabling', () => {
    const fixture = createFixture([completeProblem, nullableProblem]);
    fixture.componentRef.setInput(
      'duplicatingIds',
      new Set([completeProblem.id]),
    );
    fixture.componentRef.setInput(
      'duplicateErrors',
      new Map([[completeProblem.id, 'The problem could not be duplicated.']]),
    );
    fixture.detectChanges();

    const sourceRow = fixture.nativeElement.querySelector(
      '[data-problem-id="12"]',
    ) as HTMLTableRowElement;
    const otherRow = fixture.nativeElement.querySelector(
      '[data-problem-id="13"]',
    ) as HTMLTableRowElement;
    expect(
      (sourceRow.querySelector('.duplicate-button') as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    expect(sourceRow.textContent).toContain('Duplicating');
    expect(
      (sourceRow.querySelector('.edit-button') as HTMLButtonElement).disabled,
    ).toBe(true);
    expect(
      (sourceRow.querySelector('.review-button') as HTMLButtonElement).disabled,
    ).toBe(true);
    expect(
      (sourceRow.querySelector('.delete-button') as HTMLButtonElement).disabled,
    ).toBe(true);
    expect(sourceRow.querySelector('[role="alert"]')?.textContent).toContain(
      'could not be duplicated',
    );
    expect(
      (otherRow.querySelector('.duplicate-button') as HTMLButtonElement)
        .disabled,
    ).toBe(false);
    expect(
      (otherRow.querySelector('.edit-button') as HTMLButtonElement).disabled,
    ).toBe(false);
  });

  it('disables only the pending row actions and announces its delete error', () => {
    const fixture = createFixture([completeProblem, nullableProblem]);
    fixture.componentRef.setInput('deletingIds', new Set(['12']));
    fixture.componentRef.setInput(
      'deleteErrors',
      new Map([['12', 'The problem could not be deleted. Try again.']]),
    );
    fixture.detectChanges();

    const rows = fixture.nativeElement.querySelectorAll(
      '.problem-row',
    ) as NodeListOf<HTMLTableRowElement>;
    const firstDelete = rows[0]?.querySelector(
      '.delete-button',
    ) as HTMLButtonElement;
    const secondDelete = rows[1]?.querySelector(
      '.delete-button',
    ) as HTMLButtonElement;
    expect(firstDelete.disabled).toBe(true);
    expect(firstDelete.textContent).toContain('Deleting');
    expect(
      (rows[0]?.querySelector('.edit-button') as HTMLButtonElement).disabled,
    ).toBe(true);
    expect(secondDelete.disabled).toBe(false);
    expect(rows[0]?.querySelector('[role="alert"]')?.textContent).toContain(
      'could not be deleted',
    );
  });

  it('removes only the deleted problem from expansion state', () => {
    const fixture = createFixture([completeProblem, nullableProblem]);
    fixture.componentInstance.toggle('12');
    fixture.componentInstance.toggle('13');

    fixture.componentInstance.removeExpanded('12');

    expect(fixture.componentInstance.isExpanded('12')).toBe(false);
    expect(fixture.componentInstance.isExpanded('13')).toBe(true);
  });

  it('exposes an accessible Mark reviewed action for every problem', () => {
    const fixture = createFixture([completeProblem, nullableProblem]);
    const emitted = vi.fn();
    fixture.componentInstance.reviewRequested.subscribe(emitted);
    const buttons = fixture.nativeElement.querySelectorAll(
      '.review-button',
    ) as NodeListOf<HTMLButtonElement>;

    expect(buttons).toHaveLength(2);
    expect(buttons[0]?.getAttribute('aria-label')).toBe(
      'Mark Two Sum reviewed',
    );
    expect(buttons[1]?.getAttribute('aria-label')).toBe(
      'Mark Empty fields reviewed',
    );
    buttons[0]?.click();
    expect(emitted).toHaveBeenCalledWith(completeProblem);
  });

  it('isolates pending review state and its accessible error to one row', () => {
    const fixture = createFixture([completeProblem, nullableProblem]);
    fixture.componentRef.setInput('reviewingIds', new Set(['12']));
    fixture.componentRef.setInput(
      'reviewErrors',
      new Map([['12', 'The review was not saved.']]),
    );
    fixture.detectChanges();
    const rows = fixture.nativeElement.querySelectorAll(
      '.problem-row',
    ) as NodeListOf<HTMLTableRowElement>;
    const firstReview = rows[0]?.querySelector(
      '.review-button',
    ) as HTMLButtonElement;
    const secondReview = rows[1]?.querySelector(
      '.review-button',
    ) as HTMLButtonElement;

    expect(firstReview.disabled).toBe(true);
    expect(firstReview.textContent).toContain('Updating');
    expect(
      (rows[0]?.querySelector('.edit-button') as HTMLButtonElement).disabled,
    ).toBe(true);
    expect(
      (rows[0]?.querySelector('.delete-button') as HTMLButtonElement).disabled,
    ).toBe(true);
    expect(secondReview.disabled).toBe(false);
    expect(rows[0]?.querySelector('[role="alert"]')?.textContent).toContain(
      'review was not saved',
    );
  });

  it('communicates why a review action is unavailable', () => {
    const fixture = createFixture();
    fixture.componentRef.setInput(
      'reviewDisabledReasons',
      new Map([['12', 'Times solved has reached its maximum.']]),
    );
    fixture.detectChanges();
    const button = fixture.nativeElement.querySelector(
      '.review-button',
    ) as HTMLButtonElement;
    const descriptionId = button.getAttribute('aria-describedby');

    expect(button.disabled).toBe(true);
    expect(descriptionId).not.toBeNull();
    expect(
      fixture.nativeElement.querySelector(`#${descriptionId}`).textContent,
    ).toContain('maximum');
  });
});
