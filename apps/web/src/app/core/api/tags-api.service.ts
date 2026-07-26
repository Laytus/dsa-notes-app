import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type { Observable } from 'rxjs';
import type { NamedResourceRequest, TagResource } from './api.models';

@Injectable({ providedIn: 'root' })
export class TagsApiService {
  private readonly http = inject(HttpClient);

  getTags(): Observable<readonly TagResource[]> {
    return this.http.get<readonly TagResource[]>('/api/tags');
  }

  createTag(request: NamedResourceRequest): Observable<TagResource> {
    return this.http.post<TagResource>('/api/tags', request);
  }

  updateTag(
    id: string,
    request: NamedResourceRequest,
  ): Observable<TagResource> {
    return this.http.patch<TagResource>(
      `/api/tags/${encodeURIComponent(id)}`,
      request,
    );
  }

  deleteTag(id: string): Observable<void> {
    return this.http.delete<void>(`/api/tags/${encodeURIComponent(id)}`);
  }
}
