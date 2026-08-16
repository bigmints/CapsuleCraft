import React from 'react';
import { CapsuleBlock, CalloutBlockData } from '../../types';
import { Lightbulb, Info, AlertTriangle, Sparkles, Heart, Trash2 } from 'lucide-react';

interface Props {
  block: CapsuleBlock & { type: 'callout' };
  onChange: (updatedData: CalloutBlockData) => void;
  onDelete: () => void;
}

export const CalloutBlock: React.FC<Props> = ({ block, onChange, onDelete }) => {
  const tone = block.data.tone || 'emerald';

  const toneConfig = {
    emerald: {
      border: 'border-cyan-500/40',
      bg: 'bg-cyan-950/20',
      text: 'text-cyan-300',
      icon: Lightbulb,
    },
    blue: {
      border: 'border-sky-500/40',
      bg: 'bg-sky-950/20',
      text: 'text-sky-300',
      icon: Info,
    },
    purple: {
      border: 'border-purple-500/40',
      bg: 'bg-purple-950/20',
      text: 'text-purple-300',
      icon: Sparkles,
    },
    amber: {
      border: 'border-amber-500/40',
      bg: 'bg-amber-950/20',
      text: 'text-amber-300',
      icon: AlertTriangle,
    },
    rose: {
      border: 'border-rose-500/40',
      bg: 'bg-rose-950/20',
      text: 'text-rose-300',
      icon: Heart,
    },
  }[tone];

  const IconComponent = toneConfig.icon;

  return (
    <div
      className={`my-3 rounded-xl border ${toneConfig.border} ${toneConfig.bg} p-4 shadow-md backdrop-blur-sm group relative`}
    >
      <div className="flex items-start gap-3">
        <div className={`p-1 rounded-lg ${toneConfig.text} shrink-0 mt-0.5`}>
          <IconComponent className="w-5 h-5" />
        </div>

        <div className="flex-1 space-y-1">
          <input
            type="text"
            value={block.data.title}
            onChange={(e) => onChange({ ...block.data, title: e.target.value })}
            placeholder="Callout title..."
            className={`w-full bg-transparent font-semibold text-sm outline-none border-none focus:ring-0 ${toneConfig.text}`}
          />

          <textarea
            rows={2}
            value={block.data.content}
            onChange={(e) => onChange({ ...block.data, content: e.target.value })}
            placeholder="Callout message or invariant..."
            className="w-full bg-transparent text-slate-300 text-xs leading-relaxed resize-none outline-none border-none focus:ring-0 placeholder:text-slate-500"
          />
        </div>

        <button
          type="button"
          onClick={onDelete}
          className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-rose-400 p-1 rounded transition-opacity"
          title="Delete Callout"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
