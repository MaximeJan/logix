// Cadrage du canevas — logique pure, sans React.
//
// Le canevas est un <svg> dont le viewBox (unités SVG) est piloté par
// hooks/useViewport. À 100 %, une unité SVG = un pixel écran : `base` est la
// taille mesurée du <svg> et une échelle `s` correspond à un viewBox de
// base.w / s × base.h / s.

import type { CircuitComponent } from '../domain/types';

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Échelle d'affichage par défaut en iframe (les composants y paraissent trop gros à 100 %). */
export const EMBED_DEFAULT_SCALE = 0.75;
/** Bornes du zoom (mêmes limites que la molette : ×8 en avant, ×4 en arrière). */
export const MIN_SCALE = 0.25;
export const MAX_SCALE = 8;
/** Marge autour du circuit quand on le recadre (unités SVG). */
export const FIT_PADDING = 40;

/**
 * Rectangle englobant les composants, ou null si le circuit est vide.
 * `sizeOf` renvoie la taille d'un composant (typiquement `getDef(…, comp)`,
 * qui tient compte de l'orientation) — injecté pour garder lib/ sans gates/.
 */
export function circuitBounds(
  components: CircuitComponent[],
  sizeOf: (comp: CircuitComponent) => { w: number; h: number } | null | undefined,
): Rect | null {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const c of components) {
    const size = sizeOf(c);
    if (!size) continue;
    minX = Math.min(minX, c.x);
    minY = Math.min(minY, c.y);
    maxX = Math.max(maxX, c.x + size.w);
    maxY = Math.max(maxY, c.y + size.h);
  }
  if (minX === Infinity) return null;
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

/**
 * viewBox qui affiche `bounds` dans un <svg> de taille `base`.
 *  - `scale` imposé : on l'utilise tel quel ;
 *  - sinon on recadre (le circuit + marge tient dans la vue), sans dépasser
 *    `maxScale` — un petit circuit n'est donc pas agrandi au-delà de ce zoom.
 * Le circuit est centré ; s'il déborde malgré tout (échelle imposée ou plancher
 * MIN_SCALE atteint), on aligne son coin haut-gauche, là où se trouvent les
 * entrées. Sans circuit, la vue part de l'origine.
 */
export function viewForBounds(
  bounds: Rect | null,
  base: { w: number; h: number },
  opts: { scale?: number; maxScale?: number; padding?: number } = {},
): Rect {
  const pad = opts.padding ?? FIT_PADDING;
  const maxScale = opts.maxScale ?? 1;
  const clamp = (s: number) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, s));

  if (!bounds) {
    const s = clamp(opts.scale ?? maxScale);
    return { x: 0, y: 0, w: base.w / s, h: base.h / s };
  }

  const contentW = bounds.w + 2 * pad;
  const contentH = bounds.h + 2 * pad;
  const fit = Math.min(base.w / contentW, base.h / contentH);
  const s = clamp(opts.scale ?? Math.min(maxScale, fit));
  const w = base.w / s;
  const h = base.h / s;

  const x = contentW <= w ? bounds.x + bounds.w / 2 - w / 2 : bounds.x - pad;
  const y = contentH <= h ? bounds.y + bounds.h / 2 - h / 2 : bounds.y - pad;
  return { x, y, w, h };
}

/**
 * Zoom d'un facteur `factor` (>1 = on s'approche) autour du centre de la vue,
 * borné à [MIN_SCALE, MAX_SCALE] par rapport à `base`.
 */
export function zoomView(view: Rect, base: { w: number; h: number }, factor: number): Rect {
  const scale = base.w / view.w;
  const next = Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale * factor));
  const w = base.w / next;
  const h = w * (view.h / view.w);
  const cx = view.x + view.w / 2;
  const cy = view.y + view.h / 2;
  return { x: cx - w / 2, y: cy - h / 2, w, h };
}
