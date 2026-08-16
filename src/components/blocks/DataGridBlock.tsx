import React, { useState, useMemo } from 'react';
import { CapsuleBlock, DataGridBlockData, CapsuleAttachment } from '../../types';
import {
  Table as TableIcon,
  BarChart3,
  LineChart,
  PieChart,
  Plus,
  Trash2,
  FileSpreadsheet,
  Layers,
  ArrowUpDown,
  Download,
} from 'lucide-react';

interface Props {
  block: CapsuleBlock & { type: 'data_grid_view' };
  attachments: CapsuleAttachment[];
  onChange: (updatedData: DataGridBlockData) => void;
  onUpdateAttachment: (cid: string, newContent: string) => void;
  onDelete: () => void;
}

export const DataGridBlock: React.FC<Props> = ({
  block,
  attachments,
  onChange,
  onUpdateAttachment,
  onDelete,
}) => {
  const cleanCid = block.data.source_cid.replace(/^cid:/, '').replace(/^<|>$/g, '');
  const attachment = attachments.find(
    (a) => a.cid === cleanCid || `cid:${a.cid}` === block.data.source_cid || a.name === cleanCid
  );

  const rawCsv = attachment ? attachment.content : 'Month,CAC,LTV,Margin\nJan,120,450,0.42\nFeb,115,480,0.45';

  const { headers, rows } = useMemo(() => {
    const lines = rawCsv.trim().split('\n').filter(Boolean);
    if (lines.length === 0) return { headers: ['Col1', 'Col2'], rows: [] };
    const h = lines[0].split(',').map((s) => s.trim());
    const r = lines.slice(1).map((line) => line.split(',').map((s) => s.trim()));
    return { headers: h, rows: r };
  }, [rawCsv]);

  const viewMode = block.data.view || 'table';
  const chartType = block.data.chartType || 'bar';
  const xCol = block.data.xColumn || headers[0] || '';
  const yCol = block.data.yColumn || headers[1] || headers[0] || '';

  // Stats calculation for numeric columns
  const stats = useMemo(() => {
    const colIndex = headers.indexOf(yCol);
    if (colIndex === -1) return null;
    const nums = rows
      .map((r) => parseFloat(r[colIndex]))
      .filter((n) => !isNaN(n));
    if (nums.length === 0) return null;
    const sum = nums.reduce((a, b) => a + b, 0);
    const avg = sum / nums.length;
    const min = Math.min(...nums);
    const max = Math.max(...nums);
    return { count: nums.length, sum, avg: avg.toFixed(2), min, max };
  }, [headers, rows, yCol]);

  const handleCellChange = (rowIndex: number, colIndex: number, value: string) => {
    const newRows = [...rows.map((r) => [...r])];
    if (newRows[rowIndex]) {
      newRows[rowIndex][colIndex] = value;
      const newCsv = [headers.join(','), ...newRows.map((r) => r.join(','))].join('\n');
      onUpdateAttachment(cleanCid, newCsv);
    }
  };

  const handleHeaderChange = (colIndex: number, value: string) => {
    const newHeaders = [...headers];
    newHeaders[colIndex] = value;
    const newCsv = [newHeaders.join(','), ...rows.map((r) => r.join(','))].join('\n');
    onUpdateAttachment(cleanCid, newCsv);
  };

  const handleAddRow = () => {
    const newRow = headers.map(() => '0');
    const newCsv = [headers.join(','), ...rows.map((r) => r.join(',')), newRow.join(',')].join('\n');
    onUpdateAttachment(cleanCid, newCsv);
  };

  const handleAddColumn = () => {
    const newHeader = `Metric_${headers.length + 1}`;
    const newHeaders = [...headers, newHeader];
    const newRows = rows.map((r) => [...r, '0']);
    const newCsv = [newHeaders.join(','), ...newRows.map((r) => r.join(','))].join('\n');
    onUpdateAttachment(cleanCid, newCsv);
  };

  const handleDeleteRow = (rowIndex: number) => {
    const newRows = rows.filter((_, i) => i !== rowIndex);
    const newCsv = [headers.join(','), ...newRows.map((r) => r.join(','))].join('\n');
    onUpdateAttachment(cleanCid, newCsv);
  };

  return (
    <div className="my-4 rounded-xl border border-cyan-500/30 bg-[#0f172a]/80 shadow-xl shadow-cyan-950/20 backdrop-blur-sm overflow-hidden group">
      {/* Top Bar */}
      <div className="bg-slate-950/80 px-4 py-2.5 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="p-1 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
            <FileSpreadsheet className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-cyan-400">
                Live DataGrid
              </span>
              <span className="text-[10px] font-mono text-slate-400 bg-slate-800/80 px-2 py-0.5 rounded border border-slate-700">
                {block.data.source_cid}
              </span>
            </div>
          </div>
        </div>

        {/* View Switcher Controls */}
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-slate-800/80 rounded-lg p-0.5 border border-slate-700 text-xs">
            <button
              type="button"
              onClick={() => onChange({ ...block.data, view: 'table' })}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-md transition-all ${
                viewMode === 'table' ? 'bg-cyan-500 text-slate-950 font-semibold shadow' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <TableIcon className="w-3.5 h-3.5" />
              <span>Table</span>
            </button>
            <button
              type="button"
              onClick={() => onChange({ ...block.data, view: 'chart' })}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-md transition-all ${
                viewMode === 'chart' ? 'bg-cyan-500 text-slate-950 font-semibold shadow' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span>Chart</span>
            </button>
            <button
              type="button"
              onClick={() => onChange({ ...block.data, view: 'pivot' })}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-md transition-all ${
                viewMode === 'pivot' ? 'bg-cyan-500 text-slate-950 font-semibold shadow' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Metrics</span>
            </button>
          </div>

          <button
            type="button"
            onClick={onDelete}
            className="text-xs text-slate-500 hover:text-rose-400 p-1.5 rounded hover:bg-slate-800 transition-colors"
            title="Remove DataGrid block"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="p-4">
        {viewMode === 'table' && (
          <div className="space-y-3">
            <div className="overflow-x-auto rounded-lg border border-slate-800 bg-slate-950/60">
              <table className="w-full text-left text-xs border-collapse font-mono">
                <thead>
                  <tr className="bg-slate-800/60 text-slate-300 border-b border-slate-700">
                    <th className="p-2 w-8 text-center text-slate-500">#</th>
                    {headers.map((header, colIdx) => (
                      <th key={colIdx} className="p-2 border-r border-slate-800 min-w-[110px]">
                        <input
                          type="text"
                          value={header}
                          onChange={(e) => handleHeaderChange(colIdx, e.target.value)}
                          className="w-full bg-transparent font-semibold text-cyan-300 border-none outline-none focus:bg-slate-700/50 px-1 py-0.5 rounded"
                        />
                      </th>
                    ))}
                    <th className="p-2 w-10 text-center">
                      <button
                        type="button"
                        onClick={handleAddColumn}
                        className="p-1 rounded bg-slate-800 hover:bg-cyan-500/20 text-slate-400 hover:text-cyan-300 transition-colors"
                        title="Add Column"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-200">
                  {rows.map((row, rowIdx) => (
                    <tr key={rowIdx} className="hover:bg-slate-800/30 transition-colors group/row">
                      <td className="p-2 text-center text-slate-500 select-none">{rowIdx + 1}</td>
                      {row.map((cell, colIdx) => (
                        <td key={colIdx} className="p-2 border-r border-slate-800/50">
                          <input
                            type="text"
                            value={cell}
                            onChange={(e) => handleCellChange(rowIdx, colIdx, e.target.value)}
                            className="w-full bg-transparent text-slate-200 border-none outline-none focus:bg-cyan-950/40 focus:text-cyan-200 px-1 py-0.5 rounded"
                          />
                        </td>
                      ))}
                      <td className="p-1 text-center">
                        <button
                          type="button"
                          onClick={() => handleDeleteRow(rowIdx)}
                          className="opacity-0 group-hover/row:opacity-100 p-1 text-slate-600 hover:text-rose-400 rounded transition-all"
                          title="Delete Row"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between text-xs text-slate-400 pt-1">
              <button
                type="button"
                onClick={handleAddRow}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-400 border border-slate-700 transition-colors font-medium text-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Row</span>
              </button>

              <div className="flex items-center gap-3 text-slate-500 font-mono text-[10px]">
                <span>{rows.length} rows</span>
                <span>•</span>
                <span>{headers.length} columns</span>
                <span>•</span>
                <span className="text-cyan-400">MIME-Linked CID</span>
              </div>
            </div>
          </div>
        )}

        {viewMode === 'chart' && (
          <div className="space-y-4">
            {/* Chart Config Controls */}
            <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-950/50 p-2.5 rounded-lg border border-slate-800 text-xs">
              <div className="flex items-center gap-2">
                <span className="text-slate-400">Type:</span>
                <div className="flex items-center gap-1 bg-slate-800 p-0.5 rounded border border-slate-700">
                  <button
                    type="button"
                    onClick={() => onChange({ ...block.data, chartType: 'bar' })}
                    className={`p-1 rounded ${chartType === 'bar' ? 'bg-cyan-500 text-slate-950 font-bold' : 'text-slate-400'}`}
                    title="Bar Chart"
                  >
                    <BarChart3 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onChange({ ...block.data, chartType: 'line' })}
                    className={`p-1 rounded ${chartType === 'line' ? 'bg-cyan-500 text-slate-950 font-bold' : 'text-slate-400'}`}
                    title="Line Chart"
                  >
                    <LineChart className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onChange({ ...block.data, chartType: 'pie' })}
                    className={`p-1 rounded ${chartType === 'pie' ? 'bg-cyan-500 text-slate-950 font-bold' : 'text-slate-400'}`}
                    title="Pie / Donut"
                  >
                    <PieChart className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-400">X (Category):</span>
                  <select
                    value={xCol}
                    onChange={(e) => onChange({ ...block.data, xColumn: e.target.value })}
                    className="bg-slate-800 text-slate-200 border border-slate-700 rounded px-2 py-1 outline-none text-xs"
                  >
                    {headers.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-1.5">
                  <span className="text-slate-400">Y (Value):</span>
                  <select
                    value={yCol}
                    onChange={(e) => onChange({ ...block.data, yColumn: e.target.value })}
                    className="bg-slate-800 text-slate-200 border border-slate-700 rounded px-2 py-1 outline-none text-xs"
                  >
                    {headers.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Visual SVG Chart Rendering */}
            <div className="bg-slate-950/80 rounded-xl p-4 border border-slate-800 min-h-[220px] flex flex-col justify-end">
              <div className="text-xs font-semibold text-slate-300 mb-3 flex items-center justify-between">
                <span>{block.data.title || `${yCol} across ${xCol}`}</span>
                {stats && (
                  <span className="text-[10px] font-mono text-cyan-400">
                    Avg: {stats.avg} | Max: {stats.max}
                  </span>
                )}
              </div>

              {chartType === 'bar' && (
                <div className="flex items-end gap-3 h-44 pt-4 border-b border-slate-800 px-2">
                  {rows.map((row, idx) => {
                    const xVal = row[headers.indexOf(xCol)] || `Item ${idx + 1}`;
                    const yRaw = parseFloat(row[headers.indexOf(yCol)]) || 0;
                    const maxVal = stats?.max || 100;
                    const heightPercent = Math.min(100, Math.max(8, (yRaw / maxVal) * 100));

                    return (
                      <div key={idx} className="flex-1 flex flex-col items-center gap-1.5 group/bar">
                        <span className="text-[10px] font-mono text-cyan-300 opacity-0 group-hover/bar:opacity-100 transition-opacity">
                          {yRaw}
                        </span>
                        <div
                          style={{ height: `${heightPercent}%` }}
                          className="w-full max-w-[48px] bg-gradient-to-t from-cyan-600 to-cyan-400 rounded-t-md transition-all duration-300 hover:brightness-125 shadow-[0_0_8px_rgba(6,182,212,0.2)]"
                        />
                        <span className="text-[10px] font-mono text-slate-400 truncate max-w-[60px]">
                          {xVal}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}

              {chartType === 'line' && (
                <div className="relative h-44 w-full pt-4">
                  <svg className="w-full h-full overflow-visible" viewBox="0 0 500 120" preserveAspectRatio="none">
                    {/* Grid lines */}
                    <line x1="0" y1="30" x2="500" y2="30" stroke="#334155" strokeDasharray="3 3" strokeWidth="1" />
                    <line x1="0" y1="60" x2="500" y2="60" stroke="#334155" strokeDasharray="3 3" strokeWidth="1" />
                    <line x1="0" y1="90" x2="500" y2="90" stroke="#334155" strokeDasharray="3 3" strokeWidth="1" />

                    {/* Polyline */}
                    {(() => {
                      const maxVal = stats?.max || 100;
                      const points = rows.map((r, i) => {
                        const yRaw = parseFloat(r[headers.indexOf(yCol)]) || 0;
                        const x = (i / Math.max(1, rows.length - 1)) * 500;
                        const y = 110 - (yRaw / maxVal) * 90;
                        return `${x},${y}`;
                      });
                      return (
                        <>
                          <polyline
                            fill="none"
                            stroke="#06b6d4"
                            strokeWidth="3"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            points={points.join(' ')}
                          />
                          {rows.map((r, i) => {
                            const yRaw = parseFloat(r[headers.indexOf(yCol)]) || 0;
                            const x = (i / Math.max(1, rows.length - 1)) * 500;
                            const y = 110 - (yRaw / maxVal) * 90;
                            return (
                              <circle
                                key={i}
                                cx={x}
                                cy={y}
                                r="4"
                                fill="#0f172a"
                                stroke="#06b6d4"
                                strokeWidth="2.5"
                              />
                            );
                          })}
                        </>
                      );
                    })()}
                  </svg>
                  <div className="flex justify-between text-[10px] font-mono text-slate-400 mt-2">
                    {rows.map((r, i) => (
                      <span key={i}>{r[headers.indexOf(xCol)]}</span>
                    ))}
                  </div>
                </div>
              )}

              {chartType === 'pie' && (
                <div className="flex items-center justify-around py-3">
                  <div className="flex flex-col gap-1.5 text-xs font-mono">
                    {rows.slice(0, 5).map((r, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <span
                          className="w-2.5 h-2.5 rounded-full"
                          style={{ backgroundColor: ['#06b6d4', '#10b981', '#a855f7', '#f59e0b', '#ec4899'][i % 5] }}
                        />
                        <span className="text-slate-300">{r[headers.indexOf(xCol)]}:</span>
                        <span className="text-cyan-300 font-semibold">{r[headers.indexOf(yCol)]}</span>
                      </div>
                    ))}
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-cyan-400 font-mono">{stats?.sum || 0}</div>
                    <div className="text-[10px] text-slate-500 uppercase tracking-wider">Total ({yCol})</div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {viewMode === 'pivot' && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-950/60 p-4 rounded-xl border border-slate-800">
            <div className="p-3 bg-[#0f172a] rounded-lg border border-slate-800">
              <div className="text-[10px] text-slate-500 uppercase font-mono">Sum ({yCol})</div>
              <div className="text-lg font-bold text-cyan-400 font-mono mt-1">{stats?.sum || 0}</div>
            </div>
            <div className="p-3 bg-[#0f172a] rounded-lg border border-slate-800">
              <div className="text-[10px] text-slate-500 uppercase font-mono">Average (AVG)</div>
              <div className="text-lg font-bold text-emerald-400 font-mono mt-1">{stats?.avg || 0}</div>
            </div>
            <div className="p-3 bg-[#0f172a] rounded-lg border border-slate-800">
              <div className="text-[10px] text-slate-500 uppercase font-mono">Minimum</div>
              <div className="text-lg font-bold text-amber-400 font-mono mt-1">{stats?.min || 0}</div>
            </div>
            <div className="p-3 bg-[#0f172a] rounded-lg border border-slate-800">
              <div className="text-[10px] text-slate-500 uppercase font-mono">Maximum</div>
              <div className="text-lg font-bold text-purple-400 font-mono mt-1">{stats?.max || 0}</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
