// Géométrie d'un composant personnalisé « interactif » — logique pure, sans React.
//
// Un composant encapsulé peut être marqué `interactive` : ses entrées deviennent
// des cellules CLIQUABLES (comme une Entrée) et ses sorties affichent leur valeur
// (comme une Sortie). On obtient une mini-calculatrice autonome en une seule
// boîte, sans câbler d'Entrée/Sortie autour. Cette même géométrie sert à trois
// endroits : la construction de la def (buildCustomDef), le rendu du canevas
// (CircuitCanvas) et la détection du clic (orchestrateur). D'où ce module partagé.

export interface InteractivePortRow {
  kind: 'in' | 'out';
  /** Index dans def.inputs (kind 'in') ou def.outputs (kind 'out'). */
  index: number;
  name: string;
  width: number;
  /** Centre vertical de la rangée. */
  y: number;
}

export interface InteractiveLayout {
  w: number;
  h: number;
  titleH: number;
  /** x où commencent les cellules d'entrée / les valeurs de sortie. */
  cellsX: number;
  cell: number;
  padX: number;
  rows: InteractivePortRow[];
  /** Ports de sortie (câblables) posés sur le bord droit. */
  outPorts: { name: string; internalId?: string; x: number; y: number; width: number }[];
}

interface PortLike {
  name: string;
  internalId?: string;
  width?: number;
}

const PAD_X = 10;
const TITLE_H = 22;
const ROW_H = 24;
const CELL = 18;
const GAP_X = 8;
const LABEL_CHAR = 6.5;
const TITLE_CHAR = 7;
const BOTTOM = 8;
const VALUE_PAD = 14;

/** Nombre de chiffres décimaux du plus grand entier d'une largeur donnée. */
export function decimalDigits(width: number): number {
  const maxVal = width >= 30 ? Math.pow(2, width) - 1 : (1 << width) - 1;
  return String(Math.max(0, maxVal)).length;
}

/**
 * Calcule la disposition (une colonne : entrées cliquables en haut, sorties
 * affichées en dessous). Dépend uniquement des ports (noms + largeurs) et du
 * nom du composant, jamais de l'état courant — donc réutilisable partout.
 */
export function interactiveLayout(
  name: string,
  inputs: PortLike[],
  outputs: PortLike[],
): InteractiveLayout {
  const nIn = inputs.length;
  const nRows = Math.max(1, nIn + outputs.length);

  const maxNameLen = Math.max(1, ...inputs.map((p) => p.name.length), ...outputs.map((p) => p.name.length));
  const labelColW = Math.max(14, Math.ceil(maxNameLen * LABEL_CHAR));
  const cellsX = PAD_X + labelColW + GAP_X;

  const rows: InteractivePortRow[] = [];
  inputs.forEach((p, i) =>
    rows.push({ kind: 'in', index: i, name: p.name, width: p.width ?? 1, y: 0 }),
  );
  outputs.forEach((p, i) =>
    rows.push({ kind: 'out', index: i, name: p.name, width: p.width ?? 1, y: 0 }),
  );
  rows.forEach((r, k) => {
    r.y = TITLE_H + k * ROW_H + ROW_H / 2;
  });

  // Largeur : la rangée la plus large (cellules d'entrée / badge de valeur),
  // sans jamais rétrécir sous le titre.
  let contentRight = cellsX;
  for (const r of rows) {
    const rightX =
      r.kind === 'in'
        ? cellsX + r.width * CELL
        : cellsX + decimalDigits(r.width) * LABEL_CHAR + VALUE_PAD;
    contentRight = Math.max(contentRight, rightX);
  }
  const titleW = PAD_X * 2 + Math.ceil(name.length * TITLE_CHAR);
  const w = Math.ceil(Math.max(contentRight + PAD_X, titleW) / 10) * 10;
  const h = Math.ceil((TITLE_H + nRows * ROW_H + BOTTOM) / 10) * 10;

  const outPorts = outputs.map((p, i) => {
    const row = rows[nIn + i];
    return { name: p.name, internalId: p.internalId, x: w, y: row.y, width: p.width ?? 1 };
  });

  return { w, h, titleH: TITLE_H, cellsX, cell: CELL, padX: PAD_X, rows, outPorts };
}

/**
 * Détecte quelle cellule d'entrée (bit) a été cliquée, en coordonnées locales au
 * composant. Renvoie null si le clic n'est sur aucune cellule. MSB à gauche.
 */
export function hitTestInteractiveCell(
  layout: InteractiveLayout,
  localX: number,
  localY: number,
): { inputIndex: number; bitIdx: number } | null {
  const half = layout.cell / 2;
  for (const r of layout.rows) {
    if (r.kind !== 'in') continue;
    if (localY < r.y - half || localY > r.y + half) continue;
    const rel = localX - layout.cellsX;
    if (rel < 0 || rel >= r.width * layout.cell) continue;
    const visualIdx = Math.floor(rel / layout.cell);
    const bitIdx = r.width - 1 - visualIdx; // MSB à gauche
    return { inputIndex: r.index, bitIdx };
  }
  return null;
}
