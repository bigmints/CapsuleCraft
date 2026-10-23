import { CapsuleNode, CapsuleBlock, CapsuleAttachment } from '../types';
import { decodeRfc2047, parseExternalEmail } from './emailParser';

/**
 * Deterministic 8-char hash (FNV-1a based, base36).
 * Used for MIME boundaries so that assembling an unchanged capsule twice
 * produces byte-identical .eml (no needless folder-vault rewrites).
 */
function stableHash(input: string): string {
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let i = 0; i < input.length; i++) {
    const c = input.charCodeAt(i);
    h1 = (h1 ^ c) >>> 0;
    h1 = (h1 * 16777619) >>> 0;
    h2 = (h2 + c * (i + 7)) >>> 0;
  }
  return (h1.toString(36) + h2.toString(36)).toUpperCase().slice(0, 10).padEnd(8, '0');
}

/** True when a MIME part payload can survive raw (7bit-ish) transport. */
function needsBase64(content: string): boolean {
  // Boundary-like lines, CR/LF quirks or non-Latin1 chars would corrupt MIME framing.
  return /[\u0080-\uffff]/.test(content) || /(^|\r?\n)--[A-Za-z0-9'_+-]+(\r?\n|$)/.test(content);
}

function toBase64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

function fromBase64(b64: string): string {
  const binary = atob(b64.replace(/\s+/g, ''));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

export function assembleEml(capsule: CapsuleNode): string {
  const seed = `${capsule.messageId}|${capsule.subject}|${capsule.blocks.length}|${capsule.attachments.length}`;
  const boundaryRoot = `BOUNDARY_ROOT_${stableHash(seed)}`;
  const boundaryPayload = `BOUNDARY_PAYLOAD_${stableHash(seed + '|payload')}`;

  const headers: string[] = [
    `From: ${capsule.from || 'Alexey <user@local>'}`,
    `To: ${capsule.to || 'Co-Thinker <agent@local>'}`,
    `Subject: ${capsule.subject || 'Untitled Capsule'}`,
    `Date: ${capsule.date || new Date().toUTCString()}`,
    `Message-ID: ${capsule.messageId}`,
  ];

  if (capsule.inReplyTo) {
    headers.push(`In-Reply-To: ${capsule.inReplyTo}`);
  }

  if (capsule.parentId) {
    headers.push(`X-Capsule-Page-Parent: ${capsule.parentId}`);
  }

  if (capsule.references && capsule.references.length > 0) {
    headers.push(`References: ${capsule.references.join(' ')}`);
  }

  if (capsule.tags && capsule.tags.length > 0) {
    headers.push(`X-Capsule-Tags: ${capsule.tags.join(', ')}`);
  }

  headers.push(`X-Capsule-Status: ${capsule.status || 'Active'}`);
  headers.push(`MIME-Version: 1.0`);
  headers.push(`Content-Type: multipart/mixed; boundary="${boundaryRoot}"`);

  // Canvas JSON state
  const canvasJson = JSON.stringify(
    {
      version: '1.0',
      generator: 'CapsuleCraft v2.0 (Zero-DB Pure-MIME Engine)',
      messageId: capsule.messageId,
      subject: capsule.subject,
      tags: capsule.tags,
      blocks: capsule.blocks,
    },
    null,
    2
  );

  // Standalone HTML5 representation
  const htmlFallback = generateAutonomousHtml(capsule);

  const parts: string[] = [];

  // 1. Multipart/alternative payload (JSON state + HTML fallback)
  const alternativePayload = [
    `--${boundaryRoot}`,
    `Content-Type: multipart/alternative; boundary="${boundaryPayload}"`,
    '',
    `--${boundaryPayload}`,
    `Content-Type: application/json; name="canvas_state.json"`,
    `Content-Disposition: inline; filename="canvas_state.json"`,
    '',
    canvasJson,
    '',
    `--${boundaryPayload}`,
    `Content-Type: text/html; charset="utf-8"`,
    `Content-Disposition: inline`,
    '',
    htmlFallback,
    '',
    `--${boundaryPayload}--`,
  ].join('\r\n');

  parts.push(alternativePayload);

  // 2. Attachments (DataGrids CSV, Whiteboard JSON, Code, Audio, etc.)
  if (capsule.attachments && capsule.attachments.length > 0) {
    for (const att of capsule.attachments) {
      const cleanCid = att.cid.replace(/^<|>$/g, '').replace(/^cid:/, '');
      const encoded = needsBase64(att.content);
      const attPart = [
        `--${boundaryRoot}`,
        `Content-Type: ${att.mimeType || 'text/plain'}; name="${att.name}"`,
        `Content-ID: <${cleanCid}>`,
        `Content-Disposition: attachment; filename="${att.name}"`,
        `Content-Transfer-Encoding: ${encoded ? 'base64' : '8bit'}`,
        '',
        encoded ? toBase64(att.content) : att.content,
      ].join('\r\n');
      parts.push(attPart);
    }
  }

  // Root boundary end
  parts.push(`--${boundaryRoot}--`);

  return headers.join('\r\n') + '\r\n\r\n' + parts.join('\r\n');
}

function parseNativeAttachments(rawHeaders: string, rawBody: string, attachments: CapsuleAttachment[]): void {
  const boundaryMatch = rawHeaders.match(/boundary=["']?([^"';]+)["']?/i);
  if (boundaryMatch && boundaryMatch[1]) {
    const boundary = boundaryMatch[1];
    const parts = rawBody.split(new RegExp(`--${boundary}(?:--)?`));

    for (const part of parts) {
      if (!part.trim()) continue;

      const contentIdMatch = part.match(/Content-ID:\s*<([^>]+)>/i);
      const nameMatch = part.match(/filename=["']?([^"'\r\n]+)["']?|name=["']?([^"'\r\n]+)["']?/i);
      const mimeMatch = part.match(/Content-Type:\s*([^;\r\n]+)/i);
      const encodingMatch = part.match(/Content-Transfer-Encoding:\s*([\w-]+)/i);

      // Resolve the part name from either regex group, then skip the
      // internal canvas_state.json / html alternative sub-parts.
      const resolvedName = nameMatch ? nameMatch[1] || nameMatch[2] : undefined;
      if (resolvedName && resolvedName.toLowerCase() === 'canvas_state.json') continue;

      if (resolvedName) {
        const name = resolvedName;
        const cid = contentIdMatch ? contentIdMatch[1] : name.replace(/[^a-zA-Z0-9_]/g, '_');
        const mimeType = mimeMatch ? mimeMatch[1].trim() : 'text/plain';

        // Extract content after double newline
        const bodySplit = part.indexOf('\r\n\r\n') !== -1 ? part.indexOf('\r\n\r\n') + 4 : part.indexOf('\n\n') + 2;
        let content = bodySplit > 1 ? part.substring(bodySplit).trim() : '';

        // Honor Content-Transfer-Encoding (base64 attachments, e.g. audio/binary data)
        if (encodingMatch && encodingMatch[1].toLowerCase() === 'base64' && content) {
          try {
            content = fromBase64(content);
          } catch {
            console.warn(`parseEml: failed to decode base64 attachment "${name}"`);
          }
        }

        attachments.push({
          name,
          cid,
          mimeType,
          content,
          sizeBytes: content.length,
        });
      }
    }
  }
}

export function parseEml(rawEml: string, fileName?: string): CapsuleNode {
  // Fast Header Scanner: find first double newline (\r\n\r\n or \n\n)
  let headerEndPos = rawEml.indexOf('\r\n\r\n');
  let lineBreakLen = 4;
  if (headerEndPos === -1) {
    headerEndPos = rawEml.indexOf('\n\n');
    lineBreakLen = 2;
  }

  const rawHeaders = headerEndPos !== -1 ? rawEml.substring(0, headerEndPos) : rawEml;
  const rawBody = headerEndPos !== -1 ? rawEml.substring(headerEndPos + lineBreakLen) : '';

  // Parse RFC 5322 Headers
  const headersMap = new Map<string, string>();
  const headerLines = rawHeaders.split(/\r?\n/);
  let currentKey = '';

  for (const line of headerLines) {
    if (/^\s+/.test(line) && currentKey) {
      // Header continuation
      headersMap.set(currentKey, headersMap.get(currentKey) + ' ' + line.trim());
    } else {
      const match = line.match(/^([^:]+):\s*(.*)$/);
      if (match) {
        currentKey = match[1].trim().toLowerCase();
        headersMap.set(currentKey, match[2].trim());
      }
    }
  }

  const fallbackId = fileName
    ? `<capsule-${fileName.toLowerCase().replace(/\.eml$/i, '').replace(/[^a-z0-9_-]/g, '_')}@vault.local>`
    : `<capsule-${Math.random().toString(36).substring(2, 10)}@vault.local>`;
  const messageId = headersMap.get('message-id') || fallbackId;
  const rawSubject = headersMap.get('subject') || 'Untitled Capsule';
  const subject = decodeRfc2047(rawSubject);
  const from = decodeRfc2047(headersMap.get('from') || 'Alexey <user@local>');
  const to = decodeRfc2047(headersMap.get('to') || 'Co-Thinker <agent@local>');
  const dateStr = headersMap.get('date') || new Date().toUTCString();
  const inReplyTo = headersMap.get('in-reply-to') || undefined;
  const parentId = headersMap.get('x-capsule-page-parent') || undefined;
  
  const rawRefs = headersMap.get('references') || '';
  const references = rawRefs
    ? rawRefs.split(/\s+/).filter(Boolean)
    : [];

  const rawTags = headersMap.get('x-capsule-tags') || '';
  const tags = rawTags
    ? rawTags.split(',').map((t) => t.trim()).filter(Boolean)
    : [];

  const status = (headersMap.get('x-capsule-status') as any) || 'Active';

  // Parse Body and extract canvas_state.json & attachments
  let blocks: CapsuleBlock[] = [];
  const attachments: CapsuleAttachment[] = [];

  try {
    // 1. Try to find canvas_state.json block in rawBody (native CapsuleCraft capsules)
    const jsonMatch = rawBody.match(/Content-Type:\s*application\/json;[^\r\n]*name=["']?canvas_state\.json["']?[\s\S]*?\r?\n\r?\n([\s\S]*?)(?=\r?\n--|$)/i);
    let isNativeCapsule = false;

    if (jsonMatch && jsonMatch[1]) {
      try {
        const parsedJson = JSON.parse(jsonMatch[1].trim());
        if (parsedJson.blocks && Array.isArray(parsedJson.blocks)) {
          blocks = parsedJson.blocks;
          isNativeCapsule = true;
        }
      } catch {
        // Corrupted JSON payload, will fallback to external parser
      }
    }

    if (isNativeCapsule) {
      // Native CapsuleCraft attachment parsing
      parseNativeAttachments(rawHeaders, rawBody, attachments);
    } else {
      // External email (Gmail, Outlook, Thunderbird, Coursera, etc.)
      const externalResult = parseExternalEmail(rawBody, rawHeaders, subject);
      blocks = externalResult.blocks;
      attachments.push(...externalResult.attachments);
    }
  } catch (err) {
    console.warn('Error parsing MIME parts:', err);
    if (blocks.length === 0) {
      blocks = [
        {
          id: `blk_heading_${Date.now()}`,
          type: 'heading',
          data: { level: 1, text: subject },
        },
        {
          id: `blk_body_${Date.now()}`,
          type: 'paragraph',
          data: { text: rawBody.substring(0, 500) || 'Imported Capsule content.' },
        },
      ];
    }
  }

  return {
    messageId,
    subject,
    from,
    to,
    date: dateStr,
    timestamp: new Date(dateStr).getTime() || Date.now(),
    inReplyTo,
    parentId,
    references,
    tags,
    status,
    fileName: fileName || `${subject.toLowerCase().replace(/[^a-z0-9_-]/g, '_').substring(0, 30)}.eml`,
    blocks,
    attachments,
    rawEml,
    byteOffsetBody: headerEndPos,
  };
}

export function generateAutonomousHtml(capsule: CapsuleNode): string {
  const blocksHtml = capsule.blocks
    .map((block) => {
      switch (block.type) {
        case 'heading': {
          const tag = `h${block.data.level || 1}`;
          return `<${tag} style="color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin-top: 1.5em; margin-bottom: 0.5em;">${escapeHtml(block.data.text)}</${tag}>`;
        }
        case 'paragraph':
          return `<p style="color: #cbd5e1; font-size: 16px; line-height: 1.65; margin-bottom: 1em;">${escapeHtml(block.data.text)}</p>`;
        case 'ai_opponent_block':
          return `
          <div style="background: #1e293b; border-left: 4px solid #10b981; border-radius: 8px; padding: 16px 20px; margin: 20px 0;">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
              <span style="color: #10b981; font-weight: 600; font-size: 13px; text-transform: uppercase; letter-spacing: 0.05em;">⚡ AI Co-Thinker Critique (${escapeHtml(block.author || 'Co-Thinker')})</span>
            </div>
            <p style="color: #f1f5f9; font-size: 15px; line-height: 1.6; margin: 0; font-style: italic;">
              "${escapeHtml(block.data.criticism)}"
            </p>
          </div>`;
        case 'data_grid_view': {
          const att = capsule.attachments.find(
            (a) => `cid:${a.cid}` === block.data.source_cid || a.cid === block.data.source_cid
          );
          let tablePreview = '<p style="color: #94a3b8; font-size: 13px;">[DataGrid connected via CID: ' + escapeHtml(block.data.source_cid) + ']</p>';
          if (att && att.content) {
            const rows = att.content.trim().split('\n').slice(0, 5).map((r) => r.split(','));
            if (rows.length > 0) {
              const headers = rows[0];
              const bodyRows = rows.slice(1);
              tablePreview = `
                <table style="width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 13px; background: #0f172a; border-radius: 6px; overflow: hidden;">
                  <thead>
                    <tr style="background: #334155;">
                      ${headers.map((h) => `<th style="padding: 8px 12px; text-align: left; color: #f8fafc; border-bottom: 1px solid #475569;">${escapeHtml(h.trim())}</th>`).join('')}
                    </tr>
                  </thead>
                  <tbody>
                    ${bodyRows.map((row) => `<tr style="border-bottom: 1px solid #1e293b;">${row.map((cell) => `<td style="padding: 6px 12px; color: #cbd5e1;">${escapeHtml(cell.trim())}</td>`).join('')}</tr>`).join('')}
                  </tbody>
                </table>
              `;
            }
          }
          return `
            <div style="background: #1e293b; border: 1px solid #334155; border-radius: 8px; padding: 16px; margin: 20px 0;">
              <div style="color: #38bdf8; font-weight: 600; font-size: 14px; margin-bottom: 8px;">📊 Live DataGrid (${escapeHtml(block.data.title || block.data.source_cid)})</div>
              ${tablePreview}
            </div>
          `;
        }
        case 'interactive_canvas':
          return `
            <div style="background: #1e293b; border: 1px solid #334155; border-radius: 8px; padding: 16px; margin: 20px 0; text-align: center;">
              <div style="color: #a855f7; font-weight: 600; font-size: 14px; margin-bottom: 6px;">🎨 Whiteboard / Vector Scene</div>
              <p style="color: #94a3b8; font-size: 13px; margin: 0;">Interactive Vector MindMap & Whiteboard linked to <code style="background: #0f172a; padding: 2px 6px; border-radius: 4px; color: #e2e8f0;">${escapeHtml(block.data.scene_cid)}</code></p>
            </div>
          `;
        case 'code_repl':
          return `
            <div style="background: #090d16; border: 1px solid #334155; border-radius: 8px; padding: 14px; margin: 20px 0; font-family: monospace;">
              <div style="color: #94a3b8; font-size: 12px; margin-bottom: 8px; border-bottom: 1px solid #1e293b; padding-bottom: 4px;">// ${block.data.language.toUpperCase()} EXECUTION BLOCK</div>
              <pre style="color: #38bdf8; margin: 0; font-size: 13px; line-height: 1.5; overflow-x: auto;"><code>${escapeHtml(block.data.code)}</code></pre>
            </div>
          `;
        case 'callout':
          return `
            <div style="background: rgba(16, 185, 129, 0.1); border: 1px solid #10b981; border-radius: 8px; padding: 14px 18px; margin: 20px 0;">
              <div style="color: #10b981; font-weight: 600; font-size: 14px; margin-bottom: 4px;">💡 ${escapeHtml(block.data.title || 'Quote')}</div>
              <div style="color: #cbd5e1; font-size: 14px; line-height: 1.5;">${escapeHtml(block.data.content)}</div>
            </div>
          `;
        case 'audio_note': {
          const att = capsule.attachments.find(
            (a) => (block.data as any).audioCid && a.cid === (block.data as any).audioCid
          );
          const audioHtml = att
            ? `<audio controls style="width: 100%;" src="data:${(block.data as any).audioMime || att.mimeType || 'audio/mpeg'};base64,${att.content}"></audio>`
            : `<p style="color: #94a3b8; font-size: 13px; margin: 0;">Voice note — no audio attached</p>`;
          return `
            <div style="background: #1e293b; border: 1px solid #334155; border-radius: 8px; padding: 16px; margin: 20px 0;">
              <div style="color: #22d3ee; font-weight: 600; font-size: 14px; margin-bottom: 8px;">🎤 Voice Thought Note ${escapeHtml((block.data as any).author || '')}</div>
              ${audioHtml}
              <p style="color: #cbd5e1; font-size: 14px; line-height: 1.5; margin: 12px 0 0;">${escapeHtml((block.data as any).transcript || '')}</p>
            </div>
          `;
        }
        case 'todo_list':
          return `
            <div style="background: #1e293b; border-radius: 8px; padding: 14px; margin: 20px 0;">
              <div style="font-weight: 600; color: #f8fafc; font-size: 14px; margin-bottom: 8px;">${escapeHtml(block.data.title || 'Checklist')}</div>
              <ul style="list-style: none; padding: 0; margin: 0;">
                ${block.data.items.map((item) => `<li style="color: ${item.done ? '#94a3b8' : '#e2e8f0'}; text-decoration: ${item.done ? 'line-through' : 'none'}; padding: 4px 0;">${item.done ? '☑' : '☐'} ${escapeHtml(item.text)}</li>`).join('')}
              </ul>
            </div>
          `;
        default:
          return '';
      }
    })
    .join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(capsule.subject)}</title>
  <style>
    body {
      background-color: #0f172a;
      color: #f8fafc;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      margin: 0;
      padding: 32px 20px;
    }
    .capsule-wrapper {
      max-width: 780px;
      margin: 0 auto;
      background: #090d16;
      border: 1px solid #1e293b;
      border-radius: 12px;
      padding: 36px 40px;
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.5);
    }
    .meta-bar {
      border-bottom: 1px solid #1e293b;
      padding-bottom: 20px;
      margin-bottom: 24px;
      font-size: 13px;
      color: #94a3b8;
    }
    .meta-row {
      display: flex;
      margin-bottom: 6px;
    }
    .meta-label {
      width: 110px;
      font-weight: 600;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .meta-val {
      color: #cbd5e1;
      font-family: monospace;
    }
    .tag {
      display: inline-block;
      background: #1e293b;
      color: #38bdf8;
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 12px;
      margin-right: 6px;
    }
    .footer-note {
      margin-top: 40px;
      padding-top: 16px;
      border-top: 1px solid #1e293b;
      font-size: 12px;
      color: #64748b;
      text-align: center;
    }
  </style>
</head>
<body>
  <div class="capsule-wrapper">
    <div class="meta-bar">
      <div class="meta-row"><span class="meta-label">From:</span><span class="meta-val">${escapeHtml(capsule.from)}</span></div>
      <div class="meta-row"><span class="meta-label">To:</span><span class="meta-val">${escapeHtml(capsule.to)}</span></div>
      <div class="meta-row"><span class="meta-label">Date:</span><span class="meta-val">${escapeHtml(capsule.date)}</span></div>
      <div class="meta-row"><span class="meta-label">Message-ID:</span><span class="meta-val">${escapeHtml(capsule.messageId)}</span></div>
      ${capsule.inReplyTo ? `<div class="meta-row"><span class="meta-label">In-Reply-To:</span><span class="meta-val">${escapeHtml(capsule.inReplyTo)}</span></div>` : ''}
      <div class="meta-row" style="margin-top: 10px;">
        <span class="meta-label">Tags:</span>
        <div>
          ${capsule.tags.map((t) => `<span class="tag">${escapeHtml(t)}</span>`).join('')}
        </div>
      </div>
    </div>

    <div class="content-body">
      ${blocksHtml}
    </div>

    <div class="footer-note">
      🛸 Generated by <b>CapsuleCraft</b> • Pure-MIME Zero-DB Multimodal Knowledge Engine
    </div>
  </div>
</body>
</html>`;
}

function escapeHtml(str: string): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
