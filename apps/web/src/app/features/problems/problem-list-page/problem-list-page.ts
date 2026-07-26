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
import { CreateProblemPanel } from '../create-problem-panel/create-problem-panel';
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

@Component({
  selector: 'app-problem-list-page',
  imports: [CreateProblemPanel, ProblemTable],
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

  readonly problems = signal<readonly Problem[]>([]);
  readonly categories = signal<readonly CategoryResource[]>([]);
  readonly tags = signal<readonly TagResource[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly warning = signal<string | null>(null);
  readonly categoriesAvailable = signal(true);
  readonly tagsAvailable = signal(true);
  readonly createPanelOpen = signal(false);
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
    this.successMessage.set(null);
    this.createPanelOpen.set(true);
  }

  closeCreatePanel(): void {
    this.createPanelOpen.set(false);
    queueMicrotask(() => this.addProblemButton()?.nativeElement.focus());
  }

  onProblemCreated(problem: Problem): void {
    this.problems.update((current) =>
      [...current, problem].sort(compareProblems),
    );
    this.successMessage.set(`${problem.name} was added.`);
    this.closeCreatePanel();
  }
}
