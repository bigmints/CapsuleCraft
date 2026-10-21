import React, { useEffect, useRef, useState } from 'react';
import { CapsuleNode, VaultGraphState } from '../types';
import {
  Folder,
  FileCode,
  Plus,
  Search,
  Tag,
  Clock,
  Sparkles,
  GitBranch,
  Download,
  Upload,
  Layers,
  ChevronRight,
  ChevronDown,
  Trash2,
} from 'lucide-react';

interface Props {
  graphState: VaultGraphState;
  selectedMessageId: string | null;
  onSelectNode: (messageId: string) => void;
  onCreateNewCapsule: () => void;
  onDeleteCapsule: (messageId: string) => void;
  onImportEml: (file: File) => void;
  onExportVaultZip: () => void;
}

export const VaultSidebar: React.FC<Props> = ({
  graphState,
  selectedMessageId,
  onSelectNode,
  onCreateNewCapsule,
  onDeleteCapsule,
  onImportEml,
  onExportVaultZip,
}) => {
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [collapsedFolders, setCollapsedFolders] = useState<Record<string, boolean>>({});

  // Global Cmd/Ctrl+K shortcut: focus the vault search input
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const allCapsules: CapsuleNode[] = Array.from(graphState.nodes.values());

  // Filter capsules by search & tag
  const filteredCapsules = allCapsules.filter((cap: CapsuleNode) => {
    const matchesTag = !activeTag || cap.tags.includes(activeTag);
    if (!matchesTag) return false;
    if (!searchQuery.trim()) return true;

    const query = searchQuery.toLowerCase();
    return (
      cap.subject.toLowerCase().includes(query) ||
      cap.from.toLowerCase().includes(query) ||
      cap.tags.some((t) => t.toLowerCase().includes(query)) ||
      cap.blocks.some((b) => {
        if ('text' in b.data && typeof b.data.text === 'string') return b.data.text.toLowerCase().includes(query);
        if ('criticism' in b.data && typeof b.data.criticism === 'string') return b.data.criticism.toLowerCase().includes(query);
        return false;
      })
    );
  });

  // Group capsules by folder or virtual category
  const folderGroups: Record<string, CapsuleNode[]> = {};
  for (const cap of filteredCapsules) {
    const folder = cap.tags[0] || 'Uncategorized';
    if (!folderGroups[folder]) folderGroups[folder] = [];
    folderGroups[folder].push(cap);
  }

  const allTags = Array.from(graphState.tagIndex.keys());

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onImportEml(file);
    }
  };

  return (
    <aside className="w-72 sm:w-80 h-full border-r border-slate-800 bg-[#020617] flex flex-col select-none text-xs text-slate-300 shrink-0">
      {/* Vault Info Header */}
      <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-[#0f172a]/20">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 shadow-[0_0_10px_rgba(6,182,212,0.15)]">
            <Folder className="w-4 h-4" />
          </div>
          <div>
            <div className="font-bold text-white tracking-wide text-[11px] uppercase">
              Local .eml Vault
            </div>
            <div className="text-[10px] font-mono text-emerald-400 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>Zero-DB (Pure MIME)</span>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={onCreateNewCapsule}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-semibold transition-all shadow-[0_0_12px_rgba(6,182,212,0.3)] active:scale-95 text-[11px]"
          title="Create New Capsule (.eml)"
        >
          <Plus className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">New .eml</span>
        </button>
      </div>

      {/* Search Bar with CMD + K */}
      <div className="p-3 border-b border-slate-800 space-y-2">
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-500" />
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search capsules & relations..."
            className="w-full bg-slate-900/80 border border-slate-700/80 rounded-md pl-8 pr-14 py-1.5 text-xs text-slate-200 placeholder:text-slate-500 outline-none focus:border-cyan-500/60 focus:ring-1 focus:ring-cyan-500/30 transition-all font-mono"
          />
          <span className="absolute right-2 top-1.5 text-[9px] font-mono text-slate-500 bg-slate-800 px-1.5 py-0.5 rounded border border-slate-700">
            ⌘K
          </span>
        </div>

        {/* Tags filter badges */}
        {allTags.length > 0 && (
          <div className="flex items-center gap-1 overflow-x-auto pt-1 pb-0.5 no-scrollbar">
            <button
              type="button"
              onClick={() => setActiveTag(null)}
              className={`px-2 py-0.5 rounded text-[10px] font-mono shrink-0 transition-all ${
                !activeTag
                  ? 'bg-cyan-500 text-slate-950 font-bold shadow-[0_0_8px_rgba(6,182,212,0.4)]'
                  : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
              }`}
            >
              All
            </button>
            {allTags.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setActiveTag(activeTag === t ? null : t)}
                className={`px-2 py-0.5 rounded text-[10px] font-mono shrink-0 transition-all ${
                  activeTag === t
                    ? 'bg-cyan-500 text-slate-950 font-bold shadow-[0_0_8px_rgba(6,182,212,0.4)]'
                    : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Capsule Tree List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-3">
        {Object.entries(folderGroups).map(([folderName, items]) => {
          const isCollapsed = collapsedFolders[folderName];

          return (
            <div key={folderName} className="space-y-1">
              <button
                type="button"
                onClick={() =>
                  setCollapsedFolders((prev) => ({
                    ...prev,
                    [folderName]: !prev[folderName],
                  }))
                }
                className="w-full flex items-center justify-between px-2 py-1 text-slate-400 hover:text-slate-200 text-[11px] font-mono font-medium"
              >
                <div className="flex items-center gap-1.5">
                  {isCollapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  <span className="uppercase tracking-wider">{folderName}</span>
                </div>
                <span className="text-[10px] text-slate-600">({items.length})</span>
              </button>

              {!isCollapsed && (
                <div className="space-y-1 pl-1">
                  {items.map((cap) => {
                    const isSelected = cap.messageId === selectedMessageId;

                    return (
                      <div
                        key={cap.messageId}
                        onClick={() => onSelectNode(cap.messageId)}
                        className={`group relative flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer transition-all border ${
                          isSelected
                            ? 'bg-cyan-500/10 text-cyan-200 border-cyan-500/40 shadow-[0_0_12px_rgba(6,182,212,0.15)]'
                            : 'hover:bg-slate-900/70 border-transparent text-slate-300 hover:border-slate-800'
                        }`}
                      >
                        <div className="flex-1 min-w-0 pr-2">
                          <div className="flex items-center gap-2">
                            <FileCode
                              className={`w-3.5 h-3.5 shrink-0 ${
                                isSelected ? 'text-cyan-400' : 'text-slate-500'
                              }`}
                            />
                            <span className="font-medium truncate text-xs text-white">
                              {cap.subject}
                            </span>
                          </div>

                          <div className="flex items-center gap-2 mt-0.5 text-[10px] font-mono text-slate-500">
                            <span>{new Date(cap.timestamp).toLocaleDateString()}</span>
                            {cap.inReplyTo && (
                              <span className="text-cyan-400 bg-cyan-950/60 px-1 rounded text-[9px] border border-cyan-800/50">
                                Re:
                              </span>
                            )}
                            <span>{cap.blocks.length} blocks</span>
                          </div>
                        </div>

                        {/* Delete Capsule on hover */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteCapsule(cap.messageId);
                          }}
                          className="opacity-0 group-hover:opacity-100 p-1 text-slate-500 hover:text-rose-400 rounded transition-opacity"
                          title="Delete Capsule"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

        {filteredCapsules.length === 0 && (
          <div className="p-4 text-center text-xs text-slate-600 font-mono">
            No matching capsules
          </div>
        )}
      </div>

      {/* Autonomous Sync Status Card */}
      <div className="mx-3 my-2 p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-[10px] space-y-1">
        <div className="flex items-center justify-between text-emerald-400 font-bold font-mono uppercase tracking-wider">
          <span>Autonomous Sync</span>
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
        </div>
        <p className="text-slate-400 text-[10px] leading-relaxed">
          RFC 5322 Invariant: No external DB. Zero sync drift across devices.
        </p>
      </div>

      {/* Footer Vault Actions */}
      <div className="p-3 border-t border-slate-800 bg-[#0f172a]/40 flex items-center justify-between text-xs font-mono">
        <label className="flex items-center gap-1.5 text-slate-400 hover:text-cyan-300 cursor-pointer p-1 rounded hover:bg-slate-900 transition-colors">
          <Upload className="w-3.5 h-3.5 text-cyan-400" />
          <span>Import .eml</span>
          <input
            type="file"
            accept=".eml,message/rfc822"
            onChange={handleFileUpload}
            className="hidden"
          />
        </label>

        <button
          type="button"
          onClick={onExportVaultZip}
          className="flex items-center gap-1.5 text-slate-400 hover:text-emerald-300 p-1 rounded hover:bg-slate-900 transition-colors"
          title="Export all .eml files as ZIP bundle"
        >
          <Download className="w-3.5 h-3.5 text-emerald-400" />
          <span>Export Vault</span>
        </button>
      </div>
    </aside>
  );
};
