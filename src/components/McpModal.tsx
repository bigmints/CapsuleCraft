import React, { useEffect, useState } from 'react';
import { Bot, Copy, Check, X, Terminal, Cpu } from 'lucide-react';
import { useI18n } from '../i18n';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

type ClientTab = 'antigravity' | 'claude_desktop' | 'claude_code' | 'cursor';

export const McpModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const { t } = useI18n();
  const [activeTab, setActiveTab] = useState<ClientTab>('antigravity');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
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

  const defaultVaultPath = 'D:\\Projects\\active\\capsuleos\\vault';
  const defaultExePath = 'D:\\Projects\\active\\capsuleos\\native\\target\\debug\\capsuleos-native.exe';

  const mcpConfigObj = {
    mcpServers: {
      capsulecraft: {
        command: defaultExePath,
        args: ['--mcp', defaultVaultPath],
      },
    },
  };

  const mcpConfigJson = JSON.stringify(mcpConfigObj, null, 2);
  const claudeCodeCmd = `claude mcp add capsulecraft "${defaultExePath}" --mcp "${defaultVaultPath}"`;

  const tabs: { id: ClientTab; label: string; location: string }[] = [
    {
      id: 'antigravity',
      label: 'Antigravity (AGY)',
      location: '~/.gemini/antigravity/mcp/ or AGY workspace configuration',
    },
    {
      id: 'claude_desktop',
      label: 'Claude Desktop',
      location: '%APPDATA%\\Claude\\claude_desktop_config.json',
    },
    {
      id: 'claude_code',
      label: 'Claude Code (CLI)',
      location: 'Terminal command registration',
    },
    {
      id: 'cursor',
      label: 'Cursor / Windsurf',
      location: '.cursor/mcp.json or workspace settings',
    },
  ];

  const contentToCopy = activeTab === 'claude_code' ? claudeCodeCmd : mcpConfigJson;

  const handleCopy = () => {
    navigator.clipboard.writeText(contentToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-slate-900 border border-indigo-500/30 rounded-xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-indigo-950/80 border border-indigo-500/40 flex items-center justify-center text-indigo-400 shadow-sm">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-100 flex items-center gap-2">
                {t('mcp.title')}
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  RFC 5322 stdio
                </span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">{t('mcp.subtitle')}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Client Selection Tabs */}
        <div className="px-5 pt-4 pb-2 flex gap-2 border-b border-slate-800 bg-slate-950/30 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition flex items-center gap-1.5 whitespace-nowrap ${
                activeTab === tab.id
                  ? 'bg-indigo-600 text-white shadow-[0_0_12px_rgba(99,102,241,0.3)]'
                  : 'bg-slate-800/80 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content Body */}
        <div className="p-5 space-y-4 overflow-y-auto">
          <div>
            <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
              <span className="font-mono text-[11px] text-slate-300">
                {tabs.find((t) => t.id === activeTab)?.location}
              </span>
              <span className="text-emerald-400 font-mono text-[11px] flex items-center gap-1">
                <Cpu className="w-3.5 h-3.5" /> Zero-DB BM25 Engine
              </span>
            </div>

            <div className="relative group">
              <pre className="p-3.5 rounded-lg bg-slate-950 border border-slate-800 text-indigo-300 font-mono text-xs overflow-x-auto selection:bg-indigo-900 leading-relaxed max-h-56">
                {contentToCopy}
              </pre>
              <button
                type="button"
                onClick={handleCopy}
                className="absolute top-2.5 right-2.5 flex items-center gap-1 px-2.5 py-1 rounded bg-slate-800/90 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-mono transition shadow"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-emerald-400">{t('mcp.copied')}</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-slate-400" />
                    <span>{t('mcp.copyConfig')}</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Setup Script helper */}
          <div className="p-3 rounded-lg bg-indigo-950/20 border border-indigo-500/20 text-xs text-slate-300 flex items-start gap-2.5">
            <Terminal className="w-4 h-4 text-indigo-400 mt-0.5 shrink-0" />
            <div>
              <span className="font-semibold text-indigo-200">Zero-Friction Auto Setup:</span>{' '}
              {t('mcp.setupScript')}
              <div className="mt-1 font-mono text-[11px] text-slate-400 bg-slate-950/80 px-2 py-1 rounded border border-slate-800/80">
                powershell -ExecutionPolicy Bypass -File .\scripts\setup_mcp.ps1
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between">
          <div className="text-[11px] text-slate-400 font-mono">
            CLI test: <span className="text-slate-300">capsuleos-native.exe --mcp [vault]</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition"
          >
            {t('ai.close')}
          </button>
        </div>
      </div>
    </div>
  );
};
