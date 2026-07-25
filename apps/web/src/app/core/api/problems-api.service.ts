import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type { Observable } from 'rxjs';
import type { Problem } from './api.models';

@Injectable({ providedIn: 'root' })
export class ProblemsApiService {
  private readonly http = inject(HttpClient);

  getProblems(): Observable<readonly Problem[]> {
    return this.http.get<readonly Problem[]>('/api/problems');
  }
}
