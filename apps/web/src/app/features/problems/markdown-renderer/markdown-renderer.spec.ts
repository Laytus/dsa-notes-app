import { TestBed } from '@angular/core/testing';
import { MarkdownRendererComponent, renderMarkdown } from './markdown-renderer';

describe('MarkdownRendererComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [MarkdownRendererComponent] }).compileComponents();
  });

  it('renders common Markdown through an ordinary Angular innerHTML binding', () => {
    const fixture = TestBed.createComponent(MarkdownRendererComponent);
    fixture.componentRef.setInput('markdown', '# Heading\n\n**bold** and `code`\n\n- one\n- two\n\n```ts\nconst value = 1;\n```');
    fixture.detectChanges();

    const content = fixture.nativeElement.querySelector('.markdown-content') as HTMLElement;
    expect(content.querySelector('h1')?.textContent).toBe('Heading');
    expect(content.querySelector('strong')?.textContent).toBe('bold');
    expect(content.querySelector('pre code')?.textContent).toContain('const value = 1;');
  });

  it('keeps raw HTML, dangerous links, and images inert', () => {
    const fixture = TestBed.createComponent(MarkdownRendererComponent);
    fixture.componentRef.setInput('markdown', '<script>alert(1)</script>\n\n<img src=x onerror="alert(1)">\n\n[unsafe](javascript:alert(1))\n\n[dangerous](data:text/html,hello)\n\n![remote image](https://example.com/image.png)');
    fixture.detectChanges();

    const content = fixture.nativeElement.querySelector('.markdown-content') as HTMLElement;
    expect(content.querySelector('script, img, iframe')).toBeNull();
    expect(content.querySelector('a[href^="javascript:"], a[href^="data:"]')).toBeNull();
    expect(content.textContent).toContain('<script>alert(1)</script>');
  });

  it('allows HTTP and HTTPS Markdown links only', () => {
    expect(renderMarkdown('[safe](https://example.com)')).toContain('href="https://example.com"');
    expect(renderMarkdown('[unsafe](vbscript:msgbox(1))')).not.toContain('href=');
  });
});
