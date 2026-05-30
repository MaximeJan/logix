// Définitions de composants — catégorie « sequential ». Agrégées dans ./index.
import type { CircuitComponent } from '../domain/types';
import { asInt, maskTo } from '../lib/sim';
import { formatBitsGrouped } from '../lib/bits';
import { rectLayout } from './rectLayout';
import { RectShape } from './RectShape';
import type { GateDef } from './types';

// Dispositions par composant (dessin fixe — seuls les ports bougent selon l'orientation).
function srlatchLayout(comp?: CircuitComponent) {
  return rectLayout({
    orientation: comp?.state?.orientation,
    inputs: [
      { name: 'S', label: 'S', width: 1 },
      { name: 'R', label: 'R', width: 1 },
    ],
    outputs: [{ name: 'Q', label: 'Q', width: 1 }],
    contentW: 30,
    contentH: 44,
    inMargin: 26,
    outMargin: 26,
  });
}

function dffLayout(comp?: CircuitComponent) {
  const width = comp?.state?.width ?? 1;
  const fmtLen = formatBitsGrouped(0, width).length;
  const contentW = Math.max(46, fmtLen * 9 + 14);
  return rectLayout({
    orientation: comp?.state?.orientation,
    inputs: [
      { name: 'D', label: 'D', width },
      { name: 'CLK', label: 'CLK', width: 1, clk: true },
      { name: 'RST', label: 'R', width: 1 },
    ],
    outputs: [{ name: 'Q', label: 'Q', width }],
    contentW,
    contentH: 44,
    inMargin: 40,
    outMargin: 26,
  });
}

function regLayout(comp?: CircuitComponent) {
  const width = comp?.state?.width ?? 4;
  const fmtLen = formatBitsGrouped(0, width).length;
  const contentW = Math.max(46, fmtLen * 9 + 14);
  return rectLayout({
    orientation: comp?.state?.orientation,
    inputs: [
      { name: 'D', label: 'D', width },
      { name: 'LD', label: 'LD', width: 1 },
      { name: 'CLK', label: 'CLK', width: 1, clk: true },
    ],
    outputs: [{ name: 'Q', label: 'Q', width }],
    contentW,
    contentH: 44,
    inMargin: 40,
    outMargin: 26,
  });
}

function counterLayout(comp?: CircuitComponent) {
  const width = comp?.state?.width ?? 4;
  const fmtLen = formatBitsGrouped(0, width).length;
  const contentW = Math.max(46, fmtLen * 9 + 14);
  return rectLayout({
    orientation: comp?.state?.orientation,
    inputs: [
      { name: 'EN', label: 'EN', width: 1 },
      { name: 'CLK', label: 'CLK', width: 1, clk: true },
      { name: 'RST', label: 'R', width: 1 },
    ],
    outputs: [{ name: 'Q', label: 'Q', width }],
    contentW,
    contentH: 44,
    inMargin: 40,
    outMargin: 26,
  });
}

function ramLayout(comp?: CircuitComponent) {
  const aw = comp?.state?.addrWidth ?? 3;
  const dw = comp?.state?.dataWidth ?? 4;
  const fmtLen = formatBitsGrouped(0, dw).length;
  const contentW = Math.max(46, fmtLen * 9 + 14);
  return rectLayout({
    orientation: comp?.state?.orientation,
    inputs: [
      { name: 'ADDR', label: 'A', width: aw },
      { name: 'DATA_IN', label: 'D', width: dw },
      { name: 'WE', label: 'WE', width: 1 },
      { name: 'CLK', label: 'CLK', width: 1, clk: true },
    ],
    outputs: [{ name: 'DATA_OUT', label: 'Q', width: dw }],
    contentW,
    contentH: 60, // libellé « RAM N×M » (16) + cadre LED (44)
    inMargin: 40,
    outMargin: 26,
  });
}

// Helpers de rendu du contenu central (LCD + valeur).
const LCD_FILL = 'var(--lcd-fill, #0f172a)';
const LCD_BORDER = 'var(--lcd-border, #0f172a)';
const LCD_TEXT = 'var(--lcd-text, #fbbf24)';
const NO_SEL = { userSelect: 'none' as const, pointerEvents: 'none' as const };

export const sequentialGates: Record<string, GateDef> = {
  SRLATCH: {
    label: 'Latch SR',
    category: 'Séquentiel',
    w: 96,
    h: 76,
    inputs: [],
    outputs: [],
    fixedDisplay: true,
    defaultState: { q: 0 },
    getDynamicGeometry: (comp) => {
      const L = srlatchLayout(comp);
      return { w: L.w, h: L.h, inputs: L.inputs, outputs: L.outputs };
    },
    shape: (comp) => {
      const q = asInt(comp?.state?.q) & 1;
      const L = srlatchLayout(comp);
      const { content } = L;
      return (
        <RectShape layout={L}>
          <rect
            x={content.x}
            y={content.y}
            width={content.w}
            height={content.h}
            rx="2"
            fill={LCD_FILL}
            stroke={LCD_BORDER}
            strokeWidth="1"
          />
          <text
            x={content.x + content.w / 2}
            y={content.y + content.h / 2 + 6}
            textAnchor="middle"
            fontSize="18"
            fontWeight="700"
            fontFamily="'IBM Plex Mono', monospace"
            fill={LCD_TEXT}
            style={NO_SEL}
          >
            {q}
          </text>
        </RectShape>
      );
    },
  },
  DFF: {
    label: 'Bascule D',
    category: 'Séquentiel',
    w: 134,
    h: 88,
    inputs: [],
    outputs: [],
    fixedDisplay: true,
    defaultState: { q: 0, lastClk: 0, lastTriggerAt: 0, width: 1 },
    getDynamicGeometry: (comp) => {
      const L = dffLayout(comp);
      return { w: L.w, h: L.h, inputs: L.inputs, outputs: L.outputs };
    },
    shape: (comp) => {
      const width = comp?.state?.width ?? 1;
      const q = maskTo(width, asInt(comp?.state?.q));
      const now = Date.now();
      const since = now - (comp?.state?.lastTriggerAt ?? 0);
      const triggered = since >= 0 && since < 300;
      const valText = width === 1 ? String(q) : formatBitsGrouped(q, width);
      const L = dffLayout(comp);
      const { content } = L;
      const halo = triggered
        ? { color: '#84cc16', opacity: Math.max(0, 1 - since / 300) }
        : undefined;
      return (
        <RectShape layout={L} halo={halo}>
          <rect
            x={content.x}
            y={content.y}
            width={content.w}
            height={content.h}
            rx="2"
            fill={LCD_FILL}
            stroke={LCD_BORDER}
            strokeWidth="1"
          />
          <text
            x={content.x + content.w / 2}
            y={content.y + content.h / 2 + 5}
            textAnchor="middle"
            fontSize={width === 1 ? 20 : 14}
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
  REG: {
    label: 'Registre N-bit',
    category: 'Séquentiel',
    w: 134,
    h: 88,
    inputs: [],
    outputs: [],
    fixedDisplay: true,
    defaultState: { q: 0, lastClk: 0, lastTriggerAt: 0, width: 4 },
    getDynamicGeometry: (comp) => {
      const L = regLayout(comp);
      return { w: L.w, h: L.h, inputs: L.inputs, outputs: L.outputs };
    },
    shape: (comp) => {
      const width = comp?.state?.width ?? 4;
      const q = maskTo(width, asInt(comp?.state?.q));
      const now = Date.now();
      const since = now - (comp?.state?.lastTriggerAt ?? 0);
      const triggered = since >= 0 && since < 300;
      const valText = width === 1 ? String(q) : formatBitsGrouped(q, width);
      const L = regLayout(comp);
      const { content } = L;
      const halo = triggered
        ? { color: '#84cc16', opacity: Math.max(0, 1 - since / 300) }
        : undefined;
      return (
        <RectShape layout={L} halo={halo}>
          <rect
            x={content.x}
            y={content.y}
            width={content.w}
            height={content.h}
            rx="2"
            fill={LCD_FILL}
            stroke={LCD_BORDER}
            strokeWidth="1"
          />
          <text
            x={content.x + content.w / 2}
            y={content.y + content.h / 2 + 5}
            textAnchor="middle"
            fontSize={width === 1 ? 20 : 14}
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
  COUNTER: {
    label: 'Compteur N-bit',
    category: 'Séquentiel',
    w: 134,
    h: 88,
    inputs: [],
    outputs: [],
    fixedDisplay: true,
    defaultState: { q: 0, lastClk: 0, lastTriggerAt: 0, width: 4 },
    getDynamicGeometry: (comp) => {
      const L = counterLayout(comp);
      return { w: L.w, h: L.h, inputs: L.inputs, outputs: L.outputs };
    },
    shape: (comp) => {
      const width = comp?.state?.width ?? 4;
      const q = maskTo(width, asInt(comp?.state?.q));
      const now = Date.now();
      const since = now - (comp?.state?.lastTriggerAt ?? 0);
      const triggered = since >= 0 && since < 300;
      const valText = width === 1 ? String(q) : formatBitsGrouped(q, width);
      const L = counterLayout(comp);
      const { content } = L;
      const halo = triggered
        ? { color: '#84cc16', opacity: Math.max(0, 1 - since / 300) }
        : undefined;
      return (
        <RectShape layout={L} halo={halo}>
          <rect
            x={content.x}
            y={content.y}
            width={content.w}
            height={content.h}
            rx="2"
            fill={LCD_FILL}
            stroke={LCD_BORDER}
            strokeWidth="1"
          />
          <text
            x={content.x + content.w / 2}
            y={content.y + content.h / 2 + 5}
            textAnchor="middle"
            fontSize={width === 1 ? 20 : 14}
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
  RAM: {
    label: 'RAM',
    category: 'Séquentiel',
    w: 140,
    h: 112,
    inputs: [],
    outputs: [],
    fixedDisplay: true,
    // addrWidth : largeur du port ADDR (1..8) → 2^addrWidth cases mémoire
    // dataWidth : largeur des mots (1..16)
    // mem       : tableau d'entiers, longueur 2^addrWidth, chaque entrée masquée à dataWidth bits
    // lastClk   : valeur CLK observée au tick précédent (pour détecter le front montant)
    defaultState: { addrWidth: 3, dataWidth: 4, mem: [0, 0, 0, 0, 0, 0, 0, 0], lastClk: 0 },
    getDynamicGeometry: (comp) => {
      const L = ramLayout(comp);
      return { w: L.w, h: L.h, inputs: L.inputs, outputs: L.outputs };
    },
    shape: (comp, _outputValue, _inputValue, inputsByName) => {
      const aw = comp?.state?.addrWidth ?? 3;
      const dw = comp?.state?.dataWidth ?? 4;
      const mem = Array.isArray(comp?.state?.mem) ? comp.state.mem : [];
      const depth = 1 << aw;
      const liveAddr = maskTo(aw, asInt(inputsByName?.ADDR ?? 0));
      const liveValue = maskTo(dw, asInt(mem[liveAddr] ?? 0));
      const L = ramLayout(comp);
      const { content } = L;
      const lcdY = content.y + 16;
      const lcdH = content.h - 16;
      const valText = dw === 1 ? String(liveValue) : formatBitsGrouped(liveValue, dw);
      return (
        <RectShape layout={L}>
          {/* Libellé RAM N×M */}
          <text
            x={content.x + content.w / 2}
            y={content.y + 11}
            textAnchor="middle"
            fontSize="12"
            fontWeight="700"
            fontFamily="'IBM Plex Sans', sans-serif"
            fill="#1f2937"
            style={NO_SEL}
          >
            RAM {depth}×{dw}
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
          {/* Valeur de la case adressée */}
          <text
            x={content.x + content.w / 2}
            y={lcdY + lcdH / 2 + 5}
            textAnchor="middle"
            fontSize={dw === 1 ? 20 : 14}
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
