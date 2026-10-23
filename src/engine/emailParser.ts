import { CapsuleBlock, CapsuleAttachment, TodoItem } from '../types';

export interface MimePart {
  headers: Map<string, string>;
  rawHeaders: string;
  contentType: string;
  mimeType: string;
  charset: string;
  encoding: string;
  contentId?: string;
  filename?: string;
  content: string; // Decoded text for text/*, or raw base64 for binary
  isBinary: boolean;
  parts?: MimePart[];
}

/**
 * Safely escapes characters with special meaning in RegExp.
 */
export function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Robustly extracts the boundary parameter from a Content-Type header string.
 * Supports quoted ("...") and unquoted values, safely ignoring trailing parameters (; charset=...).
 */
export function extractBoundary(contentTypeHeader?: string): string | undefined {
  if (!contentTypeHeader) return undefined;
  const match = contentTypeHeader.match(/boundary=(?:"([^"]+)"|'([^']+)'|([^;\s]+))/i);
  if (match) {
    return match[1] || match[2] || match[3];
  }
  return undefined;
}

/**
 * Decodes raw bytes to string using TextDecoder with alias normalization
 * and safe fallbacks (UTF-8, Latin-1) to avoid RangeError on unknown charsets.
 */
export function safeDecodeText(bytes: Uint8Array, charset?: string): string {
  let clean = (charset || 'utf-8').trim().replace(/^["']|["']$/g, '').toLowerCase();

  // Normalize common charset aliases
  if (clean === 'cp1251' || clean === 'cp-1251' || clean === 'windows1251') {
    clean = 'windows-1251';
  } else if (clean === 'utf8') {
    clean = 'utf-8';
  } else if (clean === 'iso8859-1' || clean === 'iso-88591' || clean === 'latin1') {
    clean = 'iso-8859-1';
  } else if (clean === 'koi8r') {
    clean = 'koi8-r';
  }

  try {
    return new TextDecoder(clean).decode(bytes);
  } catch {
    try {
      return new TextDecoder('utf-8').decode(bytes);
    } catch {
      let str = '';
      for (let i = 0; i < bytes.length; i++) {
        str += String.fromCharCode(bytes[i]);
      }
      return str;
    }
  }
}

/**
 * Decodes Quoted-Printable encoded string (RFC 2045) into proper text.
 * Strips soft line breaks (=\r\n, =\n, =\r) before assembling bytes.
 */
export function decodeQuotedPrintable(input: string, charset = 'utf-8'): string {
  // 1. Remove soft line breaks
  const normalized = input.replace(/=(?:\r\n|\n|\r)/g, '');

  // 2. Accumulate raw bytes
  const bytes: number[] = [];
  for (let i = 0; i < normalized.length; i++) {
    const char = normalized[i];
    if (char === '=' && i + 2 < normalized.length) {
      const hex = normalized.substring(i + 1, i + 3);
      if (/^[0-9A-Fa-f]{2}$/.test(hex)) {
        bytes.push(parseInt(hex, 16));
        i += 2;
        continue;
      }
    }
    bytes.push(char.charCodeAt(0) & 0xff);
  }

  return safeDecodeText(new Uint8Array(bytes), charset);
}

/**
 * Decodes Base64 string into decoded text using the specified charset.
 */
export function decodeBase64Text(b64: string, charset = 'utf-8'): string {
  try {
    const binary = atob(b64.replace(/\s+/g, ''));
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return safeDecodeText(bytes, charset);
  } catch {
    return b64;
  }
}

/**
 * Decodes RFC 2047 encoded-words in email headers (=?charset?[BQ]?encoded?=).
 * Collapses whitespace between adjacent encoded-words per RFC 2047 Section 6.2.
 */
export function decodeRfc2047(header: string): string {
  if (!header || !header.includes('=?')) return header;

  // RFC 2047: whitespace between adjacent encoded-words must be ignored
  const collapsed = header.replace(
    /(=\?[^?]+\?[BQbq]\?[^?]+\?=)\s+(?==\?[^?]+\?[BQbq]\?[^?]+\?=)/g,
    '$1'
  );

  return collapsed.replace(
    /=\?([^?]+)\?([BQbq])\?([^?]+)\?=/g,
    (_, rawCharset, encoding, text) => {
      const enc = encoding.toUpperCase();
      const charset = rawCharset.trim();

      if (enc === 'B') {
        return decodeBase64Text(text, charset);
      }
      if (enc === 'Q') {
        // RFC 2047 Q-encoding replaces spaces with '_'
        const qText = text.replace(/_/g, ' ');
        return decodeQuotedPrintable(qText, charset);
      }
      return text;
    }
  );
}

const COMMON_HTML_ENTITIES: Record<string, string> = {
  nbsp: ' ',
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  copy: '©',
  reg: '®',
  trade: '™',
  mdash: '—',
  ndash: '–',
  hellip: '…',
  bull: '•',
  laquo: '«',
  raquo: '»',
  euro: '€',
  pound: '£',
  yen: '¥',
  cent: '¢',
  sect: '§',
  deg: '°',
  plusmn: '±',
  times: '×',
  divide: '÷',
  para: '¶',
  middot: '·',
  zwnj: '',
  zwj: '',
};

/**
 * Decodes standard HTML entities and numeric character references.
 * Automatically filters out invisible preheader spacer hacks (&#847;, \u034F, \u200B).
 */
export function decodeHtmlEntities(html: string): string {
  return html
    .replace(/&([a-z0-9]+);/gi, (match, entity) => {
      const lower = entity.toLowerCase();
      if (COMMON_HTML_ENTITIES[lower] !== undefined) {
        return COMMON_HTML_ENTITIES[lower];
      }
      return match;
    })
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, dec) => {
      try {
        const code = parseInt(dec, 10);
        // Strip invisible zero-width preheader padding hacks (847 = \u034F, 8203 = \u200B, etc.)
        if (code === 847 || code === 8203 || code === 8204 || code === 8205 || code === 65279) {
          return '';
        }
        return String.fromCodePoint(code);
      } catch {
        return _;
      }
    })
    .replace(/&#x([0-9a-fA-F]+);/gi, (_, hex) => {
      try {
        const code = parseInt(hex, 16);
        if (code === 0x034f || code === 0x200b || code === 0x200c || code === 0x200d || code === 0xfeff) {
          return '';
        }
        return String.fromCodePoint(code);
      } catch {
        return _;
      }
    });
}

/**
 * Strips HTML tags, leaving clean, trimmed text with decoded entities.
 * Removes invisible preheader padding and combining joiners (\u034F, \u200B, etc.).
 */
export function stripHtmlTags(html: string): string {
  // Inline formatting tags must not become whitespace: `<strong>x</strong>.`
  // has to read as `x.`, not `x .`. Block separation is handled by callers.
  const withBreaks = html.replace(/<br\s*\/?>/gi, ' ');
  const stripped = withBreaks.replace(/<[^>]+>/g, '');
  const decoded = decodeHtmlEntities(stripped);
  return decoded
    .replace(/[\u034F\u200B-\u200D\uFEFF]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Converts sanitized HTML content into structured CapsuleOS blocks.
 * Prevents nested duplicates (e.g. <div> containing <p> or <li>).
 */
export function htmlToBlocks(rawHtml: string): CapsuleBlock[] {
  // 1. Strip styles, scripts, and comments
  let cleanHtml = rawHtml
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '');

  // 2. Unwrap container divs that wrap other block-level elements
  let prevHtml = '';
  while (cleanHtml !== prevHtml) {
    prevHtml = cleanHtml;
    cleanHtml = cleanHtml.replace(
      /<div\b[^>]*>([\s\S]*?)<\/div>/gi,
      (match, inner) => {
        if (/<(h[1-6]|blockquote|ul|ol|p|tr|div)\b/i.test(inner)) {
          return inner;
        }
        return match;
      }
    );
  }

  const blocks: CapsuleBlock[] = [];
  const now = Date.now();
  let blockIndex = 0;

  // 3. Extract block-level constructs in sequence
  // We match headings, blockquotes, lists, tables/rows, paragraphs, and terminal divs
  const blockRegex =
    /<(h[1-6]|blockquote|ul|ol|p|tr|div)\b([^>]*)>([\s\S]*?)<\/\1>/gi;

  let match: RegExpExecArray | null;
  while ((match = blockRegex.exec(cleanHtml)) !== null) {
    const tag = match[1].toLowerCase();
    const innerContent = match[3];

    if (tag.startsWith('h')) {
      const parsedLevel = parseInt(tag.charAt(1), 10);
      const level = Math.min(Math.max(parsedLevel, 1), 3) as 1 | 2 | 3;
      const text = stripHtmlTags(innerContent);
      if (text) {
        blocks.push({
          id: `blk_h_${blockIndex++}_${now}`,
          type: 'heading',
          data: { level, text },
        });
      }
    } else if (tag === 'blockquote') {
      const text = stripHtmlTags(innerContent);
      if (text) {
        blocks.push({
          id: `blk_callout_${blockIndex++}_${now}`,
          type: 'callout',
          data: {
            title: '',
            content: text,
            tone: 'blue',
          },
        });
      }
    } else if (tag === 'ul' || tag === 'ol') {
      const items: TodoItem[] = [];
      const liRegex = /<li\b[^>]*>([\s\S]*?)<\/li>/gi;
      let liMatch: RegExpExecArray | null;
      let itemIdx = 0;
      while ((liMatch = liRegex.exec(innerContent)) !== null) {
        const itemText = stripHtmlTags(liMatch[1]);
        if (itemText) {
          items.push({
            id: `item_${blockIndex}_${itemIdx++}_${now}`,
            text: itemText,
            done: false,
          });
        }
      }
      if (items.length > 0) {
        blocks.push({
          id: `blk_todo_${blockIndex++}_${now}`,
          type: 'todo_list',
          data: { items },
        });
      }
    } else {
      // p, tr, or terminal div
      const text = stripHtmlTags(innerContent);
      if (text) {
        blocks.push({
          id: `blk_p_${blockIndex++}_${now}`,
          type: 'paragraph',
          data: { text },
        });
      }
    }
  }

  // 3. Fallback: if no structured blocks were detected (e.g. plain text with <br>), split by double line breaks / <br>
  if (blocks.length === 0) {
    const textWithNewlines = cleanHtml
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>|<\/div>/gi, '\n\n');
    const stripped = stripHtmlTags(textWithNewlines);
    const paragraphs = stripped
      .split(/\n\s*\n/)
      .map((p) => p.trim())
      .filter(Boolean);

    for (const p of paragraphs) {
      blocks.push({
        id: `blk_p_${blockIndex++}_${now}`,
        type: 'paragraph',
        data: { text: p },
      });
    }
  }

  return blocks;
}

/**
 * Resolves cid: image references in HTML to Data URIs from attachments,
 * and ensures <base target="_blank"> is injected into <head> for safe link opening.
 */
export function resolveCidImages(
  html: string,
  attachments: CapsuleAttachment[]
): string {
  let resolvedHtml = html.replace(/src=["']cid:([^"'\s>]+)["']/gi, (match, rawCid) => {
    const cleanCid = rawCid.replace(/^<|>$/g, '').trim();
    const att = attachments.find(
      (a) =>
        a.cid.replace(/^<|>$/g, '').trim().toLowerCase() === cleanCid.toLowerCase() ||
        a.name.toLowerCase() === cleanCid.toLowerCase()
    );
    if (att && att.content) {
      const mime = att.mimeType || 'image/png';
      return `src="data:${mime};base64,${att.content}"`;
    }
    return match;
  });

  // Inject <base target="_blank"> so external links in preview open outside the iframe
  if (!/<base\b[^>]*target=/i.test(resolvedHtml)) {
    if (/<head\b[^>]*>/i.test(resolvedHtml)) {
      resolvedHtml = resolvedHtml.replace(
        /(<head\b[^>]*>)/i,
        '$1\n<base target="_blank">\n'
      );
    } else {
      resolvedHtml = `<base target="_blank">\n${resolvedHtml}`;
    }
  }

  return resolvedHtml;
}

/**
 * Parses raw header lines into a case-insensitive Map and extracts Content-Type attributes.
 */
function parseHeaderMap(rawHeaders: string): Map<string, string> {
  const map = new Map<string, string>();
  const lines = rawHeaders.split(/\r?\n/);
  let currentKey = '';

  for (const line of lines) {
    if (/^\s+/.test(line) && currentKey) {
      map.set(currentKey, map.get(currentKey) + ' ' + line.trim());
    } else {
      const match = line.match(/^([^:]+):\s*(.*)$/);
      if (match) {
        currentKey = match[1].trim().toLowerCase();
        map.set(currentKey, match[2].trim());
      }
    }
  }
  return map;
}

/**
 * Recursively parses MIME multipart body into a structured array of parts.
 */
export function parseMimeParts(rawBody: string, boundary: string): MimePart[] {
  const parts: MimePart[] = [];
  const escaped = escapeRegExp(boundary);
  // Boundary delimiter line
  const delimiterRegex = new RegExp(`(?:^|\\r?\\n)--${escaped}(?:--)?(?:\\r?\\n|$)`);

  const rawSegments = rawBody.split(delimiterRegex);

  for (const segment of rawSegments) {
    const trimmed = segment.trim();
    if (!trimmed || trimmed === '--') continue;

    // Split headers and body at the first double newline
    let headerEnd = segment.indexOf('\r\n\r\n');
    let breakLen = 4;
    if (headerEnd === -1) {
      headerEnd = segment.indexOf('\n\n');
      breakLen = 2;
    }

    const rawPartHeaders = headerEnd !== -1 ? segment.substring(0, headerEnd) : '';
    const rawPartBody = headerEnd !== -1 ? segment.substring(headerEnd + breakLen) : segment;

    const headers = parseHeaderMap(rawPartHeaders);
    const contentTypeHeader = headers.get('content-type') || 'text/plain';
    const encoding = (headers.get('content-transfer-encoding') || '7bit').toLowerCase();
    const contentDisposition = headers.get('content-disposition') || '';
    const contentIdRaw = headers.get('content-id');
    const contentId = contentIdRaw ? contentIdRaw.replace(/^<|>$/g, '').trim() : undefined;

    // Extract mime type and charset
    const mimeMatch = contentTypeHeader.match(/^([^;\s]+)/);
    const mimeType = (mimeMatch ? mimeMatch[1] : 'text/plain').toLowerCase();

    const charsetMatch = contentTypeHeader.match(/charset=(?:"([^"]+)"|'([^']+)'|([^;\s]+))/i);
    const charset = charsetMatch
      ? (charsetMatch[1] || charsetMatch[2] || charsetMatch[3]).trim()
      : 'utf-8';

    // Extract filename
    const filenameMatch =
      contentDisposition.match(/filename=(?:"([^"]+)"|'([^']+)'|([^;\s]+))/i) ||
      contentTypeHeader.match(/name=(?:"([^"]+)"|'([^']+)'|([^;\s]+))/i);
    const filename = filenameMatch
      ? decodeRfc2047(filenameMatch[1] || filenameMatch[2] || filenameMatch[3]).trim()
      : undefined;

    const subBoundary = extractBoundary(contentTypeHeader);

    if (subBoundary && mimeType.startsWith('multipart/')) {
      // Recursive multipart
      const subParts = parseMimeParts(rawPartBody, subBoundary);
      parts.push({
        headers,
        rawHeaders: rawPartHeaders,
        contentType: contentTypeHeader,
        mimeType,
        charset,
        encoding,
        contentId,
        filename,
        content: '',
        isBinary: false,
        parts: subParts,
      });
      continue;
    }

    // Leaf part decoding
    const isText = mimeType.startsWith('text/') || mimeType === 'message/rfc822';
    let decodedContent = '';

    if (isText) {
      if (encoding === 'quoted-printable') {
        decodedContent = decodeQuotedPrintable(rawPartBody, charset);
      } else if (encoding === 'base64') {
        decodedContent = decodeBase64Text(rawPartBody, charset);
      } else {
        // 7bit / 8bit raw text
        const bytes = new TextEncoder().encode(rawPartBody);
        decodedContent = safeDecodeText(bytes, charset);
      }
    } else {
      // Non-text binary: keep clean base64 payload
      decodedContent = rawPartBody.replace(/\r?\n/g, '').trim();
    }

    parts.push({
      headers,
      rawHeaders: rawPartHeaders,
      contentType: contentTypeHeader,
      mimeType,
      charset,
      encoding,
      contentId,
      filename,
      content: decodedContent,
      isBinary: !isText,
    });
  }

  return parts;
}

/**
 * Flattens all nested MIME parts into a single array.
 */
function flattenParts(parts: MimePart[]): MimePart[] {
  const result: MimePart[] = [];
  for (const p of parts) {
    if (p.parts && p.parts.length > 0) {
      result.push(...flattenParts(p.parts));
    } else {
      result.push(p);
    }
  }
  return result;
}

export interface ExternalEmailResult {
  blocks: CapsuleBlock[];
  attachments: CapsuleAttachment[];
  htmlBody?: string;
  plainTextBody?: string;
}

/**
 * Parses an external email (RFC 5322 / MIME) into CapsuleOS blocks and attachments.
 * Supports both Multipart and Single-part emails.
 */
export function parseExternalEmail(
  rawBody: string,
  rawHeaders: string,
  fallbackSubject = 'External Email'
): ExternalEmailResult {
  const headers = parseHeaderMap(rawHeaders);
  const contentTypeHeader = headers.get('content-type') || 'text/plain';
  const boundary = extractBoundary(contentTypeHeader);

  let flatParts: MimePart[] = [];

  if (boundary) {
    const tree = parseMimeParts(rawBody, boundary);
    flatParts = flattenParts(tree);
  } else {
    // Single-part email
    const encoding = (headers.get('content-transfer-encoding') || '7bit').toLowerCase();
    const mimeMatch = contentTypeHeader.match(/^([^;\s]+)/);
    const mimeType = (mimeMatch ? mimeMatch[1] : 'text/plain').toLowerCase();
    const charsetMatch = contentTypeHeader.match(/charset=(?:"([^"]+)"|'([^']+)'|([^;\s]+))/i);
    const charset = charsetMatch
      ? (charsetMatch[1] || charsetMatch[2] || charsetMatch[3]).trim()
      : 'utf-8';

    const isText = mimeType.startsWith('text/');
    let content = '';

    if (isText) {
      if (encoding === 'quoted-printable') {
        content = decodeQuotedPrintable(rawBody, charset);
      } else if (encoding === 'base64') {
        content = decodeBase64Text(rawBody, charset);
      } else {
        const bytes = new TextEncoder().encode(rawBody);
        content = safeDecodeText(bytes, charset);
      }
    } else {
      content = rawBody.replace(/\r?\n/g, '').trim();
    }

    flatParts.push({
      headers,
      rawHeaders,
      contentType: contentTypeHeader,
      mimeType,
      charset,
      encoding,
      content,
      isBinary: !isText,
    });
  }

  // 1. Separate body parts and attachments
  const attachments: CapsuleAttachment[] = [];
  let htmlPart: MimePart | undefined;
  let plainPart: MimePart | undefined;

  for (const part of flatParts) {
    const isAttachment =
      part.headers.get('content-disposition')?.toLowerCase().includes('attachment') ||
      !!part.filename;

    if (!isAttachment && part.mimeType === 'text/html' && !htmlPart) {
      htmlPart = part;
    } else if (!isAttachment && part.mimeType === 'text/plain' && !plainPart) {
      plainPart = part;
    } else {
      // Real attachment or inline asset (like CID images)
      const name = part.filename || part.contentId || `attachment_${attachments.length + 1}`;
      const cid = part.contentId || name.replace(/[^a-zA-Z0-9_-]/g, '_');
      attachments.push({
        name,
        cid,
        mimeType: part.mimeType,
        content: part.content,
        sizeBytes: part.content.length,
      });
    }
  }

  // 2. Select best body representation
  let blocks: CapsuleBlock[] = [];
  let finalHtml: string | undefined;
  const now = Date.now();

  if (htmlPart && htmlPart.content.trim()) {
    finalHtml = resolveCidImages(htmlPart.content, attachments);
    blocks = htmlToBlocks(htmlPart.content);
  } else if (plainPart && plainPart.content.trim()) {
    const text = plainPart.content.trim();
    const paragraphs = text
      .split(/\r?\n\s*\r?\n/)
      .map((p) => p.trim())
      .filter(Boolean);

    blocks = paragraphs.map((p, idx) => ({
      id: `blk_p_${idx}_${now}`,
      type: 'paragraph',
      data: { text: p },
    }));
  }

  // Ensure there is at least a heading if subject is provided and no heading was parsed
  if (fallbackSubject && fallbackSubject !== 'Untitled Capsule') {
    const hasH1 = blocks.some((b) => b.type === 'heading' && b.data.level === 1);
    if (!hasH1) {
      blocks.unshift({
        id: `blk_h_subject_${now}`,
        type: 'heading',
        data: { level: 1, text: fallbackSubject },
      });
    }
  }

  if (blocks.length === 0) {
    blocks = [
      {
        id: `blk_p_empty_${now}`,
        type: 'paragraph',
        data: { text: fallbackSubject || 'Empty message' },
      },
    ];
  }

  // 3. Save original email HTML as attachment for the Preview tab (only if email had HTML)
  if (finalHtml) {
    attachments.unshift({
      name: 'email_body.html',
      cid: 'email_body.html',
      mimeType: 'text/html',
      content: finalHtml,
      sizeBytes: finalHtml.length,
    });
  }

  return {
    blocks,
    attachments,
    htmlBody: finalHtml,
    plainTextBody: plainPart?.content,
  };
}
