import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  HostListener,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import type {
  CategoryResource,
  TagResource,
} from '../../../core/api/api.models';
import { CategoriesApiService } from '../../../core/api/categories-api.service';
import { TagsApiService } from '../../../core/api/tags-api.service';

type AdminSection = 'categories' | 'tags';
type NamedResource = CategoryResource | TagResource;

interface ApiErrorEnvelope {
  readonly error?: { readonly code?: unknown };
}

function errorCode(error: HttpErrorResponse): string | null {
  if (typeof error.error !== 'object' || error.error === null) return null;
  const envelope = error.error as ApiErrorEnvelope;
  return typeof envelope.error?.code === 'string'
    ? envelope.error.code
    : null;
}

@Component({
  selector: 'app-reference-admin-panel',
  imports: [ReactiveFormsModule],
  templateUrl: './reference-admin-panel.html',
  styleUrl: './reference-admin-panel.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReferenceAdminPanel {
  private readonly categoriesApi = inject(CategoriesApiService);
  private readonly tagsApi = inject(TagsApiService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly createInput =
    viewChild<ElementRef<HTMLInputElement>>('createInput');

  readonly categories = input.required<readonly CategoryResource[]>();
  readonly tags = input.required<readonly TagResource[]>();
  readonly initialSection = input<AdminSection>('categories');
  readonly closed = output<void>();
  readonly categoryCreated = output<CategoryResource>();
  readonly categoryRenamed = output<CategoryResource>();
  readonly categoryDeleted = output<string>();
  readonly tagCreated = output<TagResource>();
  readonly tagRenamed = output<TagResource>();
  readonly tagDeleted = output<string>();

  readonly section = signal<AdminSection>('categories');
  readonly createName = new FormControl('', { nonNullable: true });
  readonly renameName = new FormControl('', { nonNullable: true });
  readonly createForm = new FormGroup({ name: this.createName });
  readonly renameForm = new FormGroup({ name: this.renameName });
  readonly editingId = signal<string | null>(null);
  readonly categoryCreating = signal(false);
  readonly categoryRenamingIds = signal<ReadonlySet<string>>(new Set());
  readonly categoryDeletingIds = signal<ReadonlySet<string>>(new Set());
  readonly categoryCreateError = signal<string | null>(null);
  readonly categoryRenameErrors = signal<ReadonlyMap<string, string>>(new Map());
  readonly categoryDeleteErrors = signal<ReadonlyMap<string, string>>(new Map());
  readonly tagCreating = signal(false);
  readonly tagRenamingIds = signal<ReadonlySet<string>>(new Set());
  readonly tagDeletingIds = signal<ReadonlySet<string>>(new Set());
  readonly tagCreateError = signal<string | null>(null);
  readonly tagRenameErrors = signal<ReadonlyMap<string, string>>(new Map());
  readonly tagDeleteErrors = signal<ReadonlyMap<string, string>>(new Map());

  constructor() {
    this.section.set(this.initialSection());
    queueMicrotask(() => this.createInput()?.nativeElement.focus());
  }

  @HostListener('document:keydown.escape', ['$event'])
  onEscape(event: Event): void {
    if (this.editingId() !== null) {
      event.preventDefault();
      this.cancelRename();
      return;
    }
    if (this.canClose()) {
      event.preventDefault();
      this.closed.emit();
    }
  }

  switchSection(section: AdminSection): void {
    if (section === this.section()) return;
    if (this.hasPendingOperation()) return;
    if (this.hasDirtyInput() && !window.confirm('Discard the unfinished name?')) {
      return;
    }
    this.resetInputs();
    this.section.set(section);
    queueMicrotask(() => this.createInput()?.nativeElement.focus());
  }

  requestClose(): void {
    if (this.canClose()) this.closed.emit();
  }

  create(): void {
    if (this.activeCreating()) return;
    const name = this.createName.value.trim();
    this.activeCreateError().set(null);
    if (!name) {
      this.activeCreateError().set(`Enter a ${this.singularName()} name.`);
      this.createName.markAsTouched();
      return;
    }

    this.activeCreatingState().set(true);
    const request =
      this.section() === 'categories'
        ? this.categoriesApi.createCategory({ name })
        : this.tagsApi.createTag({ name });
    request.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (resource) => {
        this.activeCreatingState().set(false);
        this.createName.reset('');
        if (this.section() === 'categories') {
          this.categoryCreated.emit(resource as CategoryResource);
        } else {
          this.tagCreated.emit(resource as TagResource);
        }
        queueMicrotask(() => this.createInput()?.nativeElement.focus());
      },
      error: (error: unknown) => {
        this.activeCreatingState().set(false);
        this.activeCreateError().set(this.operationError(error, 'create'));
      },
    });
  }

  startRename(resource: NamedResource): void {
    if (this.isPending(resource.id)) return;
    if (
      this.editingId() !== null &&
      this.renameName.dirty &&
      !window.confirm('Discard the unfinished rename?')
    ) {
      return;
    }
    this.editingId.set(resource.id);
    this.renameName.reset(resource.name);
    queueMicrotask(() => {
      document
        .querySelector<HTMLInputElement>(
          `[data-rename-input="${resource.id}"]`,
        )
        ?.focus();
    });
  }

  cancelRename(): void {
    this.editingId.set(null);
    this.renameName.reset('');
  }

  rename(resource: NamedResource): void {
    if (this.activeRenamingIds()().has(resource.id)) return;
    const name = this.renameName.value.trim();
    this.clearMapError(this.activeRenameErrors(), resource.id);
    if (!name) {
      this.setMapError(
        this.activeRenameErrors(),
        resource.id,
        `Enter a ${this.singularName()} name.`,
      );
      return;
    }

    this.activeRenamingIds().update((current) =>
      new Set(current).add(resource.id),
    );
    const request =
      this.section() === 'categories'
        ? this.categoriesApi.updateCategory(resource.id, { name })
        : this.tagsApi.updateTag(resource.id, { name });
    request.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (updated) => {
        this.clearPending(this.activeRenamingIds(), resource.id);
        this.cancelRename();
        if (this.section() === 'categories') {
          this.categoryRenamed.emit(updated as CategoryResource);
        } else {
          this.tagRenamed.emit(updated as TagResource);
        }
      },
      error: (error: unknown) => {
        this.clearPending(this.activeRenamingIds(), resource.id);
        this.setMapError(
          this.activeRenameErrors(),
          resource.id,
          this.operationError(error, 'rename'),
        );
      },
    });
  }

  delete(resource: NamedResource): void {
    if (this.activeDeletingIds()().has(resource.id)) return;
    const message =
      this.section() === 'categories'
        ? `Delete category “${resource.name}”?`
        : `Delete tag “${resource.name}”? This tag will be removed from every problem.`;
    if (!window.confirm(message)) return;

    this.clearMapError(this.activeDeleteErrors(), resource.id);
    this.activeDeletingIds().update((current) =>
      new Set(current).add(resource.id),
    );
    const request =
      this.section() === 'categories'
        ? this.categoriesApi.deleteCategory(resource.id)
        : this.tagsApi.deleteTag(resource.id);
    request.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.clearPending(this.activeDeletingIds(), resource.id);
        if (this.section() === 'categories') {
          this.categoryDeleted.emit(resource.id);
        } else {
          this.tagDeleted.emit(resource.id);
        }
      },
      error: (error: unknown) => {
        this.clearPending(this.activeDeletingIds(), resource.id);
        this.setMapError(
          this.activeDeleteErrors(),
          resource.id,
          this.operationError(error, 'delete'),
        );
      },
    });
  }

  isPending(id: string): boolean {
    return (
      this.activeRenamingIds()().has(id) ||
      this.activeDeletingIds()().has(id)
    );
  }

  private canClose(): boolean {
    if (this.hasPendingOperation()) return false;
    return (
      !this.hasDirtyInput() ||
      window.confirm('Discard the unfinished category or tag name?')
    );
  }

  private hasDirtyInput(): boolean {
    return this.createName.value.length > 0 || this.editingId() !== null;
  }

  private singularName(): string {
    return this.section() === 'categories' ? 'category' : 'tag';
  }

  private resetInputs(): void {
    this.createName.reset('');
    this.cancelRename();
    this.activeCreateError().set(null);
  }

  activeCreating(): boolean {
    return this.activeCreatingState()();
  }

  activeRenaming(): ReadonlySet<string> {
    return this.activeRenamingIds()();
  }

  activeDeleting(): ReadonlySet<string> {
    return this.activeDeletingIds()();
  }

  activeCreateErrorValue(): string | null {
    return this.activeCreateError()();
  }

  activeRenameError(id: string): string | undefined {
    return this.activeRenameErrors()().get(id);
  }

  activeDeleteError(id: string): string | undefined {
    return this.activeDeleteErrors()().get(id);
  }

  private operationError(
    error: unknown,
    operation: 'create' | 'rename' | 'delete',
  ): string {
    const resource = this.singularName();
    if (!(error instanceof HttpErrorResponse)) {
      return `The ${resource} could not be ${this.pastTense(operation)}.`;
    }
    if (error.status === 0) {
      return `Could not connect to the API. The ${resource} was not ${this.pastTense(operation)}.`;
    }

    switch (errorCode(error)) {
      case 'CATEGORY_NAME_CONFLICT':
        return 'A category with this name already exists.';
      case 'TAG_NAME_CONFLICT':
        return 'A tag with this name already exists.';
      case 'CATEGORY_IN_USE':
        return 'This category is used by one or more problems. Reassign or delete those problems first.';
      case 'CATEGORY_NOT_FOUND':
        return 'This category no longer exists. Reload reference data and try again.';
      case 'TAG_NOT_FOUND':
        return 'This tag no longer exists. Reload reference data and try again.';
      case 'INVALID_CATEGORY_NAME':
      case 'INVALID_TAG_NAME':
      case 'VALIDATION_ERROR':
        return `Enter a valid ${resource} name.`;
      default:
        return `The ${resource} could not be ${this.pastTense(operation)}. Try again.`;
    }
  }

  private pastTense(operation: 'create' | 'rename' | 'delete'): string {
    return operation === 'create'
      ? 'created'
      : operation === 'rename'
        ? 'renamed'
        : 'deleted';
  }

  private clearPending(state: typeof this.categoryRenamingIds, id: string): void {
    state.update((current) => {
      const next = new Set(current);
      next.delete(id);
      return next;
    });
  }

  private setMapError(
    state: typeof this.categoryRenameErrors,
    id: string,
    message: string,
  ): void {
    state.update((current) => new Map(current).set(id, message));
  }

  private clearMapError(
    state: typeof this.categoryRenameErrors,
    id: string,
  ): void {
    state.update((current) => {
      const next = new Map(current);
      next.delete(id);
      return next;
    });
  }

  private hasPendingOperation(): boolean {
    return (
      this.categoryCreating() ||
      this.tagCreating() ||
      this.categoryRenamingIds().size > 0 ||
      this.tagRenamingIds().size > 0 ||
      this.categoryDeletingIds().size > 0 ||
      this.tagDeletingIds().size > 0
    );
  }

  private activeCreatingState():
    | typeof this.categoryCreating
    | typeof this.tagCreating {
    return this.section() === 'categories'
      ? this.categoryCreating
      : this.tagCreating;
  }

  private activeCreateError():
    | typeof this.categoryCreateError
    | typeof this.tagCreateError {
    return this.section() === 'categories'
      ? this.categoryCreateError
      : this.tagCreateError;
  }

  private activeRenamingIds():
    | typeof this.categoryRenamingIds
    | typeof this.tagRenamingIds {
    return this.section() === 'categories'
      ? this.categoryRenamingIds
      : this.tagRenamingIds;
  }

  private activeDeletingIds():
    | typeof this.categoryDeletingIds
    | typeof this.tagDeletingIds {
    return this.section() === 'categories'
      ? this.categoryDeletingIds
      : this.tagDeletingIds;
  }

  private activeRenameErrors():
    | typeof this.categoryRenameErrors
    | typeof this.tagRenameErrors {
    return this.section() === 'categories'
      ? this.categoryRenameErrors
      : this.tagRenameErrors;
  }

  private activeDeleteErrors():
    | typeof this.categoryDeleteErrors
    | typeof this.tagDeleteErrors {
    return this.section() === 'categories'
      ? this.categoryDeleteErrors
      : this.tagDeleteErrors;
  }
}
