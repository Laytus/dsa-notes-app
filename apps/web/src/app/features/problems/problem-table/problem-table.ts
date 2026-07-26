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

@Component({
  selector: 'app-problem-table',
  templateUrl: './problem-table.html',
  styleUrl: './problem-table.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProblemTable {
  readonly problems = input.required<readonly Problem[]>();
  readonly editableIds = input<ReadonlySet<string>>(new Set());
  readonly deletingIds = input<ReadonlySet<string>>(new Set());
  readonly deleteErrors = input<ReadonlyMap<string, string>>(new Map());
  readonly reviewingIds = input<ReadonlySet<string>>(new Set());
  readonly reviewErrors = input<ReadonlyMap<string, string>>(new Map());
  readonly reviewDisabledReasons = input<ReadonlyMap<string, string>>(
    new Map(),
  );
  readonly editRequested = output<Problem>();
  readonly deleteRequested = output<Problem>();
  readonly reviewRequested = output<Problem>();
  readonly expandedIds = signal<ReadonlySet<string>>(new Set());
  private readonly editButtons =
    viewChildren<ElementRef<HTMLButtonElement>>('editButton');

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

  formatTimestamp(value: string): string {
    const timestamp = new Date(value);
    if (Number.isNaN(timestamp.getTime())) return 'Invalid timestamp';
    return timestamp.toISOString().replace('T', ' ').replace(/\.\d{3}Z$/u, ' UTC');
  }
}
