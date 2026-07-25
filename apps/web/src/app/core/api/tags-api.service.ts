import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type { Observable } from 'rxjs';
import type { TagResource } from './api.models';

@Injectable({ providedIn: 'root' })
export class TagsApiService {
  private readonly http = inject(HttpClient);

  getTags(): Observable<readonly TagResource[]> {
    return this.http.get<readonly TagResource[]>('/api/tags');
  }
}
