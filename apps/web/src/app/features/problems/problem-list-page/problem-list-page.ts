import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, forkJoin, of } from 'rxjs';
import type {
  CategoryResource,
  Problem,
  TagResource,
} from '../../../core/api/api.models';
import { CategoriesApiService } from '../../../core/api/categories-api.service';
import { ProblemsApiService } from '../../../core/api/problems-api.service';
import { TagsApiService } from '../../../core/api/tags-api.service';
import { ProblemFormPanel } from '../problem-form-panel/problem-form-panel';
import { ProblemTable } from '../problem-table/problem-table';

function compareProblems(left: Problem, right: Problem): number {
  const leftName = left.name.toLowerCase();
  const rightName = right.name.toLowerCase();
  if (leftName < rightName) return -1;
  if (leftName > rightName) return 1;

  const leftId = BigInt(left.id);
  const rightId = BigInt(right.id);
  if (leftId < rightId) return -1;
  if (leftId > rightId) return 1;
  return 0;
}

type ActivePanel =
  | { readonly mode: 'create' }
  | { readonly mode: 'edit'; readonly problem: Problem };

@Component({
  selector: 'app-problem-list-page',
  imports: [ProblemFormPanel, ProblemTable],
  templateUrl: './problem-list-page.html',
  styleUrl: './problem-list-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProblemListPage {
  private readonly problemsApi = inject(ProblemsApiService);
  private readonly categoriesApi = inject(CategoriesApiService);
  private readonly tagsApi = inject(TagsApiService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly addProblemButton =
    viewChild<ElementRef<HTMLButtonElement>>('addProblemButton');
  private readonly formPanel = viewChild(ProblemFormPanel);
  private readonly problemTable = viewChild(ProblemTable);

  readonly problems = signal<readonly Problem[]>([]);
  readonly categories = signal<readonly CategoryResource[]>([]);
  readonly tags = signal<readonly TagResource[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly warning = signal<string | null>(null);
  readonly categoriesAvailable = signal(true);
  readonly tagsAvailable = signal(true);
  readonly activePanel = signal<ActivePanel | null>(null);
  readonly successMessage = signal<string | null>(null);
  readonly canCreate = computed(
    () =>
      !this.loading() &&
      !this.error() &&
      this.categoriesAvailable() &&
      this.categories().length > 0,
  );
  readonly createUnavailableMessage = computed(() => {
    if (this.loading()) return 'Categories are still loading.';
    if (!this.categoriesAvailable()) return 'Categories could not be loaded.';
    if (this.categories().length === 0) {
      return 'Add at least one category before creating a problem.';
    }
    return null;
  });
  readonly editableIds = computed<ReadonlySet<string>>(() => {
    if (!this.categoriesAvailable()) return new Set();
    const categoryIds = new Set(this.categories().map(({ id }) => id));
    return new Set(
      this.problems()
        .filter(({ category }) => categoryIds.has(category.id))
        .map(({ id }) => id),
    );
  });

  constructor() {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.warning.set(null);
    this.categoriesAvailable.set(true);
    this.tagsAvailable.set(true);

    forkJoin({
      problems: this.problemsApi.getProblems(),
      categories: this.categoriesApi.getCategories().pipe(
        catchError(() => {
          this.categoriesAvailable.set(false);
          this.warning.set('Some reference data could not be loaded.');
          return of([] as readonly CategoryResource[]);
        }),
      ),
      tags: this.tagsApi.getTags().pipe(
        catchError(() => {
          this.tagsAvailable.set(false);
          this.warning.set('Some reference data could not be loaded.');
          return of([] as readonly TagResource[]);
        }),
      ),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ problems, categories, tags }) => {
          this.problems.set(problems);
          this.categories.set(categories);
          this.tags.set(tags);
          this.loading.set(false);
        },
        error: () => {
          this.problems.set([]);
          this.error.set('Problems could not be loaded.');
          this.loading.set(false);
        },
      });
  }

  reloadReferenceData(): void {
    this.warning.set(null);
    this.categoriesAvailable.set(true);
    this.tagsAvailable.set(true);

    forkJoin({
      categories: this.categoriesApi.getCategories().pipe(
        catchError(() => {
          this.categoriesAvailable.set(false);
          this.warning.set('Some reference data could not be loaded.');
          return of([] as readonly CategoryResource[]);
        }),
      ),
      tags: this.tagsApi.getTags().pipe(
        catchError(() => {
          this.tagsAvailable.set(false);
          this.warning.set('Some reference data could not be loaded.');
          return of([] as readonly TagResource[]);
        }),
      ),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(({ categories, tags }) => {
        this.categories.set(categories);
        this.tags.set(tags);
      });
  }

  openCreatePanel(): void {
    if (!this.canCreate()) return;
    if (this.activePanel()?.mode === 'create') return;
    if (!this.canSwitchPanel()) return;
    this.successMessage.set(null);
    this.activePanel.set({ mode: 'create' });
  }

  openEditPanel(problem: Problem): void {
    if (!this.editableIds().has(problem.id)) return;
    const active = this.activePanel();
    if (active?.mode === 'edit' && active.problem.id === problem.id) return;
    if (!this.canSwitchPanel()) return;
    this.successMessage.set(null);
    this.activePanel.set({ mode: 'edit', problem });
  }

  closePanel(): void {
    const active = this.activePanel();
    this.activePanel.set(null);
    queueMicrotask(() => {
      if (active?.mode === 'edit') {
        this.problemTable()?.focusEditButton(active.problem.id);
      } else {
        this.addProblemButton()?.nativeElement.focus();
      }
    });
  }

  onProblemSaved(problem: Problem): void {
    const mode = this.activePanel()?.mode;
    this.problems.update((current) => {
      const next =
        mode === 'edit'
          ? current.map((item) => (item.id === problem.id ? problem : item))
          : [...current, problem];
      return [...next].sort(compareProblems);
    });
    this.successMessage.set(
      mode === 'edit'
        ? `${problem.name} was updated.`
        : `${problem.name} was added.`,
    );
    this.closePanel();
  }

  private canSwitchPanel(): boolean {
    return this.activePanel() === null || (this.formPanel()?.canDiscardChanges() ?? true);
  }
}
