import { Table2, Activity, X } from 'lucide-react';
import { PropertiesPanel, type ComponentPatch } from './PropertiesPanel';
import { TruthTablePanel } from './TruthTablePanel';
import { ChronogramPanel } from './ChronogramPanel';
import { PreferencesPanel } from './PreferencesPanel';
import type { Circuit, Selection, SimResult, TraceSample } from '../domain/types';
import type { Prefs } from '../lib/constants';

const SEQ = new Set(['DFF', 'REG', 'COUNTER', 'RAM', 'SRLATCH', 'CLOCK']);
const COMB = new Set([
  'AND',
  'OR',
  'NOT',
  'NAND',
  'NOR',
  'XOR',
  'MUX',
  'DEMUX',
  'DECODER',
  'ADDER',
  'SPLITTER',
  'MERGER',
]);

interface RightPanelProps {
  mode: string | null;
  circuit: Circuit;
  selection: Selection;
  sim: SimResult;
  onUpdate: (id: string, patch: ComponentPatch) => void;
  trace: TraceSample[];
  traceEnabled: boolean;
  onToggleTrace: () => void;
  onClearTrace: () => void;
  prefs: Prefs;
  onChangePrefs: (p: Prefs) => void;
  onSetMode: (mode: string | null) => void;
}

// Panneau de droite contextuel, en overlay sur le bord du canevas (n'altère pas la
// taille du SVG). Onglets selon la sélection : Table pour les combinatoires, Chrono
// pour les séquentiels ; « Apparence » est la seule vue globale. Replié si mode null.
export function RightPanel({
  mode,
  circuit,
  selection,
  sim,
  onUpdate,
  trace,
  traceEnabled,
  onToggleTrace,
  onClearTrace,
  prefs,
  onChangePrefs,
  onSetMode,
}: RightPanelProps) {
  if (!mode) return null;

  const selComp =
    selection.components.length === 1
      ? circuit.components.find((c) => c.id === selection.components[0])
      : null;
  const extraTab =
    selComp && SEQ.has(selComp.type)
      ? 'chronogram'
      : selComp && COMB.has(selComp.type)
        ? 'truthtable'
        : null;
  const isPrefs = mode === 'preferences';
  const compTabs = ['properties', ...(extraTab ? [extraTab] : [])];
  const activeView = isPrefs ? 'preferences' : compTabs.includes(mode) ? mode : 'properties';
  const tabLabel = (t: string) =>
    t === 'properties' ? 'Propriétés' : t === 'truthtable' ? 'Table' : 'Chrono';
  const tabIcon = (t: string) =>
    t === 'truthtable' ? <Table2 size={12} /> : t === 'chronogram' ? <Activity size={12} /> : null;

  return (
    <div className="absolute top-0 right-0 bottom-0 w-72 bg-white border-l border-stone-200 flex flex-col shadow-lg z-30">
      {isPrefs ? (
        <div className="flex items-center justify-between border-b border-stone-200 px-3 py-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-stone-600">
            Apparence
          </span>
          <button
            onClick={() => onSetMode(null)}
            title="Replier le panneau"
            className="text-stone-400 hover:text-stone-700"
          >
            <X size={15} />
          </button>
        </div>
      ) : (
        <div className="flex items-stretch border-b border-stone-200">
          {compTabs.map((t) => (
            <button
              key={t}
              onClick={() => onSetMode(t)}
              className={`flex-1 px-1 py-2 text-xs font-medium border-b-2 flex items-center justify-center gap-1 min-w-0 ${
                activeView === t
                  ? 'border-amber-500 text-stone-800'
                  : 'border-transparent text-stone-500 hover:text-stone-700'
              }`}
            >
              {tabIcon(t)}
              {tabLabel(t)}
            </button>
          ))}
          <button
            onClick={() => onSetMode(null)}
            title="Replier le panneau"
            className="px-2 border-b-2 border-transparent text-stone-400 hover:text-stone-700"
          >
            <X size={15} />
          </button>
        </div>
      )}
      <div className="flex-1 overflow-y-auto p-3">
        {activeView === 'properties' && (
          <PropertiesPanel circuit={circuit} selection={selection} onUpdate={onUpdate} sim={sim} />
        )}
        {activeView === 'truthtable' && <TruthTablePanel circuit={circuit} />}
        {activeView === 'chronogram' && (
          <ChronogramPanel
            trace={trace}
            enabled={traceEnabled}
            onToggle={onToggleTrace}
            onClear={onClearTrace}
          />
        )}
        {activeView === 'preferences' && (
          <PreferencesPanel prefs={prefs} onChange={onChangePrefs} />
        )}
      </div>

      <div
        className="p-2 border-t border-stone-200 text-[11px] text-stone-500 flex justify-between"
        style={{ fontFamily: "'IBM Plex Mono', monospace" }}
      >
        <span>{circuit.components.length} comp.</span>
        <span>{circuit.wires.length} fils</span>
        <span>{selection.components.length + selection.wires.length} sél.</span>
      </div>
    </div>
  );
}
