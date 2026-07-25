import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import type {
  CategoryResource,
  Problem,
  TagResource,
} from './api.models';
import { CategoriesApiService } from './categories-api.service';
import { ProblemsApiService } from './problems-api.service';
import { TagsApiService } from './tags-api.service';

describe('API services', () => {
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
  });

  it('requests typed problems once for one explicit load', async () => {
    const service = TestBed.inject(ProblemsApiService);
    const response: readonly Problem[] = [
      {
        id: '12',
        name: 'Two Sum',
        category: { id: '1', name: 'Arrays' },
        difficulty: 'Easy',
        status: 'Solved',
        tags: [{ id: '3', name: 'Hash Map' }],
        solution: null,
        source: null,
        notes: '',
        timesSolved: 2,
        lastReviewedOn: '2026-07-25',
        createdAt: '2026-07-25T18:30:00.000Z',
        updatedAt: '2026-07-25T18:30:00.000Z',
      },
    ];

    const result = firstValueFrom(service.getProblems());
    const request = httpTesting.expectOne('/api/problems');
    expect(request.request.method).toBe('GET');
    httpTesting.expectNone('/api/categories');
    request.flush(response);

    await expect(result).resolves.toEqual(response);
  });

  it('requests typed categories', async () => {
    const service = TestBed.inject(CategoriesApiService);
    const response: readonly CategoryResource[] = [
      {
        id: '1',
        name: 'Arrays',
        createdAt: '2026-07-25T18:30:00.000Z',
        updatedAt: '2026-07-25T18:30:00.000Z',
      },
    ];

    const result = firstValueFrom(service.getCategories());
    const request = httpTesting.expectOne('/api/categories');
    expect(request.request.method).toBe('GET');
    request.flush(response);
    await expect(result).resolves.toEqual(response);
  });

  it('requests typed tags', async () => {
    const service = TestBed.inject(TagsApiService);
    const response: readonly TagResource[] = [
      {
        id: '3',
        name: 'Hash Map',
        createdAt: '2026-07-25T18:30:00.000Z',
        updatedAt: '2026-07-25T18:30:00.000Z',
      },
    ];

    const result = firstValueFrom(service.getTags());
    const request = httpTesting.expectOne('/api/tags');
    expect(request.request.method).toBe('GET');
    request.flush(response);
    await expect(result).resolves.toEqual(response);
  });

  it('propagates HTTP failures to the caller', async () => {
    const service = TestBed.inject(ProblemsApiService);
    const result = firstValueFrom(service.getProblems());
    const request = httpTesting.expectOne('/api/problems');
    request.flush(
      { error: { code: 'INTERNAL_ERROR', message: 'private detail' } },
      { status: 500, statusText: 'Server Error' },
    );

    await expect(result).rejects.toMatchObject({ status: 500 });
  });
});
