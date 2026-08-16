import React, { useState } from 'react';
import { CapsuleBlock, CodeReplBlockData } from '../../types';
import { Play, Code2, Trash2, CheckCircle2, AlertCircle, Copy, Check } from 'lucide-react';

interface Props {
  block: CapsuleBlock & { type: 'code_repl' };
  onChange: (updatedData: CodeReplBlockData) => void;
  onDelete: () => void;
}

export const CodeReplBlock: React.FC<Props> = ({ block, onChange, onDelete }) => {
  const [copied, setCopied] = useState(false);
  const [isRunning, setIsRunning] = useState(false);

  const handleRunCode = () => {
    setIsRunning(true);
    try {
      // Safe execution simulation for JavaScript/REPL
      let logs: string[] = [];
      const customConsole = {
        log: (...args: any[]) => {
          logs.push(args.map((a) => (typeof a === 'object' ? JSON.stringify(a, null, 2) : String(a))).join(' '));
        },
        warn: (...args: any[]) => {
          logs.push('WARN: ' + args.join(' '));
        },
        error: (...args: any[]) => {
          logs.push('ERROR: ' + args.join(' '));
        },
      };

      // Wrap and evaluate JS code
      const runFn = new Function('console', block.data.code);
      const evalResult = runFn(customConsole);

      let finalOutput = logs.join('\n');
      if (evalResult !== undefined) {
        const resultStr = typeof evalResult === 'object' ? JSON.stringify(evalResult, null, 2) : String(evalResult);
        finalOutput = finalOutput ? `${finalOutput}\n=> ${resultStr}` : `=> ${resultStr}`;
      }

      onChange({
        ...block.data,
        output: finalOutput || '/* Executed successfully (no stdout) */',
        error: undefined,
        lastRunTime: Date.now(),
      });
    } catch (err: any) {
      onChange({
        ...block.data,
        error: err.message,
        lastRunTime: Date.now(),
      });
    } finally {
      setIsRunning(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(block.data.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="my-4 rounded-xl border border-slate-800 bg-[#020617] shadow-xl overflow-hidden font-mono group">
      {/* Header */}
      <div className="bg-[#0f172a]/80 px-4 py-2 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Code2 className="w-4 h-4 text-cyan-400" />
          <select
            value={block.data.language}
            onChange={(e) => onChange({ ...block.data, language: e.target.value as any })}
            className="bg-slate-800/80 text-xs text-slate-300 border border-slate-700 rounded px-2 py-0.5 outline-none font-mono"
          >
            <option value="javascript">JavaScript (REPL)</option>
            <option value="python">Python (WASM)</option>
            <option value="rust">Rust (SIMD)</option>
            <option value="json">JSON Schema</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleCopy}
            className="p-1 text-slate-400 hover:text-slate-200 text-xs flex items-center gap-1 rounded hover:bg-slate-800 transition-colors"
            title="Copy Code"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-cyan-400" /> : <Copy className="w-3.5 h-3.5" />}
          </button>

          <button
            type="button"
            onClick={handleRunCode}
            disabled={isRunning}
            className="flex items-center gap-1.5 px-3 py-1 rounded bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-xs transition-colors shadow-[0_0_8px_rgba(6,182,212,0.25)]"
          >
            <Play className="w-3 h-3 fill-current" />
            <span>{isRunning ? 'Running...' : 'Run'}</span>
          </button>

          <button
            type="button"
            onClick={onDelete}
            className="text-xs text-slate-500 hover:text-rose-400 p-1 rounded hover:bg-slate-800 transition-colors ml-1"
            title="Delete code block"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Code Editor Area */}
      <div className="p-3 bg-[#020617]">
        <textarea
          rows={Math.max(3, block.data.code.split('\n').length)}
          value={block.data.code}
          onChange={(e) => onChange({ ...block.data, code: e.target.value })}
          placeholder="// Write executable code here..."
          className="w-full bg-transparent text-cyan-200 text-xs leading-relaxed resize-none border-none outline-none focus:ring-0 font-mono"
          spellCheck={false}
        />
      </div>

      {/* Output Console */}
      {(block.data.output || block.data.error) && (
        <div className="bg-[#0f172a]/90 border-t border-slate-800 p-3 text-xs">
          <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1.5">
            <span className="flex items-center gap-1">
              {block.data.error ? (
                <>
                  <AlertCircle className="w-3.5 h-3.5 text-rose-400" />
                  <span className="text-rose-400 font-semibold">Execution Error</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400" />
                  <span className="text-cyan-400 font-semibold">Stdout / Return</span>
                </>
              )}
            </span>
            {block.data.lastRunTime && (
              <span className="text-slate-500 text-[10px]">
                {new Date(block.data.lastRunTime).toLocaleTimeString()}
              </span>
            )}
          </div>

          <pre
            className={`p-2.5 rounded-lg overflow-x-auto text-[11px] leading-relaxed ${
              block.data.error
                ? 'bg-rose-950/40 text-rose-300 border border-rose-900/50'
                : 'bg-slate-950 text-slate-300 border border-slate-800'
            }`}
          >
            <code>{block.data.error || block.data.output}</code>
          </pre>
        </div>
      )}
    </div>
  );
};
