import React from 'react';
import { CapsuleBlock, TodoListBlockData, TodoItem } from '../../types';
import { CheckSquare, Plus, Trash2, GripVertical } from 'lucide-react';

interface Props {
  block: CapsuleBlock & { type: 'todo_list' };
  onChange: (updatedData: TodoListBlockData) => void;
  onDelete: () => void;
}

export const TodoBlock: React.FC<Props> = ({ block, onChange, onDelete }) => {
  const items = block.data.items || [];
  const completedCount = items.filter((i) => i.done).length;
  const progress = items.length > 0 ? (completedCount / items.length) * 100 : 0;

  const handleToggle = (id: string) => {
    const updated = items.map((item) =>
      item.id === id ? { ...item, done: !item.done } : item
    );
    onChange({ ...block.data, items: updated });
  };

  const handleTextChange = (id: string, text: string) => {
    const updated = items.map((item) =>
      item.id === id ? { ...item, text } : item
    );
    onChange({ ...block.data, items: updated });
  };

  const handleAddItem = () => {
    const newItem: TodoItem = {
      id: `td_${Date.now().toString(36)}`,
      text: '',
      done: false,
    };
    onChange({ ...block.data, items: [...items, newItem] });
  };

  const handleDeleteItem = (id: string) => {
    const updated = items.filter((item) => item.id !== id);
    onChange({ ...block.data, items: updated });
  };

  return (
    <div className="my-3 rounded-xl border border-slate-800 bg-[#0f172a]/80 p-4 shadow-md group">
      {/* Header */}
      <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-800/80">
        <div className="flex items-center gap-2 flex-1">
          <CheckSquare className="w-4 h-4 text-cyan-400 shrink-0" />
          <input
            type="text"
            value={block.data.title || 'Checklist / Actions'}
            onChange={(e) => onChange({ ...block.data, title: e.target.value })}
            placeholder="Checklist title..."
            className="bg-transparent text-slate-200 font-semibold text-sm outline-none border-none focus:ring-0 w-full"
          />
        </div>

        <div className="flex items-center gap-3">
          <span className="text-[10px] font-mono text-slate-400">
            {completedCount}/{items.length}
          </span>
          <button
            type="button"
            onClick={onDelete}
            className="text-xs text-slate-500 hover:text-rose-400 p-1 rounded hover:bg-slate-800"
            title="Delete checklist"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Progress Bar */}
      {items.length > 0 && (
        <div className="w-full bg-slate-800 h-1 rounded-full mb-3 overflow-hidden">
          <div
            style={{ width: `${progress}%` }}
            className="bg-cyan-500 h-full rounded-full transition-all duration-300 shadow-[0_0_6px_rgba(6,182,212,0.4)]"
          />
        </div>
      )}

      {/* Items */}
      <div className="space-y-1.5">
        {items.map((item) => (
          <div
            key={item.id}
            className="flex items-center gap-2.5 group/item py-1 px-1 rounded-lg hover:bg-slate-800/40"
          >
            <input
              type="checkbox"
              checked={item.done}
              onChange={() => handleToggle(item.id)}
              className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-cyan-500 focus:ring-0 cursor-pointer accent-cyan-500"
            />
            <input
              type="text"
              value={item.text}
              onChange={(e) => handleTextChange(item.id, e.target.value)}
              placeholder="Action item..."
              className={`flex-1 bg-transparent text-xs outline-none border-none focus:ring-0 ${
                item.done ? 'line-through text-slate-500' : 'text-slate-200'
              }`}
            />
            <button
              type="button"
              onClick={() => handleDeleteItem(item.id)}
              className="opacity-0 group-hover/item:opacity-100 p-1 text-slate-600 hover:text-rose-400 rounded transition-opacity"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        ))}
      </div>

      {/* Add Button */}
      <button
        type="button"
        onClick={handleAddItem}
        className="mt-2 text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1.5 py-1 px-2 rounded hover:bg-cyan-950/30 transition-colors font-medium"
      >
        <Plus className="w-3.5 h-3.5" />
        <span>Add item</span>
      </button>
    </div>
  );
};
