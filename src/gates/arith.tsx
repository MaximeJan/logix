// Définitions de composants — catégorie « arith ». Agrégées dans ./index.
import type { CircuitComponent } from '../domain/types';
import { asInt, maskTo } from '../lib/sim';
import { formatBitsGrouped } from '../lib/bits';
import { rectLayout } from './rectLayout';
import { RectShape } from './RectShape';
import type { GateDef } from './types';

const LCD_FILL = 'var(--lcd-fill, #0f172a)';
const LCD_BORDER = 'var(--lcd-border, #0f172a)';
const LCD_TEXT = 'var(--lcd-text, #fbbf24)';
const NO_SEL = { userSelect: 'none' as const, pointerEvents: 'none' as const };

function adderLayout(comp?: CircuitComponent) {
  const width = comp?.state?.width ?? 4;
  const fmtLen = formatBitsGrouped(0, width).length;
  const contentW = Math.max(46, fmtLen * 9 + 14);
  return rectLayout({
    orientation: comp?.state?.orientation,
    inputs: [
      { name: 'A', label: 'A', width },
      { name: 'B', label: 'B', width },
      { name: 'Cin', label: 'Cin', width: 1 },
    ],
    outputs: [
      { name: 'S', label: 'S', width },
      { name: 'Cout', label: 'Cout', width: 1 },
    ],
    contentW,
    contentH: 44, // « + » (16) + cadre LED (28)
    inMargin: 28,
    outMargin: 34,
  });
}

// Additionneur complet : la brique 1-bit fondamentale (trois 1-bit → deux 1-bit).
// Boîte à dessin fixe, sans afficheur ; c'est le symbole « + » et les libellés de
// ports (A, B, Cin, S, Cout) qui la décrivent.
function fullAdderLayout(comp?: CircuitComponent) {
  return rectLayout({
    orientation: comp?.state?.orientation,
    inputs: [
      { name: 'A', label: 'A', width: 1 },
      { name: 'B', label: 'B', width: 1 },
      { name: 'Cin', label: 'Cin', width: 1 },
    ],
    outputs: [
      { name: 'S', label: 'S', width: 1 },
      { name: 'Cout', label: 'Cout', width: 1 },
    ],
    contentW: 24,
    contentH: 22,
    inMargin: 28,
    outMargin: 34,
  });
}

export const arithGates: Record<string, GateDef> = {
  FULLADDER: {
    label: 'Additionneur complet',
    category: 'Arithmétique',
    w: 114,
    h: 100,
    inputs: [],
    outputs: [],
    fixedDisplay: true,
    // Brique 1-bit, purement combinatoire :
    //   S    = A ⊕ B ⊕ Cin
    //   Cout = (A·B) + (Cin·(A ⊕ B))   (majorité de A, B, Cin)
    defaultState: {},
    fn: (ins) => {
      const a = asInt(ins[0]) & 1;
      const b = asInt(ins[1]) & 1;
      const cin = asInt(ins[2]) & 1;
      const s = a ^ b ^ cin;
      const cout = (a & b) | (cin & (a ^ b));
      return [s, cout];
    },
    getDynamicGeometry: (comp) => {
      const L = fullAdderLayout(comp);
      return { w: L.w, h: L.h, inputs: L.inputs, outputs: L.outputs };
    },
    shape: (comp) => {
      const L = fullAdderLayout(comp);
      const { content } = L;
      return (
        <RectShape layout={L}>
          <text
            x={content.x + content.w / 2}
            y={content.y + content.h / 2 + 6}
            textAnchor="middle"
            fontSize="18"
            fontWeight="700"
            fontFamily="'IBM Plex Mono', monospace"
            fill="#1f2937"
            style={NO_SEL}
          >
            +
          </text>
        </RectShape>
      );
    },
  },
  ADDER: {
    label: 'Additionneur',
    category: 'Arithmétique',
    w: 140,
    h: 92,
    inputs: [],
    outputs: [],
    fixedDisplay: true,
    // width : largeur 1..32. Composant purement combinatoire :
    // S = (A + B + Cin) mod 2^width, Cout = retenue sortante.
    defaultState: { width: 4 },
    getDynamicGeometry: (comp) => {
      const L = adderLayout(comp);
      return { w: L.w, h: L.h, inputs: L.inputs, outputs: L.outputs };
    },
    shape: (comp, outputValue) => {
      const width = comp?.state?.width ?? 4;
      const s = maskTo(width, asInt(outputValue));
      const valText = width === 1 ? String(s) : formatBitsGrouped(s, width);
      const L = adderLayout(comp);
      const { content } = L;
      const lcdY = content.y + 16;
      const lcdH = content.h - 16;
      return (
        <RectShape layout={L}>
          {/* Symbole « + » au-dessus du LCD */}
          <text
            x={content.x + content.w / 2}
            y={content.y + 13}
            textAnchor="middle"
            fontSize="17"
            fontWeight="700"
            fontFamily="'IBM Plex Mono', monospace"
            fill="#1f2937"
            style={NO_SEL}
          >
            +
          </text>
          {/* Cadre LED */}
          <rect
            x={content.x}
            y={lcdY}
            width={content.w}
            height={lcdH}
            rx="2"
            fill={LCD_FILL}
            stroke={LCD_BORDER}
            strokeWidth="1"
          />
          {/* Valeur de la somme */}
          <text
            x={content.x + content.w / 2}
            y={lcdY + lcdH / 2 + 5}
            textAnchor="middle"
            fontSize={width === 1 ? 16 : 13}
            fontWeight="700"
            fontFamily="'IBM Plex Mono', monospace"
            fill={LCD_TEXT}
            style={NO_SEL}
          >
            {valText}
          </text>
        </RectShape>
      );
    },
  },
};
