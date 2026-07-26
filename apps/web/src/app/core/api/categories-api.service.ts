import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type { Observable } from 'rxjs';
import type { CategoryResource, NamedResourceRequest } from './api.models';

@Injectable({ providedIn: 'root' })
export class CategoriesApiService {
  private readonly http = inject(HttpClient);

  getCategories(): Observable<readonly CategoryResource[]> {
    return this.http.get<readonly CategoryResource[]>('/api/categories');
  }

  createCategory(request: NamedResourceRequest): Observable<CategoryResource> {
    return this.http.post<CategoryResource>('/api/categories', request);
  }

  updateCategory(
    id: string,
    request: NamedResourceRequest,
  ): Observable<CategoryResource> {
    return this.http.patch<CategoryResource>(
      `/api/categories/${encodeURIComponent(id)}`,
      request,
    );
  }

  deleteCategory(id: string): Observable<void> {
    return this.http.delete<void>(
      `/api/categories/${encodeURIComponent(id)}`,
    );
  }
}
