import React, { useEffect, useRef, useState } from 'react';
import { CapsuleAttachment, CapsuleBlock, AudioNoteBlockData } from '../../types';
import { Play, Pause, Mic, Paperclip, Trash2 } from 'lucide-react';

interface Props {
  block: CapsuleBlock & { type: 'audio_note' };
  attachments?: CapsuleAttachment[];
  onUpdateAttachment?: (cid: string, content: string, mimeType?: string, name?: string) => void;
  /** Atomic: stores the audio attachment AND links it to this block in one update. */
  onAttachAudio?: (cid: string, content: string, mimeType: string, name: string) => void;
  onChange: (updatedData: AudioNoteBlockData) => void;
  onDelete: () => void;
}

function formatTime(sec: number): string {
  if (!isFinite(sec) || sec < 0) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

async function fileToBase64(file: File): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

export const AudioNoteBlock: React.FC<Props> = ({
  block,
  attachments,
  onUpdateAttachment,
  onAttachAudio,
  onChange,
  onDelete,
}) => {
  const waveform =
    block.data.waveform && block.data.waveform.length > 0
      ? block.data.waveform
      : [20, 45, 70, 90, 60, 30, 80, 100, 75, 50, 65, 85, 40, 25];

  const audioRef = useRef<HTMLAudioElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progressIndex, setProgressIndex] = useState(0);

  // Real audio attached? (stored as a base64 MIME attachment — pure .eml)
  const audioAtt = attachments?.find((a) => a.cid === block.data.audioCid);
  const hasRealAudio = Boolean(audioAtt && audioAtt.content);
  const audioSrc = hasRealAudio
    ? `data:${block.data.audioMime || audioAtt!.mimeType || 'audio/mpeg'};base64,${audioAtt!.content}`
    : null;

  // ── Simulated playback for voice notes without attached audio ─────────
  useEffect(() => {
    if (!isPlaying || hasRealAudio) return;
    const interval = setInterval(() => {
      setProgressIndex((prev) => {
        if (prev >= waveform.length - 1) {
          setIsPlaying(false);
          return 0;
        }
        return prev + 1;
      });
    }, 200);
    return () => clearInterval(interval);
  }, [isPlaying, hasRealAudio, waveform.length]);

  const togglePlay = () => {
    if (hasRealAudio && audioRef.current) {
      if (audioRef.current.paused) {
        audioRef.current.play();
        setIsPlaying(true);
      } else {
        audioRef.current.pause();
        setIsPlaying(false);
      }
      return;
    }
    setIsPlaying(!isPlaying);
  };

  // ── Real audio progress → waveform highlight ───────────────────────────
  const handleTimeUpdate = () => {
    const el = audioRef.current;
    if (!el || !el.duration) return;
    setProgressIndex(Math.floor((el.currentTime / el.duration) * waveform.length));
  };

  // Seek by clicking a waveform bar
  const handleSeek = (idx: number) => {
    if (hasRealAudio && audioRef.current && audioRef.current.duration) {
      audioRef.current.currentTime = (idx / waveform.length) * audioRef.current.duration;
      setProgressIndex(idx);
    } else {
      setProgressIndex(idx);
    }
  };

  // ── Attach a real audio file (goes into the .eml as a base64 part) ────
  const handleAttachFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !onAttachAudio) return;
    try {
      const cid = `audio_${Date.now().toString(36)}`;
      const b64 = await fileToBase64(file);
      onAttachAudio(cid, b64, file.type || 'audio/mpeg', file.name);
    } finally {
      e.target.value = '';
    }
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
              <span
                className={`text-[9px] font-mono px-1.5 py-0.5 rounded border ${
                  hasRealAudio
                    ? 'text-emerald-300 bg-emerald-950/50 border-emerald-700/50'
                    : 'text-amber-300 bg-amber-950/40 border-amber-700/40'
                }`}
                title={hasRealAudio ? 'Реальное аудио прикреплено как MIME-вложение' : 'Аудио не прикреплено — воспроизведение имитируется'}
              >
                {hasRealAudio ? 'REAL AUDIO' : 'SIMULATED'}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-cyan-300/80 bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-800/40">
            {hasRealAudio && audioRef.current?.duration
              ? `${formatTime(audioRef.current.currentTime)} / ${formatTime(audioRef.current.duration)}`
              : block.data.duration || '0:35'}
          </span>
          {onAttachAudio && (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="text-[10px] font-mono text-slate-400 hover:text-cyan-300 p-1 rounded hover:bg-slate-800 transition-colors border border-slate-700/60"
              title="Прикрепить реальный аудиофайл (mp3/webm/ogg) — сохраняется в .eml как MIME-вложение"
            >
              <Paperclip className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            type="button"
            onClick={onDelete}
            className="text-xs text-slate-500 hover:text-rose-400 p-1 rounded hover:bg-slate-800 transition-colors"
            title="Delete Audio Note"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="audio/*"
            className="hidden"
            onChange={handleAttachFile}
          />
        </div>
      </div>

      {/* Waveform Player */}
      <div className="flex items-center gap-4 bg-slate-950/60 p-3 rounded-lg border border-slate-800/80">
        <button
          type="button"
          onClick={togglePlay}
          className="w-9 h-9 rounded-full bg-cyan-500 hover:bg-cyan-400 text-slate-950 flex items-center justify-center shadow-lg transition-transform active:scale-95 shrink-0"
          title={hasRealAudio ? 'Play / Pause (real audio)' : 'Simulated playback'}
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
                onClick={() => handleSeek(idx)}
                className={`flex-1 rounded-full transition-all duration-150 ${
                  isPassed ? 'bg-cyan-400' : 'bg-slate-700 hover:bg-slate-600'
                } ${hasRealAudio ? 'cursor-pointer' : ''}`}
              />
            );
          })}
        </div>
      </div>

      {/* Real audio element (hidden, drives the waveform) */}
      {hasRealAudio && (
        <audio
          ref={audioRef}
          src={audioSrc || undefined}
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleTimeUpdate}
          onEnded={() => {
            setIsPlaying(false);
            setProgressIndex(0);
          }}
          className="hidden"
        />
      )}

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
