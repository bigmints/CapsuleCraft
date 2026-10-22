import React, { useState } from 'react';
import { CapsuleNode, VaultGraphState } from '../types';
import {
  GitBranch,
  CornerDownRight,
  Send,
  Sparkles,
  Bot,
  User,
  MessageSquare,
  ArrowRight,
  FileSpreadsheet,
  Palette,
  ShieldAlert,
  Mic,
  FileCode2,
} from 'lucide-react';

interface Props {
  graphState: VaultGraphState;
  selectedMessageId: string | null;
  onSelectNode: (messageId: string) => void;
  onOpenInCanvas: (messageId: string) => void;
  onCreateReply: (parentId: string, title?: string) => void;
}

export const ThoughtThreadView: React.FC<Props> = ({
  graphState,
  selectedMessageId,
  onSelectNode,
  onOpenInCanvas,
  onCreateReply,
}) => {
  const [replyText, setReplyText] = useState('');

  // Find root nodes (nodes with no inReplyTo or roots of threads)
  const allNodes: CapsuleNode[] = Array.from(graphState.nodes.values());
  const rootNodes = allNodes.filter((n) => !n.inReplyTo);

  // Get current active thread tree
  const activeNode = selectedMessageId
    ? graphState.nodes.get(selectedMessageId)
    : rootNodes[0] || allNodes[0];

  // Helper to find all descendants / chain of in-reply-to
  const buildThreadChain = (root: CapsuleNode): CapsuleNode[] => {
    const chain: CapsuleNode[] = [root];
    const queue = [root.messageId];

    while (queue.length > 0) {
      const currentId = queue.shift()!;
      const children = allNodes.filter((n) => n.inReplyTo === currentId);
      for (const child of children) {
        if (!chain.some((c) => c.messageId === child.messageId)) {
          chain.push(child);
          queue.push(child.messageId);
        }
      }
    }

    return chain.sort((a, b) => a.timestamp - b.timestamp);
  };

  const currentThread = activeNode ? buildThreadChain(activeNode) : [];

  const handleSendReply = (parentId: string) => {
    if (!replyText.trim()) return;
    onCreateReply(parentId, replyText.trim());
    setReplyText('');
  };

  return (
    <div className="w-full h-full flex flex-col md:flex-row bg-[#020617] text-slate-200 overflow-hidden">
      {/* Left Sidebar: Threads List */}
      <div className="w-full md:w-80 border-r border-slate-800 bg-[#0f172a]/20 flex flex-col shrink-0">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <GitBranch className="w-4 h-4 text-cyan-400" />
            <span className="text-xs font-bold uppercase tracking-wider text-slate-100 font-mono">
              Thought Threads
            </span>
          </div>
          <span className="text-[10px] font-mono text-slate-400 bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
            {rootNodes.length} roots
          </span>
        </div>

        <div className="overflow-y-auto flex-1 p-3 space-y-2">
          {rootNodes.map((root) => {
            const childrenCount = allNodes.filter((n) => n.inReplyTo === root.messageId).length;
            const isSelected =
              activeNode?.messageId === root.messageId ||
              currentThread.some((c) => c.messageId === root.messageId && c.messageId === selectedMessageId);

            return (
              <button
                key={root.messageId}
                type="button"
                onClick={() => onSelectNode(root.messageId)}
                className={`w-full text-left p-3 rounded-xl border transition-all ${
                  isSelected
                    ? 'bg-cyan-500/10 border-cyan-500/40 text-cyan-100 shadow-[0_0_12px_rgba(6,182,212,0.15)]'
                    : 'bg-slate-900/60 border-slate-800 hover:border-slate-700 text-slate-300'
                }`}
              >
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <span className="text-[9px] font-mono uppercase px-1.5 py-0.5 rounded bg-slate-800 text-cyan-300 border border-slate-700">
                    {root.status}
                  </span>
                  <div className="flex items-center gap-1 text-[10px] font-mono text-slate-500">
                    <MessageSquare className="w-3 h-3 text-cyan-400" />
                    <span>{childrenCount + 1} caps</span>
                  </div>
                </div>

                <h4 className="font-semibold text-xs text-white line-clamp-2 leading-snug">
                  {root.subject}
                </h4>

                <div className="mt-2 flex flex-wrap gap-1">
                  {root.tags.map((t) => (
                    <span key={t} className="text-[9px] font-mono text-slate-400">
                      {t}
                    </span>
                  ))}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Conversation Stream */}
      <div className="flex-1 flex flex-col h-full bg-[#020617] overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-slate-800 bg-[#0f172a]/40 backdrop-blur-md flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-slate-500">Thread:</span>
              <span className="text-xs font-semibold text-cyan-400">
                {activeNode?.subject || 'Select a thread'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono text-slate-400 bg-slate-800 px-2.5 py-1 rounded-md border border-slate-700">
              RFC 5322 In-Reply-To DAG
            </span>
          </div>
        </div>

        {/* Timeline Message Chain */}
        <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6 max-w-4xl mx-auto w-full">
          {currentThread.map((capsule, index) => {
            const isAI =
              capsule.from.toLowerCase().includes('agent') ||
              capsule.from.toLowerCase().includes('co-thinker') ||
              capsule.from.toLowerCase().includes('ai');
            const isChild = !!capsule.inReplyTo;
            const isSelectedCard = capsule.messageId === selectedMessageId;

            return (
              <div key={capsule.messageId} className="relative group">
                {/* Connector Branch Line */}
                {index > 0 && (
                  <div className="absolute -top-6 left-6 w-0.5 h-6 bg-gradient-to-b from-cyan-500/60 to-blue-600/60" />
                )}

                <div
                  className={`rounded-2xl border p-5 shadow-xl transition-all ${
                    isSelectedCard
                      ? 'border-cyan-400/70 ring-1 ring-cyan-400/50 shadow-[0_0_18px_rgba(6,182,212,0.25)]'
                      : ''
                  } ${
                    isAI
                      ? 'bg-gradient-to-br from-slate-900/90 via-cyan-950/20 to-slate-900/90 border-cyan-500/30 shadow-[0_0_15px_rgba(6,182,212,0.1)]'
                      : 'bg-[#0f172a]/40 border-slate-800'
                  }`}
                >
                  {/* Message Top Meta */}
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-3 pb-2.5 border-b border-slate-800/80">
                    <div className="flex items-center gap-2.5">
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shadow ${
                          isAI
                            ? 'bg-cyan-500 text-slate-950 shadow-[0_0_10px_rgba(6,182,212,0.4)]'
                            : 'bg-slate-700 text-white'
                        }`}
                      >
                        {isAI ? <Bot className="w-4 h-4" /> : <User className="w-4 h-4" />}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-xs text-white">
                            {capsule.from}
                          </span>
                          {isChild && (
                            <span className="flex items-center gap-0.5 text-[9px] font-mono text-cyan-300 bg-cyan-950/60 px-1.5 py-0.5 rounded border border-cyan-800/60">
                              <CornerDownRight className="w-3 h-3 text-cyan-400" /> In-Reply-To
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] font-mono text-slate-500">
                          {new Date(capsule.timestamp).toLocaleString()}
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => onOpenInCanvas(capsule.messageId)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-300 text-xs font-medium border border-slate-700 transition-colors"
                    >
                      <span>Open Canvas</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>

                  {/* Subject */}
                  <h3 className="text-sm font-bold text-white mb-2">
                    {capsule.subject}
                  </h3>

                  {/* Block snippets */}
                  <div className="space-y-2 text-xs text-slate-300">
                    {capsule.blocks.map((b) => {
                      if (b.type === 'heading') {
                        return <div key={b.id} className="font-bold text-slate-200">{b.data.text}</div>;
                      }
                      if (b.type === 'paragraph') {
                        return <p key={b.id} className="text-slate-300 leading-relaxed">{b.data.text}</p>;
                      }
                      if (b.type === 'ai_opponent_block') {
                        return (
                          <div
                            key={b.id}
                            className="p-3 rounded-lg bg-cyan-950/30 border border-cyan-500/30 text-cyan-200 italic flex items-start gap-2 text-xs"
                          >
                            <ShieldAlert className="w-4 h-4 shrink-0 text-cyan-400 mt-0.5" />
                            <span>"{b.data.criticism}"</span>
                          </div>
                        );
                      }
                      if (b.type === 'data_grid_view') {
                        return (
                          <div
                            key={b.id}
                            className="p-2 rounded bg-slate-950 border border-slate-800 text-cyan-400 flex items-center gap-2 font-mono text-[11px]"
                          >
                            <FileSpreadsheet className="w-3.5 h-3.5" />
                            <span>DataGrid Attachment ({b.data.source_cid})</span>
                          </div>
                        );
                      }
                      if (b.type === 'interactive_canvas') {
                        return (
                          <div
                            key={b.id}
                            className="p-2 rounded bg-slate-950 border border-slate-800 text-purple-400 flex items-center gap-2 font-mono text-[11px]"
                          >
                            <Palette className="w-3.5 h-3.5" />
                            <span>Whiteboard Scene ({b.data.scene_cid})</span>
                          </div>
                        );
                      }
                      if (b.type === 'callout') {
                        const d = b.data;
                        return (
                          <div
                            key={b.id}
                            className="p-2.5 rounded-lg bg-emerald-950/30 border border-emerald-500/30 text-xs"
                          >
                            <span className="text-emerald-300 font-semibold">💡 {d.title}</span>
                            <p className="text-slate-300 mt-0.5 leading-relaxed">{d.content}</p>
                          </div>
                        );
                      }
                      if (b.type === 'todo_list') {
                        const items = b.data.items || [];
                        const done = items.filter((i) => i.done).length;
                        return (
                          <div
                            key={b.id}
                            className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800 text-xs"
                          >
                            <span className="text-slate-300 font-semibold">
                              ☑️ {b.data.title || 'Checklist'} — {done}/{items.length}
                            </span>
                            <div className="mt-1 space-y-0.5">
                              {items.slice(0, 3).map((i) => (
                                <div key={i.id} className={i.done ? 'text-slate-500 line-through' : 'text-slate-300'}>
                                  • {i.text}
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      }
                      if (b.type === 'audio_note') {
                        return (
                          <div
                            key={b.id}
                            className="p-2 rounded bg-cyan-950/30 border border-cyan-500/30 text-cyan-300 flex items-center gap-2 font-mono text-[11px]"
                          >
                            <Mic className="w-3.5 h-3.5 shrink-0" />
                            <span className="truncate">Voice note {b.data.duration} — {b.data.transcript}</span>
                          </div>
                        );
                      }
                      if (b.type === 'code_repl') {
                        return (
                          <div
                            key={b.id}
                            className="p-2 rounded bg-slate-950 border border-slate-800 text-emerald-400 flex items-center gap-2 font-mono text-[11px]"
                          >
                            <FileCode2 className="w-3.5 h-3.5 shrink-0" />
                            <span className="truncate">{b.data.language}: {b.data.code.split('\n')[0]}</span>
                          </div>
                        );
                      }
                      return null;
                    })}
                  </div>

                  {/* Message Footer */}
                  <div className="mt-3 pt-2 border-t border-slate-800/60 flex items-center justify-between text-[10px] font-mono text-slate-500">
                    <span className="truncate max-w-[200px] sm:max-w-md">ID: {capsule.messageId}</span>
                    <span className="text-slate-400">{capsule.tags.join(', ')}</span>
                  </div>
                </div>
              </div>
            );
          })}

          {/* Quick Reply Composer */}
          {activeNode && (
            <div className="mt-8 pt-4 border-t border-slate-800/80">
              <div className="rounded-2xl border border-cyan-500/30 bg-[#0f172a]/50 p-4 shadow-xl backdrop-blur-md">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2 text-xs font-semibold text-cyan-400">
                    <Sparkles className="w-4 h-4" />
                    <span>Spawn Child Capsule (Re: {activeNode.subject})</span>
                  </div>
                  <span className="text-[10px] font-mono text-slate-500">
                    In-Reply-To: {activeNode.messageId}
                  </span>
                </div>

                <input
                  type="text"
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && replyText.trim()) {
                      handleSendReply(activeNode.messageId);
                    }
                  }}
                  placeholder="Subject of the daughter thought or counter-argument (press Enter)..."
                  className="w-full bg-slate-950/80 border border-slate-700/80 rounded-xl px-4 py-2.5 text-xs text-slate-100 placeholder:text-slate-500 outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/30"
                />

                <div className="mt-3 flex items-center justify-between">
                  <span className="text-[10px] text-slate-500 font-mono">
                    Generates valid RFC 5322 MIME with linked In-Reply-To header
                  </span>
                  <button
                    type="button"
                    onClick={() => handleSendReply(activeNode.messageId)}
                    className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-xs transition-all shadow-[0_0_12px_rgba(6,182,212,0.3)] active:scale-95"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Spawn Thread</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
