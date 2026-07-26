import { HttpErrorResponse } from '@angular/common/http';
import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  AbstractControl,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  type ValidationErrors,
  Validators,
} from '@angular/forms';
import type {
  CategoryResource,
  CreateProblemRequest,
  Difficulty,
  LinkInput,
  Problem,
  ProblemStatus,
  TagResource,
} from '../../../core/api/api.models';
import { ProblemsApiService } from '../../../core/api/problems-api.service';

const SOLUTION_DEFAULT_LABEL = 'View solution';
const SOURCE_DEFAULT_LABEL = 'LeetCode';

function trimmedRequired(control: AbstractControl<string>): ValidationErrors | null {
  return control.value.trim() ? null : { trimmedRequired: true };
}

export function absoluteHttpUrl(
  control: AbstractControl<string>,
): ValidationErrors | null {
  const value = control.value.trim();
  if (!value) return null;

  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:'
      ? null
      : { absoluteHttpUrl: true };
  } catch {
    return { absoluteHttpUrl: true };
  }
}

export function nonnegativeInteger(
  control: AbstractControl<number | null>,
): ValidationErrors | null {
  const value = control.value;
  return value !== null &&
    Number.isInteger(value) &&
    value >= 0 &&
    value <= 2_147_483_647
    ? null
    : { nonnegativeInteger: true };
}

export function strictOptionalDate(
  control: AbstractControl<string>,
): ValidationErrors | null {
  const value = control.value;
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/u.exec(value);
  if (!match) return { strictDate: true };

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const days = [
    31,
    year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0) ? 29 : 28,
    31,
    30,
    31,
    30,
    31,
    31,
    30,
    31,
    30,
    31,
  ];

  return year >= 1 &&
    month >= 1 &&
    month <= 12 &&
    day >= 1 &&
    day <= (days[month - 1] ?? 0)
    ? null
    : { strictDate: true };
}

interface ApiErrorEnvelope {
  readonly error?: {
    readonly code?: unknown;
  };
}

function apiErrorCode(error: HttpErrorResponse): string | null {
  if (typeof error.error !== 'object' || error.error === null) return null;
  const envelope = error.error as ApiErrorEnvelope;
  return typeof envelope.error?.code === 'string'
    ? envelope.error.code
    : null;
}

@Component({
  selector: 'app-create-problem-panel',
  imports: [ReactiveFormsModule],
  templateUrl: './create-problem-panel.html',
  styleUrl: './create-problem-panel.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CreateProblemPanel implements AfterViewInit {
  private readonly problemsApi = inject(ProblemsApiService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly nameInput =
    viewChild.required<ElementRef<HTMLInputElement>>('nameInput');
  private readonly formElement =
    viewChild.required<ElementRef<HTMLFormElement>>('problemForm');

  readonly categories = input.required<readonly CategoryResource[]>();
  readonly tags = input.required<readonly TagResource[]>();
  readonly tagsAvailable = input.required<boolean>();
  readonly created = output<Problem>();
  readonly closed = output<void>();

  readonly submitted = signal(false);
  readonly saving = signal(false);
  readonly saveError = signal<string | null>(null);

  readonly form = new FormGroup({
    name: new FormControl('', {
      nonNullable: true,
      validators: [trimmedRequired],
    }),
    categoryId: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    difficulty: new FormControl<Difficulty | null>(null),
    status: new FormControl<ProblemStatus>('To solve', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    tagIds: new FormControl<readonly string[]>([], { nonNullable: true }),
    solutionUrl: new FormControl('', {
      nonNullable: true,
      validators: [absoluteHttpUrl],
    }),
    solutionLabel: new FormControl(SOLUTION_DEFAULT_LABEL, {
      nonNullable: true,
    }),
    sourceUrl: new FormControl('', {
      nonNullable: true,
      validators: [absoluteHttpUrl],
    }),
    sourceLabel: new FormControl(SOURCE_DEFAULT_LABEL, {
      nonNullable: true,
    }),
    notes: new FormControl('', { nonNullable: true }),
    timesSolved: new FormControl<number | null>(0, {
      validators: [nonnegativeInteger],
    }),
    lastReviewedOn: new FormControl('', {
      nonNullable: true,
      validators: [strictOptionalDate],
    }),
  });

  ngAfterViewInit(): void {
    this.nameInput().nativeElement.focus();
  }

  showError(control: AbstractControl<unknown>): boolean {
    return control.invalid && (control.touched || this.submitted());
  }

  onTagChange(tagId: string, event: Event): void {
    if (!(event.target instanceof HTMLInputElement)) return;
    const selected = this.form.controls.tagIds.value;
    this.form.controls.tagIds.setValue(
      event.target.checked
        ? [...selected, tagId]
        : selected.filter((id) => id !== tagId),
    );
    this.form.controls.tagIds.markAsDirty();
  }

  requestClose(): void {
    if (this.saving()) return;
    if (
      this.form.dirty &&
      !window.confirm('Discard the changes to this problem?')
    ) {
      return;
    }
    this.closed.emit();
  }

  submit(): void {
    if (this.saving()) return;
    this.submitted.set(true);
    this.saveError.set(null);

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      queueMicrotask(() => {
        const invalid = this.formElement().nativeElement.querySelector<HTMLElement>(
          '[aria-invalid="true"]',
        );
        invalid?.focus();
      });
      return;
    }

    const request = this.toRequest();
    this.saving.set(true);
    this.problemsApi
      .createProblem(request)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (problem) => {
          this.saving.set(false);
          this.form.reset({
            name: '',
            categoryId: '',
            difficulty: null,
            status: 'To solve',
            tagIds: [],
            solutionUrl: '',
            solutionLabel: SOLUTION_DEFAULT_LABEL,
            sourceUrl: '',
            sourceLabel: SOURCE_DEFAULT_LABEL,
            notes: '',
            timesSolved: 0,
            lastReviewedOn: '',
          });
          this.created.emit(problem);
        },
        error: (error: unknown) => {
          this.saving.set(false);
          this.handleSaveError(error);
        },
      });
  }

  private toRequest(): CreateProblemRequest {
    const value = this.form.getRawValue();
    return {
      name: value.name.trim(),
      categoryId: value.categoryId,
      difficulty: value.difficulty,
      status: value.status,
      tagIds: value.tagIds,
      solution: this.toLink(
        value.solutionUrl,
        value.solutionLabel,
        SOLUTION_DEFAULT_LABEL,
      ),
      source: this.toLink(
        value.sourceUrl,
        value.sourceLabel,
        SOURCE_DEFAULT_LABEL,
      ),
      notes: value.notes,
      timesSolved: value.timesSolved as number,
      lastReviewedOn: value.lastReviewedOn || null,
    };
  }

  private toLink(
    rawUrl: string,
    rawLabel: string,
    defaultLabel: string,
  ): LinkInput | null {
    const url = rawUrl.trim();
    if (!url) return null;
    return { url, label: rawLabel.trim() || defaultLabel };
  }

  private handleSaveError(error: unknown): void {
    if (!(error instanceof HttpErrorResponse)) {
      this.saveError.set('The problem could not be created.');
      return;
    }
    if (error.status === 0) {
      this.saveError.set('Could not connect to the API.');
      return;
    }

    switch (apiErrorCode(error)) {
      case 'CATEGORY_REFERENCE_NOT_FOUND':
      case 'INVALID_CATEGORY_ID':
        this.form.controls.categoryId.setErrors({ serverReference: true });
        this.form.controls.categoryId.markAsTouched();
        this.saveError.set('Select an available category and try again.');
        break;
      case 'TAG_REFERENCE_NOT_FOUND':
      case 'INVALID_TAG_ID':
      case 'DUPLICATE_TAG_IDS':
        this.form.controls.tagIds.setErrors({ serverReference: true });
        this.saveError.set('One or more selected tags are no longer available.');
        break;
      case 'INVALID_PROBLEM_NAME':
      case 'INVALID_PROBLEM_BODY':
      case 'INVALID_DIFFICULTY':
      case 'INVALID_STATUS':
      case 'INVALID_URL':
      case 'INVALID_LINK_LABEL':
      case 'INVALID_NOTES':
      case 'INVALID_TIMES_SOLVED':
      case 'INVALID_LAST_REVIEWED_ON':
      case 'VALIDATION_ERROR':
        this.saveError.set('Review the form values and try again.');
        break;
      default:
        this.saveError.set('The problem could not be created.');
    }
  }
}
