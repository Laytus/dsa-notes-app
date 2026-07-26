import { TestBed } from '@angular/core/testing';
import type { Problem } from '../../../core/api/api.models';
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
      'Name',
      'Category',
      'Tags',
      'Difficulty',
      'Status',
      'Last reviewed',
      'Times solved',
      'Solution',
      'Source',
      'Actions',
    ]);
    expect(fixture.nativeElement.textContent).toContain('Two Sum');
    expect(fixture.nativeElement.textContent).toContain('Arrays');
    expect(fixture.nativeElement.textContent).toContain('Needs review');
    expect(fixture.nativeElement.textContent).toContain('2026-07-25');
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

  it('renders links with API labels and safe new-tab attributes', () => {
    const fixture = createFixture();
    const links = fixture.nativeElement.querySelectorAll(
      '.problem-row a',
    ) as NodeListOf<HTMLAnchorElement>;

    expect(links).toHaveLength(2);
    expect(links[0]?.textContent).toContain('View solution');
    expect(links[0]?.target).toBe('_blank');
    expect(links[0]?.rel).toBe('noopener noreferrer');
    expect(links[1]?.textContent).toContain('LeetCode');
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
