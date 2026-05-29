import type { MouseEvent as ReactMouseEvent } from 'react';
import { GATES } from '../gates';
import { getDef, typeReferences } from '../gates/registry';
import { PALETTE_ORDER } from '../lib/constants';
import { PaletteItem } from './PaletteItem';

interface PalettePanelProps {
  onPaletteMouseDown: (e: ReactMouseEvent, type: string) => void;
  placeType: string | null;
  customDefs: Record<string, unknown> | null | undefined;
  editMode: { definitionName: string } | null;
  onEditDefinition: (type: string) => void;
  onDeleteDefinition: (type: string) => void;
  onCancelPlace: () => void;
}

// Palette des composants disponibles, groupés par catégorie (E/S, Portes, Bus,
// Arithmétique, Séquentiel) + section des composants personnalisés. En mode édition,
// masque les définitions qui créeraient une récursion. Un indice de placement
// s'affiche en bas tant qu'un type est « armé » (placeType).
export function PalettePanel({
  onPaletteMouseDown,
  placeType,
  customDefs,
  editMode,
  onEditDefinition,
  onDeleteDefinition,
  onCancelPlace,
}: PalettePanelProps) {
  const items = (category: string) =>
    PALETTE_ORDER.filter((t) => GATES[t]?.category === category).map((t) => (
      <PaletteItem
        key={t}
        type={t}
        onMouseDown={onPaletteMouseDown}
        picked={placeType === t}
        customDefs={customDefs}
      />
    ));

  const customNames = Object.keys(customDefs ?? {}).sort();
  const filteredCustom = customNames.filter(
    (n) =>
      !editMode ||
      !typeReferences(
        n,
        customDefs as Parameters<typeof typeReferences>[1],
        editMode.definitionName,
      ),
  );
  const placeDef = placeType ? getDef(placeType, customDefs ?? null) : null;

  return (
    <div className="w-52 bg-white border-r border-stone-200 p-3 overflow-y-auto">
      <div className="text-xs font-semibold text-stone-500 uppercase tracking-wider mb-2">E/S</div>
      <div className="space-y-1.5 mb-4">{items('E/S')}</div>

      <div className="text-xs font-semibold text-stone-500 uppercase tracking-wider mb-2">
        Portes logiques
      </div>
      <div className="space-y-1.5">{items('Portes')}</div>

      <div className="mt-4 text-xs font-semibold text-stone-500 uppercase tracking-wider mb-2">
        Bus
      </div>
      <div className="space-y-1.5">{items('Bus')}</div>

      <div className="mt-4 text-xs font-semibold text-stone-500 uppercase tracking-wider mb-2">
        Arithmétique
      </div>
      <div className="space-y-1.5">{items('Arithmétique')}</div>

      <div className="mt-4 text-xs font-semibold text-stone-500 uppercase tracking-wider mb-2">
        Séquentiel
      </div>
      <div className="space-y-1.5">{items('Séquentiel')}</div>

      {filteredCustom.length > 0 && (
        <>
          <div className="mt-4 text-xs font-semibold text-stone-500 uppercase tracking-wider mb-2">
            Composants personnalisés
          </div>
          <div className="space-y-1.5">
            {filteredCustom.map((name) => (
              <PaletteItem
                key={name}
                type={name}
                onMouseDown={onPaletteMouseDown}
                picked={placeType === name}
                customDefs={customDefs}
                onEdit={editMode ? undefined : onEditDefinition}
                onDelete={editMode ? undefined : onDeleteDefinition}
              />
            ))}
          </div>
        </>
      )}

      {placeType && (
        <div className="mt-3 p-2 text-xs bg-amber-50 border border-amber-200 rounded">
          Cliquez sur la zone de travail pour placer{' '}
          <strong>{(placeDef?.label as string) ?? placeType}</strong>.
          <button onClick={onCancelPlace} className="block mt-1 text-amber-700 hover:underline">
            Annuler (Esc)
          </button>
        </div>
      )}
    </div>
  );
}
