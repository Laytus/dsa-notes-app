import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
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
import { ProblemFormPanel } from '../problem-form-panel/problem-form-panel';
import { ReferenceAdminPanel } from '../reference-admin-panel/reference-admin-panel';
import { POSTGRES_INTEGER_MAX } from '../problem-review';
import { ProblemTable } from '../problem-table/problem-table';
import {
  PERFORMANCE_CATEGORIES,
  PERFORMANCE_PROBLEMS,
  PERFORMANCE_TAGS,
} from '../../../../testing/problem-performance.fixture';
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

const categoryResources: readonly CategoryResource[] = [
  {
    id: '1',
    name: 'Arrays',
    createdAt: '2026-07-25T18:00:00.000Z',
    updatedAt: '2026-07-25T18:00:00.000Z',
  },
  {
    id: '2',
    name: 'Dinámica',
    createdAt: '2026-07-25T18:00:00.000Z',
    updatedAt: '2026-07-25T18:00:00.000Z',
  },
];

const tagResources: readonly TagResource[] = [
  {
    id: '10',
    name: 'Array',
    createdAt: '2026-07-25T18:00:00.000Z',
    updatedAt: '2026-07-25T18:00:00.000Z',
  },
  {
    id: '20',
    name: 'Hash Map',
    createdAt: '2026-07-25T18:00:00.000Z',
    updatedAt: '2026-07-25T18:00:00.000Z',
  },
];

const dynamicProblem: Problem = {
  ...problem,
  id: '9007199254740993',
  name: 'House Robber',
  category: { id: '2', name: 'Dinámica' },
  difficulty: null,
  status: 'Needs review',
  tags: [{ id: '10', name: 'Array' }],
  notes: 'Use the **recurrencia** relation.',
};

describe('ProblemListPage', () => {
  let problemsSubject: Subject<readonly Problem[]>;
  let categoriesSubject: Subject<readonly CategoryResource[]>;
  let tagsSubject: Subject<readonly TagResource[]>;
  let getProblems: ReturnType<typeof vi.fn>;
  let getCategories: ReturnType<typeof vi.fn>;
  let getTags: ReturnType<typeof vi.fn>;
  let createProblem: ReturnType<typeof vi.fn>;
  let updateProblem: ReturnType<typeof vi.fn>;
  let createCategory: ReturnType<typeof vi.fn>;
  let updateCategory: ReturnType<typeof vi.fn>;
  let deleteCategory: ReturnType<typeof vi.fn>;
  let createTag: ReturnType<typeof vi.fn>;
  let updateTag: ReturnType<typeof vi.fn>;
  let deleteTag: ReturnType<typeof vi.fn>;
  let duplicateResponse: Subject<Problem>;
  let duplicateProblem: ReturnType<typeof vi.fn>;
  let deleteResponse: Subject<void>;
  let deleteProblem: ReturnType<typeof vi.fn>;

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
    updateProblem = vi.fn(() => of(problem));
    createCategory = vi.fn(() => of(categoryResources[0]!));
    updateCategory = vi.fn(() => of(categoryResources[0]!));
    deleteCategory = vi.fn(() => of(undefined));
    createTag = vi.fn(() => of(tagResources[0]!));
    updateTag = vi.fn(() => of(tagResources[0]!));
    deleteTag = vi.fn(() => of(undefined));
    duplicateResponse = new Subject();
    duplicateProblem = vi.fn(() => duplicateResponse);
    deleteResponse = new Subject();
    deleteProblem = vi.fn(() => deleteResponse);

    await TestBed.configureTestingModule({
      imports: [ProblemListPage],
      providers: [
        {
          provide: ProblemsApiService,
          useValue: {
            getProblems,
            createProblem,
            updateProblem,
            duplicateProblem,
            deleteProblem,
          },
        },
        {
          provide: CategoriesApiService,
          useValue: {
            getCategories,
            createCategory,
            updateCategory,
            deleteCategory,
          },
        },
        {
          provide: TagsApiService,
          useValue: { getTags, createTag, updateTag, deleteTag },
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

  function completeLoadedPage(
    loadedProblems: readonly Problem[] = [problem, dynamicProblem],
  ): void {
    problemsSubject.next(loadedProblems);
    problemsSubject.complete();
    categoriesSubject.next(categoryResources);
    categoriesSubject.complete();
    tagsSubject.next(tagResources);
    tagsSubject.complete();
  }

  function completePerformancePage(
    fixture: ComponentFixture<ProblemListPage>,
    count = 1_000,
  ): void {
    problemsSubject.next(PERFORMANCE_PROBLEMS.slice(0, count));
    problemsSubject.complete();
    categoriesSubject.next(PERFORMANCE_CATEGORIES);
    categoriesSubject.complete();
    tagsSubject.next(PERFORMANCE_TAGS);
    tagsSubject.complete();
    fixture.detectChanges();
  }

  function changeControl(
    element: HTMLInputElement | HTMLSelectElement,
    value: string,
  ): void {
    element.value = value;
    element.dispatchEvent(
      new Event(element instanceof HTMLSelectElement ? 'change' : 'input'),
    );
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
      'Create your first category to start adding problems.',
    );
    expect(fixture.nativeElement.textContent).toContain('Manage categories');
  });

  it('supports the complete first-category workflow from an empty database', async () => {
    const firstCategory: CategoryResource = {
      id: '9007199254740993',
      name: 'Dynamic Programming',
      createdAt: '2026-07-26T12:00:00.000Z',
      updatedAt: '2026-07-26T12:00:00.000Z',
    };
    createCategory.mockReturnValue(of(firstCategory));
    const fixture = TestBed.createComponent(ProblemListPage);
    problemsSubject.next([]);
    problemsSubject.complete();
    completeAuxiliaryLoads();
    fixture.detectChanges();

    const addButton = fixture.nativeElement.querySelector(
      '.add-button',
    ) as HTMLButtonElement;
    expect(addButton.disabled).toBe(true);
    const manage = Array.from(
      fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>,
    ).find((button) => button.textContent?.trim() === 'Manage categories');
    (manage as HTMLButtonElement).click();
    fixture.detectChanges();

    const admin = fixture.debugElement.query(
      By.directive(ReferenceAdminPanel),
    ).componentInstance as ReferenceAdminPanel;
    admin.createName.setValue(' Dynamic Programming ');
    admin.create();
    fixture.detectChanges();

    expect(createCategory).toHaveBeenCalledWith({
      name: 'Dynamic Programming',
    });
    expect(getProblems).toHaveBeenCalledTimes(1);
    expect(fixture.componentInstance.categories()).toContainEqual(firstCategory);
    expect(addButton.disabled).toBe(false);
    expect(fixture.nativeElement.textContent).toContain('Dynamic Programming');
    const categoryFilterOptions = Array.from(
      fixture.nativeElement.querySelectorAll(
        '.filter-control select option',
      ) as NodeListOf<HTMLOptionElement>,
      (option) => option.textContent?.trim(),
    );
    expect(categoryFilterOptions).toContain('Dynamic Programming');

    addButton.click();
    fixture.detectChanges();
    const form = fixture.debugElement.query(
      By.directive(ProblemFormPanel),
    ).componentInstance as ProblemFormPanel;
    expect(form.categories()).toContainEqual(firstCategory);
    const optionNames = Array.from(
      fixture.nativeElement.querySelectorAll('#problem-category option'),
      (option: Element) => option.textContent?.trim(),
    );
    expect(optionNames).toContain('Dynamic Programming');
  });

  it('reconciles category and tag renames across Problems, filters, and a dirty form', () => {
    const tagged: Problem = {
      ...problem,
      tags: [{ id: '10', name: 'Array' }],
    };
    const fixture = TestBed.createComponent(ProblemListPage);
    problemsSubject.next([tagged]);
    problemsSubject.complete();
    completeLoadedPage([tagged]);
    fixture.detectChanges();

    fixture.componentInstance.selectedCategoryId.set('1');
    fixture.componentInstance.selectedTagIds.set(['10']);
    fixture.componentInstance.openEditPanel(tagged);
    fixture.detectChanges();
    const form = fixture.debugElement.query(
      By.directive(ProblemFormPanel),
    ).componentInstance as ProblemFormPanel;
    form.form.controls.notes.setValue('unsaved notes');
    form.form.controls.notes.markAsDirty();

    fixture.componentInstance.onCategoryRenamed({
      ...categoryResources[0]!,
      name: 'Data Structures',
    });
    fixture.componentInstance.onTagRenamed({
      ...tagResources[0]!,
      name: 'Sequence',
    });
    fixture.detectChanges();

    expect(fixture.componentInstance.problems()[0]?.category.name).toBe(
      'Data Structures',
    );
    expect(fixture.componentInstance.problems()[0]?.tags[0]?.name).toBe(
      'Sequence',
    );
    expect(fixture.componentInstance.selectedCategoryId()).toBe('1');
    expect(fixture.componentInstance.selectedTagIds()).toEqual(['10']);
    expect(form.form.controls.categoryId.value).toBe('1');
    expect(form.form.controls.tagIds.value).toEqual(['10']);
    expect(form.form.controls.notes.value).toBe('unsaved notes');
    expect(form.form.dirty).toBe(true);
    expect(getProblems).toHaveBeenCalledTimes(1);
  });

  it('reconciles successful reference deletions without disturbing expansion or pending state', () => {
    const tagged: Problem = {
      ...problem,
      tags: [{ id: '10', name: 'Array' }],
    };
    const fixture = TestBed.createComponent(ProblemListPage);
    problemsSubject.next([tagged]);
    problemsSubject.complete();
    categoriesSubject.next(categoryResources);
    categoriesSubject.complete();
    tagsSubject.next(tagResources);
    tagsSubject.complete();
    fixture.detectChanges();
    fixture.componentInstance.selectedCategoryId.set('2');
    fixture.componentInstance.selectedTagIds.set(['10', '20']);
    fixture.componentInstance.reviewingIds.set(new Set(['1']));
    const table = fixture.debugElement.query(
      By.directive(ProblemTable),
    ).componentInstance as ProblemTable;
    table.toggle('1');

    fixture.componentInstance.openCreatePanel();
    fixture.detectChanges();
    const form = fixture.debugElement.query(
      By.directive(ProblemFormPanel),
    ).componentInstance as ProblemFormPanel;
    form.form.patchValue({
      name: 'Dirty problem',
      categoryId: '2',
      tagIds: ['10', '20'],
    });
    form.form.markAsDirty();

    fixture.componentInstance.onCategoryDeleted('2');
    fixture.componentInstance.onTagDeleted('10');
    fixture.detectChanges();

    expect(fixture.componentInstance.categories().some(({ id }) => id === '2')).toBe(
      false,
    );
    expect(fixture.componentInstance.selectedCategoryId()).toBeNull();
    expect(fixture.componentInstance.tags().some(({ id }) => id === '10')).toBe(
      false,
    );
    expect(fixture.componentInstance.problems()[0]?.tags).toEqual([]);
    expect(fixture.componentInstance.selectedTagIds()).toEqual(['20']);
    expect(form.form.controls.categoryId.value).toBe('');
    expect(form.form.controls.tagIds.value).toEqual(['20']);
    expect(form.form.controls.name.value).toBe('Dirty problem');
    expect(form.form.dirty).toBe(true);
    expect(table.expandedIds().has('1')).toBe(true);
    expect(fixture.componentInstance.reviewingIds().has('1')).toBe(true);
    expect(getProblems).toHaveBeenCalledTimes(1);
  });

  it('opens and closes administration without resetting a dirty Problem form and restores focus', async () => {
    const fixture = TestBed.createComponent(ProblemListPage);
    completeLoadedPage([problem]);
    fixture.detectChanges();
    const addButton = fixture.nativeElement.querySelector(
      '.add-button',
    ) as HTMLButtonElement;
    addButton.click();
    fixture.detectChanges();
    const form = fixture.debugElement.query(
      By.directive(ProblemFormPanel),
    ).componentInstance as ProblemFormPanel;
    form.form.controls.notes.setValue('keep me');
    form.form.controls.notes.markAsDirty();
    const manage = fixture.nativeElement.querySelector(
      '.manage-button',
    ) as HTMLButtonElement;
    manage.click();
    fixture.detectChanges();
    expect(fixture.debugElement.query(By.directive(ProblemFormPanel))).not.toBeNull();
    expect(fixture.debugElement.query(By.directive(ReferenceAdminPanel))).not.toBeNull();

    fixture.componentInstance.closeReferenceAdmin();
    fixture.detectChanges();
    await new Promise<void>((resolve) => queueMicrotask(resolve));
    expect(form.form.controls.notes.value).toBe('keep me');
    expect(form.form.dirty).toBe(true);
    expect(document.activeElement).toBe(manage);
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
    expect(
      (fixture.nativeElement.querySelector('.edit-button') as HTMLButtonElement)
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
    const panelDebug = fixture.debugElement.query(By.directive(ProblemFormPanel));
    expect(panelDebug).not.toBeNull();
    const panel = panelDebug.componentInstance as ProblemFormPanel;
    panel.form.patchValue({ name: 'Array Basics', categoryId: '1' });
    panel.submit();
    fixture.detectChanges();
    await new Promise<void>((resolve) => queueMicrotask(resolve));
    fixture.detectChanges();

    expect(createProblem).toHaveBeenCalledTimes(1);
    expect(fixture.debugElement.query(By.directive(ProblemFormPanel))).toBeNull();
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

    fixture.componentInstance.onProblemSaved({
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

  it('opens Edit with current values and replaces the saved problem without collapsing it', async () => {
    const otherProblem: Problem = {
      ...problem,
      id: '2',
      name: 'Binary Search',
    };
    const updated: Problem = {
      ...problem,
      name: 'Array Two Sum',
      notes: 'Updated notes',
      updatedAt: '2026-07-25T20:00:00.000Z',
    };
    updateProblem.mockReturnValue(of(updated));
    const fixture = TestBed.createComponent(ProblemListPage);
    problemsSubject.next([otherProblem, problem]);
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

    const row = fixture.nativeElement.querySelector(
      '[data-problem-id="1"]',
    ) as HTMLTableRowElement;
    const expandButton = row.querySelector(
      '.expand-button',
    ) as HTMLButtonElement;
    const editButton = row.querySelector('.edit-button') as HTMLButtonElement;
    expandButton.click();
    editButton.click();
    fixture.detectChanges();

    const panelDebug = fixture.debugElement.query(By.directive(ProblemFormPanel));
    const panel = panelDebug.componentInstance as ProblemFormPanel;
    expect(panel.mode()).toBe('edit');
    expect(panel.form.controls.name.value).toBe('Two Sum');
    expect(panel.form.controls.categoryId.value).toBe('1');
    panel.form.controls.name.setValue('Array Two Sum');
    panel.submit();
    fixture.detectChanges();
    await new Promise<void>((resolve) => queueMicrotask(resolve));
    fixture.detectChanges();

    expect(updateProblem).toHaveBeenCalledTimes(1);
    expect(fixture.componentInstance.problems().map(({ id }) => id)).toEqual([
      '1',
      '2',
    ]);
    expect(fixture.componentInstance.problems()).toContainEqual(updated);
    expect(fixture.componentInstance.problems()).toHaveLength(2);
    expect(
      fixture.nativeElement.querySelector(
        '[data-problem-id="1"] + .details-row',
      ),
    ).not.toBeNull();
    expect(fixture.nativeElement.textContent).toContain(
      'Array Two Sum was updated.',
    );
    expect(document.activeElement?.getAttribute('aria-label')).toBe(
      'Edit Array Two Sum',
    );
  });

  it('reapplies exact numeric ID sorting after an update', () => {
    const larger: Problem = { ...problem, id: '10', name: 'Same Name' };
    const smaller: Problem = { ...problem, id: '2', name: 'Other' };
    const fixture = TestBed.createComponent(ProblemListPage);
    problemsSubject.next([larger, smaller]);
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
    fixture.componentInstance.openEditPanel(smaller);

    fixture.componentInstance.onProblemSaved({
      ...problem,
      id: '2',
      name: 'same name',
    });

    expect(fixture.componentInstance.problems().map(({ id }) => id)).toEqual([
      '2',
      '10',
    ]);
  });

  it('does not silently switch away from a dirty panel', () => {
    const secondProblem: Problem = { ...problem, id: '2', name: 'Three Sum' };
    const fixture = TestBed.createComponent(ProblemListPage);
    problemsSubject.next([problem, secondProblem]);
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

    const editButtons = fixture.nativeElement.querySelectorAll(
      '.edit-button',
    ) as NodeListOf<HTMLButtonElement>;
    editButtons[0]?.click();
    fixture.detectChanges();
    const panel = fixture.debugElement.query(
      By.directive(ProblemFormPanel),
    ).componentInstance as ProblemFormPanel;
    panel.form.controls.name.markAsDirty();
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);

    editButtons[1]?.click();
    expect(fixture.componentInstance.activePanel()).toEqual({
      mode: 'edit',
      problem,
    });

    confirm.mockReturnValue(true);
    editButtons[1]?.click();
    fixture.detectChanges();
    expect(fixture.componentInstance.activePanel()).toEqual({
      mode: 'edit',
      problem: secondProblem,
    });

    const switchedPanel = fixture.debugElement.query(
      By.directive(ProblemFormPanel),
    ).componentInstance as ProblemFormPanel;
    switchedPanel.form.controls.name.markAsDirty();
    confirm.mockReturnValue(false);
    (
      fixture.nativeElement.querySelector('.add-button') as HTMLButtonElement
    ).click();
    expect(fixture.componentInstance.activePanel()?.mode).toBe('edit');
    confirm.mockRestore();
  });

  it('does not silently replace a dirty Create panel with Edit', () => {
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

    (
      fixture.nativeElement.querySelector('.add-button') as HTMLButtonElement
    ).click();
    fixture.detectChanges();
    const panel = fixture.debugElement.query(
      By.directive(ProblemFormPanel),
    ).componentInstance as ProblemFormPanel;
    panel.form.controls.name.markAsDirty();
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);

    (
      fixture.nativeElement.querySelector('.edit-button') as HTMLButtonElement
    ).click();
    expect(fixture.componentInstance.activePanel()?.mode).toBe('create');

    confirm.mockReturnValue(true);
    (
      fixture.nativeElement.querySelector('.edit-button') as HTMLButtonElement
    ).click();
    expect(fixture.componentInstance.activePanel()?.mode).toBe('edit');
    confirm.mockRestore();
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

  it('allows editing with unavailable tags while preserving current tag IDs', () => {
    const taggedProblem: Problem = {
      ...problem,
      tags: [{ id: '20', name: 'Hash Map' }],
    };
    const fixture = TestBed.createComponent(ProblemListPage);
    problemsSubject.next([taggedProblem]);
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

    (
      fixture.nativeElement.querySelector('.edit-button') as HTMLButtonElement
    ).click();
    fixture.detectChanges();
    const panel = fixture.debugElement.query(
      By.directive(ProblemFormPanel),
    ).componentInstance as ProblemFormPanel;
    expect(panel.form.controls.tagIds.value).toEqual(['20']);
    expect(fixture.nativeElement.textContent).toContain(
      'Existing tags are preserved',
    );
  });

  it('requires named confirmation and prevents duplicate pending deletes', () => {
    const secondProblem: Problem = { ...problem, id: '2', name: 'Three Sum' };
    const fixture = TestBed.createComponent(ProblemListPage);
    problemsSubject.next([problem, secondProblem]);
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
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const deleteButtons = fixture.nativeElement.querySelectorAll(
      '.delete-button',
    ) as NodeListOf<HTMLButtonElement>;

    deleteButtons[0]?.click();
    expect(confirm).toHaveBeenCalledWith(
      'Delete “Two Sum”? This action cannot be undone.',
    );
    expect(deleteProblem).not.toHaveBeenCalled();

    confirm.mockReturnValue(true);
    deleteButtons[0]?.click();
    fixture.detectChanges();
    fixture.componentInstance.requestDelete(problem);

    expect(deleteProblem).toHaveBeenCalledTimes(1);
    expect(deleteProblem).toHaveBeenCalledWith('1');
    expect(deleteButtons[0]?.disabled).toBe(true);
    expect(deleteButtons[1]?.disabled).toBe(false);
    confirm.mockRestore();
  });

  it('removes only the confirmed problem, cleans its expansion, and focuses Add', async () => {
    const secondProblem: Problem = { ...problem, id: '2', name: 'Three Sum' };
    const fixture = TestBed.createComponent(ProblemListPage);
    problemsSubject.next([problem, secondProblem]);
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
    const table = fixture.debugElement.query(
      By.directive(ProblemTable),
    ).componentInstance as ProblemTable;
    table.toggle('1');
    table.toggle('2');
    fixture.detectChanges();
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);

    (
      fixture.nativeElement.querySelector(
        '[data-problem-id="1"] .delete-button',
      ) as HTMLButtonElement
    ).click();
    deleteResponse.next();
    deleteResponse.complete();
    fixture.detectChanges();
    await new Promise<void>((resolve) => queueMicrotask(resolve));
    fixture.detectChanges();

    expect(fixture.componentInstance.problems()).toEqual([secondProblem]);
    expect(getProblems).toHaveBeenCalledTimes(1);
    expect(table.isExpanded('1')).toBe(false);
    expect(table.isExpanded('2')).toBe(true);
    expect(
      fixture.nativeElement.querySelector('[data-problem-id="1"]'),
    ).toBeNull();
    expect(
      fixture.nativeElement.querySelector('[data-problem-id="2"] + .details-row'),
    ).not.toBeNull();
    expect(document.activeElement).toBe(
      fixture.nativeElement.querySelector('.add-button'),
    );
    confirm.mockRestore();
  });

  it('transitions to empty state and focuses the heading when Add is disabled', async () => {
    const fixture = TestBed.createComponent(ProblemListPage);
    problemsSubject.next([problem]);
    problemsSubject.complete();
    completeAuxiliaryLoads();
    fixture.detectChanges();
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);

    (
      fixture.nativeElement.querySelector('.delete-button') as HTMLButtonElement
    ).click();
    deleteResponse.next();
    deleteResponse.complete();
    fixture.detectChanges();
    await new Promise<void>((resolve) => queueMicrotask(resolve));
    fixture.detectChanges();

    expect(fixture.componentInstance.problems()).toEqual([]);
    expect(fixture.nativeElement.textContent).toContain(
      'No problems have been added yet.',
    );
    expect(fixture.nativeElement.querySelector('table')).toBeNull();
    expect(document.activeElement).toBe(
      fixture.nativeElement.querySelector('#problems-title'),
    );
    confirm.mockRestore();
  });

  it('uses combined confirmation before deleting a dirty active edit', async () => {
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
    (
      fixture.nativeElement.querySelector('.edit-button') as HTMLButtonElement
    ).click();
    fixture.detectChanges();
    const panel = fixture.debugElement.query(
      By.directive(ProblemFormPanel),
    ).componentInstance as ProblemFormPanel;
    panel.form.controls.name.setValue('Unsaved');
    panel.form.controls.name.markAsDirty();
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const deleteButton = fixture.nativeElement.querySelector(
      '.delete-button',
    ) as HTMLButtonElement;

    deleteButton.click();
    expect(confirm).toHaveBeenCalledWith(
      'Delete “Two Sum”? This action cannot be undone and unsaved edits will be discarded.',
    );
    expect(deleteProblem).not.toHaveBeenCalled();
    expect(fixture.componentInstance.activePanel()?.mode).toBe('edit');

    confirm.mockReturnValue(true);
    deleteButton.click();
    deleteResponse.next();
    deleteResponse.complete();
    fixture.detectChanges();
    await new Promise<void>((resolve) => queueMicrotask(resolve));
    fixture.detectChanges();

    expect(fixture.componentInstance.activePanel()).toBeNull();
    expect(document.activeElement).toBe(
      fixture.nativeElement.querySelector('.add-button'),
    );
    confirm.mockRestore();
  });

  it('preserves a dirty editor when deleting a different problem', () => {
    const secondProblem: Problem = { ...problem, id: '2', name: 'Three Sum' };
    const fixture = TestBed.createComponent(ProblemListPage);
    problemsSubject.next([problem, secondProblem]);
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
    const rows = fixture.nativeElement.querySelectorAll(
      '.problem-row',
    ) as NodeListOf<HTMLTableRowElement>;
    (rows[0]?.querySelector('.edit-button') as HTMLButtonElement).click();
    fixture.detectChanges();
    const panel = fixture.debugElement.query(
      By.directive(ProblemFormPanel),
    ).componentInstance as ProblemFormPanel;
    panel.form.controls.name.setValue('Unsaved edit');
    panel.form.controls.name.markAsDirty();
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);

    (rows[1]?.querySelector('.delete-button') as HTMLButtonElement).click();
    deleteResponse.next();
    deleteResponse.complete();
    fixture.detectChanges();

    expect(fixture.componentInstance.activePanel()).toEqual({
      mode: 'edit',
      problem,
    });
    expect(panel.form.controls.name.value).toBe('Unsaved edit');
    confirm.mockRestore();
  });

  it('preserves a dirty Create panel while deleting a problem', () => {
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
    (
      fixture.nativeElement.querySelector('.add-button') as HTMLButtonElement
    ).click();
    fixture.detectChanges();
    const panel = fixture.debugElement.query(
      By.directive(ProblemFormPanel),
    ).componentInstance as ProblemFormPanel;
    panel.form.controls.name.setValue('Unsaved create');
    panel.form.controls.name.markAsDirty();
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);

    (
      fixture.nativeElement.querySelector('.delete-button') as HTMLButtonElement
    ).click();
    deleteResponse.next();
    deleteResponse.complete();
    fixture.detectChanges();

    expect(fixture.componentInstance.activePanel()?.mode).toBe('create');
    expect(panel.form.controls.name.value).toBe('Unsaved create');
    confirm.mockRestore();
  });

  it.each([
    [
      new HttpErrorResponse({
        status: 404,
        error: { error: { code: 'PROBLEM_NOT_FOUND', message: 'raw secret' } },
      }),
      'This problem no longer exists on the server.',
    ],
    [
      new HttpErrorResponse({ status: 0, statusText: 'Network Error' }),
      'Could not connect to the API.',
    ],
    [new Error('database secret'), 'The problem could not be deleted.'],
  ])('preserves state and shows a safe delete failure for %s', (failure, message) => {
    const fixture = TestBed.createComponent(ProblemListPage);
    problemsSubject.next([problem]);
    problemsSubject.complete();
    completeAuxiliaryLoads();
    fixture.detectChanges();
    const table = fixture.debugElement.query(
      By.directive(ProblemTable),
    ).componentInstance as ProblemTable;
    table.toggle(problem.id);
    fixture.detectChanges();
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);

    (
      fixture.nativeElement.querySelector('.delete-button') as HTMLButtonElement
    ).click();
    deleteResponse.error(failure);
    fixture.detectChanges();

    expect(fixture.componentInstance.problems()).toEqual([problem]);
    expect(table.isExpanded(problem.id)).toBe(true);
    expect(fixture.componentInstance.deletingIds().has(problem.id)).toBe(false);
    expect(fixture.nativeElement.textContent).toContain(message);
    expect(fixture.nativeElement.textContent).not.toContain('raw secret');
    expect(fixture.nativeElement.textContent).not.toContain('database secret');
    confirm.mockRestore();
  });

  it('clears a previous delete error when a retry succeeds', () => {
    const fixture = TestBed.createComponent(ProblemListPage);
    problemsSubject.next([problem]);
    problemsSubject.complete();
    completeAuxiliaryLoads();
    fixture.detectChanges();
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const firstResponse = deleteResponse;

    (
      fixture.nativeElement.querySelector('.delete-button') as HTMLButtonElement
    ).click();
    firstResponse.error(
      new HttpErrorResponse({ status: 500, statusText: 'Server Error' }),
    );
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain(
      'The problem could not be deleted.',
    );

    deleteResponse = new Subject();
    (
      fixture.nativeElement.querySelector('.delete-button') as HTMLButtonElement
    ).click();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).not.toContain(
      'The problem could not be deleted.',
    );
    deleteResponse.next();
    deleteResponse.complete();
    fixture.detectChanges();

    expect(deleteProblem).toHaveBeenCalledTimes(2);
    expect(fixture.componentInstance.problems()).toEqual([]);
    confirm.mockRestore();
  });

  it('sends one exact partial review PATCH and replaces the hydrated problem', () => {
    const reviewedProblem: Problem = {
      ...problem,
      id: '9007199254740993',
      name: 'Same Name',
      timesSolved: 2,
      lastReviewedOn: '2025-12-01',
    };
    const otherProblem: Problem = {
      ...problem,
      id: '2',
      name: 'same name',
    };
    const hydratedReview: Problem = {
      ...reviewedProblem,
      timesSolved: 3,
      lastReviewedOn: '2026-01-05',
      updatedAt: '2026-07-25T20:00:00.000Z',
    };
    const reviewResponse = new Subject<Problem>();
    updateProblem.mockReturnValue(reviewResponse);
    const fixture = TestBed.createComponent(ProblemListPage);
    problemsSubject.next([reviewedProblem, otherProblem]);
    problemsSubject.complete();
    completeAuxiliaryLoads();
    fixture.detectChanges();
    const table = fixture.debugElement.query(
      By.directive(ProblemTable),
    ).componentInstance as ProblemTable;
    table.toggle(reviewedProblem.id);
    table.toggle(otherProblem.id);
    fixture.detectChanges();
    const reviewedRow = fixture.nativeElement.querySelector(
      `[data-problem-id="${reviewedProblem.id}"]`,
    ) as HTMLTableRowElement;
    const reviewButton = reviewedRow.querySelector(
      '.review-button',
    ) as HTMLButtonElement;
    reviewButton.focus();

    reviewButton.click();
    fixture.detectChanges();
    fixture.componentInstance.requestReview(reviewedProblem);

    expect(updateProblem).toHaveBeenCalledTimes(1);
    expect(updateProblem).toHaveBeenCalledWith('9007199254740993', {
      timesSolved: 3,
    });
    expect(reviewButton.disabled).toBe(true);
    expect(reviewButton.textContent).toContain('Updating');
    expect(
      (
        fixture.nativeElement.querySelector(
          '[data-problem-id="2"] .review-button',
        ) as HTMLButtonElement
      ).disabled,
    ).toBe(false);

    reviewResponse.next(hydratedReview);
    reviewResponse.complete();
    fixture.detectChanges();

    expect(fixture.componentInstance.problems()).toEqual([
      otherProblem,
      hydratedReview,
    ]);
    expect(fixture.componentInstance.problems()).toHaveLength(2);
    expect(getProblems).toHaveBeenCalledTimes(1);
    expect(getCategories).toHaveBeenCalledTimes(1);
    expect(getTags).toHaveBeenCalledTimes(1);
    expect(table.isExpanded(reviewedProblem.id)).toBe(true);
    expect(table.isExpanded(otherProblem.id)).toBe(true);
    expect(document.activeElement?.getAttribute('aria-label')).toBe(
      'Mark Same Name reviewed',
    );
  });

  it('increments zero and sets a null review date to the local date', () => {
    const unreviewed: Problem = {
      ...problem,
      timesSolved: 0,
      lastReviewedOn: null,
    };
    const reviewResponse = new Subject<Problem>();
    updateProblem.mockReturnValue(reviewResponse);
    const fixture = TestBed.createComponent(ProblemListPage);
    problemsSubject.next([unreviewed]);
    problemsSubject.complete();
    completeAuxiliaryLoads();
    fixture.detectChanges();

    (
      fixture.nativeElement.querySelector('.review-button') as HTMLButtonElement
    ).click();

    expect(updateProblem).toHaveBeenCalledWith('1', {
      timesSolved: 1,
    });
  });

  it('prevents review when the PostgreSQL integer maximum is reached', () => {
    const maximumProblem: Problem = {
      ...problem,
      timesSolved: POSTGRES_INTEGER_MAX,
    };
    const fixture = TestBed.createComponent(ProblemListPage);
    problemsSubject.next([maximumProblem]);
    problemsSubject.complete();
    completeAuxiliaryLoads();
    fixture.detectChanges();
    const reviewButton = fixture.nativeElement.querySelector(
      '.review-button',
    ) as HTMLButtonElement;

    expect(reviewButton.disabled).toBe(true);
    expect(fixture.nativeElement.textContent).toContain(
      'Times solved has reached its maximum',
    );
    fixture.componentInstance.requestReview(maximumProblem);
    expect(updateProblem).not.toHaveBeenCalled();
    expect(fixture.componentInstance.problems()).toEqual([maximumProblem]);
  });

  it('blocks review for the actively edited problem', () => {
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
    (
      fixture.nativeElement.querySelector('.edit-button') as HTMLButtonElement
    ).click();
    fixture.detectChanges();
    const reviewButton = fixture.nativeElement.querySelector(
      '.review-button',
    ) as HTMLButtonElement;

    expect(reviewButton.disabled).toBe(true);
    expect(fixture.nativeElement.textContent).toContain(
      'open for editing',
    );
    fixture.componentInstance.requestReview(problem);
    expect(updateProblem).not.toHaveBeenCalled();
  });

  it('reviews another problem without disturbing a dirty Edit panel', () => {
    const secondProblem: Problem = { ...problem, id: '2', name: 'Three Sum' };
    const reviewResponse = new Subject<Problem>();
    updateProblem.mockReturnValue(reviewResponse);
    const fixture = TestBed.createComponent(ProblemListPage);
    problemsSubject.next([problem, secondProblem]);
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
    const rows = fixture.nativeElement.querySelectorAll(
      '.problem-row',
    ) as NodeListOf<HTMLTableRowElement>;
    (rows[0]?.querySelector('.edit-button') as HTMLButtonElement).click();
    fixture.detectChanges();
    const panel = fixture.debugElement.query(
      By.directive(ProblemFormPanel),
    ).componentInstance as ProblemFormPanel;
    panel.form.controls.name.setValue('Unsaved edit');
    panel.form.controls.name.markAsDirty();
    const confirm = vi.spyOn(window, 'confirm');

    (rows[1]?.querySelector('.review-button') as HTMLButtonElement).click();

    expect(updateProblem).toHaveBeenCalledTimes(1);
    expect(confirm).not.toHaveBeenCalled();
    expect(fixture.componentInstance.activePanel()).toEqual({
      mode: 'edit',
      problem,
    });
    expect(panel.form.controls.name.value).toBe('Unsaved edit');
    confirm.mockRestore();
  });

  it('reviews while preserving a dirty Create panel', () => {
    const reviewResponse = new Subject<Problem>();
    updateProblem.mockReturnValue(reviewResponse);
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
    (
      fixture.nativeElement.querySelector('.add-button') as HTMLButtonElement
    ).click();
    fixture.detectChanges();
    const panel = fixture.debugElement.query(
      By.directive(ProblemFormPanel),
    ).componentInstance as ProblemFormPanel;
    panel.form.controls.name.setValue('Unsaved create');
    panel.form.controls.name.markAsDirty();
    const confirm = vi.spyOn(window, 'confirm');

    (
      fixture.nativeElement.querySelector('.review-button') as HTMLButtonElement
    ).click();

    expect(updateProblem).toHaveBeenCalledTimes(1);
    expect(confirm).not.toHaveBeenCalled();
    expect(fixture.componentInstance.activePanel()?.mode).toBe('create');
    expect(panel.form.controls.name.value).toBe('Unsaved create');
    confirm.mockRestore();
  });

  it.each([
    [
      new HttpErrorResponse({
        status: 404,
        error: { error: { code: 'PROBLEM_NOT_FOUND', message: 'raw secret' } },
      }),
      'This problem no longer exists on the server.',
    ],
    [
      new HttpErrorResponse({
        status: 400,
        error: {
          error: { code: 'INVALID_TIMES_SOLVED', message: 'raw validation' },
        },
      }),
      'The review values were rejected.',
    ],
    [
      new HttpErrorResponse({ status: 0, statusText: 'Network Error' }),
      'Could not connect to the API.',
    ],
    [new Error('database secret'), 'The problem could not be marked reviewed.'],
  ])('preserves review state and shows a safe failure for %s', (failure, message) => {
    const original: Problem = {
      ...problem,
      timesSolved: 4,
      lastReviewedOn: '2025-12-01',
    };
    const reviewResponse = new Subject<Problem>();
    updateProblem.mockReturnValue(reviewResponse);
    const fixture = TestBed.createComponent(ProblemListPage);
    problemsSubject.next([original]);
    problemsSubject.complete();
    completeAuxiliaryLoads();
    fixture.detectChanges();
    const table = fixture.debugElement.query(
      By.directive(ProblemTable),
    ).componentInstance as ProblemTable;
    table.toggle(original.id);
    fixture.detectChanges();

    (
      fixture.nativeElement.querySelector('.review-button') as HTMLButtonElement
    ).click();
    reviewResponse.error(failure);
    fixture.detectChanges();

    expect(fixture.componentInstance.problems()).toEqual([original]);
    expect(fixture.componentInstance.reviewingIds().has(original.id)).toBe(
      false,
    );
    expect(table.isExpanded(original.id)).toBe(true);
    expect(fixture.nativeElement.textContent).toContain(message);
    expect(fixture.nativeElement.textContent).not.toContain('raw secret');
    expect(fixture.nativeElement.textContent).not.toContain('raw validation');
    expect(fixture.nativeElement.textContent).not.toContain('database secret');
  });

  it('clears a previous review error when retry succeeds', () => {
    const firstResponse = new Subject<Problem>();
    updateProblem.mockReturnValue(firstResponse);
    const fixture = TestBed.createComponent(ProblemListPage);
    problemsSubject.next([problem]);
    problemsSubject.complete();
    completeAuxiliaryLoads();
    fixture.detectChanges();

    (
      fixture.nativeElement.querySelector('.review-button') as HTMLButtonElement
    ).click();
    firstResponse.error(
      new HttpErrorResponse({ status: 500, statusText: 'Server Error' }),
    );
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain(
      'The problem could not be marked reviewed.',
    );

    const retryResponse = new Subject<Problem>();
    updateProblem.mockReturnValue(retryResponse);
    (
      fixture.nativeElement.querySelector('.review-button') as HTMLButtonElement
    ).click();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).not.toContain(
      'The problem could not be marked reviewed.',
    );
    const reviewed = {
      ...problem,
      timesSolved: 2,
      lastReviewedOn: '2026-01-05',
    };
    retryResponse.next(reviewed);
    retryResponse.complete();
    fixture.detectChanges();

    expect(updateProblem).toHaveBeenCalledTimes(2);
    expect(fixture.componentInstance.problems()).toEqual([reviewed]);
  });

  it('renders an accessible filter toolbar with complete domain options', () => {
    const fixture = TestBed.createComponent(ProblemListPage);
    completeLoadedPage();
    fixture.detectChanges();

    const search = fixture.nativeElement.querySelector(
      'input[type="search"]',
    ) as HTMLInputElement;
    expect(search.labels?.[0]?.textContent).toContain('Search problems');

    const selects = fixture.nativeElement.querySelectorAll(
      '.filter-control select',
    ) as NodeListOf<HTMLSelectElement>;
    expect(Array.from(selects[0]?.options ?? [], ({ text }) => text)).toEqual([
      'All categories',
      'Arrays',
      'Dinámica',
    ]);
    expect(Array.from(selects[1]?.options ?? [], ({ text }) => text)).toEqual([
      'All difficulties',
      'Easy',
      'Medium',
      'Hard',
      'Unspecified',
    ]);
    expect(Array.from(selects[2]?.options ?? [], ({ text }) => text)).toEqual([
      'All statuses',
      'To solve',
      'Attempted',
      'Solved',
      'Needs review',
      'Mastered',
    ]);
    expect(
      fixture.nativeElement.querySelector('.tag-filters legend').textContent,
    ).toContain('Tags');
    expect(
      fixture.nativeElement.querySelectorAll(
        '.tag-filters input[type="checkbox"]',
      ),
    ).toHaveLength(2);
    expect(fixture.nativeElement.textContent).toContain(
      'Match any selected tag.',
    );
    expect(
      (fixture.nativeElement.querySelector('.clear-filters') as HTMLButtonElement)
        .disabled,
    ).toBe(true);
  });

  it('filters normalized search text locally across hydrated fields', () => {
    const fixture = TestBed.createComponent(ProblemListPage);
    completeLoadedPage();
    fixture.detectChanges();
    const search = fixture.nativeElement.querySelector(
      'input[type="search"]',
    ) as HTMLInputElement;

    changeControl(search, '  DINAMICA  ');
    fixture.detectChanges();

    expect(fixture.componentInstance.problems()).toHaveLength(2);
    expect(fixture.componentInstance.filteredProblems()).toEqual([
      dynamicProblem,
    ]);
    expect(fixture.nativeElement.textContent).toContain('1 of 2 problems');
    expect(getProblems).toHaveBeenCalledTimes(1);
    expect(getCategories).toHaveBeenCalledTimes(1);
    expect(getTags).toHaveBeenCalledTimes(1);
  });

  it('combines filter groups with AND while selected tags use OR', () => {
    const hashProblem: Problem = {
      ...problem,
      id: '3',
      name: 'Map Practice',
      tags: [{ id: '20', name: 'Hash Map' }],
    };
    const fixture = TestBed.createComponent(ProblemListPage);
    completeLoadedPage([problem, dynamicProblem, hashProblem]);
    fixture.detectChanges();

    const selects = fixture.nativeElement.querySelectorAll(
      '.filter-control select',
    ) as NodeListOf<HTMLSelectElement>;
    changeControl(selects[0]!, '1');
    changeControl(selects[2]!, 'Solved');
    const tagInputs = fixture.nativeElement.querySelectorAll(
      '.tag-filters input',
    ) as NodeListOf<HTMLInputElement>;
    tagInputs[0]!.click();
    tagInputs[1]!.click();
    fixture.detectChanges();

    expect(fixture.componentInstance.selectedTagIds()).toEqual(['10', '20']);
    expect(
      fixture.componentInstance.filteredProblems().map(({ id }) => id),
    ).toEqual(['3']);
  });

  it('distinguishes no matches from a true empty collection and clears locally', () => {
    const fixture = TestBed.createComponent(ProblemListPage);
    completeLoadedPage();
    fixture.detectChanges();

    changeControl(
      fixture.nativeElement.querySelector('input[type="search"]'),
      'not present',
    );
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain(
      'No problems match the current search and filters.',
    );
    expect(fixture.nativeElement.textContent).not.toContain(
      'No problems have been added yet.',
    );
    expect(fixture.nativeElement.querySelector('app-problem-table').hidden).toBe(
      true,
    );
    (
      fixture.nativeElement.querySelector(
        '.no-match-state button',
      ) as HTMLButtonElement
    ).click();
    fixture.detectChanges();

    expect(fixture.componentInstance.filtersActive()).toBe(false);
    expect(fixture.componentInstance.filteredProblems()).toHaveLength(2);
    expect(fixture.nativeElement.querySelector('app-problem-table').hidden).toBe(
      false,
    );
    expect(getProblems).toHaveBeenCalledTimes(1);
  });

  it('clears every criterion without changing canonical or pending state', () => {
    const fixture = TestBed.createComponent(ProblemListPage);
    completeLoadedPage();
    fixture.detectChanges();
    fixture.componentInstance.searchQuery.set('house');
    fixture.componentInstance.selectedCategoryId.set('2');
    fixture.componentInstance.selectedDifficulty.set('unspecified');
    fixture.componentInstance.selectedStatus.set('Needs review');
    fixture.componentInstance.selectedTagIds.set(['10']);
    fixture.componentInstance.deletingIds.set(new Set(['1']));
    fixture.componentInstance.reviewingIds.set(
      new Set(['9007199254740993']),
    );
    const canonical = fixture.componentInstance.problems();

    fixture.componentInstance.clearFilters();

    expect(fixture.componentInstance.filters()).toEqual({
      query: '',
      categoryId: null,
      difficulty: null,
      status: null,
      tagIds: [],
    });
    expect(fixture.componentInstance.problems()).toBe(canonical);
    expect(fixture.componentInstance.deletingIds().has('1')).toBe(true);
    expect(
      fixture.componentInstance.reviewingIds().has('9007199254740993'),
    ).toBe(true);
  });

  it('preserves expansion while a filter temporarily hides the row', () => {
    const fixture = TestBed.createComponent(ProblemListPage);
    completeLoadedPage();
    fixture.detectChanges();
    const table = fixture.debugElement.query(
      By.directive(ProblemTable),
    ).componentInstance as ProblemTable;
    table.toggle(problem.id);
    fixture.detectChanges();

    fixture.componentInstance.searchQuery.set('house');
    fixture.detectChanges();
    expect(table.isExpanded(problem.id)).toBe(true);
    expect(
      fixture.nativeElement.querySelector('[data-problem-id="1"]'),
    ).toBeNull();

    fixture.componentInstance.clearFilters();
    fixture.detectChanges();
    expect(
      fixture.nativeElement.querySelector(
        '[data-problem-id="1"] + .details-row',
      ),
    ).not.toBeNull();
  });

  it('disables only the unavailable auxiliary filter and keeps others usable', () => {
    const fixture = TestBed.createComponent(ProblemListPage);
    problemsSubject.next([problem, dynamicProblem]);
    problemsSubject.complete();
    categoriesSubject.error(new Error('private categories error'));
    tagsSubject.next(tagResources);
    tagsSubject.complete();
    fixture.detectChanges();

    const selects = fixture.nativeElement.querySelectorAll(
      '.filter-control select',
    ) as NodeListOf<HTMLSelectElement>;
    expect(selects[0]?.disabled).toBe(true);
    expect(selects[1]?.disabled).toBe(false);
    expect(selects[2]?.disabled).toBe(false);
    expect(
      (fixture.nativeElement.querySelector('.tag-filters') as HTMLFieldSetElement)
        .disabled,
    ).toBe(false);
    expect(fixture.nativeElement.textContent).toContain(
      'Category filtering is unavailable',
    );

    changeControl(selects[1]!, 'unspecified');
    fixture.detectChanges();
    expect(fixture.componentInstance.filteredProblems()).toEqual([
      dynamicProblem,
    ]);
  });

  it('disables only tag filtering when tags fail and preserves loaded problems', () => {
    const fixture = TestBed.createComponent(ProblemListPage);
    problemsSubject.next([problem, dynamicProblem]);
    problemsSubject.complete();
    categoriesSubject.next(categoryResources);
    categoriesSubject.complete();
    tagsSubject.error(new Error('private tags error'));
    fixture.detectChanges();

    expect(
      (fixture.nativeElement.querySelector('.tag-filters') as HTMLFieldSetElement)
        .disabled,
    ).toBe(true);
    expect(
      (
        fixture.nativeElement.querySelector(
          '.filter-control select',
        ) as HTMLSelectElement
      ).disabled,
    ).toBe(false);
    expect(fixture.nativeElement.textContent).toContain(
      'Tag filtering is unavailable',
    );
    expect(fixture.componentInstance.problems()).toHaveLength(2);
  });

  it('keeps canonical create and edit updates derived under active filters', () => {
    const created: Problem = { ...problem, id: '3', name: 'Hidden Graph' };
    const edited: Problem = {
      ...dynamicProblem,
      name: 'Visible Array Problem',
      category: { id: '1', name: 'Arrays' },
    };
    const fixture = TestBed.createComponent(ProblemListPage);
    completeLoadedPage();
    fixture.detectChanges();
    fixture.componentInstance.selectedCategoryId.set('2');

    fixture.componentInstance.onProblemSaved(created);
    expect(fixture.componentInstance.problems()).toContainEqual(created);
    expect(fixture.componentInstance.filteredProblems()).not.toContainEqual(
      created,
    );

    fixture.componentInstance.openEditPanel(dynamicProblem);
    fixture.componentInstance.onProblemSaved(edited);
    expect(fixture.componentInstance.problems()).toContainEqual(edited);
    expect(fixture.componentInstance.filteredProblems()).toEqual([]);
  });

  it('changes filters without closing dirty Create or Edit panels or confirming', () => {
    const fixture = TestBed.createComponent(ProblemListPage);
    completeLoadedPage();
    fixture.detectChanges();
    const confirm = vi.spyOn(window, 'confirm');
    fixture.componentInstance.openCreatePanel();
    fixture.detectChanges();
    const createPanel = fixture.debugElement.query(
      By.directive(ProblemFormPanel),
    ).componentInstance as ProblemFormPanel;
    createPanel.form.controls.name.setValue('Unsaved create');
    createPanel.form.controls.name.markAsDirty();

    changeControl(
      fixture.nativeElement.querySelector('input[type="search"]'),
      'house',
    );
    expect(fixture.componentInstance.activePanel()?.mode).toBe('create');
    expect(createPanel.form.controls.name.value).toBe('Unsaved create');
    expect(confirm).not.toHaveBeenCalled();

    fixture.componentInstance.activePanel.set({
      mode: 'edit',
      problem: dynamicProblem,
    });
    fixture.detectChanges();
    const editPanel = fixture.debugElement.query(
      By.directive(ProblemFormPanel),
    ).componentInstance as ProblemFormPanel;
    editPanel.form.controls.notes.setValue('Unsaved edit');
    editPanel.form.controls.notes.markAsDirty();
    fixture.componentInstance.selectedStatus.set('Solved');

    expect(fixture.componentInstance.activePanel()?.mode).toBe('edit');
    expect(editPanel.form.controls.notes.value).toBe('Unsaved edit');
    expect(confirm).not.toHaveBeenCalled();
    confirm.mockRestore();
  });

  it('sends one exact large-ID duplication request and isolates pending state', () => {
    const source: Problem = {
      ...dynamicProblem,
      id: '9007199254740993',
    };
    const fixture = TestBed.createComponent(ProblemListPage);
    completeLoadedPage([source, problem]);
    fixture.detectChanges();
    const confirm = vi.spyOn(window, 'confirm');
    const sourceRow = fixture.nativeElement.querySelector(
      `[data-problem-id="${source.id}"]`,
    ) as HTMLTableRowElement;
    const duplicate = sourceRow.querySelector(
      '.duplicate-button',
    ) as HTMLButtonElement;

    duplicate.click();
    fixture.detectChanges();
    fixture.componentInstance.requestDuplicate(source);

    expect(duplicateProblem).toHaveBeenCalledTimes(1);
    expect(duplicateProblem).toHaveBeenCalledWith('9007199254740993');
    expect(confirm).not.toHaveBeenCalled();
    expect(duplicate.disabled).toBe(true);
    expect(duplicate.textContent).toContain('Duplicating');
    expect(
      (sourceRow.querySelector('.edit-button') as HTMLButtonElement).disabled,
    ).toBe(true);
    expect(
      (sourceRow.querySelector('.review-button') as HTMLButtonElement).disabled,
    ).toBe(true);
    expect(
      (sourceRow.querySelector('.delete-button') as HTMLButtonElement).disabled,
    ).toBe(true);
    expect(
      (
        fixture.nativeElement.querySelector(
          '[data-problem-id="1"] .duplicate-button',
        ) as HTMLButtonElement
      ).disabled,
    ).toBe(false);
    confirm.mockRestore();
  });

  it('inserts the hydrated duplicate once, reapplies exact sorting, and preserves expansion and focus', async () => {
    const source: Problem = {
      ...problem,
      id: '9007199254740993',
      name: 'Same',
    };
    const existingCopy: Problem = {
      ...problem,
      id: '2',
      name: 'same copy',
    };
    const hydratedDuplicate: Problem = {
      ...source,
      id: '10',
      name: 'Same Copy',
      notes: 'Returned by the API',
      createdAt: '2026-07-26T03:00:00.000Z',
      updatedAt: '2026-07-26T03:00:00.000Z',
    };
    const fixture = TestBed.createComponent(ProblemListPage);
    completeLoadedPage([source, existingCopy]);
    fixture.detectChanges();
    const table = fixture.debugElement.query(
      By.directive(ProblemTable),
    ).componentInstance as ProblemTable;
    table.toggle(source.id);
    table.toggle(existingCopy.id);
    fixture.detectChanges();
    const duplicateButton = fixture.nativeElement.querySelector(
      `[data-problem-id="${source.id}"] .duplicate-button`,
    ) as HTMLButtonElement;
    duplicateButton.focus();
    duplicateButton.click();

    duplicateResponse.next(hydratedDuplicate);
    duplicateResponse.complete();
    fixture.detectChanges();
    await new Promise<void>((resolve) => queueMicrotask(resolve));
    fixture.detectChanges();

    expect(fixture.componentInstance.problems()).toEqual([
      source,
      existingCopy,
      hydratedDuplicate,
    ]);
    expect(
      fixture.componentInstance.problems().filter(({ id }) => id === '10'),
    ).toEqual([hydratedDuplicate]);
    expect(fixture.componentInstance.problems()).toContain(source);
    expect(getProblems).toHaveBeenCalledTimes(1);
    expect(getCategories).toHaveBeenCalledTimes(1);
    expect(getTags).toHaveBeenCalledTimes(1);
    expect(table.isExpanded(source.id)).toBe(true);
    expect(table.isExpanded(existingCopy.id)).toBe(true);
    expect(table.isExpanded(hydratedDuplicate.id)).toBe(false);
    expect(document.activeElement?.getAttribute('aria-label')).toBe(
      'Duplicate Same',
    );
  });

  it('derives duplicate visibility and counts from active filters without resetting them', () => {
    const matchingDuplicate: Problem = {
      ...dynamicProblem,
      id: '3',
      name: 'House Robber Copy',
    };
    const fixture = TestBed.createComponent(ProblemListPage);
    completeLoadedPage();
    fixture.detectChanges();
    fixture.componentInstance.selectedCategoryId.set('2');
    fixture.componentInstance.selectedTagIds.set(['10']);
    fixture.detectChanges();

    fixture.componentInstance.requestDuplicate(dynamicProblem);
    duplicateResponse.next(matchingDuplicate);
    duplicateResponse.complete();
    fixture.detectChanges();

    expect(fixture.componentInstance.problems()).toHaveLength(3);
    expect(fixture.componentInstance.filteredProblems()).toEqual([
      dynamicProblem,
      matchingDuplicate,
    ]);
    expect(fixture.componentInstance.selectedCategoryId()).toBe('2');
    expect(fixture.componentInstance.selectedTagIds()).toEqual(['10']);
    expect(fixture.nativeElement.textContent).toContain('2 of 3 problems');
    expect(getProblems).toHaveBeenCalledTimes(1);
  });

  it('keeps a duplicate canonical but hidden when its source does not match active filters', () => {
    const hiddenDuplicate: Problem = {
      ...problem,
      id: '3',
      name: 'Two Sum Copy',
    };
    const fixture = TestBed.createComponent(ProblemListPage);
    completeLoadedPage();
    fixture.detectChanges();
    fixture.componentInstance.selectedCategoryId.set('2');

    fixture.componentInstance.requestDuplicate(problem);
    duplicateResponse.next(hiddenDuplicate);
    duplicateResponse.complete();

    expect(fixture.componentInstance.problems()).toContainEqual(
      hiddenDuplicate,
    );
    expect(fixture.componentInstance.filteredProblems()).toEqual([
      dynamicProblem,
    ]);
    expect(fixture.componentInstance.selectedCategoryId()).toBe('2');
  });

  it('blocks duplication for the actively edited source but allows another problem', () => {
    const fixture = TestBed.createComponent(ProblemListPage);
    completeLoadedPage();
    fixture.detectChanges();
    fixture.componentInstance.openEditPanel(problem);
    fixture.detectChanges();

    const sourceDuplicate = fixture.nativeElement.querySelector(
      '[data-problem-id="1"] .duplicate-button',
    ) as HTMLButtonElement;
    const otherDuplicate = fixture.nativeElement.querySelector(
      `[data-problem-id="${dynamicProblem.id}"] .duplicate-button`,
    ) as HTMLButtonElement;
    expect(sourceDuplicate.disabled).toBe(true);
    expect(otherDuplicate.disabled).toBe(false);

    fixture.componentInstance.requestDuplicate(problem);
    expect(duplicateProblem).not.toHaveBeenCalled();
    otherDuplicate.click();
    expect(duplicateProblem).toHaveBeenCalledWith(dynamicProblem.id);
  });

  it('preserves dirty Create and unrelated Edit state without discard confirmation', () => {
    const fixture = TestBed.createComponent(ProblemListPage);
    completeLoadedPage();
    fixture.detectChanges();
    fixture.componentInstance.openCreatePanel();
    fixture.detectChanges();
    const createPanel = fixture.debugElement.query(
      By.directive(ProblemFormPanel),
    ).componentInstance as ProblemFormPanel;
    createPanel.form.controls.name.setValue('Unsaved create');
    createPanel.form.controls.name.markAsDirty();
    const confirm = vi.spyOn(window, 'confirm');

    fixture.componentInstance.requestDuplicate(problem);
    expect(fixture.componentInstance.activePanel()?.mode).toBe('create');
    expect(createPanel.form.controls.name.value).toBe('Unsaved create');
    expect(confirm).not.toHaveBeenCalled();

    fixture.componentInstance.activePanel.set({
      mode: 'edit',
      problem: dynamicProblem,
    });
    fixture.detectChanges();
    const editPanel = fixture.debugElement.query(
      By.directive(ProblemFormPanel),
    ).componentInstance as ProblemFormPanel;
    editPanel.form.controls.notes.setValue('Unsaved edit');
    editPanel.form.controls.notes.markAsDirty();
    fixture.componentInstance.requestDuplicate(problem);

    expect(fixture.componentInstance.activePanel()).toEqual({
      mode: 'edit',
      problem: dynamicProblem,
    });
    expect(editPanel.form.controls.notes.value).toBe('Unsaved edit');
    expect(confirm).not.toHaveBeenCalled();
    confirm.mockRestore();
  });

  it.each([
    [
      new HttpErrorResponse({
        status: 404,
        error: { error: { code: 'PROBLEM_NOT_FOUND', message: 'raw secret' } },
      }),
      'This problem no longer exists on the server.',
    ],
    [
      new HttpErrorResponse({
        status: 400,
        error: {
          error: { code: 'INVALID_PROBLEM_NAME', message: 'raw validation' },
        },
      }),
      'The duplicate name or source values are invalid.',
    ],
    [
      new HttpErrorResponse({ status: 0, statusText: 'Network Error' }),
      'Could not connect to the API.',
    ],
    [new Error('database secret'), 'The problem could not be duplicated.'],
  ])('preserves state and shows a safe duplication failure for %s', (failure, message) => {
    const fixture = TestBed.createComponent(ProblemListPage);
    completeLoadedPage();
    fixture.detectChanges();
    const table = fixture.debugElement.query(
      By.directive(ProblemTable),
    ).componentInstance as ProblemTable;
    table.toggle(problem.id);
    fixture.detectChanges();
    const canonical = fixture.componentInstance.problems();

    fixture.componentInstance.requestDuplicate(problem);
    duplicateResponse.error(failure);
    fixture.detectChanges();

    expect(fixture.componentInstance.problems()).toBe(canonical);
    expect(fixture.componentInstance.duplicatingIds().has(problem.id)).toBe(
      false,
    );
    expect(table.isExpanded(problem.id)).toBe(true);
    expect(fixture.nativeElement.textContent).toContain(message);
    expect(fixture.nativeElement.textContent).not.toContain('raw secret');
    expect(fixture.nativeElement.textContent).not.toContain('raw validation');
    expect(fixture.nativeElement.textContent).not.toContain('database secret');
  });

  it('clears an old duplication error when retry succeeds', () => {
    const fixture = TestBed.createComponent(ProblemListPage);
    completeLoadedPage();
    fixture.detectChanges();
    const firstResponse = duplicateResponse;

    fixture.componentInstance.requestDuplicate(problem);
    firstResponse.error(
      new HttpErrorResponse({ status: 500, statusText: 'Server Error' }),
    );
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain(
      'The problem could not be duplicated.',
    );

    duplicateResponse = new Subject();
    const duplicate: Problem = {
      ...problem,
      id: '3',
      name: 'Two Sum Copy',
    };
    fixture.componentInstance.requestDuplicate(problem);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).not.toContain(
      'The problem could not be duplicated.',
    );
    duplicateResponse.next(duplicate);
    duplicateResponse.complete();

    expect(duplicateProblem).toHaveBeenCalledTimes(2);
    expect(fixture.componentInstance.problems()).toContainEqual(duplicate);
  });

  it('saves a changed inline name with a field-only PATCH and preserves expansion', async () => {
    const response = new Subject<Problem>();
    updateProblem.mockReturnValue(response);
    const fixture = TestBed.createComponent(ProblemListPage);
    completeLoadedPage([problem]);
    fixture.detectChanges();
    const table = fixture.debugElement.query(
      By.directive(ProblemTable),
    ).componentInstance as ProblemTable;
    table.toggle(problem.id);

    fixture.componentInstance.requestInlineEdit({ problem, field: 'name' });
    fixture.componentInstance.updateInlineDraft('  Updated Two Sum  ');
    fixture.componentInstance.saveInlineEdit();

    expect(updateProblem).toHaveBeenCalledWith('1', { name: 'Updated Two Sum' });
    expect(fixture.componentInstance.inlineSaving()).toBe(true);
    response.next({ ...problem, name: 'Updated Two Sum' });
    response.complete();
    fixture.detectChanges();
    await new Promise<void>((resolve) => queueMicrotask(resolve));

    expect(fixture.componentInstance.inlineEdit()).toBeNull();
    expect(fixture.componentInstance.problems()[0]?.name).toBe('Updated Two Sum');
    expect(table.isExpanded(problem.id)).toBe(true);
    expect(getProblems).toHaveBeenCalledTimes(1);
    expect(getCategories).toHaveBeenCalledTimes(1);
    expect(getTags).toHaveBeenCalledTimes(1);
  });

  it('keeps an inline validation error open and cancels without a request', () => {
    const fixture = TestBed.createComponent(ProblemListPage);
    completeLoadedPage([problem]);
    fixture.detectChanges();

    fixture.componentInstance.requestInlineEdit({ problem, field: 'timesSolved' });
    fixture.componentInstance.updateInlineDraft('-1');
    fixture.componentInstance.saveInlineEdit();
    fixture.detectChanges();

    expect(fixture.componentInstance.inlineEdit()?.draft).toBe('-1');
    expect(fixture.nativeElement.textContent).toContain('non-negative integer');
    expect(updateProblem).not.toHaveBeenCalled();
    fixture.componentInstance.cancelInlineEdit();
    expect(fixture.componentInstance.inlineEdit()).toBeNull();
  });

  it('does not send a PATCH for an unchanged inline value', () => {
    const fixture = TestBed.createComponent(ProblemListPage);
    completeLoadedPage([problem]);
    fixture.detectChanges();

    fixture.componentInstance.requestInlineEdit({ problem, field: 'status' });
    fixture.componentInstance.saveInlineEdit();

    expect(updateProblem).not.toHaveBeenCalled();
    expect(fixture.componentInstance.inlineEdit()).toBeNull();
  });

  it('does not send a PATCH for an unchanged inline Category string ID', () => {
    const fixture = TestBed.createComponent(ProblemListPage);
    completeLoadedPage([problem]);
    fixture.detectChanges();

    fixture.componentInstance.requestInlineEdit({ problem, field: 'categoryId' });
    expect(fixture.componentInstance.inlineEdit()?.draft).toBe(problem.category.id);
    fixture.componentInstance.saveInlineEdit();

    expect(updateProblem).not.toHaveBeenCalled();
    expect(fixture.componentInstance.inlineEdit()).toBeNull();
  });

  it('does not send a PATCH for an unchanged inline Difficulty value', () => {
    const fixture = TestBed.createComponent(ProblemListPage);
    completeLoadedPage([problem]);
    fixture.detectChanges();

    fixture.componentInstance.requestInlineEdit({ problem, field: 'difficulty' });
    expect(fixture.componentInstance.inlineEdit()?.draft).toBe(problem.difficulty);
    fixture.componentInstance.saveInlineEdit();

    expect(updateProblem).not.toHaveBeenCalled();
    expect(fixture.componentInstance.inlineEdit()).toBeNull();
  });

  it('derives visible rows from filters followed by the active sort without reloading', () => {
    const fixture = TestBed.createComponent(ProblemListPage);
    const later: Problem = { ...problem, id: '2', name: 'Alpha' };
    completeLoadedPage([problem, later]);
    fixture.detectChanges();

    fixture.componentInstance.setSort('name');
    expect(fixture.componentInstance.activeSort()).toEqual({
      field: 'name',
      direction: 'ascending',
    });
    expect(fixture.componentInstance.visibleProblems().map(({ id }) => id)).toEqual([
      '2',
      '1',
    ]);

    fixture.componentInstance.setSort('name');
    expect(fixture.componentInstance.visibleProblems().map(({ id }) => id)).toEqual([
      '1',
      '2',
    ]);
    const searchInput = document.createElement('input');
    searchInput.value = 'alpha';
    fixture.componentInstance.setSearchQuery({ target: searchInput } as unknown as Event);
    expect(fixture.componentInstance.activeSort()?.direction).toBe('descending');
    expect(fixture.componentInstance.visibleProblems().map(({ id }) => id)).toEqual(['2']);
    expect(getProblems).toHaveBeenCalledTimes(1);
  });

  it('renders only the first 100 of 1,000 sorted Problems and loads the next block on demand', () => {
    const fixture = TestBed.createComponent(ProblemListPage);
    completePerformancePage(fixture);

    expect(fixture.componentInstance.sortedProblems()).toHaveLength(1_000);
    expect(fixture.componentInstance.visibleProblems()).toHaveLength(100);
    expect(fixture.nativeElement.querySelectorAll('.problem-row')).toHaveLength(100);
    expect(fixture.nativeElement.textContent).toContain('Showing 100 of 1000 problems');
    expect((fixture.nativeElement.querySelector('.progressive-rendering button') as HTMLButtonElement).type).toBe('button');

    (fixture.nativeElement.querySelector('.progressive-rendering button') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(fixture.componentInstance.visibleProblems()).toHaveLength(200);
    expect(fixture.nativeElement.querySelectorAll('.problem-row')).toHaveLength(200);
    expect(getProblems).toHaveBeenCalledTimes(1);
    expect(getCategories).toHaveBeenCalledTimes(1);
    expect(getTags).toHaveBeenCalledTimes(1);
  });

  it('renders a final partial block and removes Show more when all matches are visible', () => {
    const fixture = TestBed.createComponent(ProblemListPage);
    completePerformancePage(fixture, 250);

    const showMore = (): void => {
      (fixture.nativeElement.querySelector('.progressive-rendering button') as HTMLButtonElement).click();
      fixture.detectChanges();
    };
    showMore();
    showMore();

    expect(fixture.componentInstance.visibleProblems()).toHaveLength(250);
    expect(fixture.nativeElement.querySelectorAll('.problem-row')).toHaveLength(250);
    expect(fixture.nativeElement.querySelector('.progressive-rendering button')).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('Showing all 250 problems');
  });

  it('resets the render limit after search, filters, and sorting while deriving over all Problems', () => {
    const fixture = TestBed.createComponent(ProblemListPage);
    completePerformancePage(fixture);
    fixture.componentInstance.showMoreProblems();
    expect(fixture.componentInstance.visibleLimit()).toBe(200);

    const searchInput = document.createElement('input');
    searchInput.value = 'dinamica marker';
    fixture.componentInstance.setSearchQuery({ target: searchInput } as unknown as Event);
    expect(fixture.componentInstance.visibleLimit()).toBe(100);
    expect(fixture.componentInstance.filteredProblems()).toHaveLength(35);

    fixture.componentInstance.showMoreProblems();
    fixture.componentInstance.setCategoryFilter({ target: { value: '4' } } as unknown as Event);
    expect(fixture.componentInstance.visibleLimit()).toBe(100);

    fixture.componentInstance.showMoreProblems();
    fixture.componentInstance.setSort('name');
    expect(fixture.componentInstance.visibleLimit()).toBe(100);
    expect(fixture.componentInstance.sortedProblems()).toHaveLength(7);
    fixture.componentInstance.showMoreProblems();
    fixture.componentInstance.clearFilters();
    expect(fixture.componentInstance.visibleLimit()).toBe(100);
    expect(fixture.componentInstance.sortedProblems()).toHaveLength(1_000);
    expect(getProblems).toHaveBeenCalledTimes(1);
  });

  it('pulls the next matching Problem into the rendered block after deletion', () => {
    const fixture = TestBed.createComponent(ProblemListPage);
    completePerformancePage(fixture, 101);
    const target = fixture.componentInstance.visibleProblems()[0]!;
    const nextProblem = fixture.componentInstance.sortedProblems()[100]!;
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    fixture.componentInstance.requestDelete(target);
    deleteResponse.next();
    deleteResponse.complete();
    fixture.detectChanges();

    expect(fixture.componentInstance.visibleProblems()).toHaveLength(100);
    expect(fixture.componentInstance.visibleProblems().some(({ id }) => id === target.id)).toBe(false);
    expect(fixture.componentInstance.visibleProblems().some(({ id }) => id === nextProblem.id)).toBe(true);
  });

  it('preserves ID-based expansion, including a previously hidden row, and a dirty inline editor when rows are appended', () => {
    const fixture = TestBed.createComponent(ProblemListPage);
    completePerformancePage(fixture);
    const target = fixture.componentInstance.visibleProblems()[0]!;
    const initiallyHidden = fixture.componentInstance.sortedProblems()[150]!;
    const table = fixture.debugElement.query(By.directive(ProblemTable)).componentInstance as ProblemTable;
    table.toggle(target.id);
    table.toggle(initiallyHidden.id);
    fixture.componentInstance.requestInlineEdit({ problem: target, field: 'name' });
    fixture.componentInstance.updateInlineDraft('Edited without saving');

    fixture.componentInstance.showMoreProblems();
    fixture.detectChanges();

    expect(table.isExpanded(target.id)).toBe(true);
    expect(table.isExpanded(initiallyHidden.id)).toBe(true);
    expect(fixture.nativeElement.querySelector(`#problem-details-${initiallyHidden.id}`)).not.toBeNull();
    expect(fixture.componentInstance.inlineEdit()).toMatchObject({
      problemId: target.id,
      draft: 'Edited without saving',
    });
    expect(fixture.componentInstance.visibleProblems()[0]?.id).toBe('9007199254740993');
  });

  it('opens one expanded Notes editor with the exact raw source and previews without a request', () => {
    const fixture = TestBed.createComponent(ProblemListPage);
    completeLoadedPage([dynamicProblem]);
    fixture.detectChanges();
    const table = fixture.debugElement.query(By.directive(ProblemTable)).componentInstance as ProblemTable;
    table.toggle(dynamicProblem.id);
    fixture.detectChanges();

    fixture.componentInstance.requestNotesEdit(dynamicProblem);
    fixture.componentInstance.updateNotesDraft('  # Draft\n\n**kept exactly**  ');
    fixture.componentInstance.setNotesMode('preview');
    fixture.detectChanges();

    expect(fixture.componentInstance.notesEditor()).toMatchObject({
      problemId: dynamicProblem.id,
      draft: '  # Draft\n\n**kept exactly**  ',
      mode: 'preview',
    });
    expect(fixture.nativeElement.querySelector('.markdown-content h1')?.textContent).toBe('Draft');
    expect(updateProblem).not.toHaveBeenCalled();
  });

  it('toggles the active Notes editor with Meta/Ctrl+Shift+Enter without saving and restores textarea focus', async () => {
    const fixture = TestBed.createComponent(ProblemListPage);
    completeLoadedPage([dynamicProblem]);
    fixture.detectChanges();
    const table = fixture.debugElement.query(By.directive(ProblemTable)).componentInstance as ProblemTable;
    table.toggle(dynamicProblem.id);
    fixture.componentInstance.requestNotesEdit(dynamicProblem);
    fixture.componentInstance.updateNotesDraft('  exact\n\ndraft  ');
    fixture.detectChanges();

    const textarea = fixture.nativeElement.querySelector('.notes-editor') as HTMLTextAreaElement;
    expect(textarea.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', metaKey: true, shiftKey: true, cancelable: true }))).toBe(false);
    fixture.detectChanges();
    expect(fixture.componentInstance.notesEditor()).toMatchObject({ mode: 'preview', draft: '  exact\n\ndraft  ' });
    expect(updateProblem).not.toHaveBeenCalled();

    const previewButton = fixture.nativeElement.querySelector('[data-mode="preview"]') as HTMLButtonElement;
    expect(previewButton.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', ctrlKey: true, shiftKey: true, cancelable: true }))).toBe(false);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(fixture.componentInstance.notesEditor()).toMatchObject({ mode: 'edit', draft: '  exact\n\ndraft  ' });
    expect(document.activeElement).toBe(fixture.nativeElement.querySelector('.notes-editor'));
    expect(updateProblem).not.toHaveBeenCalled();
  });

  it('opens Notes from a header double-click, keeps single clicks and Markdown content inert, and preserves expansion', async () => {
    const fixture = TestBed.createComponent(ProblemListPage);
    completeLoadedPage([dynamicProblem]);
    fixture.detectChanges();
    const table = fixture.debugElement.query(By.directive(ProblemTable)).componentInstance as ProblemTable;
    table.toggle(dynamicProblem.id);
    fixture.detectChanges();
    const heading = fixture.nativeElement.querySelector('.notes-heading') as HTMLDivElement;
    const markdown = fixture.nativeElement.querySelector('.markdown-content') as HTMLDivElement;

    heading.click();
    markdown.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    expect(fixture.componentInstance.notesEditor()).toBeNull();
    heading.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    fixture.detectChanges();
    await fixture.whenStable();

    expect(fixture.componentInstance.notesEditor()).toMatchObject({
      problemId: dynamicProblem.id,
      originalNotes: dynamicProblem.notes,
      draft: dynamicProblem.notes,
      mode: 'edit',
    });
    expect(table.isExpanded(dynamicProblem.id)).toBe(true);
    expect(document.activeElement).toBe(fixture.nativeElement.querySelector('.notes-editor'));
  });

  it('uses existing confirmation rules when a header double-click switches a dirty Notes editor', () => {
    const otherProblem = { ...problem, id: '2', name: 'Other problem' };
    const fixture = TestBed.createComponent(ProblemListPage);
    completeLoadedPage([problem, otherProblem]);
    fixture.detectChanges();
    const table = fixture.debugElement.query(By.directive(ProblemTable)).componentInstance as ProblemTable;
    table.toggle(problem.id);
    table.toggle(otherProblem.id);
    fixture.componentInstance.requestNotesEdit(problem);
    fixture.componentInstance.updateNotesDraft('dirty');
    fixture.detectChanges();
    const headings = fixture.nativeElement.querySelectorAll('.notes-heading') as NodeListOf<HTMLDivElement>;
    vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true);

    headings[1]?.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    expect(fixture.componentInstance.notesEditor()).toMatchObject({ problemId: problem.id, draft: 'dirty' });
    headings[1]?.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    expect(fixture.componentInstance.notesEditor()).toMatchObject({ problemId: otherProblem.id, draft: otherProblem.notes, mode: 'edit' });
  });

  it('saves only changed Notes, preserves expansion, and returns to read mode', () => {
    const fixture = TestBed.createComponent(ProblemListPage);
    completeLoadedPage([problem]);
    fixture.detectChanges();
    const response = new Subject<Problem>();
    updateProblem.mockReturnValue(response);
    const table = fixture.debugElement.query(By.directive(ProblemTable)).componentInstance as ProblemTable;
    table.toggle(problem.id);

    fixture.componentInstance.requestNotesEdit(problem);
    fixture.componentInstance.updateNotesDraft('\nline one\n\nline two\n');
    fixture.componentInstance.saveNotes();

    expect(updateProblem).toHaveBeenCalledWith('1', { notes: '\nline one\n\nline two\n' });
    expect(fixture.componentInstance.notesSaving()).toBe(true);
    response.next({ ...problem, notes: '\nline one\n\nline two\n' });
    response.complete();
    fixture.detectChanges();

    expect(fixture.componentInstance.notesEditor()).toBeNull();
    expect(table.isExpanded('1')).toBe(true);
    expect(fixture.componentInstance.problems()[0]?.notes).toBe('\nline one\n\nline two\n');
  });

  it('routes a Notes textarea Meta+Enter through the field-only Save workflow', () => {
    const fixture = TestBed.createComponent(ProblemListPage);
    completeLoadedPage([problem]);
    fixture.detectChanges();
    const response = new Subject<Problem>();
    updateProblem.mockReturnValue(response);
    const table = fixture.debugElement.query(By.directive(ProblemTable)).componentInstance as ProblemTable;
    table.toggle(problem.id);
    fixture.componentInstance.requestNotesEdit(problem);
    fixture.componentInstance.updateNotesDraft('shortcut draft');
    fixture.detectChanges();

    const textarea = fixture.nativeElement.querySelector('.notes-editor') as HTMLTextAreaElement;
    const event = new KeyboardEvent('keydown', { key: 'Enter', metaKey: true, cancelable: true });
    expect(textarea.dispatchEvent(event)).toBe(false);
    expect(updateProblem).toHaveBeenCalledWith('1', { notes: 'shortcut draft' });
    response.next({ ...problem, notes: 'shortcut draft' });
    response.complete();
    fixture.detectChanges();

    expect(fixture.componentInstance.notesEditor()).toBeNull();
    expect(table.isExpanded(problem.id)).toBe(true);
  });

  it('closes an unchanged Notes editor without PATCH through Ctrl+Enter', () => {
    const fixture = TestBed.createComponent(ProblemListPage);
    completeLoadedPage([problem]);
    fixture.detectChanges();
    const table = fixture.debugElement.query(By.directive(ProblemTable)).componentInstance as ProblemTable;
    table.toggle(problem.id);
    fixture.componentInstance.requestNotesEdit(problem);
    fixture.detectChanges();

    const textarea = fixture.nativeElement.querySelector('.notes-editor') as HTMLTextAreaElement;
    textarea.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', ctrlKey: true, cancelable: true }));
    fixture.detectChanges();

    expect(updateProblem).not.toHaveBeenCalled();
    expect(fixture.componentInstance.notesEditor()).toBeNull();
  });

  it('keeps a failed Notes draft open and confirms before a dirty cancel or collapse', () => {
    const fixture = TestBed.createComponent(ProblemListPage);
    completeLoadedPage([problem]);
    fixture.detectChanges();
    const response = new Subject<Problem>();
    updateProblem.mockReturnValue(response);
    const table = fixture.debugElement.query(By.directive(ProblemTable)).componentInstance as ProblemTable;
    table.toggle(problem.id);
    fixture.componentInstance.requestNotesEdit(problem);
    fixture.componentInstance.updateNotesDraft('unsaved');
    fixture.componentInstance.saveNotes();
    response.error(new HttpErrorResponse({ status: 0 }));

    expect(fixture.componentInstance.notesEditor()?.draft).toBe('unsaved');
    expect(fixture.componentInstance.notesError()).toContain('Network unavailable');
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    fixture.componentInstance.cancelNotesEdit();
    fixture.componentInstance.requestExpansion(problem.id);
    expect(fixture.componentInstance.notesEditor()?.draft).toBe('unsaved');
    expect(table.isExpanded(problem.id)).toBe(true);
  });

  it('preserves the Notes draft after a failed Ctrl+Enter Save', () => {
    const fixture = TestBed.createComponent(ProblemListPage);
    completeLoadedPage([problem]);
    fixture.detectChanges();
    const response = new Subject<Problem>();
    updateProblem.mockReturnValue(response);
    const table = fixture.debugElement.query(By.directive(ProblemTable)).componentInstance as ProblemTable;
    table.toggle(problem.id);
    fixture.componentInstance.requestNotesEdit(problem);
    fixture.componentInstance.updateNotesDraft('retry this');
    fixture.detectChanges();

    const textarea = fixture.nativeElement.querySelector('.notes-editor') as HTMLTextAreaElement;
    textarea.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', ctrlKey: true, cancelable: true }));
    response.error(new HttpErrorResponse({ status: 0 }));

    expect(fixture.componentInstance.notesEditor()).toMatchObject({ draft: 'retry this', mode: 'edit' });
    expect(fixture.componentInstance.notesError()).toContain('Network unavailable');
  });
});
