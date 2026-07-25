import {
  ChangeDetectionStrategy,
  Component,
  input,
  signal,
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
  readonly expandedIds = signal<ReadonlySet<string>>(new Set());

  isExpanded(id: string): boolean {
    return this.expandedIds().has(id);
  }

  toggle(id: string): void {
    const next = new Set(this.expandedIds());
    if (next.has(id)) next.delete(id);
    else next.add(id);
    this.expandedIds.set(next);
  }

  formatTimestamp(value: string): string {
    const timestamp = new Date(value);
    if (Number.isNaN(timestamp.getTime())) return 'Invalid timestamp';
    return timestamp.toISOString().replace('T', ' ').replace(/\.\d{3}Z$/u, ' UTC');
  }
}
