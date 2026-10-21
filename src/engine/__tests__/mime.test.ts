import { describe, it, expect } from 'vitest';
import { assembleEml, parseEml, generateAutonomousHtml } from '../mime';
import { CapsuleNode } from '../../types';

const makeCapsule = (overrides: Partial<CapsuleNode> = {}): CapsuleNode => ({
  messageId: '<capsule-test-001@vault.local>',
  subject: 'Test capsule',
  from: 'Alexey <user@local>',
  to: 'Agent <agent@local>',
  date: 'Wed, 22 Oct 2025 10:00:00 +0000',
  timestamp: 1761127200000,
  references: [],
  tags: ['#test', '#mime'],
  status: 'Active',
  fileName: 'test.eml',
  blocks: [
    { id: 'b1', type: 'heading', data: { level: 1, text: 'Заголовок' } },
    { id: 'b2', type: 'paragraph', data: { text: 'Привет, мир! Hello world.' } },
  ],
  attachments: [
    {
      name: 'dataset.csv',
      cid: 'dataset_csv',
      mimeType: 'text/csv',
      content: 'Region,Sales\nNorth,120\nSouth,95',
    },
  ],
  ...overrides,
});

describe('assembleEml → parseEml round-trip', () => {
  it('preserves headers, tags, status and references', () => {
    const capsule = makeCapsule({
      references: ['<root@vault.local>'],
      inReplyTo: '<root@vault.local>',
    });
    const parsed = parseEml(assembleEml(capsule), 'round.eml');

    expect(parsed.messageId).toBe('<capsule-test-001@vault.local>');
    expect(parsed.subject).toBe('Test capsule');
    expect(parsed.from).toBe('Alexey <user@local>');
    expect(parsed.inReplyTo).toBe('<root@vault.local>');
    expect(parsed.references).toEqual(['<root@vault.local>']);
    expect(parsed.tags).toEqual(['#test', '#mime']);
    expect(parsed.status).toBe('Active');
  });

  it('preserves blocks via embedded canvas_state.json', () => {
    const parsed = parseEml(assembleEml(makeCapsule()));
    expect(parsed.blocks).toHaveLength(2);
    expect(parsed.blocks[0].type).toBe('heading');
    expect((parsed.blocks[0].data as { text: string }).text).toBe('Заголовок');
    expect(parsed.blocks[1].type).toBe('paragraph');
  });

  it('preserves real attachments without the phantom canvas_state.json', () => {
    const parsed = parseEml(assembleEml(makeCapsule()));
    const names = parsed.attachments.map((a) => a.name);

    // Regression: canvas_state.json used to leak into the attachment list.
    expect(names).not.toContain('canvas_state.json');
    expect(names).toEqual(['dataset.csv']);
    expect(parsed.attachments[0].content).toContain('North,120');
  });

  it('base64-encodes attachments containing boundary-like lines and decodes them back', () => {
    const tricky = 'note,quote\n"--BOUNDARY_ROOT_SOMETHING",ok\nрядом,юникод';
    const capsule = makeCapsule({
      attachments: [{ name: 'tricky.csv', cid: 'tricky', mimeType: 'text/csv', content: tricky }],
    });
    const raw = assembleEml(capsule);

    expect(raw).toContain('Content-Transfer-Encoding: base64');
    const parsed = parseEml(raw);
    expect(parsed.attachments).toHaveLength(1);
    expect(parsed.attachments[0].content).toBe(tricky);
  });

  it('keeps plain attachments unencoded (8bit) for human-readable .eml', () => {
    const raw = assembleEml(makeCapsule());
    expect(raw).toContain('Content-Transfer-Encoding: 8bit');
    expect(raw).toContain('North,120');
  });

  it('produces byte-identical .eml for unchanged capsules (stable boundaries)', () => {
    const capsule = makeCapsule();
    const first = assembleEml(capsule);
    const second = assembleEml({ ...capsule });
    expect(first).toBe(second);
  });

  it('parses externally authored .eml without canvas JSON into fallback blocks', () => {
    const raw = [
      'From: External <ext@mail.local>',
      'Subject: Plain email',
      'Message-ID: <plain@mail.local>',
      'MIME-Version: 1.0',
      '',
      'Just a plain body line.',
    ].join('\r\n');

    const parsed = parseEml(raw, 'plain.eml');
    expect(parsed.subject).toBe('Plain email');
    expect(parsed.blocks.length).toBeGreaterThanOrEqual(2);
    expect(parsed.blocks.some((b) => (b.data as { text?: string }).text?.includes('plain body'))).toBe(true);
    expect(parsed.attachments).toHaveLength(0);
  });
});

describe('generateAutonomousHtml', () => {
  it('escapes html-sensitive characters', () => {
    const capsule = makeCapsule({
      blocks: [{ id: 'x', type: 'paragraph', data: { text: '<script>alert(1)</script>' } }],
    });
    const html = generateAutonomousHtml(capsule);
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;');
  });
});
