import { HttpErrorResponse } from '@angular/common/http';
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
import {
  formatLocalDate,
  LOCAL_DATE_SOURCE,
  POSTGRES_INTEGER_MAX,
} from '../problem-review';
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
  private readonly currentLocalDate = inject(LOCAL_DATE_SOURCE);
  private readonly addProblemButton =
    viewChild<ElementRef<HTMLButtonElement>>('addProblemButton');
  private readonly problemsHeading =
    viewChild<ElementRef<HTMLHeadingElement>>('problemsHeading');
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
  readonly deletingIds = signal<ReadonlySet<string>>(new Set());
  readonly deleteErrors = signal<ReadonlyMap<string, string>>(new Map());
  readonly reviewingIds = signal<ReadonlySet<string>>(new Set());
  readonly reviewErrors = signal<ReadonlyMap<string, string>>(new Map());
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
  readonly reviewDisabledReasons = computed<ReadonlyMap<string, string>>(() => {
    const active = this.activePanel();
    const reasons = new Map<string, string>();
    for (const problem of this.problems()) {
      if (!Number.isInteger(problem.timesSolved) || problem.timesSolved < 0) {
        reasons.set(
          problem.id,
          'Mark reviewed is unavailable because Times solved is invalid.',
        );
      } else if (problem.timesSolved >= POSTGRES_INTEGER_MAX) {
        reasons.set(
          problem.id,
          'Mark reviewed is unavailable because Times solved has reached its maximum.',
        );
      } else if (
        active?.mode === 'edit' &&
        active.problem.id === problem.id
      ) {
        reasons.set(
          problem.id,
          'Mark reviewed is unavailable while this problem is open for editing.',
        );
      }
    }
    return reasons;
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
    if (this.reviewingIds().has(problem.id)) return;
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
    if (mode === 'edit') this.replaceProblem(problem);
    else {
      this.problems.update((current) =>
        [...current, problem].sort(compareProblems),
      );
    }
    this.successMessage.set(
      mode === 'edit'
        ? `${problem.name} was updated.`
        : `${problem.name} was added.`,
    );
    this.closePanel();
  }

  requestDelete(problem: Problem): void {
    if (this.deletingIds().has(problem.id)) return;
    if (this.reviewingIds().has(problem.id)) return;

    const active = this.activePanel();
    const discardsDirtyEdit =
      active?.mode === 'edit' &&
      active.problem.id === problem.id &&
      (this.formPanel()?.hasUnsavedChanges() ?? false);
    const message = discardsDirtyEdit
      ? `Delete “${problem.name}”? This action cannot be undone and unsaved edits will be discarded.`
      : `Delete “${problem.name}”? This action cannot be undone.`;
    if (!window.confirm(message)) return;

    this.clearDeleteError(problem.id);
    this.deletingIds.update((current) => new Set(current).add(problem.id));
    this.problemsApi
      .deleteProblem(problem.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.clearDeleting(problem.id);
          this.clearReviewing(problem.id);
          this.clearReviewError(problem.id);
          this.problemTable()?.removeExpanded(problem.id);
          this.problems.update((current) =>
            current.filter(({ id }) => id !== problem.id),
          );
          const currentPanel = this.activePanel();
          if (
            currentPanel?.mode === 'edit' &&
            currentPanel.problem.id === problem.id
          ) {
            this.activePanel.set(null);
          }
          this.successMessage.set(`${problem.name} was deleted.`);
          queueMicrotask(() => {
            const addButton = this.addProblemButton()?.nativeElement;
            if (addButton && !addButton.disabled) addButton.focus();
            else this.problemsHeading()?.nativeElement.focus();
          });
        },
        error: (error: unknown) => {
          this.clearDeleting(problem.id);
          this.deleteErrors.update((current) => {
            const next = new Map(current);
            next.set(problem.id, this.deleteErrorMessage(error));
            return next;
          });
        },
      });
  }

  requestReview(problem: Problem): void {
    if (
      this.reviewingIds().has(problem.id) ||
      this.deletingIds().has(problem.id) ||
      this.reviewDisabledReasons().has(problem.id)
    ) {
      return;
    }

    this.clearReviewError(problem.id);
    this.reviewingIds.update((current) => new Set(current).add(problem.id));
    this.problemsApi
      .updateProblem(problem.id, {
        timesSolved: problem.timesSolved + 1,
        lastReviewedOn: formatLocalDate(this.currentLocalDate()),
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (reviewedProblem) => {
          this.clearReviewing(problem.id);
          this.replaceProblem(reviewedProblem);
          this.successMessage.set(`${reviewedProblem.name} was marked reviewed.`);
        },
        error: (error: unknown) => {
          this.clearReviewing(problem.id);
          this.reviewErrors.update((current) => {
            const next = new Map(current);
            next.set(problem.id, this.reviewErrorMessage(error));
            return next;
          });
        },
      });
  }

  private canSwitchPanel(): boolean {
    return this.activePanel() === null || (this.formPanel()?.canDiscardChanges() ?? true);
  }

  private clearDeleting(id: string): void {
    this.deletingIds.update((current) => {
      const next = new Set(current);
      next.delete(id);
      return next;
    });
  }

  private clearDeleteError(id: string): void {
    this.deleteErrors.update((current) => {
      const next = new Map(current);
      next.delete(id);
      return next;
    });
  }

  private clearReviewing(id: string): void {
    this.reviewingIds.update((current) => {
      const next = new Set(current);
      next.delete(id);
      return next;
    });
  }

  private clearReviewError(id: string): void {
    this.reviewErrors.update((current) => {
      const next = new Map(current);
      next.delete(id);
      return next;
    });
  }

  private replaceProblem(problem: Problem): void {
    this.problems.update((current) =>
      current
        .map((item) => (item.id === problem.id ? problem : item))
        .sort(compareProblems),
    );
  }

  private deleteErrorMessage(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      if (error.status === 0) {
        return 'Could not connect to the API. The problem was not deleted.';
      }
      if (error.status === 404) {
        return 'This problem no longer exists on the server. Refresh or try again.';
      }
    }
    return 'The problem could not be deleted. Try again.';
  }

  private reviewErrorMessage(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      if (error.status === 0) {
        return 'Could not connect to the API. The review was not saved.';
      }
      if (error.status === 404) {
        return 'This problem no longer exists on the server. Refresh or try again.';
      }
      if (error.status === 400) {
        return 'The review values were rejected. Refresh and try again.';
      }
    }
    return 'The problem could not be marked reviewed. Try again.';
  }
}
