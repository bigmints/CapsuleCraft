import {
  CapsuleNode,
  VaultGraphState,
  GraphNode,
  GraphEdge,
  CapsuleBlock,
} from '../types';
import { assembleEml, parseEml } from './mime';
import { loadVaultFromDisk, saveVaultToDisk } from './desktopStore';
import JSZip from 'jszip';

const STORAGE_KEY = 'capsule_os_vault_v2';

export const INITIAL_CAPSULES: CapsuleNode[] = [
  {
    messageId: '<capsule-9f3a-4b21@vault.local>',
    subject: 'Анализ рынка и оптимизация юнит-экономики',
    from: 'Alexey <user@local>',
    to: 'Claude 3.5 Sonnet <agent@local>',
    date: 'Fri, 25 Oct 2024 14:30:00 +0300',
    timestamp: new Date('2024-10-25T11:30:00Z').getTime(),
    inReplyTo: '<capsule-8a11-001a@vault.local>',
    references: ['<capsule-8a11-001a@vault.local>', '<capsule-0000-root@vault.local>'],
    tags: ['#finance', '#ai-strategy', '#q4'],
    status: 'Active',
    fileName: '2024-10-unit-economics.eml',
    blocks: [
      {
        id: 'blk_01',
        type: 'heading',
        data: { level: 1, text: 'Анализ рынка и оптимизация юнит-экономики' },
      },
      {
        id: 'blk_01_p',
        type: 'paragraph',
        data: {
          text: 'Текущая модель монетизации показывает устойчивый рост LTV/CAC при масштабировании каналов прямой дистрибуции. Проводим стресс-тестирование с когортами Q4.',
        },
      },
      {
        id: 'blk_02',
        type: 'ai_opponent_block',
        author: 'Claude 3.5 Sonnet',
        data: {
          criticism: 'Маржинальность переоценена на 14% из-за логистики и сезонного оттока в Q1. Рекомендуется заложить буфер на удержание.',
          sourceClaim: 'LTV/CAC 4.1x',
          confidence: 0.94,
        },
      },
      {
        id: 'blk_03',
        type: 'data_grid_view',
        data: {
          source_cid: 'cid:dataset_q4_csv',
          view: 'chart',
          chartType: 'bar',
          xColumn: 'Month',
          yColumn: 'LTV',
          title: 'Квартальная динамика CAC vs LTV ($)',
        },
      },
      {
        id: 'blk_04',
        type: 'interactive_canvas',
        data: {
          scene_cid: 'cid:whiteboard_scene_json',
        },
      },
      {
        id: 'blk_05_callout',
        type: 'callout',
        data: {
          title: 'Ключевой инвариант',
          content: 'Все расчеты и визуальные холсты упаковываются в единый MIME-контейнер без сторонних СУБД.',
          tone: 'emerald',
        },
      },
    ],
    attachments: [
      {
        name: 'dataset_q4.csv',
        cid: 'dataset_q4_csv',
        mimeType: 'text/csv',
        content: `Month,CAC,LTV,Margin,ARR_K
Jan,120,450,0.42,85
Feb,115,480,0.45,110
Mar,110,510,0.48,145
Apr,105,530,0.50,190
May,98,560,0.52,240
Jun,92,590,0.55,310`,
      },
      {
        name: 'whiteboard.json',
        cid: 'whiteboard_scene_json',
        mimeType: 'application/json',
        content: JSON.stringify({
          elements: [
            {
              id: 'el_1',
              type: 'rectangle',
              x: 80,
              y: 60,
              width: 200,
              height: 70,
              label: 'User Acquisition (Paid)',
              color: '#38bdf8',
            },
            {
              id: 'el_2',
              type: 'rectangle',
              x: 340,
              y: 60,
              width: 200,
              height: 70,
              label: 'Activation & Onboarding',
              color: '#10b981',
            },
            {
              id: 'el_3',
              type: 'rectangle',
              x: 600,
              y: 60,
              width: 200,
              height: 70,
              label: 'Retention & Expansion',
              color: '#a855f7',
            },
            {
              id: 'el_4',
              type: 'arrow',
              x: 280,
              y: 95,
              width: 60,
              height: 2,
              label: 'K-Factor 1.4',
              color: '#64748b',
              fromId: 'el_1',
              toId: 'el_2',
            },
            {
              id: 'el_5',
              type: 'arrow',
              x: 540,
              y: 95,
              width: 60,
              height: 2,
              label: 'LTV 4.5x',
              color: '#64748b',
              fromId: 'el_2',
              toId: 'el_3',
            },
            {
              id: 'el_6',
              type: 'sticky',
              x: 200,
              y: 170,
              width: 240,
              height: 90,
              label: '💡 Снижение CAC на $20 высвобождает $45k для AI R&D',
              color: '#f59e0b',
            },
          ],
        }),
      },
    ],
  },
  {
    messageId: '<capsule-8a11-001a@vault.local>',
    subject: 'AI-Augmented Cognitive Architecture & RAM Indexing',
    from: 'Alexey <user@local>',
    to: 'Claude 3.5 Sonnet <agent@local>',
    date: 'Wed, 23 Oct 2024 10:15:00 +0300',
    timestamp: new Date('2024-10-23T07:15:00Z').getTime(),
    inReplyTo: '<capsule-0000-root@vault.local>',
    references: ['<capsule-0000-root@vault.local>'],
    tags: ['#ai-strategy', '#neuroscience', '#architecture'],
    status: 'Active',
    fileName: '2024-10-cognitive-arch.eml',
    blocks: [
      {
        id: 'blk_cog_01',
        type: 'heading',
        data: { level: 1, text: 'AI-Augmented Cognitive Architecture & RAM Indexing' },
      },
      {
        id: 'blk_cog_02',
        type: 'paragraph',
        data: {
          text: 'Модель внешнего расширения рабочей памяти человека через графовые структуры MIME-сообщений. Вместо монолитной базы данных — децентрализованный лес автономных капсул.',
        },
      },
      {
        id: 'blk_cog_03',
        type: 'code_repl',
        data: {
          language: 'javascript',
          code: `// Sub-millisecond RAM Directed Graph Topology
function calculateNodeInfluence(inDegree, outDegree, depth) {
  const pagerank = (inDegree * 1.5) + (outDegree * 0.8) + (1 / (depth + 1));
  return {
    pagerank: Number(pagerank.toFixed(3)),
    isHub: inDegree >= 3,
    status: 'Indexed in RAM'
  };
}

calculateNodeInfluence(4, 2, 1);`,
          output: `{\n  "pagerank": 6.9,\n  "isHub": true,\n  "status": "Indexed in RAM"\n}`,
        },
      },
      {
        id: 'blk_cog_04',
        type: 'audio_note',
        data: {
          duration: '0:42',
          transcript: 'Голосовая заметка: Исследовать переход на memmap2 с нулевым оверхедом при сканировании заголовков 50k файлов.',
          waveform: [15, 30, 45, 80, 95, 60, 40, 75, 100, 85, 55, 30, 65, 90, 45, 20],
          author: 'Alexey (Voice Note)',
        },
      },
    ],
    attachments: [],
  },
  {
    messageId: '<capsule-0000-root@vault.local>',
    subject: 'CapsuleOS Genesis & Zero-DB Protocol RFC',
    from: 'Alexey <user@local>',
    to: 'All Vault Agents <agents@vault.local>',
    date: 'Mon, 21 Oct 2024 09:00:00 +0300',
    timestamp: new Date('2024-10-21T06:00:00Z').getTime(),
    references: [],
    tags: ['#architecture', '#zero-db', '#rfc5322'],
    status: 'Active',
    fileName: 'capsule-0000-genesis.eml',
    blocks: [
      {
        id: 'blk_gen_01',
        type: 'heading',
        data: { level: 1, text: 'CapsuleOS Genesis: Инварианты Протокола' },
      },
      {
        id: 'blk_gen_02',
        type: 'callout',
        data: {
          title: '3 Фундаментальных Инварианта',
          content: '1. Pure EML File-System (Zero-DB)\n2. Beyond Markdown (Block-Canvas Engine)\n3. MIME-Native State Serialization (JSON State + HTML5 Fallback)',
          tone: 'blue',
        },
      },
      {
        id: 'blk_gen_03',
        type: 'todo_list',
        data: {
          title: 'Дорожная карта реализации MVP',
          items: [
            { id: 'td_1', text: 'SIMD Zero-DB Header Scanner в RAM (<120ms / 50k files)', done: true },
            { id: 'td_2', text: 'MIME-native multipart/mixed Assembler/Parser', done: true },
            { id: 'td_3', text: 'Force-Directed Directed Acyclic Graph (WebGL / 60 FPS)', done: true },
            { id: 'td_4', text: 'Human-AI Co-Thinking Dialogue & In-Reply-To Threading', done: true },
            { id: 'td_5', text: 'Live DataGrid & Embedded Vector Whiteboard Blocks', done: true },
          ],
        },
      },
    ],
    attachments: [],
  },
  {
    messageId: '<capsule-child-10b2@vault.local>',
    subject: 'Re: Анализ рынка и оптимизация юнит-экономики',
    from: 'Claude 3.5 Sonnet <agent@local>',
    to: 'Alexey <user@local>',
    date: 'Fri, 25 Oct 2024 16:45:00 +0300',
    timestamp: new Date('2024-10-25T13:45:00Z').getTime(),
    inReplyTo: '<capsule-9f3a-4b21@vault.local>',
    references: ['<capsule-8a11-001a@vault.local>', '<capsule-9f3a-4b21@vault.local>'],
    tags: ['#finance', '#ai-dialogue', '#q4'],
    status: 'Synthesis',
    fileName: 're-2024-10-unit-economics-claude.eml',
    blocks: [
      {
        id: 'blk_rep_01',
        type: 'heading',
        data: { level: 2, text: 'Re: Моделирование сценария стресс-теста CAC +25%' },
      },
      {
        id: 'blk_rep_02',
        type: 'paragraph',
        data: {
          text: 'Провел симуляцию влияния роста стоимости привлечения на маржинальность Q4. При сохранении текущего уровня удержания (NPS 72) чистая прибыль выдерживает повышение CAC до $145.',
        },
      },
      {
        id: 'blk_rep_03',
        type: 'code_repl',
        data: {
          language: 'javascript',
          code: `// Stress Test Model Simulation
const baseLTV = 590;
const stressCAC = 120 * 1.25; // +25%
const margin = 0.52;
const netPerUser = (baseLTV * margin) - stressCAC;

console.log({
  stressCAC: '$' + stressCAC.toFixed(2),
  netProfitPerUser: '$' + netPerUser.toFixed(2),
  safetyRatio: (baseLTV / stressCAC).toFixed(2) + 'x'
});`,
          output: `{\n  "stressCAC": "$150.00",\n  "netProfitPerUser": "$156.80",\n  "safetyRatio": "3.93x"\n}`,
        },
      },
      {
        id: 'blk_rep_04',
        type: 'callout',
        data: {
          title: 'Рекомендация AI-партнера',
          content: 'Зафиксировать таргет CAC на уровне $110 и запустить когортную сегментацию в начале ноября.',
          tone: 'purple',
        },
      },
    ],
    attachments: [],
  },
  {
    messageId: '<capsule-whiteboard-77c1@vault.local>',
    subject: 'Autonomous AI Multi-Agent Flow & Knowledge Loops',
    from: 'Alexey <user@local>',
    to: 'Claude 3.5 Sonnet <agent@local>',
    date: 'Thu, 24 Oct 2024 18:20:00 +0300',
    timestamp: new Date('2024-10-24T15:20:00Z').getTime(),
    inReplyTo: '<capsule-8a11-001a@vault.local>',
    references: ['<capsule-8a11-001a@vault.local>'],
    tags: ['#ai-strategy', '#agents', '#whiteboard'],
    status: 'Active',
    fileName: '2024-10-agent-flow.eml',
    blocks: [
      {
        id: 'blk_wb_01',
        type: 'heading',
        data: { level: 1, text: 'Autonomous AI Multi-Agent Flow & Knowledge Loops' },
      },
      {
        id: 'blk_wb_02',
        type: 'paragraph',
        data: {
          text: 'Схема взаимодействия автономных агентов: сканер файловой системы слушает изменения .eml, передает контекст в LLM-ядро и автоматически порождает ветки In-Reply-To.',
        },
      },
      {
        id: 'blk_wb_03',
        type: 'interactive_canvas',
        data: {
          scene_cid: 'cid:agent_flow_canvas_json',
        },
      },
    ],
    attachments: [
      {
        name: 'agent_flow.json',
        cid: 'agent_flow_canvas_json',
        mimeType: 'application/json',
        content: JSON.stringify({
          elements: [
            {
              id: 'af_1',
              type: 'rectangle',
              x: 100,
              y: 80,
              width: 180,
              height: 65,
              label: '📁 File Watcher (.eml)',
              color: '#38bdf8',
            },
            {
              id: 'af_2',
              type: 'rectangle',
              x: 360,
              y: 80,
              width: 180,
              height: 65,
              label: '⚡ Zero-DB Scanner',
              color: '#10b981',
            },
            {
              id: 'af_3',
              type: 'rectangle',
              x: 620,
              y: 80,
              width: 180,
              height: 65,
              label: '🧠 Co-Thinker Agent',
              color: '#a855f7',
            },
            {
              id: 'af_4',
              type: 'sticky',
              x: 360,
              y: 190,
              width: 220,
              height: 80,
              label: '✨ In-Memory Petgraph DAG\nSub-millisecond updates',
              color: '#ec4899',
            },
          ],
        }),
      },
    ],
  },
];

class VaultStore {
  private nodes: Map<string, CapsuleNode> = new Map();
  private invertedIndex: Map<string, Set<string>> = new Map(); // word -> Set<messageId>
  private listeners: Set<() => void> = new Set();
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
    // Try to load from localStorage or initialize with starter capsules
    try {
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
          return;
        }
      }
    } catch (e) {
      console.warn('Could not restore from localStorage:', e);
    }

    // Default seed
    for (const c of INITIAL_CAPSULES) {
      c.rawEml = assembleEml(c);
      this.nodes.set(c.messageId, c);
    }
    this.rebuildIndexes();
    this.persist();

    // Desktop shell: prefer the on-disk vault over localStorage/seed.
    // If a vault.json exists it is authoritative (the freshest copy).
    this.loadFromDisk().then((loaded) => {
      if (loaded && loaded.length > 0) {
        this.nodes.clear();
        for (const c of loaded) {
          if (!c.rawEml) c.rawEml = assembleEml(c);
          this.nodes.set(c.messageId, c);
        }
        this.rebuildIndexes();
        this.notify();
      }
    });
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

  private persist() {
    try {
      const list = Array.from(this.nodes.values());
      localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
      // Real filesystem persistence (Tauri desktop shell) — fire-and-forget.
      saveVaultToDisk(list).then((ok) => {
        if (!ok) console.warn('vaultStore: disk persist unavailable');
      });
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

      // Extract tokens for inverted index
      const searchableText = `${node.subject} ${node.from} ${node.to} ${node.tags.join(' ')} ${this.extractBlockText(node.blocks)}`.toLowerCase();
      const tokens = searchableText.match(/[a-zа-я0-9_-]{2,}/gi) || [];

      for (const token of tokens) {
        const clean = token.toLowerCase();
        if (!this.invertedIndex.has(clean)) {
          this.invertedIndex.set(clean, new Set());
        }
        this.invertedIndex.get(clean)!.add(msgId);
      }
    }

    const duration = Math.max(0.1, performance.now() - startTime);
    this.scanStats = {
      totalFiles: this.nodes.size,
      scanDurationMs: Number(duration.toFixed(2)),
      scannedBytes: totalBytes,
      simdSpeedMBs: Number(((totalBytes / (1024 * 1024)) / (duration / 1000) || 350).toFixed(1)),
      lastScanTimestamp: Date.now(),
    };
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
    this.nodes.delete(messageId);
    this.rebuildIndexes();
    this.persist();
    this.notify();
  }

  public createNewCapsule(overrides?: Partial<CapsuleNode>): CapsuleNode {
    const idSuffix = Math.random().toString(36).substring(2, 6);
    const messageId = `<capsule-${idSuffix}-${Date.now().toString(36)}@vault.local>`;
    const newCapsule: CapsuleNode = {
      messageId,
      subject: overrides?.subject || 'Новая исследовательская капсула',
      from: overrides?.from || 'Alexey <user@local>',
      to: overrides?.to || 'Claude 3.5 Sonnet <agent@local>',
      date: new Date().toUTCString(),
      timestamp: Date.now(),
      inReplyTo: overrides?.inReplyTo,
      references: overrides?.references || (overrides?.inReplyTo ? [overrides.inReplyTo] : []),
      tags: overrides?.tags || ['#new-thought'],
      status: overrides?.status || 'Active',
      fileName: `capsule_${idSuffix}.eml`,
      blocks: overrides?.blocks || [
        {
          id: `blk_head_${Date.now()}`,
          type: 'heading',
          data: { level: 1, text: overrides?.subject || 'Новая исследовательская капсула' },
        },
        {
          id: `blk_body_${Date.now()}`,
          type: 'paragraph',
          data: { text: 'Введите текст или используйте slash-команды (/table, /canvas, /ai-critique, /code)...' },
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

  public createChildReply(parentId: string, title?: string, blocks?: CapsuleBlock[]): CapsuleNode {
    const parent = this.nodes.get(parentId);
    const parentSubject = parent ? parent.subject : 'Thought';
    const cleanSubject = parentSubject.startsWith('Re: ') ? parentSubject : `Re: ${parentSubject}`;

    const newCapsule: CapsuleNode = {
      messageId: `<capsule-re-${Math.random().toString(36).substring(2, 8)}@vault.local>`,
      subject: title || cleanSubject,
      from: 'Claude 3.5 Sonnet <agent@local>',
      to: parent?.from || 'Alexey <user@local>',
      date: new Date().toUTCString(),
      timestamp: Date.now(),
      inReplyTo: parentId,
      references: parent ? Array.from(new Set([...parent.references, parentId])) : [parentId],
      tags: parent ? [...parent.tags, '#ai-dialogue'] : ['#ai-dialogue'],
      status: 'Synthesis',
      fileName: `re_${Math.random().toString(36).substring(2, 6)}.eml`,
      blocks: blocks || [
        {
          id: `blk_rep_hd_${Date.now()}`,
          type: 'heading',
          data: { level: 2, text: title || cleanSubject },
        },
        {
          id: `blk_rep_ai_${Date.now()}`,
          type: 'ai_opponent_block',
          author: 'Claude 3.5 Sonnet',
          data: {
            criticism: `Развитие мысли в ответ на «${parentSubject}»: выделим ключевые ограничивающие гипотезы и альтернативные пути синтеза.`,
          },
        },
        {
          id: `blk_rep_p_${Date.now()}`,
          type: 'paragraph',
          data: { text: 'Предлагается запустить итеративный цикл валидации с фиксацией метрик в RAM-графе.' },
        },
      ],
      attachments: [],
    };

    newCapsule.rawEml = assembleEml(newCapsule);
    this.nodes.set(newCapsule.messageId, newCapsule);
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

  public resetToStarterVault() {
    this.nodes.clear();
    for (const c of INITIAL_CAPSULES) {
      const copy = JSON.parse(JSON.stringify(c));
      copy.rawEml = assembleEml(copy);
      this.nodes.set(copy.messageId, copy);
    }
    this.rebuildIndexes();
    this.persist();
    this.notify();
  }

  public search(query: string): CapsuleNode[] {
    const q = query.trim().toLowerCase();
    if (!q) return this.getNodes();

    // Match exact tag
    if (q.startsWith('#')) {
      return this.getNodes().filter((n) => n.tags.some((t) => t.toLowerCase().includes(q)));
    }

    const tokens = q.match(/[a-zа-я0-9_-]{2,}/gi) || [q];
    const matchScores = new Map<string, number>();

    for (const token of tokens) {
      const matchSet = this.invertedIndex.get(token);
      if (matchSet) {
        for (const id of matchSet) {
          matchScores.set(id, (matchScores.get(id) || 0) + 10);
        }
      }

      // Substring fuzzy in subjects and tags
      for (const [id, node] of this.nodes) {
        if (node.subject.toLowerCase().includes(token)) {
          matchScores.set(id, (matchScores.get(id) || 0) + 15);
        }
        if (node.tags.some((t) => t.toLowerCase().includes(token))) {
          matchScores.set(id, (matchScores.get(id) || 0) + 8);
        }
      }
    }

    return Array.from(matchScores.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([id]) => this.nodes.get(id)!)
      .filter(Boolean);
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
    const folder = zip.folder('CapsuleOS_Vault');

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
