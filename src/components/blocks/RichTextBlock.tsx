import React, { useRef, useEffect } from 'react';
import { CapsuleBlock, ParagraphBlockData } from '../../types';

interface Props {
  block: CapsuleBlock & { type: 'paragraph' };
  onChange: (updatedData: ParagraphBlockData) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  onDelete: () => void;
}

export const RichTextBlock: React.FC<Props> = ({ block, onChange, onKeyDown }) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const adjustHeight = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.max(28, textareaRef.current.scrollHeight)}px`;
    }
  };

  useEffect(() => {
    adjustHeight();
  }, [block.data.text]);

  return (
    <div className="relative my-1.5 group">
      <textarea
        ref={textareaRef}
        rows={1}
        value={block.data.text}
        onChange={(e) => {
          onChange({ text: e.target.value });
          adjustHeight();
        }}
        onKeyDown={onKeyDown}
        placeholder="Type a thought or enter '/' for interactive blocks..."
        className="w-full resize-none overflow-hidden bg-transparent text-slate-300 text-[15px] leading-relaxed border-none outline-none focus:ring-0 placeholder:text-slate-600 focus:text-slate-100 selection:bg-cyan-500/30 font-normal"
      />
    </div>
  );
};
