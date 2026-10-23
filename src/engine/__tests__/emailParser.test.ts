import { describe, it, expect } from 'vitest';
import {
  decodeQuotedPrintable,
  decodeRfc2047,
  safeDecodeText,
  escapeRegExp,
  extractBoundary,
  htmlToBlocks,
  resolveCidImages,
  parseExternalEmail,
} from '../emailParser';
import { parseEml } from '../mime';

describe('emailParser: safeDecodeText & decodeQuotedPrintable', () => {
  it('decodes UTF-8 Quoted-Printable cyrillic text', () => {
    // "Привет" in UTF-8 QP
    const qp = '=D0=9F=D1=80=D0=B8=D0=B2=D0=B5=D1=82';
    expect(decodeQuotedPrintable(qp, 'utf-8')).toBe('Привет');
  });

  it('supports lowercase hex in Quoted-Printable', () => {
    const qp = '=d0=9f=d1=80=d0=b8=d0=b2=d0=b5=d1=82';
    expect(decodeQuotedPrintable(qp, 'utf-8')).toBe('Привет');
  });

  it('collapses soft line breaks (=\\r\\n and =\\n)', () => {
    // "Привет" split across soft line breaks
    const qp = '=D0=9F=\r\n=D1=80=\n=D0=B8=D0=B2=D0=B5=D1=82';
    expect(decodeQuotedPrintable(qp, 'utf-8')).toBe('Привет');
  });

  it('decodes Windows-1251 Quoted-Printable', () => {
    // "Привет" in Windows-1251: CF F0 E8 E2 E5 F2
    const qp = '=CF=F0=E8=E2=E5=F2';
    expect(decodeQuotedPrintable(qp, 'windows-1251')).toBe('Привет');
    expect(decodeQuotedPrintable(qp, 'cp1251')).toBe('Привет');
  });

  it('handles corrupted or unknown charsets gracefully with safeDecodeText', () => {
    const bytes = new TextEncoder().encode('Hello Safe World');
    expect(safeDecodeText(bytes, 'unknown-8bit-charset')).toBe('Hello Safe World');
    expect(safeDecodeText(bytes, '"utf-8"')).toBe('Hello Safe World');
  });
});

describe('emailParser: decodeRfc2047', () => {
  it('decodes Base64 encoded-word headers', () => {
    // "Привет" in UTF-8 base64 is 0J/RgNC40LLQtdGC
    const header = '=?UTF-8?B?0J/RgNC40LLQtdGC?=';
    expect(decodeRfc2047(header)).toBe('Привет');
  });

  it('decodes Quoted-Printable RFC 2047 headers with underscore as space', () => {
    const header = '=?UTF-8?Q?Hello_World=21?=';
    expect(decodeRfc2047(header)).toBe('Hello World!');
  });

  it('collapses whitespace between adjacent encoded-words per RFC 2047 Sec 6.2', () => {
    // "При" and "вет"
    const header = '=?UTF-8?B?0J/RgNC4?=  \r\n\t =?UTF-8?B?0LLQtdGC?=';
    expect(decodeRfc2047(header)).toBe('Привет');
  });

  it('decodes Windows-1251 RFC 2047 headers', () => {
    const header = '=?Windows-1251?Q?=CF=F0=E8=E2=E5=F2?=';
    expect(decodeRfc2047(header)).toBe('Привет');
  });

  it('returns unencoded headers as-is', () => {
    const plain = 'Simple ASCII Subject';
    expect(decodeRfc2047(plain)).toBe(plain);
  });
});

describe('emailParser: boundary extraction & regex escaping', () => {
  it('escapes special regex characters in boundaries', () => {
    const boundary = '----=_NextPart_000+1234.5/6';
    const escaped = escapeRegExp(boundary);
    expect(new RegExp(escaped).test(boundary)).toBe(true);
  });

  it('extracts boundaries with quotes, unquoted, and trailing parameters', () => {
    expect(
      extractBoundary('multipart/mixed; boundary="----=_NextPart_001"; charset="utf-8"')
    ).toBe('----=_NextPart_001');

    expect(
      extractBoundary('multipart/alternative; boundary=simple_boundary_123')
    ).toBe('simple_boundary_123');

    expect(extractBoundary('text/plain; charset=utf-8')).toBeUndefined();
  });
});

describe('emailParser: htmlToBlocks', () => {
  it('clamps heading levels 1..6 into 1..3', () => {
    const html = '<h1>Heading 1</h1><h4>Heading 4</h4><h6>Heading 6</h6>';
    const blocks = htmlToBlocks(html);
    expect(blocks).toHaveLength(3);
    expect(blocks[0].type).toBe('heading');
    expect((blocks[0].data as any).level).toBe(1);
    expect(blocks[1].type).toBe('heading');
    expect((blocks[1].data as any).level).toBe(3);
    expect(blocks[2].type).toBe('heading');
    expect((blocks[2].data as any).level).toBe(3);
  });

  it('strips <style>, <script>, and comments without leaking into text', () => {
    const html = `
      <style>.hidden { display: none; }</style>
      <script>alert("hack");</script>
      <!-- Hidden comment -->
      <p>Clean Paragraph</p>
    `;
    const blocks = htmlToBlocks(html);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].type).toBe('paragraph');
    expect((blocks[0].data as any).text).toBe('Clean Paragraph');
  });

  it('prevents duplication for divs containing nested paragraphs', () => {
    const html = `
      <div>
        <p>Child Paragraph 1</p>
        <p>Child Paragraph 2</p>
      </div>
    `;
    const blocks = htmlToBlocks(html);
    expect(blocks).toHaveLength(2);
    expect((blocks[0].data as any).text).toBe('Child Paragraph 1');
    expect((blocks[1].data as any).text).toBe('Child Paragraph 2');
  });

  it('converts lists (ul / ol) into todo_list blocks', () => {
    const html = `
      <ul>
        <li>Task Alpha</li>
        <li>Task Beta</li>
      </ul>
    `;
    const blocks = htmlToBlocks(html);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].type).toBe('todo_list');
    const items = (blocks[0].data as any).items;
    expect(items).toHaveLength(2);
    expect(items[0].text).toBe('Task Alpha');
    expect(items[0].done).toBe(false);
    expect(items[1].text).toBe('Task Beta');
  });

  it('converts blockquote into callout block', () => {
    const html = '<blockquote>Important notice from author</blockquote>';
    const blocks = htmlToBlocks(html);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].type).toBe('callout');
    expect((blocks[0].data as any).title).toBe('Цитата');
    expect((blocks[0].data as any).content).toBe('Important notice from author');
    expect((blocks[0].data as any).tone).toBe('blue');
  });

  it('decodes HTML entities and numeric codes in text', () => {
    const html = '<p>A &amp; B &quot;Quotes&quot; &copy; 2026 &mdash; &#1055;&#1088;&#1080;&#1074;&#1077;&#1090;</p>';
    const blocks = htmlToBlocks(html);
    expect(blocks).toHaveLength(1);
    expect((blocks[0].data as any).text).toBe('A & B "Quotes" © 2026 — Привет');
  });

  it('filters out email preheader spacer hacks (&#847;, &zwnj;, zero-width characters)', () => {
    const html = `
      <div>
        <p>Real header text</p>
        <div style="display:none">&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;</div>
        <p>&copy; 2026 Coursera Inc. All rights reserved.</p>
      </div>
    `;
    const blocks = htmlToBlocks(html);
    expect(blocks).toHaveLength(2);
    expect((blocks[0].data as any).text).toBe('Real header text');
    expect((blocks[1].data as any).text).toBe('© 2026 Coursera Inc. All rights reserved.');
  });
});

describe('emailParser: resolveCidImages & Base64 handling', () => {
  it('resolves cid: images to data URIs and injects <base target="_blank">', () => {
    const html = `
      <html>
        <head><title>Email</title></head>
        <body><img src="cid:logo_img@domain.com"></body>
      </html>
    `;
    const attachments = [
      {
        name: 'logo.png',
        cid: 'logo_img@domain.com',
        mimeType: 'image/png',
        content: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      },
    ];

    const resolved = resolveCidImages(html, attachments);
    expect(resolved).toContain('src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="');
    expect(resolved).toContain('<base target="_blank">');
  });

  it('decodes Base64-encoded text/html with cyrillic content', () => {
    // "<p>Тест Base64</p>" in UTF-8 Base64: PHA+0KLQtdGB0YIgQmFzZTY0PC9wPg==
    const rawHeaders = [
      'Content-Type: text/html; charset=utf-8',
      'Content-Transfer-Encoding: base64',
    ].join('\r\n');
    const rawBody = 'PHA+0KLQtdGB0YIgQmFzZTY0PC9wPg==';

    const result = parseExternalEmail(rawBody, rawHeaders, 'Base64 Email');
    expect(result.blocks.some((b) => (b.data as any).text?.includes('Тест Base64'))).toBe(true);
  });
});

describe('emailParser & mime integration (End-to-End)', () => {
  it('parses realistic multipart email with nested related, html, and attachments', () => {
    const rawEml = [
      'From: "Coursera Team" <no-reply@coursera.org>',
      'To: student@capsuleos.local',
      'Subject: =?UTF-8?B?0J/QvtC30LTRgNCw0LLQu9GP0LXQvCEg0JrRg9GA0YEg0LfQsNCy0LXRgNGI0LXQvQ==?=',
      'Date: Wed, 21 Oct 2026 14:00:00 +0000',
      'Message-ID: <coursera_cert_12345@coursera.org>',
      'MIME-Version: 1.0',
      'Content-Type: multipart/mixed; boundary="BOUNDARY_MIXED_ROOT"',
      '',
      '--BOUNDARY_MIXED_ROOT',
      'Content-Type: multipart/related; boundary="BOUNDARY_RELATED"',
      '',
      '--BOUNDARY_RELATED',
      'Content-Type: text/html; charset=utf-8',
      'Content-Transfer-Encoding: quoted-printable',
      '',
      '<html><body>',
      '<h1>=D0=9F=D0=BE=D0=B7=D0=B4=D1=80=D0=B0=D0=B2=D0=BB=D1=8F=D0=B5=D0=BC!</h1>',
      '<p>=D0=92=D1=8B =D1=83=D1=81=D0=BF=D0=B5=D1=88=D0=BD=D0=BE =D0=B7=D0=B0=D0=B2=D0=B5=D1=80=D1=88=D0=B8=D0=BB=D0=B8 =D0=BA=D1=83=D1=80=D1=81.</p>',
      '<img src=3D"cid:badge@coursera.org">',
      '<ul>',
      '<li>=D0=A1=D0=BA=D0=B0=D1=87=D0=B0=D1=82=D1=8C =D1=81=D0=B5=D1=80=D1=82=D0=B8=D1=84=D0=B8=D0=BA=D0=B0=D1=82</li>',
      '<li>=D0=9F=D0=BE=D0=B4=D0=B5=D0=BB=D0=B8=D1=82=D1=8C=D1=81=D1=8F =D0=B2 LinkedIn</li>',
      '</ul>',
      '</body></html>',
      '',
      '--BOUNDARY_RELATED',
      'Content-Type: image/png; name="badge.png"',
      'Content-ID: <badge@coursera.org>',
      'Content-Transfer-Encoding: base64',
      '',
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      '',
      '--BOUNDARY_RELATED--',
      '',
      '--BOUNDARY_MIXED_ROOT',
      'Content-Type: application/pdf; name="Certificate.pdf"',
      'Content-Disposition: attachment; filename="Certificate.pdf"',
      'Content-Transfer-Encoding: base64',
      '',
      'JVBERi0xLjQKJcTl8uXrCjEgMCBvYmoKPDwKL1R5cGUgL0NhdGFsb2c...',
      '',
      '--BOUNDARY_MIXED_ROOT--',
    ].join('\r\n');

    const capsule = parseEml(rawEml, 'coursera.eml');

    // 1. Decoded RFC 2047 subject
    expect(capsule.subject).toBe('Поздравляем! Курс завершен');
    expect(capsule.messageId).toBe('<coursera_cert_12345@coursera.org>');

    // 2. Structured blocks
    expect(capsule.blocks.length).toBeGreaterThanOrEqual(3);
    expect(capsule.blocks.some((b) => b.type === 'heading' && (b.data as any).text === 'Поздравляем!')).toBe(true);
    expect(capsule.blocks.some((b) => b.type === 'paragraph' && (b.data as any).text.includes('успешно завершили'))).toBe(true);
    expect(capsule.blocks.some((b) => b.type === 'todo_list')).toBe(true);

    // 3. Attachments: email_body.html + badge.png + Certificate.pdf
    expect(capsule.attachments.length).toBe(3);
    const emailBody = capsule.attachments.find((a) => a.name === 'email_body.html');
    expect(emailBody).toBeDefined();
    expect(emailBody?.content).toContain('src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="');
    expect(emailBody?.content).toContain('<base target="_blank">');

    const certAtt = capsule.attachments.find((a) => a.name === 'Certificate.pdf');
    expect(certAtt).toBeDefined();
    expect(certAtt?.mimeType).toBe('application/pdf');
  });
});
