import React, { useEffect, useRef, useState } from 'react';
import { CapsuleAttachment, CapsuleBlock, AudioNoteBlockData } from '../../types';
import { Play, Pause, Mic, Paperclip, Trash2, Square, X } from 'lucide-react';
import { useI18n } from '../../i18n';

interface Props {
  block: CapsuleBlock & { type: 'audio_note' };
  attachments?: CapsuleAttachment[];
  onUpdateAttachment?: (cid: string, content: string, mimeType?: string, name?: string) => void;
  /** Atomic: stores the audio attachment AND links it to this block in one update. */
  onAttachAudio?: (
    cid: string,
    content: string,
    mimeType: string,
    name: string,
    extraData?: Partial<AudioNoteBlockData>
  ) => void;
  onChange: (updatedData: AudioNoteBlockData) => void;
  onDelete: () => void;
}

/** Blocks whose microphone capture was already auto-started in this session. */
const autoStartedBlocks = new Set<string>();

function formatTime(sec: number): string {
  if (!isFinite(sec) || sec < 0) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

async function blobToBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

async function fileToBase64(file: File): Promise<string> {
  return blobToBase64(file);
}

/** Downsample a raw level array to at most n bars, keeping the envelope shape. */
function downsample(arr: number[], n: number): number[] {
  if (arr.length <= n) return arr;
  const out: number[] = [];
  const step = arr.length / n;
  for (let i = 0; i < n; i++) out.push(arr[Math.floor(i * step)]);
  return out;
}

export const AudioNoteBlock: React.FC<Props> = ({
  block,
  attachments,
  onUpdateAttachment,
  onAttachAudio,
  onChange,
  onDelete,
}) => {
  const { t } = useI18n();

  const waveform = block.data.waveform && block.data.waveform.length > 0 ? block.data.waveform : [];

  const audioRef = useRef<HTMLAudioElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progressIndex, setProgressIndex] = useState(0);
  const [progressPct, setProgressPct] = useState(0);

  // ── In-app microphone recording (MediaRecorder → base64 MIME attachment) ─
  const [recState, setRecState] = useState<'idle' | 'requesting' | 'recording'>('idle');
  const [recSeconds, setRecSeconds] = useState(0);
  const [recLevels, setRecLevels] = useState<number[]>([]);
  const [micError, setMicError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const rafRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const cancelledRef = useRef(false);
  const secondsRef = useRef(0);
  const recLevelsRef = useRef<number[]>([]);
  const frameCounterRef = useRef(0);

  // Real audio attached? (stored as a base64 MIME attachment — pure .eml)
  const audioAtt = attachments?.find((a) => a.cid === block.data.audioCid);
  const hasRealAudio = Boolean(audioAtt && audioAtt.content);
  const audioSrc = hasRealAudio
    ? `data:${block.data.audioMime || audioAtt!.mimeType || 'audio/mpeg'};base64,${audioAtt!.content}`
    : null;

  const togglePlay = () => {
    const el = audioRef.current;
    if (!hasRealAudio || !el) return;
    if (el.paused) {
      void el.play();
      setIsPlaying(true);
    } else {
      el.pause();
      setIsPlaying(false);
    }
  };

  // ── Real audio progress → waveform highlight ───────────────────────────
  const handleTimeUpdate = () => {
    const el = audioRef.current;
    if (!el || !el.duration) return;
    setProgressPct((el.currentTime / el.duration) * 100);
    if (waveform.length > 0) {
      setProgressIndex(Math.floor((el.currentTime / el.duration) * waveform.length));
    }
  };

  // Seek by clicking a waveform bar (real audio only — no fake playback)
  const handleSeek = (idx: number) => {
    const el = audioRef.current;
    if (!hasRealAudio || !el || !el.duration) return;
    el.currentTime = (idx / waveform.length) * el.duration;
    setProgressIndex(idx);
  };

  // ── Attach a real audio file (goes into the .eml as a base64 part) ────
  const handleAttachFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !onAttachAudio) return;
    setMicError(null);
    try {
      const cid = `audio_${Date.now().toString(36)}`;
      const b64 = await fileToBase64(file);
      onAttachAudio(cid, b64, file.type || 'audio/mpeg', file.name);
    } finally {
      e.target.value = '';
    }
  };

  // ── Microphone recording helpers ─────────────────────────────────────
  const cleanupRecording = () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = 0;
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    audioCtxRef.current?.close().catch(() => undefined);
    audioCtxRef.current = null;
    mediaRecorderRef.current = null;
  };

  // Stop mic + analyser when the block unmounts mid-recording
  useEffect(() => cleanupRecording, []);

  const pickRecorderMime = (): string => {
    if (typeof MediaRecorder === 'undefined') return '';
    const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'];
    return candidates.find((c) => MediaRecorder.isTypeSupported(c)) || '';
  };

  const extensionFor = (mime: string): string =>
    mime.includes('mp4') ? 'm4a' : mime.includes('ogg') ? 'ogg' : 'webm';

  const handleRecordingStopped = async () => {
    const mimeType = mediaRecorderRef.current?.mimeType || 'audio/webm';
    const blob = new Blob(chunksRef.current, { type: mimeType });
    const secs = Math.max(1, secondsRef.current);
    const levels = recLevelsRef.current;
    cleanupRecording();
    setRecState('idle');

    if (cancelledRef.current || blob.size === 0 || !onAttachAudio) return;

    try {
      const cid = `audio_${Date.now().toString(36)}`;
      const b64 = await blobToBase64(blob);
      const name = `voice-note-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}.${extensionFor(mimeType)}`;
      // Atomic: attachment + audioCid link + recorded duration/waveform in ONE
      // update. A separate onChange() here would run from a stale block snapshot
      // and silently drop the audioCid link (last-writer-wins).
      const extra: Partial<AudioNoteBlockData> = { duration: formatTime(secs) };
      if (levels.length >= 8) extra.waveform = downsample(levels, 96);
      onAttachAudio(cid, b64, mimeType.split(';')[0], name, extra);
    } catch {
      setMicError(t('audio.encodeFailed'));
    }
  };

  const startRecording = async () => {
    setMicError(null);
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setMicError(t('audio.micUnsupported'));
      return;
    }
    setRecState('requesting');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      cancelledRef.current = false;
      chunksRef.current = [];
      secondsRef.current = 0;
      recLevelsRef.current = [];
      frameCounterRef.current = 0;
      setRecSeconds(0);
      setRecLevels([]);

      // Live level meter — decorative during recording, saved as the waveform after
      try {
        const Ctx =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        const ctx = new Ctx();
        audioCtxRef.current = ctx;
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 512;
        ctx.createMediaStreamSource(stream).connect(analyser);
        const buf = new Uint8Array(analyser.fftSize);
        const tick = () => {
          if (!audioCtxRef.current) return;
          analyser.getByteTimeDomainData(buf);
          let sum = 0;
          for (let i = 0; i < buf.length; i++) {
            const v = (buf[i] - 128) / 128;
            sum += v * v;
          }
          const rms = Math.sqrt(sum / buf.length);
          const level = Math.min(100, Math.max(8, Math.round(rms * 320)));
          // sample ~4 bars per second to keep long notes light
          frameCounterRef.current += 1;
          if (frameCounterRef.current % 15 === 0) {
            const next = [...recLevelsRef.current.slice(-239), level];
            recLevelsRef.current = next;
            setRecLevels(next);
          }
          rafRef.current = requestAnimationFrame(tick);
        };
        rafRef.current = requestAnimationFrame(tick);
      } catch {
        /* analyser is decorative — recording still works without it */
      }

      const mime = pickRecorderMime();
      const rec = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
      mediaRecorderRef.current = rec;
      rec.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };
      rec.onstop = () => {
        void handleRecordingStopped();
      };
      rec.start(250);

      timerRef.current = setInterval(() => {
        secondsRef.current += 1;
        setRecSeconds(secondsRef.current);
      }, 1000);
      setRecState('recording');
    } catch (err) {
      setRecState('idle');
      cleanupRecording();
      setMicError(
        err instanceof DOMException && err.name === 'NotAllowedError'
          ? t('audio.micDenied')
          : t('audio.micUnavailable')
      );
    }
  };

  const stopRecording = (cancel = false) => {
    cancelledRef.current = cancel;
    const rec = mediaRecorderRef.current;
    if (rec && rec.state === 'recording') rec.stop();
    else {
      cleanupRecording();
      setRecState('idle');
    }
  };

  // Recording starts by itself when an empty audio-note block is created —
  // no fake waveform, no simulated playback. If the mic is unavailable the
  // block shows an explicit "attach audio file" action instead.
  useEffect(() => {
    if (!onAttachAudio || hasRealAudio || block.data.audioCid) return;
    if (block.data.transcript.trim()) return;
    if (autoStartedBlocks.has(block.id)) return;
    // Defer one tick so React StrictMode's mount/unmount cycle doesn't cancel
    // the capture before it starts.
    const timer = window.setTimeout(() => {
      if (autoStartedBlocks.has(block.id)) return;
      autoStartedBlocks.add(block.id);
      void startRecording();
    }, 0);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const recordingLabel =
    recState === 'requesting' ? t('audio.requesting') : recState === 'recording' ? t('audio.recording') : '';

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
                    : 'text-slate-400 bg-slate-800/60 border-slate-700/60'
                }`}
              >
                {hasRealAudio ? t('audio.badge.attached') : t('audio.badge.none')}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-cyan-300/80 bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-800/40">
            {recState === 'recording'
              ? formatTime(recSeconds)
              : hasRealAudio && audioRef.current?.duration
                ? `${formatTime(audioRef.current.currentTime)} / ${formatTime(audioRef.current.duration)}`
                : '—'}
          </span>
          {onAttachAudio && recState === 'idle' && !hasRealAudio && (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="text-[10px] font-mono text-cyan-300 hover:text-cyan-200 p-1 rounded hover:bg-cyan-950/40 transition-colors border border-cyan-800/40"
              title={t('audio.attachFile')}
            >
              <Paperclip className="w-3.5 h-3.5" />
            </button>
          )}
          {onAttachAudio && recState === 'idle' && hasRealAudio && (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="text-[10px] font-mono text-slate-400 hover:text-cyan-300 p-1 rounded hover:bg-slate-800 transition-colors border border-slate-700/60"
              title={t('audio.attachFile')}
            >
              <Paperclip className="w-3.5 h-3.5" />
            </button>
          )}
          {onAttachAudio && recState === 'idle' && (
            <button
              type="button"
              onClick={startRecording}
              className="text-[10px] font-mono text-rose-400 hover:text-rose-300 p-1 rounded hover:bg-rose-950/40 transition-colors border border-rose-800/40"
              title={t('audio.recordFromMic')}
            >
              <Mic className="w-3.5 h-3.5" />
            </button>
          )}
          {recState !== 'idle' && (
            <span
              className="flex items-center gap-1.5 text-[10px] font-mono text-rose-300 bg-rose-950/50 border border-rose-700/50 px-2 py-0.5 rounded"
              title={recordingLabel}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
              {recState === 'requesting' ? 'MIC…' : 'REC'}
            </span>
          )}
          {recState === 'recording' && (
            <>
              <button
                type="button"
                onClick={() => stopRecording(false)}
                className="text-[10px] font-mono text-rose-300 hover:text-white p-1 rounded bg-rose-600/80 hover:bg-rose-500 transition-colors border border-rose-500/60"
                title={t('audio.stopAndSave')}
              >
                <Square className="w-3 h-3 fill-current" />
              </button>
              <button
                type="button"
                onClick={() => stopRecording(true)}
                className="text-[10px] font-mono text-slate-400 hover:text-rose-300 p-1 rounded hover:bg-slate-800 transition-colors border border-slate-700/60"
                title={t('audio.cancelRecording')}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </>
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

      {/* Player / live recording meter / empty-state actions */}
      <div className="flex items-center gap-4 bg-slate-950/60 p-3 rounded-lg border border-slate-800/80">
        {recState !== 'idle' ? (
          <>
            <button
              type="button"
              disabled
              className="w-9 h-9 rounded-full bg-slate-700 text-slate-950 flex items-center justify-center shrink-0"
              title={recordingLabel}
            >
              <Mic className="w-4 h-4" />
            </button>
            <div className="flex-1 flex items-center gap-1.5 h-10 px-2 overflow-hidden">
              {recLevels.length === 0 ? (
                <div className="w-full text-center text-[10px] font-mono text-slate-500">
                  {recordingLabel}
                </div>
              ) : (
                recLevels.map((val, idx) => (
                  <div
                    key={idx}
                    style={{ height: `${val}%` }}
                    className="flex-1 min-w-[2px] rounded-full bg-rose-400/90 transition-all duration-100"
                  />
                ))
              )}
            </div>
          </>
        ) : hasRealAudio ? (
          <>
            <button
              type="button"
              onClick={togglePlay}
              className="w-9 h-9 rounded-full bg-cyan-500 hover:bg-cyan-400 text-slate-950 flex items-center justify-center shadow-lg transition-transform active:scale-95 shrink-0"
              title={t('audio.play')}
            >
              {isPlaying ? (
                <Pause className="w-4 h-4 fill-current" />
              ) : (
                <Play className="w-4 h-4 fill-current ml-0.5" />
              )}
            </button>
            {waveform.length > 0 ? (
              <div className="flex-1 flex items-center gap-1.5 h-10 px-2">
                {waveform.map((val, idx) => {
                  const isPassed = idx <= progressIndex;
                  return (
                    <div
                      key={idx}
                      style={{ height: `${Math.max(15, val)}%` }}
                      onClick={() => handleSeek(idx)}
                      className={`flex-1 rounded-full cursor-pointer transition-all duration-150 ${
                        isPassed ? 'bg-cyan-400' : 'bg-slate-700 hover:bg-slate-600'
                      }`}
                    />
                  );
                })}
              </div>
            ) : (
              <div className="flex-1 h-1.5 rounded-full bg-slate-700 overflow-hidden">
                <div className="h-full bg-cyan-400" style={{ width: `${progressPct}%` }} />
              </div>
            )}
          </>
        ) : (
          <div className="flex-1 flex flex-col sm:flex-row sm:items-center gap-2">
            <p className="text-[11px] text-slate-400 flex-1">{t('audio.prompt')}</p>
            <div className="flex items-center gap-2">
              {onAttachAudio && (
                <button
                  type="button"
                  onClick={startRecording}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-rose-600/90 hover:bg-rose-500 text-white text-[11px] font-semibold transition-colors"
                >
                  <Mic className="w-3.5 h-3.5" />
                  {t('audio.record')}
                </button>
              )}
              {onAttachAudio && (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-[11px] font-semibold transition-colors"
                >
                  <Paperclip className="w-3.5 h-3.5" />
                  {t('audio.attach')}
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {micError && (
        <div className="mt-2 text-[10px] font-mono text-rose-400 bg-rose-950/30 border border-rose-900/40 rounded px-2 py-1">
          {micError}
        </div>
      )}

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
            setProgressPct(0);
          }}
          className="hidden"
        />
      )}

      {/* Audio Transcript */}
      <div className="mt-3">
        <div className="text-[10px] font-mono text-slate-500 uppercase mb-1">
          {t('audio.transcript')}:
        </div>
        <textarea
          rows={2}
          value={block.data.transcript}
          onChange={(e) => onChange({ ...block.data, transcript: e.target.value })}
          placeholder={t('audio.transcriptPlaceholder')}
          className="w-full bg-transparent text-slate-300 text-xs leading-relaxed resize-none border-none outline-none focus:ring-0 placeholder:text-slate-600"
        />
      </div>
    </div>
  );
};
