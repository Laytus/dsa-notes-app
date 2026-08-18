import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  input,
  output,
  signal,
  viewChildren,
} from '@angular/core';
import type { Problem } from '../../../core/api/api.models';
import type { CategoryResource, Difficulty, ProblemStatus } from '../../../core/api/api.models';
import type { InlineProblemEdit, InlineProblemField } from '../inline-problem-edit';
import type { ExpandedNotesEditor, ExpandedNotesEditorMode } from '../expanded-notes-editor';
import type { ProblemSort, ProblemSortField } from '../problem-sorting';
import { MarkdownRendererComponent } from '../markdown-renderer/markdown-renderer';

@Component({
  selector: 'app-problem-table',
  imports: [MarkdownRendererComponent],
  host: { '(dblclick)': 'handleNotesHeaderDoubleClick($event)' },
  templateUrl: './problem-table.html',
  styleUrl: './problem-table.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProblemTable {
  readonly problems = input.required<readonly Problem[]>();
  readonly editableIds = input<ReadonlySet<string>>(new Set());
  readonly duplicatingIds = input<ReadonlySet<string>>(new Set());
  readonly duplicateErrors = input<ReadonlyMap<string, string>>(new Map());
  readonly duplicateDisabledIds = input<ReadonlySet<string>>(new Set());
  readonly deletingIds = input<ReadonlySet<string>>(new Set());
  readonly deleteErrors = input<ReadonlyMap<string, string>>(new Map());
  readonly reviewingIds = input<ReadonlySet<string>>(new Set());
  readonly reviewErrors = input<ReadonlyMap<string, string>>(new Map());
  readonly reviewDisabledReasons = input<ReadonlyMap<string, string>>(
    new Map(),
  );
  readonly categories = input<readonly CategoryResource[]>([]);
  readonly difficulties = input<readonly Difficulty[]>([]);
  readonly statuses = input<readonly ProblemStatus[]>([]);
  readonly inlineEdit = input<InlineProblemEdit | null>(null);
  readonly inlineSaving = input(false);
  readonly inlineError = input<string | null>(null);
  readonly inlinePendingProblemId = input<string | null>(null);
  readonly activeSort = input<ProblemSort | null>(null);
  readonly notesEditor = input<ExpandedNotesEditor | null>(null);
  readonly notesSaving = input(false);
  readonly notesError = input<string | null>(null);
  readonly editRequested = output<Problem>();
  readonly duplicateRequested = output<Problem>();
  readonly deleteRequested = output<Problem>();
  readonly reviewRequested = output<Problem>();
  readonly inlineEditRequested = output<{ readonly problem: Problem; readonly field: InlineProblemField }>();
  readonly inlineDraftChanged = output<string>();
  readonly inlineSaveRequested = output<void>();
  readonly inlineCancelRequested = output<void>();
  readonly sortRequested = output<ProblemSortField>();
  readonly notesEditRequested = output<Problem>();
  readonly notesDraftChanged = output<string>();
  readonly notesModeRequested = output<ExpandedNotesEditorMode>();
  readonly notesSaveRequested = output<void>();
  readonly notesCancelRequested = output<void>();
  readonly expansionRequested = output<string>();
  readonly expandedIds = signal<ReadonlySet<string>>(new Set());
  private readonly editButtons =
    viewChildren<ElementRef<HTMLButtonElement>>('editButton');
  private readonly duplicateButtons =
    viewChildren<ElementRef<HTMLButtonElement>>('duplicateButton');
  private readonly inlineTriggers =
    viewChildren<ElementRef<HTMLButtonElement>>('inlineTrigger');
  private readonly inlineEditors =
    viewChildren<ElementRef<HTMLInputElement | HTMLSelectElement>>('inlineEditor');
  private readonly notesTextareas = viewChildren<ElementRef<HTMLTextAreaElement>>('notesTextarea');
  private readonly notesButtons = viewChildren<ElementRef<HTMLButtonElement>>('notesButton');
  private readonly notesModeButtons = viewChildren<ElementRef<HTMLButtonElement>>('notesModeButton');

  isExpanded(id: string): boolean {
    return this.expandedIds().has(id);
  }

  toggle(id: string): void {
    const next = new Set(this.expandedIds());
    if (next.has(id)) next.delete(id);
    else next.add(id);
    this.expandedIds.set(next);
  }

  requestExpansion(id: string): void {
    this.expansionRequested.emit(id);
  }

  removeExpanded(id: string): void {
    if (!this.expandedIds().has(id)) return;
    const next = new Set(this.expandedIds());
    next.delete(id);
    this.expandedIds.set(next);
  }

  focusEditButton(id: string): void {
    this.editButtons()
      .find(({ nativeElement }) => nativeElement.dataset['problemId'] === id)
      ?.nativeElement.focus();
  }

  focusDuplicateButton(id: string): void {
    this.duplicateButtons()
      .find(({ nativeElement }) => nativeElement.dataset['problemId'] === id)
      ?.nativeElement.focus();
  }

  focusInlineTrigger(id: string, field: InlineProblemField): void {
    this.inlineTriggers()
      .find(({ nativeElement }) =>
        nativeElement.dataset['problemId'] === id && nativeElement.dataset['field'] === field,
      )
      ?.nativeElement.focus();
  }

  focusInlineEditor(): void {
    this.inlineEditors()[0]?.nativeElement.focus();
  }

  focusNotesTextarea(): void {
    this.notesTextareas()[0]?.nativeElement.focus();
  }

  focusNotesButton(id: string): void {
    this.notesButtons()
      .find(({ nativeElement }) => nativeElement.dataset['problemId'] === id)
      ?.nativeElement.focus();
  }

  focusNotesModeButton(mode: ExpandedNotesEditorMode): void {
    this.notesModeButtons()
      .find(({ nativeElement }) => nativeElement.dataset['mode'] === mode)
      ?.nativeElement.focus();
  }

  handleNotesEditorKeydown(event: KeyboardEvent): void {
    if (
      event.key !== 'Enter' ||
      (!event.metaKey && !event.ctrlKey)
    ) {
      return;
    }

    event.preventDefault();
    if (this.notesSaving()) return;

    if (event.shiftKey) {
      const editor = this.notesEditor();
      if (editor === null) return;
      this.notesModeRequested.emit(
        editor.mode === 'edit' ? 'preview' : 'edit',
      );
      return;
    }

    this.notesSaveRequested.emit();
  }

  handleNotesHeaderDoubleClick(event: MouseEvent): void {
    const header = this.notesHeaderTarget(event.target);
    const problemId = header?.dataset['problemId'];
    const problem = this.problems().find(({ id }) => id === problemId);
    if (
      this.notesSaving() ||
      problem === undefined ||
      this.notesEditor()?.problemId === problem.id ||
      this.isInteractiveTarget(event.target)
    ) {
      return;
    }
    this.notesEditRequested.emit(problem);
  }

  private isInteractiveTarget(target: EventTarget | null): boolean {
    return target instanceof Element && target.closest(
      'a, button, input, textarea, select, option, label, [role="button"], [contenteditable]',
    ) !== null;
  }

  private notesHeaderTarget(target: EventTarget | null): HTMLElement | null {
    return target instanceof Element
      ? target.closest<HTMLElement>('[data-notes-header]')
      : null;
  }

  isSorted(field: ProblemSortField): boolean {
    return this.activeSort()?.field === field;
  }

  sortDirection(field: ProblemSortField): 'ascending' | 'descending' | 'none' {
    return this.isSorted(field) ? this.activeSort()!.direction : 'none';
  }

  sortButtonLabel(field: ProblemSortField, label: string): string {
    const direction = this.isSorted(field)
      ? this.activeSort()!.direction === 'ascending'
        ? 'descending'
        : 'ascending'
      : 'ascending';
    return `Sort by ${label} ${direction}`;
  }

  formatTimestamp(value: string): string {
    const timestamp = new Date(value);
    if (Number.isNaN(timestamp.getTime())) return 'Invalid timestamp';
    return timestamp.toISOString().replace('T', ' ').replace(/\.\d{3}Z$/u, ' UTC');
  }

  previewTags(problem: Problem): readonly Problem['tags'][number][] {
    return problem.tags.slice(0, 2);
  }

  remainingTagCount(problem: Problem): number {
    return Math.max(0, problem.tags.length - this.previewTags(problem).length);
  }

  tagLabel(problem: Problem): string {
    return problem.tags.map(({ name }) => name).join(', ');
  }
}
