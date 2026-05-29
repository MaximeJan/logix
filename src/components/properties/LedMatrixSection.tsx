import { addrBitsFor } from '../../lib/geometry';
import { asInt } from '../../lib/sim';
import { BusWidthControl } from '../BusWidthControl';
import type { CircuitComponent } from '../../domain/types';
import type { ComponentPatch } from '../PropertiesPanel';

interface Props {
  comp: CircuitComponent;
  onUpdate: (id: string, patch: ComponentPatch) => void;
}

// Section Propriétés de la matrice LED : dimensions (colonnes/lignes) + effacement.
export function LedMatrixSection({ comp, onUpdate }: Props) {
  const id = comp.id;
  const cols = comp.state?.cols ?? 8;
  const rows = comp.state?.rows ?? 8;
  const xWidth = addrBitsFor(cols);
  const yWidth = addrBitsFor(rows);
  const total = cols * rows;

  // Redimensionne pixels en préservant la zone commune (origine en haut-gauche)
  const resizePixels = (newCols: number, newRows: number) => {
    const newTotal = newCols * newRows;
    const next = new Array(newTotal).fill(0);
    const cur = Array.isArray(comp.state?.pixels) ? comp.state.pixels : [];
    const commonRows = Math.min(rows, newRows);
    const commonCols = Math.min(cols, newCols);
    for (let r = 0; r < commonRows; r++) {
      for (let c = 0; c < commonCols; c++) {
        next[r * newCols + c] = asInt(cur[r * cols + c] ?? 0);
      }
    }
    return next;
  };

  const clearMatrix = () => {
    onUpdate(id, { state: { ...(comp.state ?? {}), pixels: new Array(total).fill(0) } });
  };

  return (
    <div className="pt-2 border-t border-stone-200 space-y-2">
      <div className="text-[11px] text-stone-500 leading-snug">
        Matrice{' '}
        <strong>
          {cols}×{rows}
        </strong>{' '}
        ({total} pixels, X sur {xWidth} bit{xWidth > 1 ? 's' : ''}, Y sur {yWidth} bit
        {yWidth > 1 ? 's' : ''}). Écriture sur <strong>front montant</strong> de CLK si WE = 1 :
        pixel à la position (X, Y) ← D. RST = 1 efface toute la matrice.
      </div>
      <div>
        <label className="text-stone-500 block mb-1">Colonnes (1-16)</label>
        <BusWidthControl
          value={cols}
          min={1}
          max={16}
          onChange={(newCols) => {
            onUpdate(id, {
              state: {
                ...(comp.state ?? {}),
                cols: newCols,
                pixels: resizePixels(newCols, rows),
              },
              _dropMismatchedWires: true,
            });
          }}
        />
      </div>
      <div>
        <label className="text-stone-500 block mb-1">Lignes (1-16)</label>
        <BusWidthControl
          value={rows}
          min={1}
          max={16}
          onChange={(newRows) => {
            onUpdate(id, {
              state: {
                ...(comp.state ?? {}),
                rows: newRows,
                pixels: resizePixels(cols, newRows),
              },
              _dropMismatchedWires: true,
            });
          }}
        />
      </div>
      <button
        onClick={clearMatrix}
        className="w-full text-xs px-2 py-1 rounded border border-stone-300 bg-white text-stone-700 hover:bg-stone-50"
      >
        Effacer la matrice
      </button>
      <p className="text-[10px] text-stone-400 leading-snug">
        Couleur du pixel allumé reprend la couleur des entrées (Apparence → Entrée active).
      </p>
    </div>
  );
}
