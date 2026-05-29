import { getDef } from '../gates/registry';
import type { CircuitComponent } from '../domain/types';

interface PaletteDragGhostProps {
  paletteDrag: { type: string; mouseX: number; mouseY: number; didMove?: boolean } | null;
  customDefs: Record<string, unknown> | null | undefined;
}

// Aperçu fantôme qui suit le curseur pendant un glisser depuis la palette. Adapte
// la fenêtre au gabarit réel pour les composants à géométrie dynamique (bus,
// SPLITTER/MERGER) et les composants personnalisés.
export function PaletteDragGhost({ paletteDrag, customDefs }: PaletteDragGhostProps) {
  if (!paletteDrag?.didMove) return null;
  const ghostDef = getDef(paletteDrag.type, customDefs ?? null);
  if (!ghostDef) return null;
  const adapt = !!ghostDef.isCustom || ghostDef.w > 60 || ghostDef.h > 40;
  const vb = adapt ? `-5 -5 ${ghostDef.w + 10} ${ghostDef.h + 10}` : '-5 -8 80 56';
  return (
    <div
      style={{
        position: 'fixed',
        left: paletteDrag.mouseX,
        top: paletteDrag.mouseY,
        transform: 'translate(-50%, -50%)',
        pointerEvents: 'none',
        zIndex: 1000,
        opacity: 0.75,
        filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.15))',
      }}
    >
      <svg
        width={adapt ? ghostDef.w + 10 : 80}
        height={adapt ? ghostDef.h + 10 : 56}
        viewBox={vb}
        style={{ overflow: 'visible' }}
      >
        <g
          stroke="#1f2937"
          strokeWidth={1.5}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {ghostDef.shape?.({ state: ghostDef.defaultState } as CircuitComponent, 0, 0)}
        </g>
      </svg>
    </div>
  );
}
