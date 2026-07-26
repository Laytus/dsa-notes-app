import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { of, Subject, throwError } from 'rxjs';
import type {
  CategoryResource,
  TagResource,
} from '../../../core/api/api.models';
import { CategoriesApiService } from '../../../core/api/categories-api.service';
import { TagsApiService } from '../../../core/api/tags-api.service';
import { ReferenceAdminPanel } from './reference-admin-panel';

const category: CategoryResource = {
  id: '9007199254740993',
  name: 'Arrays',
  createdAt: '2026-07-25T18:00:00.000Z',
  updatedAt: '2026-07-25T18:00:00.000Z',
};
const tag: TagResource = {
  id: '9007199254740995',
  name: 'Hash Map',
  createdAt: '2026-07-25T18:00:00.000Z',
  updatedAt: '2026-07-25T18:00:00.000Z',
};

describe('ReferenceAdminPanel', () => {
  let createCategory: ReturnType<typeof vi.fn>;
  let updateCategory: ReturnType<typeof vi.fn>;
  let deleteCategory: ReturnType<typeof vi.fn>;
  let createTag: ReturnType<typeof vi.fn>;
  let updateTag: ReturnType<typeof vi.fn>;
  let deleteTag: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    createCategory = vi.fn(() => of(category));
    updateCategory = vi.fn(() => of({ ...category, name: 'Data Structures' }));
    deleteCategory = vi.fn(() => of(undefined));
    createTag = vi.fn(() => of(tag));
    updateTag = vi.fn(() => of({ ...tag, name: 'Hash Table' }));
    deleteTag = vi.fn(() => of(undefined));

    await TestBed.configureTestingModule({
      imports: [ReferenceAdminPanel],
      providers: [
        {
          provide: CategoriesApiService,
          useValue: { createCategory, updateCategory, deleteCategory },
        },
        {
          provide: TagsApiService,
          useValue: { createTag, updateTag, deleteTag },
        },
      ],
    }).compileComponents();
  });

  function createFixture() {
    const fixture = TestBed.createComponent(ReferenceAdminPanel);
    fixture.componentRef.setInput('categories', [category]);
    fixture.componentRef.setInput('tags', [tag]);
    fixture.detectChanges();
    return fixture;
  }

  it('renders accessible category actions and creates a trimmed hydrated category', () => {
    const fixture = createFixture();
    const component = fixture.componentInstance;
    expect(fixture.nativeElement.textContent).toContain('Arrays');
    expect(
      fixture.nativeElement.querySelector('[aria-label="Rename Arrays"]'),
    ).not.toBeNull();
    expect(
      fixture.nativeElement.querySelector('[aria-label="Delete Arrays"]'),
    ).not.toBeNull();

    const emitted = vi.fn();
    component.categoryCreated.subscribe(emitted);
    component.createName.setValue('  Arrays  ');
    component.create();

    expect(createCategory).toHaveBeenCalledWith({ name: 'Arrays' });
    expect(emitted).toHaveBeenCalledWith(category);
    expect(component.createName.value).toBe('');
  });

  it('renames through Enter semantics and preserves the exact large ID', () => {
    const fixture = createFixture();
    const component = fixture.componentInstance;
    const emitted = vi.fn();
    component.categoryRenamed.subscribe(emitted);
    component.startRename(category);
    fixture.detectChanges();
    component.renameName.setValue(' Data Structures ');
    fixture.debugElement
      .query(By.css('.rename-form'))
      .triggerEventHandler('ngSubmit', new Event('submit'));

    expect(updateCategory).toHaveBeenCalledWith(category.id, {
      name: 'Data Structures',
    });
    expect(emitted).toHaveBeenCalledWith(
      expect.objectContaining({ id: category.id, name: 'Data Structures' }),
    );
  });

  it('requires Category confirmation and isolates pending state by row', () => {
    const pending = new Subject<void>();
    deleteCategory.mockReturnValue(pending);
    const fixture = createFixture();
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    fixture.componentInstance.delete(category);
    fixture.detectChanges();

    expect(confirm).toHaveBeenCalledWith('Delete category “Arrays”?');
    expect(deleteCategory).toHaveBeenCalledWith(category.id);
    expect(
      fixture.componentInstance.categoryDeletingIds().has(category.id),
    ).toBe(true);
    expect(
      (fixture.nativeElement.querySelector(
        '[aria-label="Delete Arrays"]',
      ) as HTMLButtonElement).disabled,
    ).toBe(true);
    confirm.mockRestore();
  });

  it('shows safe duplicate and referenced-category errors and supports retry', () => {
    createCategory
      .mockReturnValueOnce(
        throwError(
          () =>
            new HttpErrorResponse({
              status: 409,
              error: {
                error: {
                  code: 'CATEGORY_NAME_CONFLICT',
                  message: 'database index detail',
                },
              },
            }),
        ),
      )
      .mockReturnValueOnce(of(category));
    deleteCategory.mockReturnValue(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 409,
            error: { error: { code: 'CATEGORY_IN_USE', message: 'SQL detail' } },
          }),
      ),
    );
    const fixture = createFixture();
    const component = fixture.componentInstance;
    component.createName.setValue('Arrays');
    component.create();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain(
      'A category with this name already exists.',
    );
    expect(fixture.nativeElement.textContent).not.toContain('database index');

    component.create();
    expect(component.categoryCreateError()).toBeNull();

    vi.spyOn(window, 'confirm').mockReturnValue(true);
    component.delete(category);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain(
      'Reassign or delete those problems first.',
    );
    expect(fixture.nativeElement.textContent).not.toContain('SQL detail');
    expect(component.categoryDeletingIds().size).toBe(0);
  });

  it('creates, renames, and confirms global deletion of Tags', () => {
    const fixture = createFixture();
    const component = fixture.componentInstance;
    component.switchSection('tags');
    fixture.detectChanges();
    const created = vi.fn();
    const renamed = vi.fn();
    const deleted = vi.fn();
    component.tagCreated.subscribe(created);
    component.tagRenamed.subscribe(renamed);
    component.tagDeleted.subscribe(deleted);

    component.createName.setValue(' Hash Map ');
    component.create();
    expect(createTag).toHaveBeenCalledWith({ name: 'Hash Map' });
    expect(created).toHaveBeenCalledWith(tag);

    component.startRename(tag);
    component.renameName.setValue('Hash Table');
    component.rename(tag);
    expect(updateTag).toHaveBeenCalledWith(tag.id, { name: 'Hash Table' });
    expect(renamed).toHaveBeenCalledWith(expect.objectContaining({ id: tag.id }));

    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    component.delete(tag);
    expect(confirm).toHaveBeenCalledWith(
      'Delete tag “Hash Map”? This tag will be removed from every problem.',
    );
    expect(deleteTag).toHaveBeenCalledWith(tag.id);
    expect(deleted).toHaveBeenCalledWith(tag.id);
    confirm.mockRestore();
  });

  it('submits the Tag create form through Angular without native navigation', () => {
    const response = new Subject<TagResource>();
    createTag.mockReturnValue(response);
    const fixture = createFixture();
    const component = fixture.componentInstance;
    const created = vi.fn();
    component.tagCreated.subscribe(created);

    (
      fixture.nativeElement.querySelector(
        '.section-tabs button:nth-child(2)',
      ) as HTMLButtonElement
    ).click();
    fixture.detectChanges();
    const input = fixture.nativeElement.querySelector(
      '#new-tag',
    ) as HTMLInputElement;
    input.value = '  Graph  ';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    const form = fixture.nativeElement.querySelector(
      '.create-form',
    ) as HTMLFormElement;
    const nativeSubmitAccepted = form.dispatchEvent(
      new Event('submit', { bubbles: true, cancelable: true }),
    );

    expect(nativeSubmitAccepted).toBe(false);
    expect(createTag).toHaveBeenCalledTimes(1);
    expect(createTag).toHaveBeenCalledWith({ name: 'Graph' });
    expect(component.createName.value).toBe('  Graph  ');
    expect(fixture.nativeElement.querySelector('.panel')).not.toBeNull();

    response.next({ ...tag, name: 'Graph' });
    response.complete();
    fixture.detectChanges();
    expect(created).toHaveBeenCalledWith(expect.objectContaining({ name: 'Graph' }));
    expect(component.createName.value).toBe('');
  });

  it('shows a safe Tag failure and clears it on retry', () => {
    createTag
      .mockReturnValueOnce(
        throwError(
          () =>
            new HttpErrorResponse({
              status: 0,
              error: { privateUrl: 'postgres://secret' },
            }),
        ),
      )
      .mockReturnValueOnce(of(tag));
    const fixture = createFixture();
    const component = fixture.componentInstance;
    component.switchSection('tags');
    component.createName.setValue('Hash Map');
    component.create();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain(
      'Could not connect to the API.',
    );
    expect(fixture.nativeElement.textContent).not.toContain('postgres://');
    expect(component.tagCreating()).toBe(false);

    component.create();
    expect(component.tagCreateError()).toBeNull();
  });

  it('cancels rename with Escape and guards dirty panel close', () => {
    const fixture = createFixture();
    const component = fixture.componentInstance;
    const closed = vi.fn();
    component.closed.subscribe(closed);
    component.startRename(category);
    component.onEscape(new Event('keydown'));
    expect(component.editingId()).toBeNull();
    expect(closed).not.toHaveBeenCalled();

    component.createName.setValue('unfinished');
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    component.requestClose();
    expect(closed).not.toHaveBeenCalled();
    confirm.mockReturnValue(true);
    component.requestClose();
    expect(closed).toHaveBeenCalledOnce();
    component.createName.reset('');
    component.onEscape(new Event('keydown'));
    expect(closed).toHaveBeenCalledTimes(2);
    confirm.mockRestore();
  });
});
