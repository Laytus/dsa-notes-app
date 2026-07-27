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

@Component({
  selector: 'app-problem-table',
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
  readonly editRequested = output<Problem>();
  readonly duplicateRequested = output<Problem>();
  readonly deleteRequested = output<Problem>();
  readonly reviewRequested = output<Problem>();
  readonly inlineEditRequested = output<{ readonly problem: Problem; readonly field: InlineProblemField }>();
  readonly inlineDraftChanged = output<string>();
  readonly inlineSaveRequested = output<void>();
  readonly inlineCancelRequested = output<void>();
  readonly expandedIds = signal<ReadonlySet<string>>(new Set());
  private readonly editButtons =
    viewChildren<ElementRef<HTMLButtonElement>>('editButton');
  private readonly duplicateButtons =
    viewChildren<ElementRef<HTMLButtonElement>>('duplicateButton');
  private readonly inlineTriggers =
    viewChildren<ElementRef<HTMLButtonElement>>('inlineTrigger');
  private readonly inlineEditors =
    viewChildren<ElementRef<HTMLInputElement | HTMLSelectElement>>('inlineEditor');

  isExpanded(id: string): boolean {
    return this.expandedIds().has(id);
  }

  toggle(id: string): void {
    const next = new Set(this.expandedIds());
    if (next.has(id)) next.delete(id);
    else next.add(id);
    this.expandedIds.set(next);
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

  formatTimestamp(value: string): string {
    const timestamp = new Date(value);
    if (Number.isNaN(timestamp.getTime())) return 'Invalid timestamp';
    return timestamp.toISOString().replace('T', ' ').replace(/\.\d{3}Z$/u, ' UTC');
  }
}
