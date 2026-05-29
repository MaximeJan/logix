import type { ReactNode } from 'react';
import type { TraceSample } from '../domain/types';

const TRACE_MAX_LEN = 100;

export function ChronogramPanel({
  trace,
  enabled,
  onToggle,
  onClear,
}: {
  trace: TraceSample[];
  enabled: boolean;
  onToggle: () => void;
  onClear: () => void;
}) {
  // Reconstruit la liste des signaux à partir du dernier échantillon (l'ordre est
  // stable tant que la structure du circuit ne change pas).
  const lastSample = trace[trace.length - 1];
  const signalsMeta = lastSample?.signals ?? [];

  if (signalsMeta.length === 0) {
    return (
      <div className="space-y-3 text-sm">
        <div className="flex gap-1">
          <button
            onClick={onToggle}
            className={`flex-1 px-2 py-1 text-xs rounded border ${
              enabled
                ? 'bg-stone-800 text-white border-stone-800'
                : 'bg-white text-stone-700 border-stone-300 hover:bg-stone-50'
            }`}
          >
            {enabled ? '⏸ Pause' : '⏵ Reprendre'}
          </button>
          <button
            onClick={onClear}
            className="px-2 py-1 text-xs rounded border border-stone-300 bg-white text-stone-700 hover:bg-stone-50"
          >
            Effacer
          </button>
        </div>
        <p className="text-xs text-stone-500 italic leading-snug">
          Le chronogramme se remplit automatiquement à chaque transition d'horloge. Ajoute une CLOCK
          au circuit et tique-la (manuellement ou en auto) pour voir les signaux s'enregistrer ici.
        </p>
      </div>
    );
  }

  // Géométrie
  const sampleWidth = 24; // largeur d'un échantillon en px
  const rowHeight = 28; // hauteur d'une piste
  const labelWidth = 80; // colonne des labels à gauche
  const padTop = 4;
  const padRight = 8;
  const n = trace.length;
  const svgWidth = labelWidth + n * sampleWidth + padRight;
  const svgHeight = padTop + signalsMeta.length * rowHeight + 4;

  // Helpers de rendu
  const formatValue = (s: { width: number; value: number }) => {
    if (s.width === 1) return String(s.value & 1);
    // Pour les bus : hex compact si large, sinon décimal
    if (s.width > 4) return '0x' + (s.value >>> 0).toString(16).toUpperCase();
    return String(s.value);
  };

  // Trace une piste 1-bit : ligne haute/basse
  const render1Bit = (sigIdx: number, rowY: number) => {
    const path: string[] = [];
    for (let i = 0; i < n; i++) {
      const v = trace[i].signals.find((x) => x.key === signalsMeta[sigIdx].key)?.value ?? 0;
      const x0 = labelWidth + i * sampleWidth;
      const x1 = labelWidth + (i + 1) * sampleWidth;
      const y = rowY + (v ? 4 : rowHeight - 8);
      if (i === 0) {
        path.push(`M ${x0} ${y}`);
      } else {
        // transition verticale si v change
        const prev =
          trace[i - 1].signals.find((x) => x.key === signalsMeta[sigIdx].key)?.value ?? 0;
        if (prev !== v) {
          path.push(`L ${x0} ${rowY + (prev ? 4 : rowHeight - 8)}`);
          path.push(`L ${x0} ${y}`);
        } else {
          path.push(`L ${x0} ${y}`);
        }
      }
      path.push(`L ${x1} ${y}`);
    }
    return (
      <path
        key={signalsMeta[sigIdx].key + '-trace'}
        d={path.join(' ')}
        fill="none"
        stroke="#65a30d"
        strokeWidth="1.5"
      />
    );
  };

  // Trace une piste bus : bandes étiquetées par valeur
  const renderBus = (sigIdx: number, rowY: number) => {
    const elements: ReactNode[] = [];
    let segStart = 0;
    let segValue = trace[0].signals.find((x) => x.key === signalsMeta[sigIdx].key)?.value ?? 0;
    const pushSeg = (start: number, end: number, value: number) => {
      const x = labelWidth + start * sampleWidth;
      const width = (end - start) * sampleWidth;
      elements.push(
        <g key={`${signalsMeta[sigIdx].key}-${start}`}>
          <rect
            x={x}
            y={rowY + 4}
            width={width}
            height={rowHeight - 12}
            fill="#fef3c7"
            stroke="#f59e0b"
            strokeWidth="0.5"
          />
          {width > 18 && (
            <text
              x={x + width / 2}
              y={rowY + rowHeight / 2 + 1}
              textAnchor="middle"
              fontSize="9"
              fontFamily="'IBM Plex Mono', monospace"
              fill="#78350f"
              style={{ userSelect: 'none', pointerEvents: 'none' }}
            >
              {formatValue({ width: signalsMeta[sigIdx].width, value })}
            </text>
          )}
        </g>,
      );
    };
    for (let i = 1; i < n; i++) {
      const v = trace[i].signals.find((x) => x.key === signalsMeta[sigIdx].key)?.value ?? 0;
      if (v !== segValue) {
        pushSeg(segStart, i, segValue);
        segStart = i;
        segValue = v;
      }
    }
    pushSeg(segStart, n, segValue);
    return <g key={signalsMeta[sigIdx].key + '-bus'}>{elements}</g>;
  };

  return (
    <div className="space-y-3 text-sm">
      <div className="flex gap-1">
        <button
          onClick={onToggle}
          className={`flex-1 px-2 py-1 text-xs rounded border ${
            enabled
              ? 'bg-stone-800 text-white border-stone-800'
              : 'bg-white text-stone-700 border-stone-300 hover:bg-stone-50'
          }`}
        >
          {enabled ? '⏸ Pause' : '⏵ Reprendre'}
        </button>
        <button
          onClick={onClear}
          className="px-2 py-1 text-xs rounded border border-stone-300 bg-white text-stone-700 hover:bg-stone-50"
        >
          Effacer
        </button>
      </div>
      <div className="text-[11px] text-stone-500">
        {n} échantillon{n > 1 ? 's' : ''} (max {TRACE_MAX_LEN}). 1 échantillon = 1 transition de
        CLK.
      </div>
      <div className="overflow-x-auto border border-stone-200 rounded bg-white">
        <svg
          width={svgWidth}
          height={svgHeight}
          style={{ minWidth: '100%' }}
          fontFamily="'IBM Plex Mono', monospace"
        >
          {/* Labels + pistes */}
          {signalsMeta.map((sig, sigIdx) => {
            const rowY = padTop + sigIdx * rowHeight;
            return (
              <g key={sig.key}>
                {/* Fond zébré */}
                {sigIdx % 2 === 1 && (
                  <rect x="0" y={rowY} width={svgWidth} height={rowHeight} fill="#fafafa" />
                )}
                {/* Label */}
                <text
                  x="6"
                  y={rowY + rowHeight / 2 + 3}
                  fontSize="9.5"
                  fill="#475569"
                  style={{ userSelect: 'none', pointerEvents: 'none' }}
                >
                  {sig.label.slice(0, 11)}
                </text>
                <text
                  x={labelWidth - 4}
                  y={rowY + rowHeight / 2 + 3}
                  textAnchor="end"
                  fontSize="8"
                  fill="#94a3b8"
                  style={{ userSelect: 'none', pointerEvents: 'none' }}
                >
                  /{sig.width}
                </text>
                {/* Ligne de base */}
                <line
                  x1={labelWidth}
                  y1={rowY + rowHeight - 4}
                  x2={svgWidth - padRight}
                  y2={rowY + rowHeight - 4}
                  stroke="#e5e7eb"
                  strokeWidth="0.5"
                />
                {/* Piste */}
                {sig.width === 1 ? render1Bit(sigIdx, rowY) : renderBus(sigIdx, rowY)}
              </g>
            );
          })}
          {/* Repères verticaux toutes les 5 transitions */}
          {Array.from({ length: Math.floor(n / 5) + 1 }).map((_, i) => {
            const x = labelWidth + i * 5 * sampleWidth;
            return (
              <line
                key={`grid-${i}`}
                x1={x}
                y1={padTop}
                x2={x}
                y2={svgHeight - 4}
                stroke="#e5e7eb"
                strokeWidth="0.5"
                strokeDasharray="2,2"
              />
            );
          })}
        </svg>
      </div>
      <p className="text-[10px] text-stone-400 leading-snug">
        Pistes vertes = 1 bit (ligne haute/basse). Bandes ambrées = bus (valeur affichée).
      </p>
    </div>
  );
}
