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
});
