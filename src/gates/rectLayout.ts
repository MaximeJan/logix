// Disposition générique d'un composant rectangulaire « à dessin fixe » : le corps
// (boîte + contenu) ne tourne jamais ; seuls les ports se placent sur le bord
// correspondant à l'orientation, répartis le long de ce bord. La boîte s'adapte
// (assez large pour étaler les ports en haut/bas, assez haute à gauche/droite).
import type { Orientation, Port } from '../domain/types';

export interface PortSpec {
  name: string;
  width: number;
  label: string;
  clk?: boolean; // affiche un repère ▷ d'horloge à l'entrée
}

export interface RectPort {
  name: string;
  label: string;
  clk: boolean;
  width: number;
  px: number;
  py: number; // point de connexion (sur le bord du composant)
  sx: number;
  sy: number; // extrémité du stub (sur le bord de la boîte)
  lx: number;
  ly: number; // ancre du label (à l'intérieur de la boîte)
  anchor: 'start' | 'middle' | 'end';
  edge: 'L' | 'R' | 'T' | 'B';
}

export interface RectLayout {
  w: number;
  h: number;
  box: { x: number; y: number; w: number; h: number };
  content: { x: number; y: number; w: number; h: number };
  inputs: Port[];
  outputs: Port[];
  ports: RectPort[];
}

const STUB = 14;
const SPACING = 24;
const EDGE_PAD = 10; // marge entre le contenu (LCD) et le bord de la boîte, axe long
const PORT_END_PAD = 12; // marge entre le bord de la boîte et le 1er/dernier port
const CLK_GAP = 8; // décalage du label CLK pour laisser de l'air après le triangle ▷

export function rectLayout(opts: {
  orientation?: Orientation;
  inputs: PortSpec[];
  outputs: PortSpec[];
  contentW: number;
  contentH: number;
  inMargin: number; // espace pour les labels du côté des entrées (dans la boîte)
  outMargin: number; // côté des sorties
}): RectLayout {
  const o = opts.orientation ?? 'right';
  const { inputs, outputs, contentW, contentH, inMargin, outMargin } = opts;
  const horizontal = o === 'right' || o === 'left'; // ports sur bords gauche/droite
  const inputFirst = o === 'right' || o === 'down'; // entrées sur bord début (gauche/haut)

  const maxN = Math.max(inputs.length, outputs.length);
  const portsSpan = Math.max(0, maxN - 1) * SPACING;

  // Axe "cross" = entrées → sorties ; axe "along" = le long du bord des ports.
  const crossContent = horizontal ? contentW : contentH;
  const alongContent = horizontal ? contentH : contentW;
  const cross = 2 * STUB + inMargin + crossContent + outMargin;
  // Assez grand pour : le contenu (avec marge au bord) OU l'étalement des ports
  // (avec marge entre le bord de boîte et les ports extrêmes).
  const along = Math.max(
    alongContent + 2 * STUB + 2 * EDGE_PAD,
    portsSpan + 2 * STUB + 2 * PORT_END_PAD,
  );

  const w = horizontal ? cross : along;
  const h = horizontal ? along : cross;

  const box = { x: STUB, y: STUB, w: w - 2 * STUB, h: h - 2 * STUB };

  // Zone de contenu : centrée sur l'axe along, décalée des marges sur l'axe cross.
  const contentCrossStart = STUB + (inputFirst ? inMargin : outMargin);
  const content = horizontal
    ? { x: contentCrossStart, y: (h - contentH) / 2, w: contentW, h: contentH }
    : { x: (w - contentW) / 2, y: contentCrossStart, w: contentW, h: contentH };

  const placeEdge = (specs: PortSpec[], isInput: boolean) => {
    const n = specs.length;
    const alongTotal = horizontal ? h : w;
    const start = alongTotal / 2 - ((n - 1) * SPACING) / 2;
    const atStart = isInput ? inputFirst : !inputFirst; // bord début (x=0 / y=0) ?
    const ports: Port[] = [];
    const items: RectPort[] = [];
    specs.forEach((sp, i) => {
      const a = start + i * SPACING;
      let px: number, py: number, sx: number, sy: number, lx: number, ly: number;
      let anchor: 'start' | 'middle' | 'end';
      let edge: 'L' | 'R' | 'T' | 'B';
      // Décalage supplémentaire du label pour laisser passer le triangle ▷ d'horloge.
      const clkOffset = sp.clk ? CLK_GAP : 0;
      if (horizontal) {
        py = a;
        sy = a;
        ly = a + 4;
        if (atStart) {
          px = 0;
          sx = STUB;
          lx = STUB + 6 + clkOffset;
          anchor = 'start';
          edge = 'L';
        } else {
          px = w;
          sx = w - STUB;
          lx = w - STUB - 6 - clkOffset;
          anchor = 'end';
          edge = 'R';
        }
      } else {
        px = a;
        sx = a;
        lx = a;
        anchor = 'middle';
        if (atStart) {
          py = 0;
          sy = STUB;
          ly = STUB + 13 + clkOffset;
          edge = 'T';
        } else {
          py = h;
          sy = h - STUB;
          ly = h - STUB - 6 - clkOffset;
          edge = 'B';
        }
      }
      ports.push({ name: sp.name, x: px, y: py, width: sp.width });
      items.push({
        name: sp.name,
        label: sp.label,
        clk: !!sp.clk,
        width: sp.width,
        px,
        py,
        sx,
        sy,
        lx,
        ly,
        anchor,
        edge,
      });
    });
    return { ports, items };
  };

  const inRes = placeEdge(inputs, true);
  const outRes = placeEdge(outputs, false);
  return {
    w,
    h,
    box,
    content,
    inputs: inRes.ports,
    outputs: outRes.ports,
    ports: [...inRes.items, ...outRes.items],
  };
}

// Petit triangle ▷ d'horloge pointant vers l'intérieur de la boîte, posé au bout du
// stub du port `it`. Renvoie le `d` d'un <path>.
export function clkTrianglePath(it: RectPort, size = 4): string {
  const { sx, sy, edge } = it;
  if (edge === 'L') return `M ${sx} ${sy - size} L ${sx + size * 2} ${sy} L ${sx} ${sy + size} Z`;
  if (edge === 'R') return `M ${sx} ${sy - size} L ${sx - size * 2} ${sy} L ${sx} ${sy + size} Z`;
  if (edge === 'T') return `M ${sx - size} ${sy} L ${sx + size} ${sy} L ${sx} ${sy + size * 2} Z`;
  return `M ${sx - size} ${sy} L ${sx + size} ${sy} L ${sx} ${sy - size * 2} Z`;
}
