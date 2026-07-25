import { TestBed } from '@angular/core/testing';
import { Observable, Subject } from 'rxjs';
import type {
  CategoryResource,
  Problem,
  TagResource,
} from '../../../core/api/api.models';
import { CategoriesApiService } from '../../../core/api/categories-api.service';
import { ProblemsApiService } from '../../../core/api/problems-api.service';
import { TagsApiService } from '../../../core/api/tags-api.service';
import { ProblemListPage } from './problem-list-page';

const problem: Problem = {
  id: '1',
  name: 'Two Sum',
  category: { id: '1', name: 'Arrays' },
  difficulty: 'Easy',
  status: 'Solved',
  tags: [],
  solution: null,
  source: null,
  notes: '',
  timesSolved: 1,
  lastReviewedOn: null,
  createdAt: '2026-07-25T18:30:00.000Z',
  updatedAt: '2026-07-25T18:30:00.000Z',
};

describe('ProblemListPage', () => {
  let problemsSubject: Subject<readonly Problem[]>;
  let categoriesSubject: Subject<readonly CategoryResource[]>;
  let tagsSubject: Subject<readonly TagResource[]>;
  let getProblems: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    problemsSubject = new Subject();
    categoriesSubject = new Subject();
    tagsSubject = new Subject();
    getProblems = vi.fn((): Observable<readonly Problem[]> => problemsSubject);

    await TestBed.configureTestingModule({
      imports: [ProblemListPage],
      providers: [
        {
          provide: ProblemsApiService,
          useValue: { getProblems },
        },
        {
          provide: CategoriesApiService,
          useValue: {
            getCategories: vi.fn(
              (): Observable<readonly CategoryResource[]> => categoriesSubject,
            ),
          },
        },
        {
          provide: TagsApiService,
          useValue: {
            getTags: vi.fn(
              (): Observable<readonly TagResource[]> => tagsSubject,
            ),
          },
        },
      ],
    }).compileComponents();
  });

  function completeAuxiliaryLoads(): void {
    categoriesSubject.next([]);
    categoriesSubject.complete();
    tagsSubject.next([]);
    tagsSubject.complete();
  }

  it('shows loading until the initial requests resolve, then renders the table', () => {
    const fixture = TestBed.createComponent(ProblemListPage);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Loading problems');
    expect(getProblems).toHaveBeenCalledTimes(1);

    problemsSubject.next([problem]);
    problemsSubject.complete();
    completeAuxiliaryLoads();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('table')).not.toBeNull();
    expect(fixture.nativeElement.textContent).toContain('Two Sum');
  });

  it('shows the empty state without rendering a table', () => {
    const fixture = TestBed.createComponent(ProblemListPage);
    problemsSubject.next([]);
    problemsSubject.complete();
    completeAuxiliaryLoads();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain(
      'No problems have been added yet.',
    );
    expect(fixture.nativeElement.querySelector('table')).toBeNull();
  });

  it('shows a safe primary error and retries only on request', () => {
    const retryProblems = new Subject<readonly Problem[]>();
    getProblems
      .mockReturnValueOnce(problemsSubject)
      .mockReturnValueOnce(retryProblems);
    const fixture = TestBed.createComponent(ProblemListPage);
    fixture.detectChanges();

    problemsSubject.error(
      new Error('GET http://localhost:3000/api/problems database secret'),
    );
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain(
      'Problems could not be loaded.',
    );
    expect(fixture.nativeElement.textContent).not.toContain('database secret');

    const retry = fixture.nativeElement.querySelector(
      'button',
    ) as HTMLButtonElement;
    retry.click();
    fixture.detectChanges();
    expect(getProblems).toHaveBeenCalledTimes(2);
    expect(fixture.nativeElement.textContent).toContain('Loading problems');
  });

  it('keeps successful problems when auxiliary reference data fails', () => {
    const fixture = TestBed.createComponent(ProblemListPage);
    problemsSubject.next([problem]);
    problemsSubject.complete();
    categoriesSubject.error(new Error('private categories error'));
    tagsSubject.next([]);
    tagsSubject.complete();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('table')).not.toBeNull();
    expect(fixture.nativeElement.textContent).toContain(
      'Some reference data could not be loaded.',
    );
    expect(fixture.nativeElement.textContent).not.toContain(
      'private categories error',
    );
  });
});
