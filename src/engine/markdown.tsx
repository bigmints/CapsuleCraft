// Markdown-lite renderer + wikilink (backlink) extraction.
// Safe: builds React nodes, never innerHTML.
import React from 'react';

export interface BacklinkResolver {
  (query: string): string | null; // returns target messageId or null
}

export interface BacklinkClickHandler {
  (messageId: string): void;
}

/**
 * Extract all [[...]] wikilinks from raw text.
 */
export function extractBacklinks(text: string): string[] {
  const out: string[] = [];
  const re = /\[\[([^\]]+)\]\]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const q = m[1].trim();
    if (q) out.push(q);
  }
  return out;
}

/**
 * Render a single line of markdown-ish text into React nodes.
 * Supported: **bold**, *italic*, `code`, [[wikilink]], [text](url).
 */
export function renderInlineMarkdown(
  text: string,
  resolveBacklink: BacklinkResolver,
  onOpenBacklink?: BacklinkClickHandler
): React.ReactNode[] {
  if (!text) return [];
  const nodes: React.ReactNode[] = [];
  const keyCounter = { n: 0 };
  const key = () => `md_${keyCounter.n++}`;

  // Token regex covering all syntax in one pass.
  const re = /(\[\[[^\]]+\]\]|`[^`]+`|\*\*[^*]+\*\*|\*[^*\s][^*]*\*|\[[^\]\n]+\]\([^)\s]+\))/g;

  let lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > lastIndex) {
      nodes.push(text.slice(lastIndex, m.index));
    }
    const token = m[0];
    if (token.startsWith('[[') && token.endsWith(']]')) {
      const query = token.slice(2, -2).trim();
      const target = resolveBacklink(query);
      if (target) {
        nodes.push(
          <button
            key={key()}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onOpenBacklink?.(target);
            }}
            className="inline-flex items-center gap-0.5 px-1.5 py-0.5 -my-0.5 rounded-md bg-cyan-500/10 text-cyan-300 hover:bg-cyan-500/25 border border-cyan-500/30 hover:border-cyan-400/60 font-medium transition-all cursor-pointer align-baseline"
            title={query}
          >
            <span className="text-cyan-500/60 font-mono text-[10px]">[[</span>
            {query}
            <span className="text-cyan-500/60 font-mono text-[10px]">]]</span>
          </button>
        );
      } else {
        nodes.push(
          <span key={key()} className="text-slate-500 border-b border-dashed border-slate-600/50">
            {token}
          </span>
        );
      }
    } else if (token.startsWith('`') && token.endsWith('`')) {
      nodes.push(
        <code
          key={key()}
          className="px-1.5 py-0.5 rounded bg-slate-800/80 text-emerald-300 font-mono text-[13px]"
        >
          {token.slice(1, -1)}
        </code>
      );
    } else if (token.startsWith('**') && token.endsWith('**')) {
      nodes.push(
        <strong key={key()} className="font-bold text-slate-100">
          {renderInlineMarkdown(token.slice(2, -2), resolveBacklink, onOpenBacklink)}
        </strong>
      );
    } else if (token.startsWith('*') && token.endsWith('*')) {
      nodes.push(
        <em key={key()} className="italic text-slate-300">
          {renderInlineMarkdown(token.slice(1, -1), resolveBacklink, onOpenBacklink)}
        </em>
      );
    } else if (token.startsWith('[')) {
      const close = token.lastIndexOf('](');
      if (close > 1 && token.endsWith(')')) {
        const label = token.slice(1, close);
        const url = token.slice(close + 2, -1);
        nodes.push(
          <a
            key={key()}
            href={url}
            target="_blank"
            rel="noreferrer noopener"
            className="text-sky-400 underline decoration-sky-500/40 underline-offset-2 hover:text-sky-300"
          >
            {label}
          </a>
        );
      } else {
        nodes.push(token);
      }
    }
    lastIndex = m.index + token.length;
  }
  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }
  return nodes;
}

/**
 * Multi-line renderer: splits on \n, renders each line, joins with <br/>.
 */
export function renderMarkdownMultiLine(
  text: string,
  resolveBacklink: BacklinkResolver,
  onOpenBacklink?: BacklinkClickHandler
): React.ReactNode[] {
  const lines = text.split('\n');
  const out: React.ReactNode[] = [];
  lines.forEach((line, i) => {
    out.push(
      <React.Fragment key={`l_${i}`}>
        {renderInlineMarkdown(line, resolveBacklink, onOpenBacklink)}
        {i < lines.length - 1 && <br />}
      </React.Fragment>
    );
  });
  return out;
}
