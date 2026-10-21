import { describe, it, expect } from 'vitest';
import { extractBacklinks, renderInlineMarkdown } from '../markdown';

describe('extractBacklinks', () => {
  it('extracts all [[wikilink]] targets', () => {
    const text = 'См. [[Alpha]] и [[Beta Node]] — но не [обычную] ссылку.';
    expect(extractBacklinks(text)).toEqual(['Alpha', 'Beta Node']);
  });

  it('returns empty array when no wikilinks present', () => {
    expect(extractBacklinks('plain text **bold** `code`')).toEqual([]);
  });
});

describe('renderInlineMarkdown', () => {
  const noopResolver = () => null;

  it('renders resolved wikilinks as clickable buttons', () => {
    const nodes = renderInlineMarkdown('link to [[Alpha]] here', (q) => (q === 'Alpha' ? '<id-1>' : null));
    // [text, button, text]
    expect(nodes).toHaveLength(3);
    expect(nodes[1]).toBeTruthy();
  });

  it('keeps unresolved wikilinks visible as dashed text', () => {
    const nodes = renderInlineMarkdown('link to [[Ghost]] here', noopResolver);
    expect(nodes).toHaveLength(3);
  });

  it('renders bold, italic and code tokens', () => {
    const nodes = renderInlineMarkdown('**bold** and *italic* and `code`', noopResolver);
    expect(nodes).toHaveLength(5);
  });

  it('renders markdown links', () => {
    const nodes = renderInlineMarkdown('[site](https://example.com)', noopResolver);
    expect(nodes).toHaveLength(1);
  });
});
