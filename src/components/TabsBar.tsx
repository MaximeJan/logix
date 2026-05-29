import { Plus } from 'lucide-react';
import { TabButton } from './TabButton';
import type { Tab } from '../domain/types';

interface TabsBarProps {
  tabs: Tab[];
  activeTabId: string;
  editMode: boolean;
  maxTabs: number;
  onSwitch: (tabId: string) => void;
  onRename: (tabId: string, name: string) => void;
  onClose: (tabId: string) => void;
  onAdd: () => void;
}

// Barre d'onglets (zones de travail). Masquée pendant l'édition d'un composant
// custom : l'onglet actif y est temporairement squatté par le sous-circuit, donc
// montrer les autres onglets serait trompeur (le banner ambré d'édition prend le relais).
export function TabsBar({
  tabs,
  activeTabId,
  editMode,
  maxTabs,
  onSwitch,
  onRename,
  onClose,
  onAdd,
}: TabsBarProps) {
  if (editMode) return null;
  return (
    <div
      className="flex items-stretch bg-stone-100 border-b border-stone-200 px-2 select-none"
      style={{ minHeight: '34px' }}
    >
      <div
        className="flex items-stretch gap-0.5 overflow-x-auto"
        style={{ scrollbarWidth: 'thin' }}
      >
        {tabs.map((tab) => (
          <TabButton
            key={tab.id}
            tab={tab}
            active={tab.id === activeTabId}
            disabled={false}
            canClose={tabs.length > 1}
            onActivate={() => onSwitch(tab.id)}
            onRename={(name) => onRename(tab.id, name)}
            onClose={() => onClose(tab.id)}
          />
        ))}
      </div>
      <button
        onClick={onAdd}
        disabled={tabs.length >= maxTabs}
        className="ml-1 flex items-center justify-center w-7 h-7 self-center rounded text-stone-600 hover:bg-stone-200 disabled:opacity-30 disabled:cursor-not-allowed"
        title={tabs.length >= maxTabs ? `Maximum ${maxTabs} onglets` : 'Nouvel onglet'}
      >
        <Plus size={16} />
      </button>
      <div className="flex-1" />
      <div className="self-center text-[11px] text-stone-400 pr-2">
        {tabs.length} / {maxTabs}
      </div>
    </div>
  );
}
