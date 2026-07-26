import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';
import type {
  CategoryResource,
  CreateProblemRequest,
  Problem,
  TagResource,
} from '../../../core/api/api.models';
import { ProblemsApiService } from '../../../core/api/problems-api.service';
import {
  CreateProblemPanel,
  strictOptionalDate,
} from './create-problem-panel';
import { FormControl } from '@angular/forms';

const categories: readonly CategoryResource[] = [
  {
    id: '10',
    name: 'Arrays',
    createdAt: '2026-07-25T18:00:00.000Z',
    updatedAt: '2026-07-25T18:00:00.000Z',
  },
];

const tags: readonly TagResource[] = [
  {
    id: '20',
    name: 'Hash Map',
    createdAt: '2026-07-25T18:00:00.000Z',
    updatedAt: '2026-07-25T18:00:00.000Z',
  },
];

const createdProblem: Problem = {
  id: '30',
  name: 'Two Sum',
  category: { id: '10', name: 'Arrays' },
  difficulty: 'Easy',
  status: 'Solved',
  tags: [{ id: '20', name: 'Hash Map' }],
  solution: {
    url: 'https://example.com/solution',
    label: 'View solution',
  },
  source: null,
  notes: 'First line\nSecond line',
  timesSolved: 2,
  lastReviewedOn: '2026-07-25',
  createdAt: '2026-07-25T18:30:00.000Z',
  updatedAt: '2026-07-25T18:30:00.000Z',
};

describe('CreateProblemPanel', () => {
  let createResponse: Subject<Problem>;
  let createProblem: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    createResponse = new Subject();
    createProblem = vi.fn(() => createResponse);

    await TestBed.configureTestingModule({
      imports: [CreateProblemPanel],
      providers: [
        {
          provide: ProblemsApiService,
          useValue: { createProblem },
        },
      ],
    }).compileComponents();
  });

  function createFixture(tagsAvailable = true) {
    const fixture = TestBed.createComponent(CreateProblemPanel);
    fixture.componentRef.setInput('categories', categories);
    fixture.componentRef.setInput('tags', tagsAvailable ? tags : []);
    fixture.componentRef.setInput('tagsAvailable', tagsAvailable);
    fixture.detectChanges();
    return fixture;
  }

  it('renders associated fields, focuses Name, and uses product defaults', () => {
    const fixture = createFixture();
    const component = fixture.componentInstance;

    expect(component.form.getRawValue()).toEqual({
      name: '',
      categoryId: '',
      difficulty: null,
      status: 'To solve',
      tagIds: [],
      solutionUrl: '',
      solutionLabel: 'View solution',
      sourceUrl: '',
      sourceLabel: 'LeetCode',
      notes: '',
      timesSolved: 0,
      lastReviewedOn: '',
    });
    expect(document.activeElement).toBe(
      fixture.nativeElement.querySelector('#problem-name'),
    );
    for (const input of fixture.nativeElement.querySelectorAll(
      'input, select, textarea',
    ) as NodeListOf<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) {
      expect(input.labels?.length).toBeGreaterThan(0);
    }
    expect(
      fixture.nativeElement.querySelectorAll('input[type="checkbox"]'),
    ).toHaveLength(1);
  });

  it('guards invalid required fields and exposes accessible errors', async () => {
    const fixture = createFixture();
    const component = fixture.componentInstance;
    component.form.controls.name.setValue('   ');
    component.submit();
    await new Promise<void>((resolve) => queueMicrotask(resolve));
    fixture.detectChanges();

    expect(createProblem).not.toHaveBeenCalled();
    expect(
      fixture.nativeElement
        .querySelector('#problem-name')
        .getAttribute('aria-invalid'),
    ).toBe('true');
    expect(
      fixture.nativeElement
        .querySelector('#problem-category')
        .getAttribute('aria-invalid'),
    ).toBe('true');
    expect(document.activeElement).toBe(
      fixture.nativeElement.querySelector('#problem-name'),
    );
  });

  it.each([
    ['solutionUrl', 'relative/path'],
    ['solutionUrl', 'ftp://example.com/file'],
    ['sourceUrl', 'not a URL'],
  ] as const)('rejects invalid %s value %s', (control, value) => {
    const fixture = createFixture();
    fixture.componentInstance.form.controls[control].setValue(value);
    expect(fixture.componentInstance.form.controls[control].invalid).toBe(true);
  });

  it('rejects negative, decimal, and impossible date values', () => {
    const fixture = createFixture();
    const controls = fixture.componentInstance.form.controls;
    controls.timesSolved.setValue(-1);
    expect(controls.timesSolved.invalid).toBe(true);
    controls.timesSolved.setValue(1.5);
    expect(controls.timesSolved.invalid).toBe(true);
    controls.lastReviewedOn.setValue('2026-02-30');
    expect(controls.lastReviewedOn.invalid).toBe(true);
    expect(
      strictOptionalDate(new FormControl('2024-02-29', { nonNullable: true })),
    ).toBeNull();
  });

  it('normalizes values, preserves notes, and guards duplicate submission', () => {
    const fixture = createFixture();
    const component = fixture.componentInstance;
    component.form.patchValue({
      name: ' Two  Sum ',
      categoryId: '10',
      difficulty: 'Easy',
      status: 'Solved',
      solutionUrl: ' https://example.com/solution ',
      solutionLabel: ' ',
      sourceUrl: '',
      sourceLabel: 'Label without URL',
      notes: 'First line\nSecond line',
      timesSolved: 2,
      lastReviewedOn: '2026-07-25',
    });
    const checkbox = fixture.nativeElement.querySelector(
      'input[type="checkbox"]',
    ) as HTMLInputElement;
    checkbox.click();
    fixture.detectChanges();

    component.submit();
    component.submit();

    expect(createProblem).toHaveBeenCalledTimes(1);
    expect(createProblem).toHaveBeenCalledWith({
      name: 'Two  Sum',
      categoryId: '10',
      difficulty: 'Easy',
      status: 'Solved',
      tagIds: ['20'],
      solution: {
        url: 'https://example.com/solution',
        label: 'View solution',
      },
      source: null,
      notes: 'First line\nSecond line',
      timesSolved: 2,
      lastReviewedOn: '2026-07-25',
    } satisfies CreateProblemRequest);
    expect(component.saving()).toBe(true);
  });

  it('retains entered values and shows safe API errors', () => {
    const fixture = createFixture();
    const component = fixture.componentInstance;
    component.form.patchValue({ name: 'Two Sum', categoryId: '10' });
    component.submit();
    createResponse.error(
      new HttpErrorResponse({
        status: 400,
        error: {
          error: {
            code: 'TAG_REFERENCE_NOT_FOUND',
            message: 'postgres secret raw detail',
          },
        },
      }),
    );
    fixture.detectChanges();

    expect(component.form.controls.name.value).toBe('Two Sum');
    expect(fixture.nativeElement.textContent).toContain(
      'One or more selected tags are no longer available.',
    );
    expect(fixture.nativeElement.textContent).not.toContain('postgres secret');
  });

  it('resets and emits the created problem after success', () => {
    const fixture = createFixture();
    const component = fixture.componentInstance;
    const emitted = vi.fn();
    component.created.subscribe(emitted);
    component.form.patchValue({ name: 'Two Sum', categoryId: '10' });
    component.submit();
    createResponse.next(createdProblem);
    createResponse.complete();

    expect(emitted).toHaveBeenCalledWith(createdProblem);
    expect(component.form.controls.name.value).toBe('');
    expect(component.form.controls.status.value).toBe('To solve');
    expect(component.form.controls.timesSolved.value).toBe(0);
  });

  it('closes pristine forms and confirms before discarding dirty forms', () => {
    const fixture = createFixture();
    const component = fixture.componentInstance;
    const closed = vi.fn();
    component.closed.subscribe(closed);

    component.requestClose();
    expect(closed).toHaveBeenCalledTimes(1);

    component.form.controls.name.setValue('Dirty');
    component.form.controls.name.markAsDirty();
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    component.requestClose();
    expect(closed).toHaveBeenCalledTimes(1);
    expect(confirm).toHaveBeenCalled();

    confirm.mockReturnValue(true);
    component.requestClose();
    expect(closed).toHaveBeenCalledTimes(2);
    confirm.mockRestore();
  });

  it('allows creation without tag controls when tags failed', () => {
    const fixture = createFixture(false);
    expect(fixture.nativeElement.textContent).toContain(
      'You can still create without tags.',
    );
    expect(
      fixture.nativeElement.querySelector('input[type="checkbox"]'),
    ).toBeNull();
  });
});
