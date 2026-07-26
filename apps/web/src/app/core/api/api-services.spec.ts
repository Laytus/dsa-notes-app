import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import type {
  CategoryResource,
  CreateProblemRequest,
  Problem,
  TagResource,
  UpdateProblemRequest,
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

  it('posts an exact typed create request without transforming string IDs', async () => {
    const service = TestBed.inject(ProblemsApiService);
    const requestBody: CreateProblemRequest = {
      name: 'Two Sum',
      categoryId: '9007199254740993',
      difficulty: null,
      status: 'To solve',
      tagIds: ['9007199254740995'],
      solution: null,
      source: null,
      notes: '',
      timesSolved: 0,
      lastReviewedOn: null,
    };
    const response: Problem = {
      id: '9007199254740997',
      name: 'Two Sum',
      category: { id: requestBody.categoryId, name: 'Arrays' },
      difficulty: null,
      status: 'To solve',
      tags: [{ id: '9007199254740995', name: 'Array' }],
      solution: null,
      source: null,
      notes: '',
      timesSolved: 0,
      lastReviewedOn: null,
      createdAt: '2026-07-25T18:30:00.000Z',
      updatedAt: '2026-07-25T18:30:00.000Z',
    };

    const result = firstValueFrom(service.createProblem(requestBody));
    const request = httpTesting.expectOne('/api/problems');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual(requestBody);
    request.flush(response);

    await expect(result).resolves.toEqual(response);
  });

  it('propagates create failures', async () => {
    const service = TestBed.inject(ProblemsApiService);
    const result = firstValueFrom(
      service.createProblem({
        name: 'Two Sum',
        categoryId: '1',
        difficulty: null,
        status: 'To solve',
        tagIds: [],
        solution: null,
        source: null,
        notes: '',
        timesSolved: 0,
        lastReviewedOn: null,
      }),
    );
    const request = httpTesting.expectOne('/api/problems');
    request.flush(
      { error: { code: 'VALIDATION_ERROR', message: 'Invalid' } },
      { status: 400, statusText: 'Bad Request' },
    );

    await expect(result).rejects.toMatchObject({ status: 400 });
  });

  it('patches an exact typed update using the unmodified string ID', async () => {
    const service = TestBed.inject(ProblemsApiService);
    const id = '9007199254740993';
    const requestBody: UpdateProblemRequest = {
      name: 'Two Sum updated',
      categoryId: '9007199254740995',
      difficulty: null,
      status: 'Needs review',
      tagIds: [],
      solution: null,
      source: null,
      notes: 'Updated',
      timesSolved: 3,
      lastReviewedOn: null,
    };
    const response: Problem = {
      id,
      name: 'Two Sum updated',
      category: {
        id: '9007199254740995',
        name: 'Arrays',
      },
      difficulty: null,
      status: 'Needs review',
      tags: [],
      solution: null,
      source: null,
      notes: 'Updated',
      timesSolved: 3,
      lastReviewedOn: null,
      createdAt: '2026-07-25T18:30:00.000Z',
      updatedAt: '2026-07-25T20:00:00.000Z',
    };

    const result = firstValueFrom(service.updateProblem(id, requestBody));
    const request = httpTesting.expectOne(`/api/problems/${id}`);
    expect(request.request.method).toBe('PATCH');
    expect(request.request.body).toEqual(requestBody);
    request.flush(response);

    await expect(result).resolves.toEqual(response);
  });

  it('propagates update failures', async () => {
    const service = TestBed.inject(ProblemsApiService);
    const result = firstValueFrom(
      service.updateProblem('1', { name: 'Updated' }),
    );
    const request = httpTesting.expectOne('/api/problems/1');
    request.flush(
      { error: { code: 'PROBLEM_NOT_FOUND', message: 'Missing' } },
      { status: 404, statusText: 'Not Found' },
    );

    await expect(result).rejects.toMatchObject({ status: 404 });
  });

  it('deletes using the exact string ID beyond the safe integer range', async () => {
    const service = TestBed.inject(ProblemsApiService);
    const id = '9007199254740993';

    const result = firstValueFrom(service.deleteProblem(id));
    const request = httpTesting.expectOne(`/api/problems/${id}`);
    expect(request.request.method).toBe('DELETE');
    expect(request.request.body).toBeNull();
    request.flush(null, { status: 204, statusText: 'No Content' });

    await expect(result).resolves.toBeNull();
  });

  it('propagates delete failures', async () => {
    const service = TestBed.inject(ProblemsApiService);
    const result = firstValueFrom(service.deleteProblem('12'));
    const request = httpTesting.expectOne('/api/problems/12');
    request.flush(
      { error: { code: 'PROBLEM_NOT_FOUND', message: 'Missing' } },
      { status: 404, statusText: 'Not Found' },
    );

    await expect(result).rejects.toMatchObject({ status: 404 });
  });
});
