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

  it('creates, renames, and deletes a category with exact string IDs', async () => {
    const service = TestBed.inject(CategoriesApiService);
    const id = '9007199254740993';
    const resource: CategoryResource = {
      id,
      name: 'Dynamic Programming',
      createdAt: '2026-07-25T18:30:00.000Z',
      updatedAt: '2026-07-25T18:30:00.000Z',
    };

    const createResult = firstValueFrom(
      service.createCategory({ name: 'Dynamic Programming' }),
    );
    const createRequest = httpTesting.expectOne('/api/categories');
    expect(createRequest.request.method).toBe('POST');
    expect(createRequest.request.body).toEqual({ name: 'Dynamic Programming' });
    createRequest.flush(resource);
    await expect(createResult).resolves.toEqual(resource);

    const updateResult = firstValueFrom(
      service.updateCategory(id, { name: 'DP' }),
    );
    const updateRequest = httpTesting.expectOne(`/api/categories/${id}`);
    expect(updateRequest.request.method).toBe('PATCH');
    expect(updateRequest.request.body).toEqual({ name: 'DP' });
    updateRequest.flush({ ...resource, name: 'DP' });
    await expect(updateResult).resolves.toMatchObject({ id, name: 'DP' });

    const deleteResult = firstValueFrom(service.deleteCategory(id));
    const deleteRequest = httpTesting.expectOne(`/api/categories/${id}`);
    expect(deleteRequest.request.method).toBe('DELETE');
    deleteRequest.flush(null);
    await expect(deleteResult).resolves.toBeNull();
  });

  it('creates, renames, and deletes a tag with exact string IDs', async () => {
    const service = TestBed.inject(TagsApiService);
    const id = '9007199254740995';
    const resource: TagResource = {
      id,
      name: 'Hash Map',
      createdAt: '2026-07-25T18:30:00.000Z',
      updatedAt: '2026-07-25T18:30:00.000Z',
    };

    const createResult = firstValueFrom(service.createTag({ name: 'Hash Map' }));
    const createRequest = httpTesting.expectOne('/api/tags');
    expect(createRequest.request.method).toBe('POST');
    expect(createRequest.request.body).toEqual({ name: 'Hash Map' });
    createRequest.flush(resource);
    await expect(createResult).resolves.toEqual(resource);

    const updateResult = firstValueFrom(
      service.updateTag(id, { name: 'Hash table' }),
    );
    const updateRequest = httpTesting.expectOne(`/api/tags/${id}`);
    expect(updateRequest.request.method).toBe('PATCH');
    expect(updateRequest.request.body).toEqual({ name: 'Hash table' });
    updateRequest.flush({ ...resource, name: 'Hash table' });
    await expect(updateResult).resolves.toMatchObject({
      id,
      name: 'Hash table',
    });

    const deleteResult = firstValueFrom(service.deleteTag(id));
    const deleteRequest = httpTesting.expectOne(`/api/tags/${id}`);
    expect(deleteRequest.request.method).toBe('DELETE');
    deleteRequest.flush(null);
    await expect(deleteResult).resolves.toBeNull();
  });

  it('propagates category and tag mutation failures', async () => {
    const categories = TestBed.inject(CategoriesApiService);
    const tags = TestBed.inject(TagsApiService);
    const categoryResult = firstValueFrom(
      categories.createCategory({ name: 'Arrays' }),
    );
    httpTesting.expectOne('/api/categories').flush(
      { error: { code: 'CATEGORY_NAME_CONFLICT' } },
      { status: 409, statusText: 'Conflict' },
    );
    await expect(categoryResult).rejects.toMatchObject({ status: 409 });

    const tagResult = firstValueFrom(tags.deleteTag('9007199254740993'));
    httpTesting.expectOne('/api/tags/9007199254740993').flush(
      { error: { code: 'TAG_NOT_FOUND' } },
      { status: 404, statusText: 'Not Found' },
    );
    await expect(tagResult).rejects.toMatchObject({ status: 404 });
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

  it('duplicates using the exact large string ID without a request body', async () => {
    const service = TestBed.inject(ProblemsApiService);
    const id = '9007199254740993';
    const response: Problem = {
      id: '9007199254740994',
      name: 'Two Sum Copy',
      category: { id: '1', name: 'Arrays' },
      difficulty: 'Easy',
      status: 'Solved',
      tags: [{ id: '2', name: 'Hash Map' }],
      solution: null,
      source: null,
      notes: '',
      timesSolved: 2,
      lastReviewedOn: '2026-07-25',
      createdAt: '2026-07-26T03:00:00.000Z',
      updatedAt: '2026-07-26T03:00:00.000Z',
    };

    const result = firstValueFrom(service.duplicateProblem(id));
    const request = httpTesting.expectOne(
      `/api/problems/${id}/duplicate`,
    );
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toBeNull();
    request.flush(response, { status: 201, statusText: 'Created' });

    await expect(result).resolves.toEqual(response);
  });

  it('propagates duplication failures', async () => {
    const service = TestBed.inject(ProblemsApiService);
    const result = firstValueFrom(service.duplicateProblem('1'));
    const request = httpTesting.expectOne('/api/problems/1/duplicate');
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
