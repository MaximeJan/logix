// Dispositions « à dessin fixe » des composants bus : Entrée/Sortie multi-bits et
// nœud BUS. Logique pure (aucun JSX) : utilisée par les `shape`, par
// `getDynamicGeometry` et par l'orchestrateur (clic sur un bit).
//
// Principes communs :
//  - le dessin ne tourne jamais (texte toujours droit, MSB toujours à gauche) ;
//    l'orientation ne fait que choisir le BORD qui porte les ports ;
//  - les ports tombent sur la grille de 10 px (demi-pas de GRID), comme ceux des
//    portes logiques : deux composants alignés se relient par un fil droit ;
//  - tout le contenu reste DANS le cadre, quelle que soit l'orientation.
import { INPUT_BUS_CELL_SIZE } from '../lib/constants';
import type { Orientation, Port } from '../domain/types';

/** Bord d'un composant : gauche, droite, haut, bas. */
export type Edge = 'L' | 'R' | 'T' | 'B';

const STEP = 20;
const roundUp = (v: number) => Math.ceil(v / STEP) * STEP;

/**
 * Bord qui porte les ports d'un côté donné. `out` : sens de l'orientation
 * (sortie à droite en `right`) ; `in` : bord opposé (entrées à gauche).
 */
export function edgeFor(orientation: Orientation | undefined, side: 'in' | 'out'): Edge {
  const out: Edge =
    orientation === 'down' ? 'B' : orientation === 'left' ? 'L' : orientation === 'up' ? 'T' : 'R';
  if (side === 'out') return out;
  return out === 'R' ? 'L' : out === 'L' ? 'R' : out === 'B' ? 'T' : 'B';
}

// ------------------------------------------------------------------ Entrée / Sortie

/** Hauteur d'une case de bit et du corps (repères MSB/LSB au-dessus des cases). */
const CELL_H = 20;
const BODY_H = 40;
const CELLS_Y = 10; // cases de y=10 à y=30 : centrées sur y=20, comme l'Entrée 1 bit
const MIN_STUB = 10;

export interface BitRowLayout {
  w: number;
  h: number;
  /** Rangée de cases (une par bit, MSB à gauche). */
  cells: { x: number; y: number; w: number; h: number };
  cellW: number;
  /** Ligne de base des repères MSB / LSB, au-dessus des cases. */
  headerY: number;
  port: { x: number; y: number; edge: Edge };
  stub: { x1: number; y1: number; x2: number; y2: number };
}

/**
 * Entrée (`side: 'out'`, le port est sa sortie) ou Sortie (`side: 'in'`) en mode
 * bus. Cases toujours horizontales ; le port se place au milieu du bord choisi
 * par l'orientation, relié aux cases par un court trait.
 */
export function bitRowLayout(
  width: number,
  orientation: Orientation | undefined,
  side: 'in' | 'out',
): BitRowLayout {
  const cellW = INPUT_BUS_CELL_SIZE;
  const bodyW = width * cellW;
  const edge = edgeFor(orientation, side);
  if (edge === 'L' || edge === 'R') {
    const w = roundUp(bodyW + MIN_STUB);
    const x = edge === 'R' ? 0 : w - bodyW;
    const py = CELLS_Y + CELL_H / 2;
    const px = edge === 'R' ? w : 0;
    return {
      w,
      h: BODY_H,
      cells: { x, y: CELLS_Y, w: bodyW, h: CELL_H },
      cellW,
      headerY: CELLS_Y - 2.5,
      port: { x: px, y: py, edge },
      stub: { x1: edge === 'R' ? x + bodyW : px, y1: py, x2: edge === 'R' ? px : x, y2: py },
    };
  }
  // Port en haut ou en bas : le corps garde sa hauteur, un trait vertical de
  // 20 px le relie au port, centré sous (ou sur) la rangée.
  const w = roundUp(bodyW);
  const x = (w - bodyW) / 2;
  const top = edge === 'T' ? STEP : 0;
  const cy = top + CELLS_Y;
  const px = w / 2;
  const h = BODY_H + STEP;
  return {
    w,
    h,
    cells: { x, y: cy, w: bodyW, h: CELL_H },
    cellW,
    headerY: cy - 2.5,
    port: { x: px, y: edge === 'T' ? 0 : h, edge },
    stub:
      edge === 'T' ? { x1: px, y1: 0, x2: px, y2: cy } : { x1: px, y1: cy + CELL_H, x2: px, y2: h },
  };
}

/** Bit visé par un clic en coordonnées locales, ou null hors des cases. */
export function bitAtPoint(L: BitRowLayout, width: number, x: number, y: number): number | null {
  const { cells, cellW } = L;
  if (y < cells.y || y > cells.y + cells.h) return null;
  if (x < cells.x || x >= cells.x + width * cellW) return null;
  const visual = Math.floor((x - cells.x) / cellW);
  return width - 1 - visual; // MSB à gauche
}

// ------------------------------------------------------------------ nœud BUS

const BOX_INSET = 14; // longueur des traits de port (bord du composant → boîtier)
const SLOT = 40; // une source = donnée + activation, 20 px d'écart, 40 px par source
const FIRST = 40; // position du premier port de donnée le long du bord

export interface BusSlot {
  k: number;
  /** Cadre du couple (donnée, activation), surligné quand la source est active. */
  rect: { x: number; y: number; w: number; h: number };
  data: { x: number; y: number; anchor: 'start' | 'middle' | 'end' };
  en: { x: number; y: number; anchor: 'start' | 'middle' | 'end' };
}

export interface BusNodeLayout {
  w: number;
  h: number;
  box: { x: number; y: number; w: number; h: number };
  inputs: Port[];
  outputs: Port[];
  /** Traits des ports : du point de connexion au boîtier. */
  stubs: { name: string; x1: number; y1: number; x2: number; y2: number }[];
  slots: BusSlot[];
  title: { x: number; y: number };
  value: { x: number; y: number; anchor: 'start' | 'middle' | 'end' };
  busLabel: { x: number; y: number; anchor: 'start' | 'middle' | 'end' };
}

/** Nombre de chiffres de la plus grande valeur d'un bus (pour la largeur). */
const digitsFor = (width: number) => String(Math.pow(2, Math.min(32, width)) - 1).length;

/**
 * Nœud BUS à `sources` émetteurs. Chaque source occupe un couple de ports
 * adjacents (donnée `in{k}` puis activation `en{k}`, 20 px d'écart) sur le bord
 * d'entrée ; la sortie `bus` est au milieu du bord opposé.
 */
export function busNodeLayout(
  sources: number,
  width: number,
  orientation: Orientation | undefined,
): BusNodeLayout {
  // La sortie est toujours sur le bord opposé aux entrées.
  const inEdge = edgeFor(orientation, 'in');
  const along = sources * SLOT + FIRST; // longueur du bord qui porte les entrées
  const valueW = digitsFor(width) * 7.5;
  const slotLabelW = 40;

  const inputs: Port[] = [];
  const stubs: BusNodeLayout['stubs'] = [];
  const slots: BusSlot[] = [];

  if (inEdge === 'L' || inEdge === 'R') {
    const h = along;
    const w = roundUp(2 * BOX_INSET + slotLabelW + 16 + valueW + 8);
    const box = { x: BOX_INSET, y: 10, w: w - 2 * BOX_INSET, h: h - 20 };
    const left = inEdge === 'L';
    const edgeX = left ? 0 : w;
    const boxEdgeX = left ? box.x : box.x + box.w;
    for (let k = 0; k < sources; k++) {
      const dy = FIRST + k * SLOT;
      const ey = dy + STEP;
      inputs.push({ name: `in${k}`, x: edgeX, y: dy, width });
      inputs.push({ name: `en${k}`, x: edgeX, y: ey, width: 1 });
      stubs.push({ name: `in${k}`, x1: edgeX, y1: dy, x2: boxEdgeX, y2: dy });
      stubs.push({ name: `en${k}`, x1: edgeX, y1: ey, x2: boxEdgeX, y2: ey });
      const rx = left ? box.x + 3 : box.x + box.w - 3 - slotLabelW;
      const lx = left ? box.x + 8 : box.x + box.w - 8;
      const anchor = left ? 'start' : 'end';
      slots.push({
        k,
        rect: { x: rx, y: dy - 11, w: slotLabelW, h: STEP + 19 },
        data: { x: lx, y: dy + 4, anchor },
        en: { x: lx, y: ey + 3, anchor },
      });
    }
    const oy = h / 2;
    const ox = left ? w : 0;
    const boxOutX = left ? box.x + box.w : box.x;
    stubs.push({ name: 'bus', x1: boxOutX, y1: oy, x2: ox, y2: oy });
    const vx = left ? box.x + box.w - 8 : box.x + 8;
    const vAnchor = left ? 'end' : 'start';
    return {
      w,
      h,
      box,
      inputs,
      outputs: [{ name: 'bus', x: ox, y: oy, width }],
      stubs,
      slots,
      title: { x: w / 2, y: box.y + 15 },
      value: { x: vx, y: oy + 14, anchor: vAnchor },
      busLabel: { x: vx, y: oy - 5, anchor: vAnchor },
    };
  }

  // Entrées en haut ou en bas : les couples s'alignent horizontalement.
  const w = along;
  const h = 100;
  const top = inEdge === 'T';
  const box = { x: 10, y: BOX_INSET, w: w - 20, h: h - 2 * BOX_INSET };
  const edgeY = top ? 0 : h;
  const boxEdgeY = top ? box.y : box.y + box.h;
  for (let k = 0; k < sources; k++) {
    const dx = FIRST + k * SLOT;
    const ex = dx + STEP;
    inputs.push({ name: `in${k}`, x: dx, y: edgeY, width });
    inputs.push({ name: `en${k}`, x: ex, y: edgeY, width: 1 });
    stubs.push({ name: `in${k}`, x1: dx, y1: edgeY, x2: dx, y2: boxEdgeY });
    stubs.push({ name: `en${k}`, x1: ex, y1: edgeY, x2: ex, y2: boxEdgeY });
    const ry = top ? box.y + 3 : box.y + box.h - 3 - 24;
    const ly = top ? box.y + 17 : box.y + box.h - 9;
    slots.push({
      k,
      rect: { x: dx - 10, y: ry, w: STEP + 18, h: 24 },
      data: { x: dx, y: ly, anchor: 'middle' },
      en: { x: ex, y: ly - 1, anchor: 'middle' },
    });
  }
  const ox = w / 2;
  const oy = top ? h : 0;
  const boxOutY = top ? box.y + box.h : box.y;
  stubs.push({ name: 'bus', x1: ox, y1: boxOutY, x2: ox, y2: oy });
  return {
    w,
    h,
    box,
    inputs,
    outputs: [{ name: 'bus', x: ox, y: oy, width }],
    stubs,
    slots,
    title: { x: w / 2, y: top ? box.y + 45 : box.y + 29 },
    value: { x: w / 2 + 4, y: top ? box.y + 64 : box.y + 14, anchor: 'start' },
    busLabel: { x: w / 2 - 4, y: top ? box.y + 64 : box.y + 14, anchor: 'end' },
  };
}
