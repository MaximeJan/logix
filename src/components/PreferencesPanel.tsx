import { ColorRow } from './ui';
import { DEFAULT_PREFS, type GridStyle, type Prefs } from '../lib/constants';

// Panneau Apparence : couleurs, épaisseurs, fond du canevas, style de grille.
export function PreferencesPanel({
  prefs,
  onChange,
}: {
  prefs: Prefs;
  onChange: (prefs: Prefs) => void;
}) {
  const update = <K extends keyof Prefs>(k: K, v: Prefs[K]) => onChange({ ...prefs, [k]: v });
  const reset = () => onChange({ ...DEFAULT_PREFS });
  const gridOptions: { v: GridStyle; label: string }[] = [
    { v: 'dots', label: 'Points' },
    { v: 'lines', label: 'Lignes' },
    { v: 'off', label: 'Aucune' },
  ];
  return (
    <div className="space-y-4 text-sm">
      <div>
        <div className="text-xs font-semibold text-stone-500 uppercase tracking-wider mb-2">
          Fils
        </div>
        <div className="space-y-2">
          <ColorRow
            label="Actif (1)"
            value={prefs.wireOnColor}
            onChange={(v) => update('wireOnColor', v)}
          />
          <ColorRow
            label="Inactif (0)"
            value={prefs.wireOffColor}
            onChange={(v) => update('wireOffColor', v)}
          />
          <div className="flex items-center justify-between">
            <span className="text-xs text-stone-600">Épaisseur</span>
            <select
              value={prefs.wireWidth}
              onChange={(e) => update('wireWidth', Number(e.target.value))}
              className="text-xs px-2 py-1 border border-stone-300 rounded bg-white"
            >
              <option value={1.5}>Fin</option>
              <option value={2}>Normal</option>
              <option value={2.5}>Épais</option>
              <option value={3}>Très épais</option>
            </select>
          </div>
        </div>
      </div>

      <div>
        <div className="text-xs font-semibold text-stone-500 uppercase tracking-wider mb-2">
          Bus (nappes)
        </div>
        <div className="space-y-2">
          <ColorRow
            label="Bit éteint (0)"
            value={prefs.busOffColor ?? '#0f172a'}
            onChange={(v) => update('busOffColor', v)}
          />
          <div className="flex items-center justify-between">
            <span className="text-xs text-stone-600">Épaisseur d'un bit</span>
            <select
              value={prefs.busBitStroke ?? 2.5}
              onChange={(e) => update('busBitStroke', Number(e.target.value))}
              className="text-xs px-2 py-1 border border-stone-300 rounded bg-white"
            >
              <option value={1.5}>Fine</option>
              <option value={2}>Moyenne</option>
              <option value={2.5}>Épaisse</option>
              <option value={3.5}>Très épaisse</option>
            </select>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-stone-600">Espacement</span>
            <select
              value={prefs.busBitGap ?? 1.2}
              onChange={(e) => update('busBitGap', Number(e.target.value))}
              className="text-xs px-2 py-1 border border-stone-300 rounded bg-white"
            >
              <option value={0.4}>Serré</option>
              <option value={0.8}>Normal</option>
              <option value={1.2}>Aéré</option>
              <option value={2}>Large</option>
            </select>
          </div>
          <p className="text-[11px] text-stone-500 leading-snug">
            Un bus de N bits est dessiné avec N pistes parallèles côte à côte. Le bit le plus
            significatif (MSB) est à l'extérieur.
          </p>
        </div>
      </div>

      <div>
        <div className="text-xs font-semibold text-stone-500 uppercase tracking-wider mb-2">
          Entrées / Sorties
        </div>
        <div className="space-y-2">
          <ColorRow
            label="Entrée active"
            value={prefs.inputOnColor}
            onChange={(v) => update('inputOnColor', v)}
          />
          <ColorRow
            label="Sortie active"
            value={prefs.outputOnColor}
            onChange={(v) => update('outputOnColor', v)}
          />
        </div>
      </div>

      <div>
        <div className="text-xs font-semibold text-stone-500 uppercase tracking-wider mb-2">
          Afficheur 7 segments
        </div>
        <div className="space-y-2">
          <ColorRow
            label="Segment allumé"
            value={prefs.seg7OnColor ?? '#ef4444'}
            onChange={(v) => update('seg7OnColor', v)}
          />
          <ColorRow
            label="Segment éteint"
            value={prefs.seg7OffColor ?? '#1f2937'}
            onChange={(v) => update('seg7OffColor', v)}
          />
        </div>
      </div>

      <div>
        <div className="text-xs font-semibold text-stone-500 uppercase tracking-wider mb-2">
          Cadre valeur (LCD)
        </div>
        <div className="space-y-2">
          <ColorRow
            label="Bordure"
            value={prefs.lcdBorderColor ?? '#f59e0b'}
            onChange={(v) => update('lcdBorderColor', v)}
          />
          <ColorRow
            label="Fond"
            value={prefs.lcdFillColor ?? '#fffbeb'}
            onChange={(v) => update('lcdFillColor', v)}
          />
          <ColorRow
            label="Texte"
            value={prefs.lcdTextColor ?? '#78350f'}
            onChange={(v) => update('lcdTextColor', v)}
          />
          <p className="text-[11px] text-stone-500 leading-snug">
            Encadre la valeur affichée par les bascules, registres, compteurs, RAM et autres
            composants à mémoire.
          </p>
        </div>
      </div>

      <div>
        <div className="text-xs font-semibold text-stone-500 uppercase tracking-wider mb-2">
          Canevas
        </div>
        <div className="space-y-2">
          <ColorRow label="Fond" value={prefs.canvasBg} onChange={(v) => update('canvasBg', v)} />
          <div className="flex items-center justify-between">
            <span className="text-xs text-stone-600">Grille</span>
            <div className="flex gap-1">
              {gridOptions.map((o) => (
                <button
                  key={o.v}
                  onClick={() => update('gridStyle', o.v)}
                  className={`px-2 py-1 text-xs rounded border transition ${
                    prefs.gridStyle === o.v
                      ? 'bg-stone-800 border-stone-800 text-white'
                      : 'border-stone-300 text-stone-600 hover:border-stone-400'
                  }`}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="pt-2 border-t border-stone-200">
        <button
          onClick={reset}
          className="w-full px-3 py-1.5 text-xs text-stone-600 border border-stone-300 rounded hover:bg-stone-50"
        >
          Réinitialiser les défauts
        </button>
        <p className="text-[11px] text-stone-500 mt-2 leading-relaxed">
          Les préférences d'apparence sont enregistrées localement dans le navigateur (elles ne font
          pas partie des fichiers de circuit exportés).
        </p>
      </div>
    </div>
  );
}
