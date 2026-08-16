import React from 'react';
import { CapsuleBlock, AiOpponentBlockData } from '../../types';
import { Sparkles, Bot, Check, ShieldAlert, ArrowRight } from 'lucide-react';

interface Props {
  block: CapsuleBlock & { type: 'ai_opponent_block' };
  onChange: (updatedData: AiOpponentBlockData) => void;
  onDelete: () => void;
  onAcceptAsSynthesis?: () => void;
}

export const AiOpponentBlock: React.FC<Props> = ({
  block,
  onChange,
  onDelete,
  onAcceptAsSynthesis,
}) => {
  const author = block.author || 'Claude 3.5 Sonnet';
  const isClaude = author.toLowerCase().includes('claude');
  const isGemini = author.toLowerCase().includes('gemini');

  return (
    <div className="relative my-4 rounded-xl border border-cyan-500/30 bg-gradient-to-br from-[#0f172a]/90 via-cyan-950/10 to-[#0f172a]/90 p-4 shadow-lg shadow-cyan-950/20 backdrop-blur-sm group">
      {/* Header Badge */}
      <div className="flex items-center justify-between gap-3 mb-2.5 pb-2 border-b border-cyan-500/15">
        <div className="flex items-center gap-2">
          <div
            className={`p-1.5 rounded-lg flex items-center justify-center ${
              isClaude
                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                : isGemini
                ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                : 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
            }`}
          >
            <Bot className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-semibold uppercase tracking-wider text-cyan-400">
                ⚡ AI Co-Thinker Critique
              </span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                {author}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 opacity-80 group-hover:opacity-100 transition-opacity">
          <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-mono text-cyan-400/80 bg-cyan-950/50 px-2 py-0.5 rounded border border-cyan-800/40">
            <Sparkles className="w-3 h-3 text-cyan-400" /> Co-Thinking Active
          </span>
          <button
            type="button"
            onClick={onDelete}
            className="text-xs text-slate-500 hover:text-rose-400 px-1.5 py-0.5 rounded hover:bg-rose-950/30 transition-colors"
            title="Dismiss Critique"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Main Criticism Body */}
      <div className="flex items-start gap-3">
        <ShieldAlert className="w-5 h-5 text-cyan-400/70 shrink-0 mt-0.5" />
        <div className="flex-1">
          <textarea
            rows={2}
            value={block.data.criticism}
            onChange={(e) => onChange({ ...block.data, criticism: e.target.value })}
            placeholder="AI counter-argument or critical risk analysis..."
            className="w-full resize-none bg-transparent text-slate-200 text-sm leading-relaxed border-none outline-none focus:ring-0 placeholder:text-slate-500 italic"
          />

          {block.data.sourceClaim && (
            <div className="mt-2 text-xs text-slate-400 flex items-center gap-1.5 bg-slate-950/60 px-2.5 py-1.5 rounded-md border border-slate-800 w-fit font-mono text-[11px]">
              <span className="text-slate-500">Target Claim:</span>
              <span className="text-slate-300 font-medium">{block.data.sourceClaim}</span>
            </div>
          )}
        </div>
      </div>

      {/* Footer Actions */}
      <div className="mt-3 pt-2.5 border-t border-slate-800/60 flex items-center justify-between text-xs text-slate-400">
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-slate-500 font-mono">
            Confidence: <span className="text-cyan-400 font-semibold">{Math.round((block.data.confidence || 0.92) * 100)}%</span>
          </span>
        </div>

        {onAcceptAsSynthesis && (
          <button
            type="button"
            onClick={onAcceptAsSynthesis}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-cyan-500/10 text-cyan-300 hover:bg-cyan-500/20 border border-cyan-500/30 text-xs font-medium transition-all shadow-[0_0_8px_rgba(6,182,212,0.15)]"
          >
            <Check className="w-3.5 h-3.5" />
            <span>Accept into Synthesis (Tab)</span>
            <ArrowRight className="w-3 h-3 text-cyan-400" />
          </button>
        )}
      </div>
    </div>
  );
};
