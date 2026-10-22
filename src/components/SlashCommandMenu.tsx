import React, { useState, useEffect, useRef } from 'react';
import { BlockType } from '../types';
import {
  Heading1,
  Heading2,
  Heading3,
  AlignLeft,
  FileSpreadsheet,
  Palette,
  Sparkles,
  Code2,
  Mic,
  Lightbulb,
  CheckSquare,
} from 'lucide-react';
import { useI18n } from '../i18n';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (type: BlockType, extraData?: any, commandId?: string) => void;
  position?: { top: number; left: number };
}

interface CommandItem {
  id: string;
  type: BlockType;
  title: string;
  description: string;
  icon: React.ElementType;
  badge?: string;
  extraData?: any;
}

export const SlashCommandMenu: React.FC<Props> = ({
  isOpen,
  onClose,
  onSelect,
  position,
}) => {
  const [search, setSearch] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const menuRef = useRef<HTMLDivElement>(null);

  const { t } = useI18n();
  const commands: CommandItem[] = [
    {
      id: 'h1',
      type: 'heading',
      title: t('slash.h1'),
      description: t('slash.h1.desc'),
      icon: Heading1,
      extraData: { level: 1, text: '' },
    },
    {
      id: 'h2',
      type: 'heading',
      title: t('slash.h2'),
      description: t('slash.h2.desc'),
      icon: Heading2,
      extraData: { level: 2, text: '' },
    },
    {
      id: 'p',
      type: 'paragraph',
      title: t('slash.paragraph'),
      description: t('slash.paragraph.desc'),
      icon: AlignLeft,
      extraData: { text: '' },
    },
    {
      id: 'task',
      type: 'todo_list',
      title: t('slash.task'),
      description: t('slash.task.desc'),
      icon: CheckSquare,
      badge: '/task',
    },
    {
      id: 'todo',
      type: 'todo_list',
      title: t('slash.todo'),
      description: t('slash.todo.desc'),
      icon: CheckSquare,
      extraData: {
        title: '',
        items: [{ id: `td_${Date.now().toString(36)}`, text: '', done: false, status: 'todo' }],
      },
    },
    {
      id: 'ai_critique',
      type: 'ai_opponent_block',
      title: t('slash.ai'),
      description: t('slash.ai.desc'),
      icon: Sparkles,
      badge: 'Alt+C',
    },
    {
      id: 'datagrid',
      type: 'data_grid_view',
      title: t('slash.data'),
      description: t('slash.data.desc'),
      icon: FileSpreadsheet,
      badge: 'MIME CID',
      extraData: {
        source_cid: `cid:dataset_${Date.now().toString(36)}_csv`,
        view: 'chart',
        chartType: 'bar',
      },
    },
    {
      id: 'whiteboard',
      type: 'interactive_canvas',
      title: t('slash.canvas'),
      description: t('slash.canvas.desc'),
      icon: Palette,
      badge: 'Vector',
      extraData: {
        scene_cid: `cid:whiteboard_${Date.now().toString(36)}_json`,
      },
    },
    {
      id: 'code',
      type: 'code_repl',
      title: t('slash.code'),
      description: t('slash.code.desc'),
      icon: Code2,
      badge: 'Executable',
      extraData: {
        language: 'javascript',
        code: '',
      },
    },
    {
      id: 'audio',
      type: 'audio_note',
      title: t('slash.audio'),
      description: t('slash.audio.desc'),
      icon: Mic,
      badge: 'Voice',
    },
    {
      id: 'callout',
      type: 'callout',
      title: t('slash.callout'),
      description: t('slash.callout.desc'),
      icon: Lightbulb,
      extraData: {
        title: '',
        content: '',
        tone: 'emerald',
      },
    },
  ];

  const filtered = commands.filter(
    (c) =>
      c.title.toLowerCase().includes(search.toLowerCase()) ||
      c.description.toLowerCase().includes(search.toLowerCase()) ||
      c.id.toLowerCase().includes(search.toLowerCase())
  );

  useEffect(() => {
    setSelectedIndex(0);
  }, [search]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % Math.max(1, filtered.length));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + filtered.length) % Math.max(1, filtered.length));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (filtered[selectedIndex]) {
          const item = filtered[selectedIndex];
          onSelect(item.type, item.extraData, item.id);
          onClose();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, filtered, selectedIndex, onSelect, onClose]);

  if (!isOpen) return null;

  return (
    <div
      ref={menuRef}
      className="fixed z-50 w-72 max-h-96 rounded-xl border border-slate-700 bg-[#0f172a]/95 p-2 shadow-2xl shadow-black/80 backdrop-blur-md overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-100"
      style={
        position
          ? { top: `${position.top}px`, left: `${position.left}px` }
          : { top: '35%', left: '50%', transform: 'translate(-50%, -50%)' }
      }
    >
      {/* Search Bar */}
      <div className="px-2 py-1.5 mb-1.5 border-b border-slate-800">
        <input
          type="text"
          autoFocus
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search blocks (/table, /canvas)..."
          className="w-full bg-transparent text-xs text-slate-100 outline-none placeholder:text-slate-500 font-medium"
        />
      </div>

      {/* Commands List */}
      <div className="overflow-y-auto flex-1 space-y-0.5 max-h-72 pr-1">
        {filtered.map((item, idx) => {
          const IconComp = item.icon;
          const isSelected = idx === selectedIndex;

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                onSelect(item.type, item.extraData, item.id);
                onClose();
              }}
              onMouseEnter={() => setSelectedIndex(idx)}
              className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left transition-colors ${
                isSelected ? 'bg-cyan-500/15 text-cyan-200 border border-cyan-500/30' : 'text-slate-300 hover:bg-slate-800/60 border border-transparent'
              }`}
            >
              <div
                className={`p-1.5 rounded-md ${isSelected ? 'bg-cyan-500 text-slate-950' : 'bg-slate-800 text-slate-400'}`}
              >
                <IconComp className="w-3.5 h-3.5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-200 truncate">
                    {item.title}
                  </span>
                  {item.badge && (
                    <span className="text-[10px] font-mono px-1 rounded bg-slate-800 text-slate-400 border border-slate-700">
                      {item.badge}
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-slate-400 truncate">
                  {item.description}
                </div>
              </div>
            </button>
          );
        })}

        {filtered.length === 0 && (
          <div className="p-3 text-center text-xs text-slate-500">
            No commands match your search
          </div>
        )}
      </div>
    </div>
  );
};
