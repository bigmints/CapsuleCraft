import React, { useState } from 'react';
import { CapsuleNode } from '../types';
import { Sparkles, Bot, ShieldAlert, Zap, Layers, Send, Brain, Cpu , CornerDownRight } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  currentCapsule: CapsuleNode;
  onExecuteAi: (prompt: string, mode: string, persona: string) => void;
  isLoading: boolean;
}

export const AiCoThinkModal: React.FC<Props> = ({
  isOpen,
  onClose,
  currentCapsule,
  onExecuteAi,
  isLoading,
}) => {
  const [persona, setPersona] = useState('Claude 3.5 Sonnet');
  const [mode, setMode] = useState<'critique' | 'counter_arg' | 'synthesis' | 'data_insight'>('critique');
  const [customPrompt, setCustomPrompt] = useState('');
  const [rigor, setRigor] = useState(0.85);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const modePrompt =
      mode === 'critique' ? 'глубокий критический анализ рисков'
      : mode === 'counter_arg' ? 'поиск контраргументов и слабых мест'
      : mode === 'data_insight' ? 'анализ данных и метрик'
      : 'синтез и выводы';
    const promptToSend = customPrompt.trim() || `Проведи ${modePrompt} для капсулы "${currentCapsule.subject}"`;
    onExecuteAi(promptToSend, mode, persona);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
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
                Капсула: <b className="text-slate-200">{currentCapsule.subject}</b>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-500 hover:text-slate-200 p-1"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {/* Persona selector */}
          <div className="space-y-1.5">
            <label className="text-slate-400 font-semibold flex items-center gap-1.5">
              <Bot className="w-3.5 h-3.5 text-sky-400" />
              <span>AI Соавтор / Модель:</span>
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'Claude 3.5 Sonnet', desc: 'Devils Advocate & Logic' },
                { id: 'Gemini 3.7 Flash', desc: 'High-speed synthesis' },
                { id: 'DeepSeek-R1', desc: 'Formal proof & Rigor' },
              ].map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPersona(p.id)}
                  className={`p-2.5 rounded-xl border text-left transition-all ${persona === p.id ? 'bg-emerald-950/50 border-emerald-500 text-emerald-200 shadow-md' : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'}`}
                >
                  <div className="font-bold text-xs">{p.id}</div>
                  <div className="text-[10px] text-slate-500 mt-0.5">{p.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Mode Selector */}
          <div className="space-y-1.5">
            <label className="text-slate-400 font-semibold flex items-center gap-1.5">
              <Brain className="w-3.5 h-3.5 text-purple-400" />
              <span>Режим когнитивного взаимодействия:</span>
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setMode('critique')}
                className={`p-2.5 rounded-xl border text-left flex items-start gap-2 ${mode === 'critique' ? 'bg-emerald-950/40 border-emerald-500 text-emerald-200' : 'bg-slate-950/60 border-slate-800 text-slate-400'}`}
              >
                <ShieldAlert className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold text-xs">Оппонентная критика (Alt+C)</div>
                  <div className="text-[10px] text-slate-500">Поиск скрытых рисков и когнитивных искажений</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setMode('synthesis')}
                className={`p-2.5 rounded-xl border text-left flex items-start gap-2 ${mode === 'synthesis' ? 'bg-emerald-950/40 border-emerald-500 text-emerald-200' : 'bg-slate-950/60 border-slate-800 text-slate-400'}`}
              >
                <Zap className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold text-xs">Синтез и продолжение (Tab)</div>
                  <div className="text-[10px] text-slate-500">Построение решений на базе тезисов</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setMode('counter_arg')}
                className={`p-2.5 rounded-xl border text-left flex items-start gap-2 ${mode === 'counter_arg' ? 'bg-emerald-950/40 border-emerald-500 text-emerald-200' : 'bg-slate-950/60 border-slate-800 text-slate-400'}`}
              >
                <CornerDownRight className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold text-xs">Контраргумент (Re: .eml)</div>
                  <div className="text-[10px] text-slate-500">Порождения дочерней капсулы с возражениями</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setMode('data_insight')}
                className={`p-2.5 rounded-xl border text-left flex items-start gap-2 ${mode === 'data_insight' ? 'bg-emerald-950/40 border-emerald-500 text-emerald-200' : 'bg-slate-950/60 border-slate-800 text-slate-400'}`}
              >
                <Layers className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold text-xs">Data Insight (метрики)</div>
                  <div className="text-[10px] text-slate-500">Анализ датасетов и метрик капсулы</div>
                </div>
              </button>
            </div>
          </div>

          {/* Custom Instruction */}
          <div className="space-y-1.5">
            <label className="text-slate-400 font-semibold">
              Уточняющий вопрос или тезис для проверки (необязательно):
            </label>
            <textarea
              rows={3}
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              placeholder="Например: Проанализируй влияние нулевой базы данных на устойчивость при отключении питания..."
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
            <span>{isLoading ? 'Генерация критики и рассуждений...' : 'Запустить Co-Thinking сессию'}</span>
          </button>
        </form>
      </div>
    </div>
  );
};
