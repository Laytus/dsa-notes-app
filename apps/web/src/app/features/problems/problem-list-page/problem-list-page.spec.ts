import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { Observable, of, Subject } from 'rxjs';
import type {
  CategoryResource,
  Problem,
  TagResource,
} from '../../../core/api/api.models';
import { CategoriesApiService } from '../../../core/api/categories-api.service';
import { ProblemsApiService } from '../../../core/api/problems-api.service';
import { TagsApiService } from '../../../core/api/tags-api.service';
import { CreateProblemPanel } from '../create-problem-panel/create-problem-panel';
import { ProblemListPage } from './problem-list-page';

const problem: Problem = {
  id: '1',
  name: 'Two Sum',
  category: { id: '1', name: 'Arrays' },
  difficulty: 'Easy',
  status: 'Solved',
  tags: [],
  solution: null,
  source: null,
  notes: '',
  timesSolved: 1,
  lastReviewedOn: null,
  createdAt: '2026-07-25T18:30:00.000Z',
  updatedAt: '2026-07-25T18:30:00.000Z',
};

describe('ProblemListPage', () => {
  let problemsSubject: Subject<readonly Problem[]>;
  let categoriesSubject: Subject<readonly CategoryResource[]>;
  let tagsSubject: Subject<readonly TagResource[]>;
  let getProblems: ReturnType<typeof vi.fn>;
  let getCategories: ReturnType<typeof vi.fn>;
  let getTags: ReturnType<typeof vi.fn>;
  let createProblem: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    problemsSubject = new Subject();
    categoriesSubject = new Subject();
    tagsSubject = new Subject();
    getProblems = vi.fn((): Observable<readonly Problem[]> => problemsSubject);
    getCategories = vi.fn(
      (): Observable<readonly CategoryResource[]> => categoriesSubject,
    );
    getTags = vi.fn((): Observable<readonly TagResource[]> => tagsSubject);
    createProblem = vi.fn(() => of(problem));

    await TestBed.configureTestingModule({
      imports: [ProblemListPage],
      providers: [
        {
          provide: ProblemsApiService,
          useValue: { getProblems, createProblem },
        },
        {
          provide: CategoriesApiService,
          useValue: { getCategories },
        },
        {
          provide: TagsApiService,
          useValue: { getTags },
        },
      ],
    }).compileComponents();
  });

  function completeAuxiliaryLoads(): void {
    categoriesSubject.next([]);
    categoriesSubject.complete();
    tagsSubject.next([]);
    tagsSubject.complete();
  }

  it('shows loading until the initial requests resolve, then renders the table', () => {
    const fixture = TestBed.createComponent(ProblemListPage);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Loading problems');
    expect(getProblems).toHaveBeenCalledTimes(1);

    problemsSubject.next([problem]);
    problemsSubject.complete();
    completeAuxiliaryLoads();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('table')).not.toBeNull();
    expect(fixture.nativeElement.textContent).toContain('Two Sum');
  });

  it('shows the empty state without rendering a table', () => {
    const fixture = TestBed.createComponent(ProblemListPage);
    problemsSubject.next([]);
    problemsSubject.complete();
    completeAuxiliaryLoads();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain(
      'No problems have been added yet.',
    );
    expect(fixture.nativeElement.querySelector('table')).toBeNull();
    expect(
      (fixture.nativeElement.querySelector('.add-button') as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    expect(fixture.nativeElement.textContent).toContain(
      'Add at least one category',
    );
  });

  it('shows a safe primary error and retries only on request', () => {
    const retryProblems = new Subject<readonly Problem[]>();
    getProblems
      .mockReturnValueOnce(problemsSubject)
      .mockReturnValueOnce(retryProblems);
    const fixture = TestBed.createComponent(ProblemListPage);
    fixture.detectChanges();

    problemsSubject.error(
      new Error('GET http://localhost:3000/api/problems database secret'),
    );
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain(
      'Problems could not be loaded.',
    );
    expect(fixture.nativeElement.textContent).not.toContain('database secret');

    const retry = fixture.nativeElement.querySelector(
      '.error-state button',
    ) as HTMLButtonElement;
    retry.click();
    fixture.detectChanges();
    expect(getProblems).toHaveBeenCalledTimes(2);
    expect(fixture.nativeElement.textContent).toContain('Loading problems');
  });

  it('keeps successful problems when auxiliary reference data fails', () => {
    const fixture = TestBed.createComponent(ProblemListPage);
    problemsSubject.next([problem]);
    problemsSubject.complete();
    categoriesSubject.error(new Error('private categories error'));
    tagsSubject.next([]);
    tagsSubject.complete();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('table')).not.toBeNull();
    expect(fixture.nativeElement.textContent).toContain(
      'Some reference data could not be loaded.',
    );
    expect(fixture.nativeElement.textContent).not.toContain(
      'private categories error',
    );
    expect(
      (fixture.nativeElement.querySelector('.add-button') as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    const retry = fixture.nativeElement.querySelector(
      '.warning button',
    ) as HTMLButtonElement;
    retry.click();
    expect(getCategories).toHaveBeenCalledTimes(2);
    expect(getTags).toHaveBeenCalledTimes(2);
  });

  it('opens the form and inserts a successful creation in sorted order', async () => {
    const created: Problem = {
      ...problem,
      id: '2',
      name: 'Array Basics',
    };
    createProblem.mockReturnValue(of(created));
    const fixture = TestBed.createComponent(ProblemListPage);
    problemsSubject.next([problem]);
    problemsSubject.complete();
    categoriesSubject.next([
      {
        id: '1',
        name: 'Arrays',
        createdAt: '2026-07-25T18:00:00.000Z',
        updatedAt: '2026-07-25T18:00:00.000Z',
      },
    ]);
    categoriesSubject.complete();
    tagsSubject.next([]);
    tagsSubject.complete();
    fixture.detectChanges();

    const addButton = fixture.nativeElement.querySelector(
      '.add-button',
    ) as HTMLButtonElement;
    expect(addButton.disabled).toBe(false);
    addButton.click();
    fixture.detectChanges();
    const panelDebug = fixture.debugElement.query(By.directive(CreateProblemPanel));
    expect(panelDebug).not.toBeNull();
    const panel = panelDebug.componentInstance as CreateProblemPanel;
    panel.form.patchValue({ name: 'Array Basics', categoryId: '1' });
    panel.submit();
    fixture.detectChanges();
    await new Promise<void>((resolve) => queueMicrotask(resolve));
    fixture.detectChanges();

    expect(createProblem).toHaveBeenCalledTimes(1);
    expect(fixture.debugElement.query(By.directive(CreateProblemPanel))).toBeNull();
    const names = Array.from(
      fixture.nativeElement.querySelectorAll('.problem-row .name-cell'),
      (cell: Element) => cell.textContent?.trim(),
    );
    expect(names).toEqual(['Array Basics', 'Two Sum']);
    expect(fixture.nativeElement.querySelectorAll('.details-row')).toHaveLength(0);
    expect(fixture.nativeElement.textContent).toContain('Array Basics was added.');
    expect(document.activeElement).toBe(addButton);
  });

  it('orders equal names by exact numeric decimal ID after insertion', () => {
    const sameNameProblems = [
      { ...problem, id: '10', name: 'Same Name' },
      { ...problem, id: '9007199254740993', name: 'same name' },
      { ...problem, id: '9007199254740992', name: 'SAME NAME' },
    ];
    const fixture = TestBed.createComponent(ProblemListPage);
    problemsSubject.next(sameNameProblems);
    problemsSubject.complete();
    completeAuxiliaryLoads();

    fixture.componentInstance.onProblemCreated({
      ...problem,
      id: '2',
      name: 'Same Name',
    });

    expect(fixture.componentInstance.problems().map(({ id }) => id)).toEqual([
      '2',
      '10',
      '9007199254740992',
      '9007199254740993',
    ]);
  });

  it('keeps creation available when only tags fail', () => {
    const fixture = TestBed.createComponent(ProblemListPage);
    problemsSubject.next([]);
    problemsSubject.complete();
    categoriesSubject.next([
      {
        id: '1',
        name: 'Arrays',
        createdAt: '2026-07-25T18:00:00.000Z',
        updatedAt: '2026-07-25T18:00:00.000Z',
      },
    ]);
    categoriesSubject.complete();
    tagsSubject.error(new Error('tags unavailable'));
    fixture.detectChanges();

    const addButton = fixture.nativeElement.querySelector(
      '.add-button',
    ) as HTMLButtonElement;
    expect(addButton.disabled).toBe(false);
    addButton.click();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain(
      'You can still create without tags.',
    );
  });
});
