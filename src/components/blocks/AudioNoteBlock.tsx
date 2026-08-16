import React, { useState, useEffect } from 'react';
import { CapsuleBlock, AudioNoteBlockData } from '../../types';
import { Play, Pause, Mic, Volume2, Trash2, User } from 'lucide-react';

interface Props {
  block: CapsuleBlock & { type: 'audio_note' };
  onChange: (updatedData: AudioNoteBlockData) => void;
  onDelete: () => void;
}

export const AudioNoteBlock: React.FC<Props> = ({ block, onChange, onDelete }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [progressIndex, setProgressIndex] = useState(0);

  const waveform = block.data.waveform || [20, 45, 70, 90, 60, 30, 80, 100, 75, 50, 65, 85, 40, 25];

  useEffect(() => {
    let interval: any;
    if (isPlaying) {
      interval = setInterval(() => {
        setProgressIndex((prev) => {
          if (prev >= waveform.length - 1) {
            setIsPlaying(false);
            return 0;
          }
          return prev + 1;
        });
      }, 200);
    }
    return () => clearInterval(interval);
  }, [isPlaying, waveform.length]);

  const togglePlay = () => {
    setIsPlaying(!isPlaying);
  };

  return (
    <div className="my-4 rounded-xl border border-cyan-500/30 bg-gradient-to-r from-[#0f172a] via-cyan-950/20 to-[#0f172a] p-4 shadow-lg shadow-cyan-950/20 group">
      {/* Top Header */}
      <div className="flex items-center justify-between gap-3 mb-3 pb-2 border-b border-cyan-500/20">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
            <Mic className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-cyan-400">
                Voice Thought Note
              </span>
              <span className="text-[10px] font-mono text-slate-300 bg-slate-800 px-1.5 py-0.5 rounded border border-slate-700">
                {block.data.author || 'User Voice'}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-cyan-300/80 bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-800/40">
            {block.data.duration || '0:35'}
          </span>
          <button
            type="button"
            onClick={onDelete}
            className="text-xs text-slate-500 hover:text-rose-400 p-1 rounded hover:bg-slate-800 transition-colors"
            title="Delete Audio Note"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Waveform Player */}
      <div className="flex items-center gap-4 bg-slate-950/60 p-3 rounded-lg border border-slate-800/80">
        <button
          type="button"
          onClick={togglePlay}
          className="w-9 h-9 rounded-full bg-cyan-500 hover:bg-cyan-400 text-slate-950 flex items-center justify-center shadow-lg transition-transform active:scale-95 shrink-0"
        >
          {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
        </button>

        {/* Waveform Bars */}
        <div className="flex-1 flex items-center gap-1.5 h-10 px-2">
          {waveform.map((val, idx) => {
            const isPassed = idx <= progressIndex && isPlaying;
            return (
              <div
                key={idx}
                style={{ height: `${Math.max(15, val)}%` }}
                className={`flex-1 rounded-full transition-all duration-150 ${isPassed ? 'bg-cyan-400' : 'bg-slate-700 hover:bg-slate-600'}`}
              />
            );
          })}
        </div>
      </div>

      {/* Audio Transcript */}
      <div className="mt-3">
        <div className="text-[10px] font-mono text-slate-500 uppercase mb-1">Transcript:</div>
        <textarea
          rows={2}
          value={block.data.transcript}
          onChange={(e) => onChange({ ...block.data, transcript: e.target.value })}
          placeholder="Audio note transcription..."
          className="w-full bg-transparent text-slate-300 text-xs leading-relaxed resize-none border-none outline-none focus:ring-0 placeholder:text-slate-600"
        />
      </div>
    </div>
  );
};
