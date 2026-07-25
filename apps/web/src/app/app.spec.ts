import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { CategoriesApiService } from './core/api/categories-api.service';
import { ProblemsApiService } from './core/api/problems-api.service';
import { TagsApiService } from './core/api/tags-api.service';
import { App } from './app';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        {
          provide: ProblemsApiService,
          useValue: { getProblems: () => of([]) },
        },
        {
          provide: CategoriesApiService,
          useValue: { getCategories: () => of([]) },
        },
        {
          provide: TagsApiService,
          useValue: { getTags: () => of([]) },
        },
      ],
    }).compileComponents();
  });

  it('renders the application shell', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('h1')?.textContent).toContain('DSA Notes');
    expect(compiled.textContent).toContain(
      'No problems have been added yet.',
    );
  });
});
