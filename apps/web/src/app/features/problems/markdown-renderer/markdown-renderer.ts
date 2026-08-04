import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import MarkdownIt from 'markdown-it';

const markdown = new MarkdownIt({
  html: false,
  linkify: false,
  typographer: false,
});

markdown.validateLink = (url: string): boolean => {
  try {
    const protocol = new URL(url).protocol;
    return protocol === 'http:' || protocol === 'https:';
  } catch {
    return false;
  }
};

// Images are deliberately inert: Notes must not load remote content or alter
// the expanded-row layout through Markdown image syntax.
markdown.renderer.rules['image'] = (tokens, index) =>
  markdown.utils.escapeHtml(tokens[index].content);

export function renderMarkdown(source: string): string {
  if (source.length === 0) return '';

  try {
    return markdown.render(source);
  } catch {
    return '<p>Notes could not be rendered.</p>';
  }
}

@Component({
  selector: 'app-markdown-renderer',
  template: '<div class="markdown-content" [innerHTML]="rendered()"></div>',
  styleUrl: './markdown-renderer.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MarkdownRendererComponent {
  readonly markdown = input.required<string>();
  readonly rendered = computed(() => renderMarkdown(this.markdown()));
}
