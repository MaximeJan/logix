import { describe, it, expect } from 'vitest';
import {
  uprightTransform,
  addrBitsFor,
  roundedRectPath,
  routeWire,
  routeWireDirected,
  pointsToStr,
  offsetManhattan,
  makeBusTracks,
  simplifyPolyline,
  makeBusRibbon,
} from '../src/lib/geometry';

// Vérifie l'axialité (segments H/V) des segments [start, end[ d'une polyline.
// Les pistes de bus convergent en éventail aux ports : leurs premier et dernier
// segments sont volontairement diagonaux, on les exclut alors via `start`/`end`.
function expectAxial(pts, start = 0, end = pts.length - 1) {
  for (let i = start; i < end; i++) {
    const sameX = pts[i][0] === pts[i + 1][0];
    const sameY = pts[i][1] === pts[i + 1][1];
    expect(sameX || sameY, `segment ${i} non axial`).toBe(true);
  }
}

describe('uprightTransform', () => {
  it('ne fait rien à angle 0 / undefined', () => {
    expect(uprightTransform(0, 10, 20)).toBeUndefined();
    expect(uprightTransform(undefined, 10, 20)).toBeUndefined();
  });
  it('contre-tourne autour de l’ancre', () => {
    expect(uprightTransform(90, 16, 20)).toBe('rotate(-90 16 20)');
    expect(uprightTransform(180, 5, 7)).toBe('rotate(-180 5 7)');
    expect(uprightTransform(270, 0, 0)).toBe('rotate(-270 0 0)');
  });
});

describe('addrBitsFor', () => {
  it('au moins 1 bit, même pour n ≤ 1', () => {
    expect(addrBitsFor(0)).toBe(1);
    expect(addrBitsFor(1)).toBe(1);
  });
  it('arrondit au nombre de bits nécessaires', () => {
    expect(addrBitsFor(2)).toBe(1);
    expect(addrBitsFor(3)).toBe(2);
    expect(addrBitsFor(4)).toBe(2);
    expect(addrBitsFor(5)).toBe(3);
    expect(addrBitsFor(8)).toBe(3);
    expect(addrBitsFor(256)).toBe(8);
  });
});

describe('roundedRectPath', () => {
  it('arc sur chaque coin arrondi, aucun sinon', () => {
    const all = roundedRectPath(0, 0, 40, 20, 3, { tl: true, tr: true, br: true, bl: true });
    expect((all.match(/A /g) || []).length).toBe(4);
    const none = roundedRectPath(0, 0, 40, 20, 3, { tl: false, tr: false, br: false, bl: false });
    expect(none.includes('A ')).toBe(false);
  });
  it('chemin fermé (M…Z)', () => {
    const p = roundedRectPath(1, 2, 10, 10, 2, { tl: true, tr: false, br: true, bl: false });
    expect(p.startsWith('M ')).toBe(true);
    expect(p.trim().endsWith('Z')).toBe(true);
    expect((p.match(/A /g) || []).length).toBe(2);
  });
});

describe('routeWire', () => {
  it('cas éloigné (dx ≥ 20) : 4 sommets, coude en U couché', () => {
    const pts = routeWire({ x: 0, y: 0 }, { x: 100, y: 40 });
    expect(pts).toHaveLength(4);
    expect(pts[0]).toEqual([0, 0]);
    expect(pts[3]).toEqual([100, 40]);
    expectAxial(pts);
  });
  it('cas rapproché (dx < 20) : 6 sommets avec stubs', () => {
    const pts = routeWire({ x: 50, y: 0 }, { x: 55, y: 40 });
    expect(pts).toHaveLength(6);
    expect(pts[0]).toEqual([50, 0]);
    expect(pts[5]).toEqual([55, 40]);
    expectAxial(pts);
  });
});

describe('routeWireDirected', () => {
  it('cas par défaut (source→droite, cible→gauche) : identique à routeWire', () => {
    const a = { x: 0, y: 0 };
    const b = { x: 100, y: 40 };
    expect(routeWireDirected(a, [1, 0], b, [-1, 0])).toEqual(routeWire(a, b));
  });

  it('source orientée bas : le fil quitte le port vers le BAS', () => {
    // Source en (50,50) pointant vers le bas, cible normale à droite.
    const pts = routeWireDirected({ x: 50, y: 50 }, [0, 1], { x: 150, y: 200 }, [-1, 0]);
    expect(pts[0]).toEqual([50, 50]);
    expect(pts[pts.length - 1]).toEqual([150, 200]);
    // Premier segment vertical descendant (x constant, y croissant).
    expect(pts[1][0]).toBe(50);
    expect(pts[1][1]).toBeGreaterThan(50);
    expectAxial(pts);
  });

  it('cible orientée haut : le fil aborde le port par le HAUT', () => {
    const pts = routeWireDirected({ x: 0, y: 0 }, [1, 0], { x: 80, y: 100 }, [0, -1]);
    expect(pts[pts.length - 1]).toEqual([80, 100]);
    // Dernier segment vertical (x constant) : on entre par le haut.
    expect(pts[pts.length - 2][0]).toBe(80);
    expect(pts[pts.length - 2][1]).toBeLessThan(100);
    expectAxial(pts);
  });

  it('extrémité libre (dTo null) : reste axial et relie les deux points', () => {
    const pts = routeWireDirected({ x: 50, y: 50 }, [0, 1], { x: 200, y: 90 }, null);
    expect(pts[0]).toEqual([50, 50]);
    expect(pts[pts.length - 1]).toEqual([200, 90]);
    expectAxial(pts);
  });
});

describe('pointsToStr', () => {
  it('formate "x,y x,y …"', () => {
    expect(pointsToStr([[0, 0], [1, 2], [3, 4]])).toBe('0,0 1,2 3,4');
  });
});

describe('offsetManhattan', () => {
  const path = [
    [0, 0],
    [50, 0],
    [50, 40],
    [100, 40],
  ];
  it('offset 0 → copie identique', () => {
    expect(offsetManhattan(path, 0)).toEqual(path);
  });
  it('conserve extrémités, longueur et axialité interne', () => {
    const out = offsetManhattan(path, 4);
    expect(out).toHaveLength(path.length);
    expect(out[0]).toEqual(path[0]);
    expect(out[out.length - 1]).toEqual(path[path.length - 1]);
    // segments internes axiaux (les segments d'éventail aux extrémités sont exclus)
    expectAxial(out, 1, out.length - 2);
  });
  it('décale réellement les sommets internes', () => {
    const out = offsetManhattan(path, 4);
    expect(out[1]).not.toEqual(path[1]);
  });
});

describe('makeBusTracks', () => {
  it('n ≤ 1 → une seule piste = le tracé', () => {
    const path = [[0, 0], [10, 0]];
    expect(makeBusTracks(path, 1, 3)).toEqual([path]);
  });
  it('n pistes parallèles, centrées (extrémités communes)', () => {
    const path = [[0, 0], [50, 0], [50, 40], [100, 40]];
    const tracks = makeBusTracks(path, 4, 3);
    expect(tracks).toHaveLength(4);
    for (const t of tracks) {
      expect(t).toHaveLength(path.length);
      expect(t[0]).toEqual(path[0]);
      expect(t[t.length - 1]).toEqual(path[path.length - 1]);
      expectAxial(t, 1, t.length - 2);
    }
  });
});

describe('simplifyPolyline', () => {
  it('retire doublons et sommets alignés (coude vide d’un fil droit)', () => {
    expect(
      simplifyPolyline([
        [0, 10],
        [40, 10],
        [40, 10],
        [100, 10],
      ]),
    ).toEqual([
      [0, 10],
      [100, 10],
    ]);
  });
  it('garde les vrais coudes', () => {
    const z = [
      [0, 0],
      [50, 0],
      [50, 40],
      [100, 40],
    ];
    expect(simplifyPolyline(z)).toEqual(z);
  });
});

describe('makeBusRibbon', () => {
  const z = [
    [0, 0],
    [50, 0],
    [50, 40],
    [100, 40],
  ];
  // Écart entre deux pistes voisines, mesuré sur un segment horizontal.
  const gapOn = (tracks, i) => Math.abs(tracks[1][i][1] - tracks[0][i][1]);

  it('les pistes partent et arrivent exactement aux ports', () => {
    const { tracks } = makeBusRibbon(z, 4, 3);
    expect(tracks).toHaveLength(4);
    for (const t of tracks) {
      expect(t[0]).toEqual([0, 0]);
      expect(t[t.length - 1]).toEqual([100, 40]);
    }
  });

  it('les pistes restent parallèles et axiales entre les deux convergences', () => {
    const { tracks, pitch } = makeBusRibbon(z, 4, 3);
    expect(pitch).toBe(3);
    for (const t of tracks) expectAxial(t, 1, t.length - 2);
    expect(gapOn(tracks, 1)).toBeCloseTo(3);
    expect(gapOn(tracks, 2)).toBeCloseTo(3);
  });

  it('la convergence se limite aux quelques pixels du port', () => {
    const { tracks } = makeBusRibbon(z, 4, 3, { taper: 6 });
    // 2e sommet de chaque piste : 6 px après le port, déjà à sa place dans le ruban.
    for (const t of tracks) expect(t[1][0]).toBeCloseTo(6);
  });

  it('aucune piste ne recule sur le premier segment (pas de nœud papillon)', () => {
    const { tracks } = makeBusRibbon(z, 8, 3.7);
    for (const t of tracks) {
      expect(t[2][0]).toBeGreaterThanOrEqual(t[1][0]); // 1er segment vers la droite
      expect(t[t.length - 2][0]).toBeLessThanOrEqual(t[t.length - 1][0] + 1e-9);
    }
  });

  it('plafonne l’épaisseur (bus large)', () => {
    const straight = [
      [0, 0],
      [300, 0],
    ];
    const { halfThick, pitch } = makeBusRibbon(straight, 32, 3.7, { maxThickness: 18 });
    expect(halfThick).toBeCloseTo(9);
    expect(pitch).toBeCloseTo(18 / 31);
  });

  it('amincit le ruban sur un tracé trop serré pour son épaisseur', () => {
    const tight = [
      [0, 0],
      [12, 0],
      [12, 40],
      [60, 40],
    ];
    const { halfThick } = makeBusRibbon(tight, 8, 3.7, { taper: 6 });
    expect(halfThick).toBeLessThanOrEqual(12 - 4 + 1e-9); // 1er segment − convergence (réduite)
  });

  it('un fil droit tracé avec un coude vide reste un ruban droit', () => {
    const { tracks } = makeBusRibbon(
      [
        [0, 20],
        [60, 20],
        [60, 20],
        [120, 20],
      ],
      4,
      3,
    );
    for (const t of tracks) expect(t).toHaveLength(4); // port, 2 sommets du ruban, port
  });

  it('n ≤ 1 → une seule piste', () => {
    const { tracks } = makeBusRibbon(z, 1, 3);
    expect(tracks).toHaveLength(1);
  });
});
