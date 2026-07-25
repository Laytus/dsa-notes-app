import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  signal,
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
import { ProblemTable } from '../problem-table/problem-table';

@Component({
  selector: 'app-problem-list-page',
  imports: [ProblemTable],
  templateUrl: './problem-list-page.html',
  styleUrl: './problem-list-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProblemListPage {
  private readonly problemsApi = inject(ProblemsApiService);
  private readonly categoriesApi = inject(CategoriesApiService);
  private readonly tagsApi = inject(TagsApiService);
  private readonly destroyRef = inject(DestroyRef);

  readonly problems = signal<readonly Problem[]>([]);
  readonly categories = signal<readonly CategoryResource[]>([]);
  readonly tags = signal<readonly TagResource[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly warning = signal<string | null>(null);

  constructor() {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.warning.set(null);

    forkJoin({
      problems: this.problemsApi.getProblems(),
      categories: this.categoriesApi.getCategories().pipe(
        catchError(() => {
          this.warning.set('Some reference data could not be loaded.');
          return of([] as readonly CategoryResource[]);
        }),
      ),
      tags: this.tagsApi.getTags().pipe(
        catchError(() => {
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
}
