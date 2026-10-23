import React, { useEffect, useRef, useState } from 'react';
import { CapsuleNode, ScoredSearchHit, VaultGraphState } from '../types';
import { vaultStore } from '../engine/vaultStore';
import { makeSnippet, blockPlainText } from '../engine/textUtils';
import {
  PageTreeItem,
  buildPageTree,
  filterPageTree,
  pageAncestors,
  pageLineage,
} from '../engine/hierarchy';
import { useI18n } from '../i18n';
import {
  Folder,
  FileCode,
  FilePlus,
  Plus,
  Search,
  ChevronRight,
  ChevronDown,
  Trash2,
  Download,
  Upload,
} from 'lucide-react';

interface Props {
  graphState: VaultGraphState;
  selectedMessageId: string | null;
  onSelectNode: (messageId: string) => void;
  onCreateNewCapsule: () => void;
  onCreateChildCapsule: (parentId: string) => void;
  onDeleteCapsule: (messageId: string) => void;
  onImportEml: (file: File) => void;
  onExportVaultZip: () => void;
}

interface PageRowProps {
  capsule: CapsuleNode;
  depth: number;
  selected: boolean;
  hasChildren: boolean;
  collapsed: boolean;
  hit?: ScoredSearchHit;
  query?: string;
  onToggle: () => void;
  onSelect: () => void;
  onCreateChild: () => void;
  onDelete: () => void;
}

const SidebarPageRow: React.FC<PageRowProps> = ({
  capsule,
  depth,
  selected,
  hasChildren,
  collapsed,
  hit,
  query,
  onToggle,
  onSelect,
  onCreateChild,
  onDelete,
}) => {
  const { t } = useI18n();

  return (
    <div
      onClick={onSelect}
      role="treeitem"
      aria-selected={selected}
      aria-expanded={hasChildren ? !collapsed : undefined}
      className={`group relative flex items-center justify-between py-2 pr-2 rounded-lg cursor-pointer transition-all border ${
        selected
          ? 'bg-cyan-500/10 text-cyan-200 border-cyan-500/40 shadow-[0_0_12px_rgba(6,182,212,0.15)]'
          : 'hover:bg-slate-900/70 border-transparent text-slate-300 hover:border-slate-800'
      }`}
      style={{ paddingLeft: 8 + depth * 14 }}
    >
      <div className="flex-1 min-w-0 pr-2">
        <div className="flex items-center gap-1.5">
          {hasChildren ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onToggle();
              }}
              className="p-0.5 text-slate-500 hover:text-cyan-300 rounded shrink-0"
              title={collapsed ? t('sidebar.expand') : t('sidebar.collapse')}
            >
              {collapsed ? (
                <ChevronRight className="w-3 h-3" />
              ) : (
                <ChevronDown className="w-3 h-3" />
              )}
            </button>
          ) : (
            <span className="w-4 shrink-0" />
          )}

          <FileCode
            className={`w-3.5 h-3.5 shrink-0 ${
              selected ? 'text-cyan-400' : 'text-slate-500'
            }`}
          />
          <span className="font-medium truncate text-xs text-white">
            {capsule.subject || t('editor.untitled')}
          </span>
        </div>

        <div className="flex items-center gap-2 mt-0.5 pl-5 text-[10px] font-mono text-slate-500">
          <span>{new Date(capsule.timestamp).toLocaleDateString()}</span>
          {capsule.inReplyTo && (
            <span className="text-cyan-400 bg-cyan-950/60 px-1 rounded text-[9px] border border-cyan-800/50">
              Re:
            </span>
          )}
          <span>{t('sidebar.blocks', { count: capsule.blocks.length })}</span>
          {hit && (
            <span
              className="ml-auto text-cyan-400/80 text-[9px] tabular-nums"
              title={`BM25 relevance: ${hit.score.toFixed(2)} · matched: ${hit.matchedTerms.join(', ')}`}
            >
              Σ{hit.score.toFixed(1)}
            </span>
          )}
        </div>

        {hit && (
          <div className="mt-1 pl-5 text-[10px] leading-snug text-slate-500 line-clamp-2">
            {makeSnippet(
              blockPlainText(capsule.blocks),
              (hit.matchedTerms.length ? hit.matchedTerms : [query || '']).map((term) =>
                term.replace(/^#/, ''),
              ),
              80,
            ).map((seg, i) =>
              seg.hit ? (
                <mark
                  key={i}
                  className="bg-cyan-500/20 text-cyan-200 rounded-[2px] px-0.5"
                >
                  {seg.text}
                </mark>
              ) : (
                <span key={i}>{seg.text}</span>
              ),
            )}
          </div>
        )}
      </div>

      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onCreateChild();
          }}
          className="p-1 text-slate-500 hover:text-cyan-300 rounded"
          title={t('sidebar.newSubpage')}
        >
          <FilePlus className="w-3 h-3" />
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="p-1 text-slate-500 hover:text-rose-400 rounded"
          title={t('sidebar.delete')}
        >
          <Trash2 className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
};

export const VaultSidebar: React.FC<Props> = ({
  graphState,
  selectedMessageId,
  onSelectNode,
  onCreateNewCapsule,
  onCreateChildCapsule,
  onDeleteCapsule,
  onImportEml,
  onExportVaultZip,
}) => {
  const searchInputRef = useRef<HTMLInputElement>(null);
  const { t } = useI18n();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [collapsedPages, setCollapsedPages] = useState<Record<string, boolean>>({});

  const allCapsules: CapsuleNode[] = Array.from(graphState.nodes.values());

  // BM25-ranked full-text search (engine) — results come back sorted by
  // relevance (Okapi BM25 over the inverted index, prefix terms included).
  const searchHits: ScoredSearchHit[] | null = searchQuery.trim()
    ? vaultStore.searchWithScores(searchQuery)
    : null;
  const hitInfo = new Map(searchHits?.map((h) => [h.node.messageId, h]) || []);

  // Tag filter (UI-level) applied on top of the ranked results / page tree
  const tagMatches = (cap: CapsuleNode) => !activeTag || cap.tags.includes(activeTag);

  const filteredCapsules: CapsuleNode[] = (searchHits
    ? searchHits.map((h) => h.node)
    : allCapsules
  ).filter(tagMatches);

  // Search keeps a flat relevance list; browsing uses the wiki page tree.
  // With a tag filter active, matching pages keep their ancestors for context.
  const pageTree = searchHits
    ? []
    : activeTag
    ? filterPageTree(
        buildPageTree(graphState.nodes),
        pageLineage(
          graphState.nodes,
          filteredCapsules.map((cap) => cap.messageId),
        ),
      )
    : buildPageTree(graphState.nodes);

  const allTags = Array.from(graphState.tagIndex.keys());

  // Selecting a deep page must reveal it, even if an ancestor was collapsed.
  useEffect(() => {
    if (!selectedMessageId) return;
    const ancestors = pageAncestors(graphState.nodes, selectedMessageId);
    if (ancestors.length === 0) return;
    setCollapsedPages((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const ancestor of ancestors) {
        if (next[ancestor.messageId]) {
          next[ancestor.messageId] = false;
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [selectedMessageId, graphState.nodes]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onImportEml(file);
    }
  };

  const togglePage = (messageId: string) => {
    setCollapsedPages((prev) => ({ ...prev, [messageId]: !prev[messageId] }));
  };

  const renderTree = (item: PageTreeItem, depth: number): React.ReactNode => {
    const cap = item.node;
    const collapsed = !!collapsedPages[cap.messageId];

    return (
      <div key={cap.messageId}>
        <SidebarPageRow
          capsule={cap}
          depth={depth}
          selected={cap.messageId === selectedMessageId}
          hasChildren={item.children.length > 0}
          collapsed={collapsed}
          onToggle={() => togglePage(cap.messageId)}
          onSelect={() => onSelectNode(cap.messageId)}
          onCreateChild={() => onCreateChildCapsule(cap.messageId)}
          onDelete={() => onDeleteCapsule(cap.messageId)}
        />
        {!collapsed && item.children.length > 0 && (
          <div className="space-y-1">
            {item.children.map((child) => renderTree(child, depth + 1))}
          </div>
        )}
      </div>
    );
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
          title={t('sidebar.newTitle')}
        >
          <Plus className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">{t('sidebar.new')}</span>
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
            placeholder={t('sidebar.searchPlaceholder')}
            title={t('sidebar.searchHint')}
            className="w-full bg-slate-900/80 border border-slate-700/80 rounded-md pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder:text-slate-500 outline-none focus:border-cyan-500/60 focus:ring-1 focus:ring-cyan-500/30 transition-all font-mono"
          />
        </div>

        {/* BM25 relevance indicator */}
        {searchHits && (
          <div className="flex items-center justify-between px-1">
            <span className="text-[10px] font-mono text-cyan-400/90">
              {t('sidebar.searchMeta', { count: searchHits.length })}
            </span>
            <span className="text-[9px] font-mono text-slate-600">
              {t('sidebar.termsIndexed', { count: vaultStore.searchStats().terms })}
            </span>
          </div>
        )}

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
              {t('sidebar.all')}
            </button>
            {allTags.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => setActiveTag(activeTag === tag ? null : tag)}
                className={`px-2 py-0.5 rounded text-[10px] font-mono shrink-0 transition-all ${
                  activeTag === tag
                    ? 'bg-cyan-500 text-slate-950 font-bold shadow-[0_0_8px_rgba(6,182,212,0.4)]'
                    : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
                }`}
              >
                {tag}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Page tree / ranked search list */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        <div className="flex items-center justify-between px-2 py-1 text-slate-500 text-[10px] font-mono uppercase tracking-wider">
          <span>{t('sidebar.pages')}</span>
          <span>{filteredCapsules.length}</span>
        </div>

        {searchHits
          ? filteredCapsules.map((cap) => (
              <SidebarPageRow
                key={cap.messageId}
                capsule={cap}
                depth={0}
                selected={cap.messageId === selectedMessageId}
                hasChildren={false}
                collapsed={false}
                hit={hitInfo.get(cap.messageId)}
                query={searchQuery}
                onToggle={() => undefined}
                onSelect={() => onSelectNode(cap.messageId)}
                onCreateChild={() => onCreateChildCapsule(cap.messageId)}
                onDelete={() => onDeleteCapsule(cap.messageId)}
              />
            ))
          : pageTree.map((item) => renderTree(item, 0))}

        {filteredCapsules.length === 0 && (
          <div className="p-4 text-center text-xs text-slate-600 font-mono">
            {t(allCapsules.length === 0 ? 'sidebar.noPages' : 'sidebar.noMatches')}
          </div>
        )}
      </div>

      {/* Autonomous Sync Status Card */}
      <div className="mx-3 my-2 p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-[10px] space-y-1">
        <div className="flex items-center justify-between text-emerald-400 font-bold font-mono uppercase tracking-wider">
          <span>{t('sidebar.localFirst')}</span>
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
        </div>
        <p className="text-slate-400 text-[10px] leading-relaxed">
          {t('sidebar.localFirstText')}
        </p>
      </div>

      {/* Footer Vault Actions */}
      <div className="p-3 border-t border-slate-800 bg-[#0f172a]/40 flex items-center justify-between text-xs font-mono">
        <label className="flex items-center gap-1.5 text-slate-400 hover:text-cyan-300 cursor-pointer p-1 rounded hover:bg-slate-900 transition-colors">
          <Upload className="w-3.5 h-3.5 text-cyan-400" />
          <span>{t('sidebar.import')}</span>
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
          title={t('sidebar.exportTitle')}
        >
          <Download className="w-3.5 h-3.5 text-emerald-400" />
          <span>{t('sidebar.export')}</span>
        </button>
      </div>
    </aside>
  );
};
