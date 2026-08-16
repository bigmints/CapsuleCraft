import React from 'react';
import { CapsuleBlock, HeadingBlockData } from '../../types';
import { Hash } from 'lucide-react';

interface Props {
  block: CapsuleBlock & { type: 'heading' };
  onChange: (updatedData: HeadingBlockData) => void;
  onDelete: () => void;
}

export const HeadingBlock: React.FC<Props> = ({ block, onChange, onDelete }) => {
  const { level, text } = block.data;

  const fontClasses = {
    1: 'text-2xl font-bold text-slate-100 tracking-tight',
    2: 'text-xl font-semibold text-slate-200 tracking-tight',
    3: 'text-lg font-medium text-slate-300',
  }[level || 1];

  return (
    <div className="group relative my-2 flex items-baseline gap-2">
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          type="button"
          onClick={() => {
            const nextLevel = level === 3 ? 1 : ((level + 1) as 1 | 2 | 3);
            onChange({ ...block.data, level: nextLevel });
          }}
          className="p-1 text-xs font-mono text-slate-500 hover:text-cyan-400 bg-slate-800/80 rounded border border-slate-700 flex items-center gap-0.5"
          title="Toggle Heading Level (H1 -> H2 -> H3)"
        >
          <Hash className="w-3 h-3" />
          <span>{level}</span>
        </button>
      </div>

      <input
        type="text"
        value={text}
        onChange={(e) => onChange({ ...block.data, text: e.target.value })}
        placeholder={`Heading ${level}...`}
        className={`w-full bg-transparent border-none outline-none focus:ring-0 ${fontClasses} placeholder:text-slate-600`}
      />
    </div>
  );
};
