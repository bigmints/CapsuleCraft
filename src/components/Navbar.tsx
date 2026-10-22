import React from 'react';
import {
  Layout,
  Network,
  GitBranch,
  CalendarDays,
  FileCode,
  Mail,
  Zap,
  Sparkles,
  HelpCircle,
} from 'lucide-react';
import { APP_VERSION } from '../version';
import { useI18n } from '../i18n';
import { LocaleToggle } from './LocaleToggle';

export type ActiveView = 'canvas' | 'graph' | 'thread' | 'planning' | 'mime' | 'html_preview';

interface Props {
  activeView: ActiveView;
  onChangeView: (view: ActiveView) => void;
  onOpenBenchmark: () => void;
  onOpenAiCoThink: () => void;
  onOpenFaq: () => void;
  totalCapsules: number;
  /** Real rebuild time of the in-memory index (ms) from vaultStore.scanStats. */
  scanDurationMs?: number;
}

export const Navbar: React.FC<Props> = ({
  activeView,
  onChangeView,
  onOpenBenchmark,
  onOpenAiCoThink,
  onOpenFaq,
  totalCapsules,
  scanDurationMs,
}) => {
  const { t } = useI18n();
  const tabs = [
    { id: 'canvas' as const, label: 'Editor', icon: Layout, tooltip: t('nav.tooltip.editor') },
    { id: 'graph' as const, label: 'Graph', icon: Network, tooltip: t('nav.tooltip.graph') },
    { id: 'thread' as const, label: 'Thread', icon: GitBranch, tooltip: t('nav.tooltip.thread') },
    { id: 'planning' as const, label: 'Planning', icon: CalendarDays, tooltip: t('nav.tooltip.planning') },
    { id: 'mime' as const, label: 'MIME', icon: FileCode, tooltip: t('nav.tooltip.mime') },
    { id: 'html_preview' as const, label: 'Preview', icon: Mail, tooltip: t('nav.tooltip.preview') },
  ];
  return (
    <header className="h-14 border-b border-slate-800 bg-[#0f172a]/50 backdrop-blur-md px-3 xl:px-6 flex items-center justify-between gap-3 z-30 shrink-0 select-none">
      {/* Brand & Identity */}
      <div className="flex items-center gap-3 shrink-0">
        <div className="w-8 h-8 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-lg flex items-center justify-center shadow-[0_0_15px_rgba(6,182,212,0.4)]">
          <div className="w-4 h-4 border-2 border-white rounded-full opacity-80" />
        </div>
        <div className="flex flex-col">
          <span className="text-sm font-bold tracking-tight text-white flex items-center whitespace-nowrap">
            CapsuleOS <span className="text-cyan-400 font-mono text-[10px] ml-1.5 opacity-80 font-normal">v{APP_VERSION}</span>
          </span>
          <span className="hidden xl:block text-[10px] text-slate-500 font-mono">~/vault/local-research</span>
        </div>
      </div>

      {/* Center View Mode Navigation Tabs */}
      <nav className="flex items-center gap-0.5 bg-slate-900/80 px-1.5 py-1 rounded-lg border border-slate-800/80 text-xs shadow-inner shrink-0">
        {tabs.map(({ id, label, icon: Icon, tooltip }) => (
          <button
            key={id}
            type="button"
            title={tooltip}
            onClick={() => onChangeView(id)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all whitespace-nowrap ${
              activeView === id
                ? 'bg-cyan-500/20 text-cyan-300 font-semibold border border-cyan-500/40 shadow-[0_0_10px_rgba(6,182,212,0.2)]'
                : 'text-slate-400 hover:text-slate-200 border border-transparent'
            }`}
          >
            <Icon className="w-3.5 h-3.5 shrink-0" />
            <span className="hidden md:inline">{label}</span>
          </button>
        ))}
      </nav>

      {/* Right Metrics & Profile */}
      <div className="flex items-center gap-2 xl:gap-4 text-[11px] font-mono shrink-0">
        {/* FAQ / Help Button */}
        <button
          type="button"
          onClick={onOpenFaq}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-900/80 hover:bg-slate-800 text-slate-300 hover:text-cyan-300 border border-slate-700 hover:border-cyan-500/40 text-[11px] font-mono transition-all shadow whitespace-nowrap"
          title={t('nav.faq')}
        >
          <HelpCircle className="w-3 h-3" />
          <span className="hidden lg:inline">FAQ</span>
        </button>

        {/* Benchmark Button */}
        <button
          type="button"
          onClick={onOpenBenchmark}
          className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-900/80 hover:bg-slate-800 text-amber-300 border border-amber-500/30 hover:border-amber-500/50 text-[11px] font-mono transition-all shadow whitespace-nowrap"
          title={t('nav.bench')}
        >
          <Zap className="w-3 h-3 text-amber-400 fill-amber-400/30" />
          <span>Bench 50k</span>
        </button>

        {/* Co-Thinking Button */}
        <button
          type="button"
          onClick={onOpenAiCoThink}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-cyan-600 hover:bg-cyan-500 text-white font-medium text-xs transition-all shadow-[0_0_12px_rgba(6,182,212,0.3)] active:scale-95 whitespace-nowrap"
        >
          <Sparkles className="w-3.5 h-3.5 text-cyan-200" />
          <span className="hidden sm:inline">Co-Think</span>
        </button>

        {/* Language switch */}
        <LocaleToggle />

        {/* Live In-Memory Telemetry */}
        <div className="hidden lg:flex flex-col items-end">
          <span className="text-emerald-400 font-semibold tracking-wide">{t('nav.ramActive')}</span>
          <span className="text-slate-500 text-[10px]">
            {t('nav.nodesMeta', {
              count: totalCapsules.toLocaleString(),
              ms: scanDurationMs != null ? scanDurationMs : '—',
            })}
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
