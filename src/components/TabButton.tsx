import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import type { Tab } from '../domain/types';

export function TabButton({
  tab,
  active,
  disabled,
  canClose,
  onActivate,
  onRename,
  onClose,
}: {
  tab: Tab;
  active: boolean;
  disabled: boolean;
  canClose: boolean;
  onActivate: () => void;
  onRename: (name: string) => void;
  onClose: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(tab.name);
  // Si le nom change depuis l'extérieur (autre source) on resync
  useEffect(() => {
    if (!editing) setDraft(tab.name);
  }, [tab.name, editing]);

  const commitName = () => {
    const trimmed = draft.trim() || tab.name;
    onRename(trimmed);
    setEditing(false);
  };

  return (
    <div
      className={`group flex items-center gap-1.5 px-2.5 self-end h-[30px] rounded-t border border-b-0 cursor-pointer transition
        ${
          active
            ? 'bg-white border-stone-300 text-stone-900'
            : 'bg-stone-200/60 border-transparent text-stone-600 hover:bg-stone-200'
        }
        ${disabled && !active ? 'opacity-40 cursor-not-allowed' : ''}`}
      onClick={() => {
        if (!editing) onActivate();
      }}
      onDoubleClick={(e) => {
        e.stopPropagation();
        if (active) setEditing(true);
      }}
      title={editing ? '' : active ? 'Double-cliquer pour renommer' : tab.name}
      style={{ minWidth: '90px', maxWidth: '180px' }}
    >
      {editing ? (
        <input
          type="text"
          value={draft}
          autoFocus
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commitName}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              commitName();
            } else if (e.key === 'Escape') {
              setDraft(tab.name);
              setEditing(false);
            }
            e.stopPropagation();
          }}
          onClick={(e) => e.stopPropagation()}
          className="flex-1 min-w-0 bg-transparent border-b border-stone-400 focus:outline-none text-sm px-1"
          maxLength={32}
        />
      ) : (
        <span className="flex-1 truncate text-sm">{tab.name}</span>
      )}
      {canClose && !disabled && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          className="opacity-0 group-hover:opacity-100 text-stone-400 hover:text-rose-600 transition"
          title="Fermer cet onglet"
        >
          <X size={13} />
        </button>
      )}
    </div>
  );
}
