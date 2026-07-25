import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type { Observable } from 'rxjs';
import type { CategoryResource } from './api.models';

@Injectable({ providedIn: 'root' })
export class CategoriesApiService {
  private readonly http = inject(HttpClient);

  getCategories(): Observable<readonly CategoryResource[]> {
    return this.http.get<readonly CategoryResource[]>('/api/categories');
  }
}
