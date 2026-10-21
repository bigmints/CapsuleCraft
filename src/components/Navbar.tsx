import React from 'react';
import {
  Layout,
  Network,
  GitBranch,
  FileCode,
  Mail,
  Zap,
  Sparkles,
} from 'lucide-react';
import { APP_VERSION } from '../version';

export type ActiveView = 'canvas' | 'graph' | 'thread' | 'mime' | 'html_preview';

interface Props {
  activeView: ActiveView;
  onChangeView: (view: ActiveView) => void;
  onOpenBenchmark: () => void;
  onOpenAiCoThink: () => void;
  totalCapsules: number;
  /** Real rebuild time of the in-memory index (ms) from vaultStore.scanStats. */
  scanDurationMs?: number;
}

export const Navbar: React.FC<Props> = ({
  activeView,
  onChangeView,
  onOpenBenchmark,
  onOpenAiCoThink,
  totalCapsules,
  scanDurationMs,
}) => {
  return (
    <header className="h-14 border-b border-slate-800 bg-[#0f172a]/50 backdrop-blur-md px-6 flex items-center justify-between z-30 shrink-0 select-none">
      {/* Brand & Identity */}
      <div className="flex items-center gap-4">
        <div className="w-8 h-8 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-lg flex items-center justify-center shadow-[0_0_15px_rgba(6,182,212,0.4)]">
          <div className="w-4 h-4 border-2 border-white rounded-full opacity-80" />
        </div>
        <div className="flex flex-col">
          <span className="text-sm font-bold tracking-tight text-white flex items-center">
            CapsuleOS <span className="text-cyan-400 font-mono text-[10px] ml-1.5 opacity-80 font-normal">v{APP_VERSION}</span>
          </span>
          <span className="text-[10px] text-slate-500 font-mono">~/vault/local-research</span>
        </div>
      </div>

      {/* Center View Mode Navigation Tabs */}
      <nav className="flex items-center gap-1 bg-slate-900/80 px-2 py-1 rounded-lg border border-slate-800/80 text-xs shadow-inner">
        <button
          type="button"
          onClick={() => onChangeView('canvas')}
          className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-all ${
            activeView === 'canvas'
              ? 'bg-cyan-500/20 text-cyan-300 font-semibold border border-cyan-500/40 shadow-[0_0_10px_rgba(6,182,212,0.2)]'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Layout className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Editor</span>
        </button>

        <button
          type="button"
          onClick={() => onChangeView('graph')}
          className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-all ${
            activeView === 'graph'
              ? 'bg-cyan-500/20 text-cyan-300 font-semibold border border-cyan-500/40 shadow-[0_0_10px_rgba(6,182,212,0.2)]'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Network className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Graph DAG</span>
        </button>

        <button
          type="button"
          onClick={() => onChangeView('thread')}
          className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-all ${
            activeView === 'thread'
              ? 'bg-cyan-500/20 text-cyan-300 font-semibold border border-cyan-500/40 shadow-[0_0_10px_rgba(6,182,212,0.2)]'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <GitBranch className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Thread</span>
        </button>

        <button
          type="button"
          onClick={() => onChangeView('mime')}
          className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-all ${
            activeView === 'mime'
              ? 'bg-cyan-500/20 text-cyan-300 font-semibold border border-cyan-500/40 shadow-[0_0_10px_rgba(6,182,212,0.2)]'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <FileCode className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">MIME Source</span>
        </button>

        <button
          type="button"
          onClick={() => onChangeView('html_preview')}
          className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-all ${
            activeView === 'html_preview'
              ? 'bg-cyan-500/20 text-cyan-300 font-semibold border border-cyan-500/40 shadow-[0_0_10px_rgba(6,182,212,0.2)]'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Mail className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Preview</span>
        </button>
      </nav>

      {/* Right Metrics & Profile */}
      <div className="flex items-center gap-4 text-[11px] font-mono">
        {/* Benchmark Button */}
        <button
          type="button"
          onClick={onOpenBenchmark}
          className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-900/80 hover:bg-slate-800 text-amber-300 border border-amber-500/30 hover:border-amber-500/50 text-[11px] font-mono transition-all shadow"
          title="SIMD Scanner Benchmark"
        >
          <Zap className="w-3 h-3 text-amber-400 fill-amber-400/30" />
          <span>SIMD 50k</span>
        </button>

        {/* Co-Thinking Button */}
        <button
          type="button"
          onClick={onOpenAiCoThink}
          className="flex items-center gap-1.5 px-3 py-1 rounded-md bg-cyan-600 hover:bg-cyan-500 text-white font-medium text-xs transition-all shadow-[0_0_12px_rgba(6,182,212,0.3)] active:scale-95"
        >
          <Sparkles className="w-3.5 h-3.5 text-cyan-200" />
          <span>Co-Think</span>
        </button>

        {/* Live In-Memory Telemetry */}
        <div className="hidden lg:flex flex-col items-end">
          <span className="text-emerald-400 font-semibold tracking-wide">RAM INDEX: ACTIVE</span>
          <span className="text-slate-500 text-[10px]">
            {totalCapsules.toLocaleString()} nodes in {scanDurationMs != null ? scanDurationMs : '—'}ms
          </span>
        </div>

        {/* User Badge */}
        <div className="w-8 h-8 rounded-full border border-slate-700 p-0.5 shadow">
          <div className="w-full h-full rounded-full bg-slate-800 flex items-center justify-center text-white font-bold text-xs">
            A
          </div>
        </div>
      </div>
    </header>
  );
};
