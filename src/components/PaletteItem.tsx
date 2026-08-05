import type { MouseEvent as ReactMouseEvent } from 'react';
import { getDef } from '../gates/registry';
import { HoverTooltip } from './HoverTooltip';
import type { CircuitComponent } from '../domain/types';

export function PaletteItem({
  type,
  onMouseDown,
  picked,
  customDefs,
  onEdit,
  onDelete,
  compact,
}: {
  type: string;
  onMouseDown: (e: ReactMouseEvent, type: string) => void;
  picked: boolean;
  customDefs: Record<string, unknown> | null | undefined;
  onEdit?: (type: string) => void;
  onDelete?: (type: string) => void;
  /** Variante deux fois plus petite (panneau d'exercice en iframe). */
  compact?: boolean;
}) {
  const def = getDef(type, customDefs ?? null);
  if (!def) return null;
  const isCustom = !!def.isCustom;
  // ViewBox adapté à la taille réelle (utile pour SPLITTER/MERGER et les composants custom).
  const needsDynamic = isCustom || def.w > 60 || def.h > 40;
  const viewBox = needsDynamic ? `-3 -3 ${def.w + 6} ${def.h + 6}` : '-3 -2 70 44';
  const previewMaxH = compact ? 28 : 56;
  const baseH = compact ? 22 : 44;
  const svgH = needsDynamic ? Math.min(previewMaxH, def.h + 6) : baseH;
  const svgW = needsDynamic ? Math.round((def.w + 6) * (svgH / (def.h + 6))) : compact ? 33 : 66;
  return (
    <div className="relative group">
      <HoverTooltip text={def.label as string} onlyIfTruncated>
        <button
          onMouseDown={(e) => onMouseDown(e, type)}
          className={`w-full flex items-center rounded-lg border transition select-none
            ${compact ? 'gap-1.5 px-1.5 py-0.5' : 'gap-3 px-3 py-2'}
            ${
              picked
                ? 'border-amber-500 bg-amber-50'
                : 'border-stone-200 bg-white hover:border-stone-400 hover:bg-stone-50'
            }`}
          style={{ fontFamily: "'IBM Plex Sans', sans-serif", cursor: 'grab' }}
        >
          <svg
            width={svgW}
            height={svgH}
            viewBox={viewBox}
            className="shrink-0 pointer-events-none"
          >
            <g
              stroke="#1f2937"
              strokeWidth={1.5}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              {def.shape?.({ state: def.defaultState } as CircuitComponent, 0, 0)}
            </g>
          </svg>
          <span
            data-truncate
            className={`font-medium text-stone-700 truncate min-w-0 ${
              compact ? 'text-[10px]' : 'text-sm'
            }`}
          >
            {def.label as string}
          </span>
        </button>
      </HoverTooltip>
      {/* Boutons Édit/Suppr pour les composants personnalisés */}
      {isCustom && (onEdit || onDelete) && (
        <div className="absolute right-1 top-1/2 -translate-y-1/2 flex gap-0.5 opacity-0 group-hover:opacity-100 transition pointer-events-none group-hover:pointer-events-auto">
          {onEdit && (
            <button
              onMouseDown={(e) => {
                e.stopPropagation();
                e.preventDefault();
              }}
              onClick={(e) => {
                e.stopPropagation();
                onEdit(type);
              }}
              className="w-6 h-6 flex items-center justify-center bg-white rounded shadow-sm border border-stone-200 hover:bg-amber-50"
              title="Éditer la définition"
            >
              <svg
                width="11"
                height="11"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
            </button>
          )}
          {onDelete && (
            <button
              onMouseDown={(e) => {
                e.stopPropagation();
                e.preventDefault();
              }}
              onClick={(e) => {
                e.stopPropagation();
                onDelete(type);
              }}
              className="w-6 h-6 flex items-center justify-center bg-white rounded shadow-sm border border-stone-200 hover:bg-rose-50 text-rose-600"
              title="Supprimer la définition"
            >
              <svg
                width="11"
                height="11"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6" />
              </svg>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
