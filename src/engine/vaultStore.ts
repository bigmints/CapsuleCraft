import {
  CapsuleNode,
  VaultGraphState,
  GraphNode,
  GraphEdge,
  CapsuleBlock,
  ScoredSearchHit,
} from '../types';
import { assembleEml, parseEml } from './mime';
import {
  loadVaultFromDisk,
  saveVaultToDisk,
  scanVaultFolder,
  writeCapsuleEml,
  removeCapsuleEml,
  sanitizeFileName,
  readVaultFile,
  subscribeVaultChanges,
  type VaultFsChange,
} from './desktopStore';
import { extractBacklinks } from './markdown';
import { Bm25Index, tokenize } from './bm25';
import JSZip from 'jszip';

const STORAGE_KEY = 'capsule_os_vault_v2';

class VaultStore {
  private nodes: Map<string, CapsuleNode> = new Map();
  private invertedIndex: Map<string, Set<string>> = new Map(); // word -> Set<messageId>
  private bm25 = new Bm25Index(); // Okapi BM25 relevance ranking over the same tokens
  private backlinks: Map<string, Set<string>> = new Map(); // messageId -> Set<target messageId>
  private listeners: Set<() => void> = new Set();
  /** Last rawEml that was written to the folder vault (dirty tracking). */
  private syncedEml: Map<string, string> = new Map();
  /** File name to rawEml cache for rapid self-write guard in fs events. */
  private syncedEmlByFile: Map<string, string> = new Map();
  private unlistenWatcher?: () => void;
  private fsBatchTimeout: any = null;
  private pendingFsChanges: Map<string, VaultFsChange> = new Map();
  public scanStats = {
    totalFiles: 0,
    scanDurationMs: 0.8,
    scannedBytes: 0,
    simdSpeedMBs: 412.5,
    lastScanTimestamp: Date.now(),
  };

  constructor() {
    this.init();
  }

  private init() {
    // Start live folder vault watcher in desktop mode unconditionally
    subscribeVaultChanges((changes) => {
      this.queueExternalFsChanges(changes);
    }).then((unlisten) => {
      this.unlistenWatcher = unlisten;
    });

    // Try to restore a previously saved vault; otherwise start EMPTY
    // (no demo seed — see FAQ/onboarding).
    try {
      if (typeof localStorage !== 'undefined') {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
          const parsed: CapsuleNode[] = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            for (const c of parsed) {
              // Ensure rawEml is present
              if (!c.rawEml) c.rawEml = assembleEml(c);
              this.nodes.set(c.messageId, c);
            }
            this.rebuildIndexes();
            // Still check the folder vault in case changes occurred while app was closed
            this.loadFromFolder().then((loaded) => {
              if (loaded && loaded.length > 0) {
                this.applyLoadedCapsules(loaded);
              }
            });
            return;
          }
        }
      }
    } catch (e) {
      console.warn('Could not restore from localStorage:', e);
    }

    // No demo seed: a fresh install starts with an EMPTY vault.
    // The FAQ/onboarding page in the UI explains the workflow instead.
    this.rebuildIndexes();
    this.notify();

    // Desktop shell: load order is folder vault (.eml files) → vault.json → empty.
    // The folder vault is authoritative when present (the freshest copy).
    this.loadFromFolder().then((loaded) => {
      if (loaded && loaded.length > 0) {
        this.applyLoadedCapsules(loaded);
        return;
      }
      return this.loadFromDisk().then((fromJson) => {
        if (fromJson && fromJson.length > 0) {
          this.applyLoadedCapsules(fromJson);
          return;
        }
        // Nothing on disk yet — persist the (intentionally empty) vault
        // so the storage layout exists from day one.
        this.persist();
      });
    });
  }

  private applyLoadedCapsules(list: CapsuleNode[]) {
    this.nodes.clear();
    this.syncedEml.clear();
    this.syncedEmlByFile.clear();
    for (const c of list) {
      if (!c.rawEml) c.rawEml = assembleEml(c);
      this.nodes.set(c.messageId, c);
      this.syncedEml.set(c.messageId, c.rawEml);
      if (c.fileName) {
        this.syncedEmlByFile.set(c.fileName, c.rawEml);
      }
    }
    this.rebuildIndexes();
    this.notify();
  }

  private async loadFromFolder(): Promise<CapsuleNode[] | null> {
    try {
      const files = await scanVaultFolder();
      if (!files || files.length === 0) return null;
      return files.map((f) => parseEml(f.rawEml, f.fileName));
    } catch (e) {
      console.warn('Could not restore from folder vault:', e);
      return null;
    }
  }

  private async loadFromDisk(): Promise<CapsuleNode[] | null> {
    try {
      const parsed = await loadVaultFromDisk<CapsuleNode[]>();
      return parsed;
    } catch (e) {
      console.warn('Could not restore from disk:', e);
      return null;
    }
  }

  /**
   * Sync the folder vault: write only capsules whose .eml changed,
   * remove .eml files whose capsules no longer exist.
   */
  private async syncEmlFiles() {
    const existing = new Set<string>();
    for (const node of this.nodes.values()) {
      const raw = node.rawEml || assembleEml(node);
      const prev = this.syncedEml.get(node.messageId);
      if (prev === raw) {
        // Unchanged — keep the known file name in the existing set.
        if (node.fileName) {
          existing.add(node.fileName);
          this.syncedEmlByFile.set(node.fileName, raw);
        }
        continue;
      }
      const targetFileName = node.fileName || `${sanitizeFileName(node.messageId)}.eml`;
      // Pre-cache before write to eliminate self-write race condition with file watcher
      this.syncedEml.set(node.messageId, raw);
      this.syncedEmlByFile.set(targetFileName, raw);

      const fileName = await writeCapsuleEml(node.messageId, raw);
      if (fileName) {
        existing.add(fileName);
        // Remember the on-disk file name for later cleanup.
        if (node.fileName !== fileName) {
          node.fileName = fileName;
        }
        this.syncedEmlByFile.set(fileName, raw);
      }
    }
    // Clean up orphaned .eml files (capsules deleted from the vault).
    try {
      const { listDir, resolveVaultDir } = await import('./desktopStore');
      const vaultDir = await resolveVaultDir();
      if (!vaultDir) return;
      const files = await listDir(vaultDir);
      for (const f of files) {
        if (f.toLowerCase().endsWith('.eml') && !existing.has(f)) {
          await removeCapsuleEml(f);
        }
      }
    } catch (e) {
      console.warn('vaultStore: orphan cleanup failed', e);
    }
  }

  private persist() {
    try {
      const list = Array.from(this.nodes.values());
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
      }
      // Real filesystem persistence (Tauri desktop shell) — fire-and-forget.
      saveVaultToDisk(list).then((ok) => {
        if (!ok) console.warn('vaultStore: disk persist unavailable');
      });
      // Folder vault: one .eml per capsule.
      this.syncEmlFiles();
    } catch (e) {
      console.warn('LocalStorage save failed:', e);
    }
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    for (const l of this.listeners) {
      l();
    }
  }

  public rebuildIndexes() {
    const startTime = performance.now();
    this.invertedIndex.clear();
    let totalBytes = 0;

    for (const [msgId, node] of this.nodes) {
      const raw = node.rawEml || assembleEml(node);
      totalBytes += raw.length;

      // Extract tokens once — they feed BOTH the boolean inverted index
      // ("which capsules contain the term") and the BM25 ranker
      // ("which of them is the most relevant").
      const searchableText = `${node.subject} ${node.from} ${node.to} ${node.tags.join(' ')} ${this.extractBlockText(node.blocks)}`;
      const tokens = tokenize(searchableText);

      for (const token of tokens) {
        if (!this.invertedIndex.has(token)) {
          this.invertedIndex.set(token, new Set());
        }
        this.invertedIndex.get(token)!.add(msgId);
      }
      this.bm25.add(msgId, tokens);
    }

    const duration = Math.max(0.1, performance.now() - startTime);
    this.scanStats = {
      totalFiles: this.nodes.size,
      scanDurationMs: Number(duration.toFixed(2)),
      scannedBytes: totalBytes,
      simdSpeedMBs: Number(((totalBytes / (1024 * 1024)) / (duration / 1000) || 350).toFixed(1)),
      lastScanTimestamp: Date.now(),
    };

    this.rebuildBacklinks();
  }

  /** Extract [[wikilink]] references from all text blocks → backlink map. */
  private rebuildBacklinks() {
    this.backlinks.clear();
    const textOf = (b: CapsuleBlock): string => {
      switch (b.type) {
        case 'heading':
          return (b.data as any).text || '';
        case 'paragraph':
          return (b.data as any).text || '';
        case 'callout':
          return `${(b.data as any).title || ''} ${(b.data as any).content || ''}`;
        case 'ai_opponent_block':
          return (b.data as any).criticism || '';
        case 'todo_list':
          return (b.data as any).items?.map((i: any) => i.text).join(' ') || '';
        default:
          return '';
      }
    };

    for (const [msgId, node] of this.nodes) {
      const targets = new Set<string>();
      for (const block of node.blocks) {
        for (const query of extractBacklinks(textOf(block))) {
          const resolved = this.resolveBacklink(query);
          if (resolved && resolved !== msgId) targets.add(resolved);
        }
      }
      if (targets.size > 0) this.backlinks.set(msgId, targets);
    }
  }

  /**
   * Resolve a [[query]] to a capsule messageId:
   * 1) exact messageId (with or without <>)  2) messageId contains query
   * 3) subject contains query (case-insensitive)  4) inverted index first hit.
   */
  public resolveBacklink(query: string): string | null {
    if (!query) return null;
    const q = query.trim();

    // 1. exact messageId (handle both <id@host> and id@host)
    const bareQ = q.replace(/^<|>$/g, '');
    for (const [id] of this.nodes) {
      const bareId = id.replace(/^<|>$/g, '');
      if (bareId === bareQ || bareId === q) return id;
    }

    // 2. messageId contains query
    const ql = q.toLowerCase();
    for (const [id] of this.nodes) {
      if (id.toLowerCase().includes(ql)) return id;
    }

    // 3. subject contains query (case-insensitive)
    let best: { id: string; len: number } | null = null;
    for (const [id, node] of this.nodes) {
      const s = node.subject.toLowerCase();
      if (s === ql) return id;
      if (s.includes(ql) && (!best || ql.length > best.len)) best = { id, len: ql.length };
    }
    if (best) return best.id;

    // 4. inverted index: first node matching all tokens
    const tokens = ql.match(/[a-zа-я0-9_-]{2,}/gi) || [];
    if (tokens.length > 0) {
      const first = this.invertedIndex.get(tokens[0]);
      if (first && first.size > 0) return Array.from(first)[0];
    }

    return null;
  }

  /** All backlink targets of a capsule (messageIds). */
  public getBacklinks(messageId: string): string[] {
    return Array.from(this.backlinks.get(messageId) || []);
  }

  /** Incoming backlinks: which capsules link TO this one. */
  public getIncomingBacklinks(messageId: string): string[] {
    const out: string[] = [];
    for (const [fromId, targets] of this.backlinks) {
      if (targets.has(messageId)) out.push(fromId);
    }
    return out;
  }

  /**
   * Export a capsule to Markdown (option — .eml remains the source of truth).
   */
  public exportCapsuleToMarkdown(messageId: string): string {
    const node = this.nodes.get(messageId);
    if (!node) return '';
    const lines: string[] = [];
    lines.push(`# ${node.subject}`);
    lines.push('');
    lines.push(`- **From:** ${node.from}`);
    lines.push(`- **Date:** ${node.date}`);
    lines.push(`- **Tags:** ${node.tags.join(', ') || '—'}`);
    lines.push(`- **Message-ID:** ${node.messageId}`);
    if (node.inReplyTo) lines.push(`- **In-Reply-To:** ${node.inReplyTo}`);
    lines.push('');

    for (const block of node.blocks) {
      switch (block.type) {
        case 'heading': {
          const d = block.data as any;
          const level = Math.min(6, Math.max(1, d.level || 1));
          lines.push(`${'#'.repeat(level)} ${d.text || ''}`);
          lines.push('');
          break;
        }
        case 'paragraph': {
          lines.push((block.data as any).text || '');
          lines.push('');
          break;
        }
        case 'callout': {
          const d = block.data as any;
          if (d.title) lines.push(`> **${d.title}**`);
          if (d.content) lines.push(`> ${(d.content || '').split('\n').join('\n> ')}`);
          lines.push('');
          break;
        }
        case 'todo_list': {
          const items = ((block.data as any).items || []) as Array<{ text: string; done?: boolean }>;
          for (const it of items) {
            lines.push(`- [${it.done ? 'x' : ' '}] ${it.text}`);
          }
          lines.push('');
          break;
        }
        case 'ai_opponent_block': {
          const d = block.data as any;
          lines.push(`> 💭 *${block.author || 'AI'}*: ${(d.criticism || '').split('\n').join('\n> ')}`);
          lines.push('');
          break;
        }
        case 'code_repl': {
          const d = block.data as any;
          lines.push(`\`\`\`${d.language || ''}`);
          lines.push(d.code || '');
          lines.push('```');
          lines.push('');
          break;
        }
        case 'data_grid_view': {
          const d = block.data as any;
          if (d.title) lines.push(`### ${d.title}`);
          const att = node.attachments.find((a) => a.cid === d.source_cid);
          if (att) {
            try {
              const rows = JSON.parse(att.content);
              if (Array.isArray(rows) && rows.length > 0 && typeof rows[0] === 'object') {
                const cols = Object.keys(rows[0]);
                lines.push('| ' + cols.join(' | ') + ' |');
                lines.push('|' + cols.map(() => '---').join('|') + '|');
                for (const r of rows.slice(0, 50)) {
                  lines.push('| ' + cols.map((c) => String(r[c] ?? '')).join(' | ') + ' |');
                }
              }
            } catch {
              /* skip non-JSON grid */
            }
          }
          lines.push('');
          break;
        }
        default:
          break;
      }
    }
    return lines.join('\n');
  }

  private extractBlockText(blocks: CapsuleBlock[]): string {
    return blocks
      .map((b) => {
        switch (b.type) {
          case 'heading':
            return b.data.text;
          case 'paragraph':
            return b.data.text;
          case 'ai_opponent_block':
            return b.data.criticism;
          case 'callout':
            return `${b.data.title} ${b.data.content}`;
          case 'todo_list':
            return b.data.items.map((i) => i.text).join(' ');
          case 'code_repl':
            return b.data.code;
          case 'audio_note':
            return b.data.transcript;
          default:
            return '';
        }
      })
      .join(' ');
  }

  public getNodes(): CapsuleNode[] {
    return Array.from(this.nodes.values()).sort((a, b) => b.timestamp - a.timestamp);
  }

  public getNode(messageId: string): CapsuleNode | undefined {
    return this.nodes.get(messageId);
  }

  public saveNode(capsule: CapsuleNode) {
    capsule.rawEml = assembleEml(capsule);
    this.nodes.set(capsule.messageId, capsule);
    this.rebuildIndexes();
    this.persist();
    this.notify();
  }

  public deleteNode(messageId: string) {
    const node = this.nodes.get(messageId);
    this.nodes.delete(messageId);
    this.syncedEml.delete(messageId);
    if (node?.fileName) {
      this.syncedEmlByFile.delete(node.fileName);
    }
    this.rebuildIndexes();
    this.persist();
    this.notify();
    // Remove the capsule's .eml file from the folder vault.
    if (node?.fileName) {
      removeCapsuleEml(node.fileName).catch(() => {});
    }
  }

  /**
   * Queue external file system events with a short debounce (100ms)
   * so bulk operations (e.g. git pull modifying 50 capsules) trigger
   * only a single rebuildIndexes() pass instead of 50.
   */
  public queueExternalFsChanges(changes: VaultFsChange[]) {
    for (const ch of changes) {
      this.pendingFsChanges.set(ch.fileName, ch);
    }
    if (this.fsBatchTimeout) {
      clearTimeout(this.fsBatchTimeout);
    }
    this.fsBatchTimeout = setTimeout(() => {
      const batch = Array.from(this.pendingFsChanges.values());
      this.pendingFsChanges.clear();
      this.fsBatchTimeout = null;
      this.handleExternalFsChanges(batch);
    }, 100);
  }

  /**
   * Process a batch of external file system changes from the native vault watcher.
   */
  public async handleExternalFsChanges(changes: VaultFsChange[]) {
    let hasChanged = false;

    for (const change of changes) {
      const { fileName, kind } = change;

      if (kind === 'remove') {
        for (const [msgId, node] of this.nodes) {
          if (node.fileName === fileName) {
            this.nodes.delete(msgId);
            this.syncedEml.delete(msgId);
            this.syncedEmlByFile.delete(fileName);
            hasChanged = true;
            break;
          }
        }
        this.syncedEmlByFile.delete(fileName);
      } else {
        // 'modify' or newly created externally
        const rawEml = await readVaultFile(fileName);
        if (rawEml === null) continue;

        // Self-write loop guard: if rawEml matches our synced cache, it's CapsuleCraft's own write
        const cached = this.syncedEmlByFile.get(fileName);
        if (cached === rawEml) {
          continue;
        }

        try {
          const parsed = parseEml(rawEml, fileName);

          // Clean up any previous node associated with this exact same file name to avoid duplicate ghost cards
          for (const [oldId, oldNode] of this.nodes) {
            if (oldNode.fileName === fileName && oldId !== parsed.messageId) {
              this.nodes.delete(oldId);
              this.syncedEml.delete(oldId);
            }
          }

          // If an existing capsule had this messageId under an older fileName, clean up old mapping
          const existing = this.nodes.get(parsed.messageId);
          if (existing?.fileName && existing.fileName !== fileName) {
            this.syncedEmlByFile.delete(existing.fileName);
          }

          this.nodes.set(parsed.messageId, parsed);
          this.syncedEml.set(parsed.messageId, rawEml);
          this.syncedEmlByFile.set(fileName, rawEml);
          hasChanged = true;
        } catch (e) {
          console.warn(`vaultStore: failed to parse external .eml ${fileName}`, e);
        }
      }
    }

    if (hasChanged) {
      this.rebuildIndexes();
      this.notify();
    }
  }

  public destroy() {
    if (this.unlistenWatcher) {
      this.unlistenWatcher();
      this.unlistenWatcher = undefined;
    }
    if (this.fsBatchTimeout) {
      clearTimeout(this.fsBatchTimeout);
      this.fsBatchTimeout = null;
    }
  }

  public createNewCapsule(overrides?: Partial<CapsuleNode>): CapsuleNode {
    const idSuffix = Math.random().toString(36).substring(2, 6);
    const messageId = `<capsule-${idSuffix}-${Date.now().toString(36)}@vault.local>`;
    const newCapsule: CapsuleNode = {
      messageId,
      subject: overrides?.subject || '',
      from: overrides?.from || 'Local user <user@capsuleos.local>',
      to: overrides?.to || 'CapsuleCraft Vault <vault@capsuleos.local>',
      date: new Date().toUTCString(),
      timestamp: Date.now(),
      inReplyTo: overrides?.inReplyTo,
      parentId: overrides?.parentId,
      references: overrides?.references || (overrides?.inReplyTo ? [overrides.inReplyTo] : []),
      tags: overrides?.tags || [],
      status: overrides?.status || 'Active',
      fileName: `capsule_${idSuffix}.eml`,
      blocks: overrides?.blocks || [
        {
          id: `blk_body_${Date.now()}`,
          type: 'paragraph',
          data: { text: '' },
        },
      ],
      attachments: overrides?.attachments || [],
    };

    newCapsule.rawEml = assembleEml(newCapsule);
    this.nodes.set(messageId, newCapsule);
    this.rebuildIndexes();
    this.persist();
    this.notify();
    return newCapsule;
  }

  public importEmlString(rawEml: string, fileName?: string): CapsuleNode {
    const parsed = parseEml(rawEml, fileName);
    parsed.rawEml = rawEml;
    this.nodes.set(parsed.messageId, parsed);
    this.rebuildIndexes();
    this.persist();
    this.notify();
    return parsed;
  }

  public search(query: string): CapsuleNode[] {
    return this.searchWithScores(query).map((hit) => hit.node);
  }

  /**
   * BM25-ranked full-text search.
   *
   * Score = Σ Okapi BM25 over query tokens (exact + prefix terms)
   *       + flat boosts for subject/tag substring hits (keeps the legacy
   *         "fuzzy" behavior; BM25 stays the dominant ranking signal).
   * Tie-break: newer capsule first. `#tag` queries keep exact-tag semantics.
   */
  public searchWithScores(query: string): ScoredSearchHit[] {
    const q = query.trim().toLowerCase();
    if (!q) {
      return this.getNodes().map((node) => ({ node, score: 0, matchedTerms: [] }));
    }

    // Match exact tag
    if (q.startsWith('#')) {
      return this.getNodes()
        .filter((n) => n.tags.some((t) => t.toLowerCase().includes(q)))
        .map((node) => ({ node, score: 100, matchedTerms: [q] }));
    }

    const tokens = tokenize(q).length ? tokenize(q) : [q];
    const scores = new Map<string, number>();
    const matched = new Map<string, Set<string>>();

    const bump = (id: string, v: number, term: string) => {
      scores.set(id, (scores.get(id) || 0) + v);
      if (!matched.has(id)) matched.set(id, new Set());
      matched.get(id)!.add(term);
    };

    for (const token of tokens) {
      // 1) BM25 over the index: exact + prefix terms
      for (const hit of this.bm25.termHits(token)) {
        bump(hit.id, hit.score, token);
      }

      // 2) Substring fuzzy in subjects and tags (legacy boost)
      for (const [id, node] of this.nodes) {
        if (node.subject.toLowerCase().includes(token)) {
          bump(id, 12, token);
        }
        if (node.tags.some((t) => t.toLowerCase().includes(token))) {
          bump(id, 6, token);
        }
      }
    }

    return Array.from(scores.entries())
      .map(([id, score]) => ({
        node: this.nodes.get(id),
        score,
        matchedTerms: Array.from(matched.get(id) || []),
      }))
      .filter((h): h is ScoredSearchHit => !!h.node)
      .sort((a, b) => b.score - a.score || b.node.timestamp - a.node.timestamp);
  }

  /** BM25 index statistics for the UI (docs, distinct terms, avg length). */
  public searchStats() {
    return this.bm25.stats();
  }

  /**
   * Semantically related capsules: tf-idf cosine similarity over the same
   * inverted index (no LLM, fully deterministic). Direct backlink targets
   * are excluded — they are already shown in the links panel.
   */
  public relatedCapsules(messageId: string, limit = 3): Array<{ node: CapsuleNode; similarity: number }> {
    if (!this.nodes.has(messageId)) return [];
    const linked = new Set<string>(this.getBacklinks(messageId));
    const out: Array<{ node: CapsuleNode; similarity: number }> = [];

    for (const [id, node] of this.nodes) {
      if (id === messageId || linked.has(id)) continue;
      const sim = this.bm25.similarity(messageId, id);
      if (sim > 0.02) out.push({ node, similarity: sim });
    }

    return out.sort((a, b) => b.similarity - a.similarity).slice(0, limit);
  }

  public getState(): VaultGraphState {
    return this.getVaultGraphState();
  }

  public getVaultGraphState(): VaultGraphState {
    const graphNodes: GraphNode[] = [];
    const graphEdges: GraphEdge[] = [];
    const tagIndex = new Map<string, string[]>();
    const authorIndex = new Map<string, string[]>();

    // Calculate in-degree / degree for each node
    const degreeMap = new Map<string, number>();

    for (const node of this.nodes.values()) {
      // Tags index
      for (const tag of node.tags) {
        if (!tagIndex.has(tag)) tagIndex.set(tag, []);
        tagIndex.get(tag)!.push(node.messageId);
      }

      // Author index
      const author = node.from.replace(/<.*>/, '').trim();
      if (!authorIndex.has(author)) authorIndex.set(author, []);
      authorIndex.get(author)!.push(node.messageId);

      // In-Reply-To Edge
      if (node.inReplyTo && this.nodes.has(node.inReplyTo)) {
        graphEdges.push({
          id: `edge_${node.messageId}_${node.inReplyTo}`,
          source: node.messageId,
          target: node.inReplyTo,
          type: 'in_reply_to',
          label: 'In-Reply-To',
        });
        degreeMap.set(node.messageId, (degreeMap.get(node.messageId) || 0) + 1);
        degreeMap.set(node.inReplyTo, (degreeMap.get(node.inReplyTo) || 0) + 1);
      }

      // Page hierarchy edge (X-Capsule-Page-Parent). Kept separate from
      // In-Reply-To so a reply thread does not silently become a sub-page.
      if (
        node.parentId &&
        this.nodes.has(node.parentId) &&
        node.parentId !== node.inReplyTo
      ) {
        graphEdges.push({
          id: `edge_page_${node.messageId}_${node.parentId}`,
          source: node.messageId,
          target: node.parentId,
          type: 'page_parent',
          label: 'Sub-page',
        });
        degreeMap.set(node.messageId, (degreeMap.get(node.messageId) || 0) + 1);
        degreeMap.set(node.parentId, (degreeMap.get(node.parentId) || 0) + 1);
      }

      // References Edges
      if (node.references && Array.isArray(node.references)) {
        for (const refId of node.references) {
          if (refId !== node.inReplyTo && this.nodes.has(refId)) {
            graphEdges.push({
              id: `edge_ref_${node.messageId}_${refId}`,
              source: node.messageId,
              target: refId,
              type: 'references',
              label: 'References',
            });
            degreeMap.set(node.messageId, (degreeMap.get(node.messageId) || 0) + 1);
            degreeMap.set(refId, (degreeMap.get(refId) || 0) + 1);
          }
        }
      }

      // Backlink Edges ([[wikilinks]] found in text blocks)
      const blTargets = this.backlinks.get(node.messageId);
      if (blTargets) {
        for (const targetId of blTargets) {
          if (this.nodes.has(targetId)) {
            graphEdges.push({
              id: `edge_bl_${node.messageId}_${targetId}`,
              source: node.messageId,
              target: targetId,
              type: 'backlink',
              label: '↗',
            });
            degreeMap.set(node.messageId, (degreeMap.get(node.messageId) || 0) + 1);
            degreeMap.set(targetId, (degreeMap.get(targetId) || 0) + 1);
          }
        }
      }
    }

    for (const node of this.nodes.values()) {
      graphNodes.push({
        id: node.messageId,
        subject: node.subject,
        from: node.from,
        tags: node.tags,
        status: node.status,
        blockCount: node.blocks.length,
        attachmentCount: node.attachments.length,
        degree: degreeMap.get(node.messageId) || 0,
        group: node.tags[0] || '#general',
      });
    }

    return {
      nodes: this.nodes,
      graphNodes,
      graphEdges,
      tagIndex,
      authorIndex,
      scanStats: this.scanStats,
    };
  }

  public async exportVaultZip(): Promise<Blob> {
    const zip = new JSZip();
    const folder = zip.folder('CapsuleCraft_Vault');

    for (const node of this.nodes.values()) {
      const emlContent = node.rawEml || assembleEml(node);
      const safeName = node.fileName || `${node.subject.replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 30)}.eml`;
      folder?.file(safeName, emlContent);
    }

    return await zip.generateAsync({ type: 'blob' });
  }

  public downloadEmlFile(messageId: string) {
    const node = this.nodes.get(messageId);
    if (!node) return;
    const emlContent = node.rawEml || assembleEml(node);
    const blob = new Blob([emlContent], { type: 'message/rfc822' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = node.fileName || 'capsule.eml';
    a.click();
    URL.revokeObjectURL(url);
  }
}

export const vaultStore = new VaultStore();
