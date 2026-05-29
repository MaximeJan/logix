// Définitions de composants — catégorie « arith ». Agrégées dans ./index.
import { asInt, maskTo } from '../lib/sim';
import { formatBitsGrouped } from '../lib/bits';
import { widthForBits } from '../lib/geometry';
import { UprightText } from './UprightText';
import type { GateDef } from './types';

export const arithGates: Record<string, GateDef> = {
  ADDER: {
    label: 'Additionneur',
    category: 'Arithmétique',
    w: 140,
    h: 92, // recalculé dynamiquement
    inputs: [],
    outputs: [],
    // width : largeur 1..32. Composant purement combinatoire :
    // S = (A + B + Cin) mod 2^width, Cout = retenue sortante.
    defaultState: { width: 4 },
    getDynamicGeometry: (comp) => {
      const width = comp?.state?.width ?? 4;
      const w = widthForBits(width, { minW: 168, portMargin: 36 });
      const h = 92;
      return {
        w,
        h,
        inputs: [
          { name: 'A', x: 0, y: 24, width },
          { name: 'B', x: 0, y: 46, width },
          { name: 'Cin', x: 0, y: 68, width: 1 },
        ],
        outputs: [
          { name: 'S', x: w, y: 34, width },
          { name: 'Cout', x: w, y: 64, width: 1 },
        ],
      };
    },
    shape: (comp, outputValue, _i, _ibn, angle) => {
      const width = comp?.state?.width ?? 4;
      const s = maskTo(width, asInt(outputValue));
      const w = widthForBits(width, { minW: 168, portMargin: 36 });
      const h = 92;
      const valText = width === 1 ? String(s) : formatBitsGrouped(s, width);
      const midX = w / 2;
      const lcdW = Math.max(30, valText.length * 9 + 14);
      const lcdH = 22;
      const lcdX = midX - lcdW / 2;
      const lcdY = 46;
      return (
        <>
          {/* Stubs entrées */}
          <line x1="0" y1="24" x2="14" y2="24" strokeWidth="1.2" />
          <line x1="0" y1="46" x2="14" y2="46" strokeWidth="1.2" />
          <line x1="0" y1="68" x2="14" y2="68" strokeWidth="1.2" />
          {/* Stubs sorties */}
          <line x1={w - 14} y1="34" x2={w} y2="34" strokeWidth="1.2" />
          <line x1={w - 14} y1="64" x2={w} y2="64" strokeWidth="1.2" />
          {/* Cercles aux entrées */}
          <circle cx="2.5" cy="24" r="2.5" fill="white" strokeWidth="1.2" />
          <circle cx="2.5" cy="46" r="2.5" fill="white" strokeWidth="1.2" />
          <circle cx="2.5" cy="68" r="2.5" fill="white" strokeWidth="1.2" />
          {/* Disques aux sorties */}
          <circle
            cx={w - 2.5}
            cy="34"
            r="3"
            fill={s ? 'var(--lcd-text, #fbbf24)' : '#1f2937'}
            stroke="#1f2937"
            strokeWidth="1"
          />
          <circle cx={w - 2.5} cy="64" r="3" fill="#1f2937" stroke="#1f2937" strokeWidth="1" />
          {/* Boîtier */}
          <rect
            x="14"
            y="10"
            width={w - 28}
            height={h - 20}
            fill="white"
            stroke="#0f172a"
            strokeWidth="2"
          />
          {/* Cadre LED (centré, sous le « + ») */}
          <rect
            x={lcdX}
            y={lcdY}
            width={lcdW}
            height={lcdH}
            rx="2"
            fill="var(--lcd-fill, #0f172a)"
            stroke="var(--lcd-border, #0f172a)"
            strokeWidth="1"
          />
          <g stroke="none">
            {/* Labels des entrées (gauche) */}
            <UprightText
              angle={angle}
              x="20"
              y="29"
              fontSize="14"
              fontWeight="700"
              fontFamily="'IBM Plex Mono', monospace"
              fill="#1f2937"
              style={{ userSelect: 'none', pointerEvents: 'none' }}
            >
              A
            </UprightText>
            <UprightText
              angle={angle}
              x="20"
              y="51"
              fontSize="14"
              fontWeight="700"
              fontFamily="'IBM Plex Mono', monospace"
              fill="#1f2937"
              style={{ userSelect: 'none', pointerEvents: 'none' }}
            >
              B
            </UprightText>
            <UprightText
              angle={angle}
              x="20"
              y="72"
              fontSize="11"
              fontWeight="700"
              fontFamily="'IBM Plex Mono', monospace"
              fill="#1f2937"
              style={{ userSelect: 'none', pointerEvents: 'none' }}
            >
              Cin
            </UprightText>
            {/* Labels des sorties (droite, collés au bord, hors du LCD) */}
            <UprightText
              angle={angle}
              x={w - 16}
              y="39"
              textAnchor="end"
              fontSize="14"
              fontWeight="700"
              fontFamily="'IBM Plex Mono', monospace"
              fill="#1f2937"
              style={{ userSelect: 'none', pointerEvents: 'none' }}
            >
              S
            </UprightText>
            <UprightText
              angle={angle}
              x={w - 16}
              y="69"
              textAnchor="end"
              fontSize="11"
              fontWeight="700"
              fontFamily="'IBM Plex Mono', monospace"
              fill="#1f2937"
              style={{ userSelect: 'none', pointerEvents: 'none' }}
            >
              Cout
            </UprightText>
            {/* Symbole « + » au-dessus du contenu */}
            <UprightText
              angle={angle}
              x={midX}
              y="33"
              textAnchor="middle"
              fontSize="17"
              fontWeight="700"
              fontFamily="'IBM Plex Mono', monospace"
              fill="#1f2937"
              style={{ userSelect: 'none', pointerEvents: 'none' }}
            >
              +
            </UprightText>
            {/* Valeur de la somme dans le LCD */}
            <UprightText
              angle={angle}
              x={midX}
              y={lcdY + lcdH / 2 + 5}
              textAnchor="middle"
              fontSize={width === 1 ? 16 : 13}
              fontWeight="700"
              fontFamily="'IBM Plex Mono', monospace"
              fill="var(--lcd-text, #fbbf24)"
              style={{ userSelect: 'none', pointerEvents: 'none' }}
            >
              {valText}
            </UprightText>
          </g>
        </>
      );
    },
  },
};
