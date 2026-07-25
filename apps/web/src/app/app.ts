import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ProblemListPage } from './features/problems/problem-list-page/problem-list-page';

@Component({
  selector: 'app-root',
  imports: [ProblemListPage],
  templateUrl: './app.html',
  styleUrl: './app.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {}
