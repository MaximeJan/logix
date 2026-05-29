import { Package, Check } from 'lucide-react';

interface CompPort {
  id: string;
  label?: string;
  name: string;
}

export interface SaveAsCompState {
  name: string;
  inputs: CompPort[];
  outputs: CompPort[];
}

interface SaveAsComponentModalProps {
  state: SaveAsCompState;
  setState: (s: SaveAsCompState) => void;
  editMode: boolean;
  nameExists: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

const MONO = { fontFamily: "'IBM Plex Mono', monospace" } as const;

// Modale d'encapsulation : nomme le composant et chaque port (les Entrée/Sortie
// internes deviennent les ports externes). Sert aussi à terminer l'édition d'une
// définition existante (editMode), auquel cas les libellés changent.
export function SaveAsComponentModal({
  state,
  setState,
  editMode,
  nameExists,
  onClose,
  onConfirm,
}: SaveAsComponentModalProps) {
  const renderPorts = (kind: 'inputs' | 'outputs', title: string) => {
    const ports = state[kind];
    if (ports.length === 0) return null;
    return (
      <div>
        <div className="text-xs font-medium text-stone-500 mb-2">
          {title} ({ports.length})
        </div>
        <div className="space-y-1.5">
          {ports.map((p, i) => (
            <div key={p.id} className="flex items-center gap-2">
              <span className="text-xs text-stone-400 w-6 text-right">{i + 1}.</span>
              <span className="text-xs text-stone-500 w-24 truncate">
                {p.label ? `"${p.label}"` : <em>sans étiquette</em>}
              </span>
              <input
                type="text"
                value={p.name}
                onChange={(e) => {
                  const next = [...ports];
                  next[i] = { ...p, name: e.target.value };
                  setState({ ...state, [kind]: next });
                }}
                className="flex-1 px-2 py-1 border border-stone-300 rounded text-sm"
                style={MONO}
              />
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div
      className="absolute inset-0 bg-black/40 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-xl w-[480px] max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-stone-200 flex items-center gap-2">
          <Package size={18} className="text-amber-600" />
          <h2 className="text-base font-medium">
            {editMode ? "Terminer l'édition" : 'Sauver comme composant'}
          </h2>
        </div>
        <div className="px-5 py-4 space-y-4">
          <div>
            <label className="block text-xs font-medium text-stone-500 mb-1">
              Nom du composant
            </label>
            <input
              type="text"
              value={state.name}
              onChange={(e) => setState({ ...state, name: e.target.value })}
              placeholder="ex. HalfAdder"
              autoFocus
              className="w-full px-3 py-1.5 border border-stone-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-amber-300"
              style={MONO}
            />
            {nameExists && (
              <div className="mt-1 text-xs text-amber-700">
                ⚠ Un composant nommé "{state.name.trim()}" existe déjà — il sera écrasé.
              </div>
            )}
          </div>

          {renderPorts('inputs', "Ports d'entrée")}
          {renderPorts('outputs', 'Ports de sortie')}

          <div className="text-xs text-stone-500 pt-2 border-t border-stone-200">
            Le sous-circuit complet (composants + fils) sera enregistré comme définition. Les
            composants <code>Entrée</code> et <code>Sortie</code> deviennent les ports externes.
          </div>
        </div>

        <div className="px-5 py-3 border-t border-stone-200 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-sm text-stone-600 hover:bg-stone-100 rounded"
          >
            Annuler
          </button>
          <button
            onClick={onConfirm}
            className="px-3 py-1.5 text-sm font-medium bg-amber-600 text-white rounded hover:bg-amber-700 flex items-center gap-1.5"
          >
            <Check size={14} />
            {editMode ? 'Enregistrer les modifications' : 'Créer le composant'}
          </button>
        </div>
      </div>
    </div>
  );
}
