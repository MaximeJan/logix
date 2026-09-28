import { describe, it, expect } from 'vitest';
import {
  circuitBounds,
  viewForBounds,
  zoomView,
  EMBED_DEFAULT_SCALE,
  FIT_PADDING,
  MIN_SCALE,
  MAX_SCALE,
} from '../src/lib/viewport';
import { getDef } from '../src/gates/registry';

const base = { w: 800, h: 400 };
const scaleOf = (vb) => base.w / vb.w;

describe('circuitBounds', () => {
  it('renvoie null pour un circuit vide', () => {
    expect(circuitBounds([], () => ({ w: 10, h: 10 }))).toBeNull();
  });

  it('englobe tous les composants (taille réelle via getDef)', () => {
    const comps = [
      { id: 'a', type: 'INPUT', x: 40, y: 60 },
      { id: 'b', type: 'AND', x: 200, y: 20 },
    ];
    const sizeOf = (c) => getDef(c.type, null, c);
    const and = getDef('AND', null, comps[1]);
    const b = circuitBounds(comps, sizeOf);
    expect(b.x).toBe(40);
    expect(b.y).toBe(20);
    expect(b.x + b.w).toBe(200 + and.w);
  });

  it('ignore les composants sans taille connue', () => {
    const comps = [
      { id: 'a', type: 'X', x: 0, y: 0 },
      { id: 'b', type: 'Y', x: 100, y: 100 },
    ];
    const b = circuitBounds(comps, (c) => (c.type === 'Y' ? { w: 20, h: 10 } : null));
    expect(b).toEqual({ x: 100, y: 100, w: 20, h: 10 });
  });
});

describe('viewForBounds', () => {
  it("sans circuit : part de l'origine à l'échelle demandée", () => {
    const vb = viewForBounds(null, base, { maxScale: EMBED_DEFAULT_SCALE });
    expect(vb.x).toBe(0);
    expect(vb.y).toBe(0);
    expect(scaleOf(vb)).toBeCloseTo(EMBED_DEFAULT_SCALE);
  });

  it("un petit circuit n'est pas agrandi au-delà de maxScale, et il est centré", () => {
    const bounds = { x: 100, y: 100, w: 60, h: 40 };
    const vb = viewForBounds(bounds, base, { maxScale: 0.75 });
    expect(scaleOf(vb)).toBeCloseTo(0.75);
    expect(vb.x + vb.w / 2).toBeCloseTo(130);
    expect(vb.y + vb.h / 2).toBeCloseTo(120);
  });

  it('un grand circuit est réduit pour tenir, marge comprise', () => {
    const bounds = { x: 0, y: 0, w: 1520, h: 200 };
    const vb = viewForBounds(bounds, base, { maxScale: 1 });
    expect(scaleOf(vb)).toBeCloseTo(800 / (1520 + 2 * FIT_PADDING));
    expect(vb.x).toBeLessThanOrEqual(-FIT_PADDING + 1e-9);
    expect(vb.x + vb.w).toBeGreaterThanOrEqual(1520 + FIT_PADDING - 1e-9);
  });

  it('une échelle imposée qui fait déborder le circuit aligne son coin haut-gauche', () => {
    const bounds = { x: 300, y: 200, w: 2000, h: 1000 };
    const vb = viewForBounds(bounds, base, { scale: 1 });
    expect(scaleOf(vb)).toBe(1);
    expect(vb.x).toBe(300 - FIT_PADDING);
    expect(vb.y).toBe(200 - FIT_PADDING);
  });

  it("borne l'échelle à [MIN_SCALE, MAX_SCALE]", () => {
    const huge = { x: 0, y: 0, w: 100000, h: 100000 };
    expect(scaleOf(viewForBounds(huge, base))).toBeCloseTo(MIN_SCALE);
    expect(scaleOf(viewForBounds(null, base, { scale: 50 }))).toBeCloseTo(MAX_SCALE);
  });
});

describe('zoomView', () => {
  const view = { x: 0, y: 0, w: 800, h: 400 };

  it('zoome autour du centre de la vue', () => {
    const vb = zoomView(view, base, 2);
    expect(scaleOf(vb)).toBeCloseTo(2);
    expect(vb.x + vb.w / 2).toBeCloseTo(400);
    expect(vb.y + vb.h / 2).toBeCloseTo(200);
  });

  it('respecte les bornes', () => {
    expect(scaleOf(zoomView(view, base, 1000))).toBeCloseTo(MAX_SCALE);
    expect(scaleOf(zoomView(view, base, 0.0001))).toBeCloseTo(MIN_SCALE);
  });
});
