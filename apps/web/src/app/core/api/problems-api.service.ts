import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type { Observable } from 'rxjs';
import type {
  CreateProblemRequest,
  Problem,
  UpdateProblemRequest,
} from './api.models';

@Injectable({ providedIn: 'root' })
export class ProblemsApiService {
  private readonly http = inject(HttpClient);

  getProblems(): Observable<readonly Problem[]> {
    return this.http.get<readonly Problem[]>('/api/problems');
  }

  createProblem(request: CreateProblemRequest): Observable<Problem> {
    return this.http.post<Problem>('/api/problems', request);
  }

  updateProblem(
    id: string,
    request: UpdateProblemRequest,
  ): Observable<Problem> {
    return this.http.patch<Problem>(`/api/problems/${id}`, request);
  }
}
