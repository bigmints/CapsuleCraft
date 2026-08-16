import React, { useState } from 'react';
import { CapsuleNode } from '../types';
import { assembleEml } from '../engine/mime';
import {
  FileCode,
  Copy,
  Check,
  Download,
  Terminal,
  Layers,
  FileSpreadsheet,
  Palette,
  Eye,
} from 'lucide-react';

interface Props {
  capsule: CapsuleNode;
  onDownloadEml: (messageId: string) => void;
}

export const RawMimeInspector: React.FC<Props> = ({ capsule, onDownloadEml }) => {
  const [copied, setCopied] = useState(false);
  const rawEml = capsule.rawEml || assembleEml(capsule);

  const handleCopy = () => {
    navigator.clipboard.writeText(rawEml);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  // MIME structure analysis
  const lines = rawEml.split(/\r?\n/);
  const headerLines = lines.slice(0, lines.findIndex((l) => l.trim() === '') || 15);
  const byteSize = new Blob([rawEml]).size;

  return (
    <div className="w-full h-full bg-[#020617] flex flex-col overflow-hidden font-mono text-xs text-slate-300">
      {/* Top Header Bar */}
      <div className="bg-[#0f172a]/60 border-b border-slate-800 px-6 py-3 flex flex-wrap items-center justify-between gap-4 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
            <FileCode className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-white uppercase text-xs tracking-wider">
                Raw RFC 5322 MIME Inspector
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-cyan-300 border border-slate-700 font-mono">
                {capsule.fileName || 'capsule.eml'}
              </span>
            </div>
            <div className="text-[10px] text-slate-500 flex items-center gap-3 mt-0.5">
              <span>Size: <b className="text-slate-300">{(byteSize / 1024).toFixed(2)} KB</b></span>
              <span>•</span>
              <span>Lines: <b className="text-slate-300">{lines.length}</b></span>
              <span>•</span>
              <span>Attachments: <b className="text-slate-300">{capsule.attachments.length}</b></span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors text-xs font-sans"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-cyan-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Copied!' : 'Copy .eml'}</span>
          </button>

          <button
            type="button"
            onClick={() => onDownloadEml(capsule.messageId)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-semibold transition-all shadow-[0_0_10px_rgba(6,182,212,0.3)] text-xs font-sans"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download .eml File</span>
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* Left Side: MIME Multipart Tree Structure */}
        <div className="w-full md:w-80 border-r border-slate-800 bg-[#0f172a]/20 p-4 overflow-y-auto space-y-4">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-cyan-400" />
            <span>MIME Tree Architecture</span>
          </div>

          <div className="space-y-2 text-[11px]">
            {/* Root */}
            <div className="p-2.5 rounded-lg bg-slate-800/80 border border-slate-700">
              <div className="text-cyan-300 font-bold">multipart/mixed (Root)</div>
              <div className="text-slate-400 text-[10px]">boundary: BOUNDARY_ROOT</div>
            </div>

            {/* Alternative Payload */}
            <div className="ml-4 pl-3 border-l-2 border-slate-700 space-y-2">
              <div className="p-2 rounded-lg bg-slate-800/60 border border-slate-700/80">
                <div className="text-emerald-300 font-bold">multipart/alternative</div>
                <div className="text-slate-400 text-[10px]">JSON State + HTML5 Fallback</div>
              </div>

              {/* Sub-parts */}
              <div className="ml-4 pl-3 border-l-2 border-emerald-500/40 space-y-1.5">
                <div className="p-1.5 rounded bg-slate-950/80 text-emerald-400 border border-emerald-950">
                  📄 application/json (canvas_state.json)
                </div>
                <div className="p-1.5 rounded bg-slate-950/80 text-emerald-400 border border-emerald-950">
                  🌐 text/html (Standalone Dashboard)
                </div>
              </div>
            </div>

            {/* Attachments */}
            {capsule.attachments.map((att, i) => (
              <div key={i} className="ml-4 pl-3 border-l-2 border-purple-500/50">
                <div className="p-2 rounded-lg bg-purple-950/40 border border-purple-800/40 text-purple-300">
                  <div className="font-bold flex items-center gap-1">
                    {att.mimeType.includes('csv') ? <FileSpreadsheet className="w-3 h-3" /> : <Palette className="w-3 h-3" />}
                    <span>{att.name}</span>
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">
                    CID: &lt;{att.cid}&gt; ({att.mimeType})
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="pt-4 border-t border-slate-800 text-[10px] text-slate-500 leading-relaxed font-sans">
            RFC 5322 ensures that every node opens seamlessly both in standard email clients (Apple Mail, Thunderbird) and inside CapsuleOS.
          </div>
        </div>

        {/* Right Side: Raw Byte-level Code Viewer */}
        <div className="flex-1 bg-[#020617] p-4 overflow-auto">
          <pre className="text-[11px] leading-relaxed text-slate-300 font-mono select-text">
            {lines.map((line, idx) => {
              let lineClass = 'text-slate-300';
              if (/^(From|To|Subject|Date|Message-ID|In-Reply-To|References|X-Capsule-.*):/i.test(line)) {
                lineClass = 'text-cyan-400 font-semibold';
              } else if (/^--BOUNDARY_/i.test(line)) {
                lineClass = 'text-amber-400 font-bold bg-amber-950/20 px-1 rounded';
              } else if (/^Content-Type:/i.test(line)) {
                lineClass = 'text-emerald-400';
              } else if (/^Content-ID:/i.test(line)) {
                lineClass = 'text-purple-400';
              }

              return (
                <div key={idx} className="flex hover:bg-slate-900/50 px-2 py-0.5 rounded">
                  <span className="w-12 text-slate-600 text-right pr-4 select-none">
                    {idx + 1}
                  </span>
                  <span className={lineClass}>{line || ' '}</span>
                </div>
              );
            })}
          </pre>
        </div>
      </div>
    </div>
  );
};
