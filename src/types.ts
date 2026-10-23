export type BlockType =
  | 'heading'
  | 'paragraph'
  | 'ai_opponent_block'
  | 'data_grid_view'
  | 'interactive_canvas'
  | 'code_repl'
  | 'audio_note'
  | 'callout'
  | 'todo_list';

export interface BaseBlock {
  id: string;
  type: BlockType;
  author?: string;
  createdAt?: number;
}

export interface HeadingBlockData {
  level: 1 | 2 | 3;
  text: string;
}

export interface ParagraphBlockData {
  text: string;
}

export interface AiOpponentBlockData {
  criticism: string;
  sourceClaim?: string;
  confidence?: number;
}

export interface DataGridBlockData {
  source_cid: string; // e.g. "cid:dataset_q4_csv"
  view?: 'table' | 'chart' | 'pivot';
  chartType?: 'bar' | 'line' | 'area' | 'pie';
  xColumn?: string;
  yColumn?: string;
  title?: string;
}

export interface WhiteboardElement {
  id: string;
  type: 'rectangle' | 'circle' | 'sticky' | 'arrow' | 'text' | 'mindmap_node';
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
  color: string;
  fromId?: string;
  toId?: string;
}

export interface InteractiveCanvasBlockData {
  scene_cid: string; // e.g. "cid:whiteboard_scene_json"
  elements?: WhiteboardElement[];
}

export interface CodeReplBlockData {
  language: 'javascript' | 'python' | 'rust' | 'json';
  code: string;
  output?: string;
  error?: string;
  lastRunTime?: number;
}

export interface AudioNoteBlockData {
  duration: string;
  transcript: string;
  waveform: number[];
  author: string;
  isPlaying?: boolean;
  /** CID of a real audio attachment (base64 payload) — enables actual playback. */
  audioCid?: string;
  /** MIME type of the attached audio (audio/webm, audio/mpeg, ...). */
  audioMime?: string;
}

export interface CalloutBlockData {
  title: string;
  content: string;
  icon?: string;
  tone: 'emerald' | 'amber' | 'blue' | 'purple' | 'rose';
}

export type TodoPriority = 'low' | 'normal' | 'high';
export type TaskStatus = 'todo' | 'doing' | 'done';

export interface TodoItem {
  id: string;
  text: string;
  done: boolean;
  /** Explicit board status. Falls back to `done ? 'done' : 'todo'` when absent. */
  status?: TaskStatus;
  /** Local calendar day (`YYYY-MM-DD`) when work starts. Defaults to the due day. */
  start?: string;
  /** Task keys (`blockId:itemId`) that must be completed first. */
  blockedBy?: string[];
  /** Local calendar day (`YYYY-MM-DD`), not a UTC instant. */
  due?: string;
  priority?: TodoPriority;
}

export interface TodoListBlockData {
  title?: string;
  items: TodoItem[];
}

export type CapsuleBlock =
  | (BaseBlock & { type: 'heading'; data: HeadingBlockData })
  | (BaseBlock & { type: 'paragraph'; data: ParagraphBlockData })
  | (BaseBlock & { type: 'ai_opponent_block'; data: AiOpponentBlockData })
  | (BaseBlock & { type: 'data_grid_view'; data: DataGridBlockData })
  | (BaseBlock & { type: 'interactive_canvas'; data: InteractiveCanvasBlockData })
  | (BaseBlock & { type: 'code_repl'; data: CodeReplBlockData })
  | (BaseBlock & { type: 'audio_note'; data: AudioNoteBlockData })
  | (BaseBlock & { type: 'callout'; data: CalloutBlockData })
  | (BaseBlock & { type: 'todo_list'; data: TodoListBlockData });

export interface CapsuleAttachment {
  name: string;
  cid: string; // e.g. "dataset_q4_csv"
  mimeType: string; // "text/csv", "application/json", etc.
  content: string; // Raw text or stringified JSON or base64
  sizeBytes?: number;
}

export interface CapsuleNode {
  messageId: string;
  subject: string;
  from: string;
  to: string;
  date: string;
  timestamp: number;
  inReplyTo?: string;
  /** Parent page in the wiki tree (X-Capsule-Page-Parent), independent of threading. */
  parentId?: string;
  references: string[];
  tags: string[];
  status: 'Active' | 'Archived' | 'Draft' | 'Synthesis';
  fileName: string;
  blocks: CapsuleBlock[];
  attachments: CapsuleAttachment[];
  rawEml?: string;
  byteOffsetBody?: number;
}

/** One ranked result of full-text search (Okapi BM25 over the inverted index). */
export interface ScoredSearchHit {
  node: CapsuleNode;
  /** BM25 score (+ subject/tag boosts). 0 for an empty query (= full listing). */
  score: number;
  /** Query tokens that actually matched this capsule. */
  matchedTerms: string[];
}

export interface NodeMetadata {
  messageId: string;
  subject: string;
  date: string;
  timestamp: number;
  from: string;
  to: string;
  inReplyTo?: string;
  /** Parent page in the wiki tree (X-Capsule-Page-Parent), independent of threading. */
  parentId?: string;
  references: string[];
  tags: string[];
  status: 'Active' | 'Archived' | 'Draft' | 'Synthesis';
  fileName: string;
  blockCount: number;
  attachmentCount: number;
  previewText: string;
  byteOffsetBody?: number;
}

export type EdgeType = 'in_reply_to' | 'references' | 'tag_cluster' | 'backlink' | 'page_parent';

export interface GraphEdge {
  id: string;
  source: string; // Message-ID
  target: string; // Message-ID
  type: EdgeType;
  label?: string;
}

export interface GraphNode extends d3.SimulationNodeDatum {
  id: string; // Message-ID
  subject: string;
  from: string;
  tags: string[];
  status: string;
  blockCount: number;
  attachmentCount: number;
  degree?: number;
  group?: string;
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
  fx?: number | null;
  fy?: number | null;
}

export interface VaultGraphState {
  nodes: Map<string, CapsuleNode>;
  graphNodes: GraphNode[];
  graphEdges: GraphEdge[];
  tagIndex: Map<string, string[]>; // Tag -> MessageIds
  authorIndex: Map<string, string[]>; // Author -> MessageIds
  scanStats: {
    totalFiles: number;
    scanDurationMs: number;
    scannedBytes: number;
    simdSpeedMBs: number;
    lastScanTimestamp: number;
  };
}

export type AppViewMode =
  | 'canvas'
  | 'graph'
  | 'threads'
  | 'mime_inspector'
  | 'autonomous_email';
