import React, { useEffect, useRef, useState } from 'react';
import { CapsuleNode } from '../types';
import { Sparkles, ShieldAlert, Zap, Layers, Send, Brain, CornerDownRight, Cpu } from 'lucide-react';
import { useI18n, type TranslationKey } from '../i18n';

type CoThinkMode = 'critique' | 'counter_arg' | 'synthesis' | 'data_insight';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  currentCapsule: CapsuleNode;
  onExecuteAi: (prompt: string, mode: string) => void;
  isLoading: boolean;
}

const MODE_KEY: Record<CoThinkMode, TranslationKey> = {
  critique: 'ai.mode.critique',
  counter_arg: 'ai.mode.counter',
  synthesis: 'ai.mode.synthesis',
  data_insight: 'ai.mode.data',
};

export const AiCoThinkModal: React.FC<Props> = ({
  isOpen,
  onClose,
  currentCapsule,
  onExecuteAi,
  isLoading,
}) => {
  const { t } = useI18n();
  const [mode, setMode] = useState<CoThinkMode>('critique');
  const [customPrompt, setCustomPrompt] = useState('');
  const promptRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    promptRef.current?.focus();
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const promptToSend =
      customPrompt.trim() ||
      t('ai.promptPrefix', { task: t(MODE_KEY[mode]), subject: currentCapsule.subject });
    onExecuteAi(promptToSend, mode);
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label="AI Co-Think"
    >
      <div className="w-full max-w-xl bg-slate-900 border border-emerald-500/40 rounded-2xl p-6 shadow-2xl shadow-emerald-950/40 space-y-5 text-slate-200">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-100 flex items-center gap-2">
                <span>Human-AI Co-Thinking & Adversarial Reasoning</span>
              </h3>
              <p className="text-xs text-slate-400">
                {t('ai.context')} <b className="text-slate-200">{currentCapsule.subject}</b>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-500 hover:text-slate-200 p-1"
            title={t('ai.close')}
            aria-label={t('ai.close')}
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {/* The engine is local heuristics today; model selection returns with real integration. */}
          <div className="flex items-center gap-1.5 text-[10px] font-mono text-slate-500 bg-slate-950/60 border border-slate-800 rounded-lg px-2.5 py-1.5">
            <Cpu className="w-3 h-3 text-emerald-400" />
            <span>{t('ai.localEngine')}</span>
          </div>

          {/* Mode Selector */}
          <div className="space-y-1.5">
            <label className="text-slate-400 font-semibold flex items-center gap-1.5">
              <Brain className="w-3.5 h-3.5 text-purple-400" />
              <span>{t('ai.mode.label')}</span>
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setMode('critique')}
                className={`p-2.5 rounded-xl border text-left flex items-start gap-2 ${mode === 'critique' ? 'bg-emerald-950/40 border-emerald-500 text-emerald-200' : 'bg-slate-950/60 border-slate-800 text-slate-400'}`}
              >
                <ShieldAlert className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold text-xs">{t('ai.critic')}</div>
                  <div className="text-[10px] text-slate-500">{t('ai.criticDesc')}</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setMode('synthesis')}
                className={`p-2.5 rounded-xl border text-left flex items-start gap-2 ${mode === 'synthesis' ? 'bg-emerald-950/40 border-emerald-500 text-emerald-200' : 'bg-slate-950/60 border-slate-800 text-slate-400'}`}
              >
                <Zap className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold text-xs">{t('ai.expand')}</div>
                  <div className="text-[10px] text-slate-500">{t('ai.expandDesc')}</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setMode('counter_arg')}
                className={`p-2.5 rounded-xl border text-left flex items-start gap-2 ${mode === 'counter_arg' ? 'bg-emerald-950/40 border-emerald-500 text-emerald-200' : 'bg-slate-950/60 border-slate-800 text-slate-400'}`}
              >
                <CornerDownRight className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold text-xs">{t('ai.counter')}</div>
                  <div className="text-[10px] text-slate-500">{t('ai.counterDesc')}</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setMode('data_insight')}
                className={`p-2.5 rounded-xl border text-left flex items-start gap-2 ${mode === 'data_insight' ? 'bg-emerald-950/40 border-emerald-500 text-emerald-200' : 'bg-slate-950/60 border-slate-800 text-slate-400'}`}
              >
                <Layers className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold text-xs">{t('ai.data')}</div>
                  <div className="text-[10px] text-slate-500">{t('ai.dataDesc')}</div>
                </div>
              </button>
            </div>
          </div>

          {/* Custom Instruction */}
          <div className="space-y-1.5">
            <label className="text-slate-400 font-semibold">{t('ai.customPrompt')}</label>
            <textarea
              ref={promptRef}
              rows={3}
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              placeholder={t('ai.customPlaceholder')}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-100 placeholder:text-slate-600 outline-none focus:border-emerald-500"
            />
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-sky-500 hover:from-emerald-400 hover:to-sky-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-500/20 disabled:opacity-50"
          >
            <Send className="w-3.5 h-3.5" />
            <span>{isLoading ? t('ai.loading') : t('ai.submit')}</span>
          </button>
        </form>
      </div>
    </div>
  );
};
