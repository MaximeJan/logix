// Dispositions des composants bus : ports sur la grille, contenu dans le cadre,
// MSB en premier, quelle que soit l'orientation. Importe la VRAIE GATES.
import { describe, it, expect } from 'vitest';
import { bitRowLayout, bitAtPoint, busNodeLayout, edgeFor } from '../src/gates/busLayout';
import { getDef } from '../src/gates/registry';

const ORIENTATIONS = ['right', 'down', 'left', 'up'];
const onHalfGrid = (v) => Math.abs(v / 10 - Math.round(v / 10)) < 1e-9;
const inside = (r, w, h) => r.x >= 0 && r.y >= 0 && r.x + r.w <= w + 1e-9 && r.y + r.h <= h + 1e-9;

describe('edgeFor', () => {
  it('la sortie suit l’orientation, les entrées sont en face', () => {
    expect(ORIENTATIONS.map((o) => edgeFor(o, 'out'))).toEqual(['R', 'B', 'L', 'T']);
    expect(ORIENTATIONS.map((o) => edgeFor(o, 'in'))).toEqual(['L', 'T', 'R', 'B']);
  });
});

describe('bitRowLayout (Entrée / Sortie multi-bits)', () => {
  for (const o of ORIENTATIONS) {
    for (const width of [2, 4, 8, 16]) {
      it(`${o}, ${width} bits : port sur la grille et au bord, cases dans le cadre`, () => {
        const L = bitRowLayout(width, o, 'out');
        expect(onHalfGrid(L.port.x) && onHalfGrid(L.port.y)).toBe(true);
        const onEdge = L.port.x === 0 || L.port.x === L.w || L.port.y === 0 || L.port.y === L.h;
        expect(onEdge).toBe(true);
        expect(inside(L.cells, L.w, L.h)).toBe(true);
        expect(L.cells.w).toBe(width * L.cellW);
        expect(L.headerY).toBeGreaterThan(0);
      });
    }
  }

  it('en `right`, même hauteur et même port qu’une Entrée 1 bit (y = 20)', () => {
    const L = bitRowLayout(8, 'right', 'out');
    expect(L.h).toBe(40);
    expect(L.port).toEqual({ x: L.w, y: 20, edge: 'R' });
  });

  it('une Sortie a son port sur le bord opposé à une Entrée', () => {
    expect(bitRowLayout(4, 'right', 'in').port.edge).toBe('L');
    expect(bitRowLayout(4, 'down', 'in').port.edge).toBe('T');
  });

  it('bitAtPoint : MSB à gauche, null hors des cases, quelle que soit l’orientation', () => {
    for (const o of ORIENTATIONS) {
      const L = bitRowLayout(4, o, 'out');
      const midY = L.cells.y + L.cells.h / 2;
      expect(bitAtPoint(L, 4, L.cells.x + 1, midY)).toBe(3);
      expect(bitAtPoint(L, 4, L.cells.x + L.cells.w - 1, midY)).toBe(0);
      expect(bitAtPoint(L, 4, L.cells.x - 1, midY)).toBeNull();
      expect(bitAtPoint(L, 4, L.cells.x + 1, L.cells.y - 1)).toBeNull();
    }
  });
});

describe('busNodeLayout (composant BUS)', () => {
  for (const o of ORIENTATIONS) {
    for (const sources of [2, 3, 8]) {
      it(`${o}, ${sources} sources : ports sur la grille, tout dans le cadre`, () => {
        const L = busNodeLayout(sources, 8, o);
        for (const p of [...L.inputs, ...L.outputs]) {
          expect(onHalfGrid(p.x) && onHalfGrid(p.y)).toBe(true);
        }
        expect(inside(L.box, L.w, L.h)).toBe(true);
        for (const sl of L.slots)
          expect(inside(sl.rect, L.box.x + L.box.w, L.box.y + L.box.h)).toBe(true);
        // Les cadres de deux sources voisines ne se chevauchent pas.
        for (let k = 1; k < L.slots.length; k++) {
          const a = L.slots[k - 1].rect;
          const b = L.slots[k].rect;
          const overlapX = a.x < b.x + b.w && b.x < a.x + a.w;
          const overlapY = a.y < b.y + b.h && b.y < a.y + a.h;
          expect(overlapX && overlapY).toBe(false);
        }
      });
    }
  }

  it('ports ordonnés [in0, en0, in1, en1…] (ordre lu par simulate), couple à 20 px', () => {
    const L = busNodeLayout(3, 8, 'right');
    expect(L.inputs.map((p) => p.name)).toEqual(['in0', 'en0', 'in1', 'en1', 'in2', 'en2']);
    expect(L.inputs[1].y - L.inputs[0].y).toBe(20);
    expect(L.inputs.filter((p) => p.name.startsWith('en')).every((p) => p.width === 1)).toBe(true);
  });

  it('la sortie est au milieu du bord opposé aux entrées', () => {
    const r = busNodeLayout(2, 8, 'right');
    expect(r.outputs[0]).toMatchObject({ name: 'bus', x: r.w, y: r.h / 2 });
    const d = busNodeLayout(2, 8, 'down');
    expect(d.inputs.every((p) => p.y === 0)).toBe(true);
    expect(d.outputs[0]).toMatchObject({ x: d.w / 2, y: d.h });
  });

  it('s’élargit pour afficher la valeur d’un bus 32 bits', () => {
    expect(busNodeLayout(2, 32, 'right').w).toBeGreaterThan(busNodeLayout(2, 8, 'right').w);
  });
});

describe('composants bus de GATES : ports sur la grille dans les 4 orientations', () => {
  const cases = [
    ['INPUT', { width: 8 }],
    ['OUTPUT', { width: 8 }],
    ['BUS', { width: 8, sources: 3 }],
    ['MUX', { selectWidth: 2, dataWidth: 4 }],
    ['DEMUX', { selectWidth: 3, dataWidth: 1 }],
    ['DECODER', { width: 2 }],
    ['SPLITTER', { width: 4 }],
    ['MERGER', { width: 8 }],
    ['SLICE', { width: 8, hi: 7, lo: 4 }],
  ];
  for (const [type, state] of cases) {
    for (const o of ORIENTATIONS) {
      it(`${type} ${o}`, () => {
        const def = getDef(type, null, {
          id: 'x',
          type,
          x: 0,
          y: 0,
          state: { ...state, orientation: o },
        });
        for (const p of [...def.inputs, ...def.outputs]) {
          expect(onHalfGrid(p.x) && onHalfGrid(p.y), `${p.name} (${p.x}, ${p.y})`).toBe(true);
          expect(p.x >= 0 && p.x <= def.w && p.y >= 0 && p.y <= def.h).toBe(true);
        }
      });
    }
  }

  it('Séparateur : MSB en premier (en haut à droite, à gauche en bas)', () => {
    const at = (o) =>
      getDef('SPLITTER', null, {
        id: 's',
        type: 'SPLITTER',
        x: 0,
        y: 0,
        state: { width: 4, orientation: o },
      }).outputs;
    const right = at('right');
    expect(right[0].name).toBe('b3');
    expect(right[0].y).toBeLessThan(right[3].y);
    const down = at('down');
    expect(down[0].name).toBe('b3');
    expect(down[0].x).toBeLessThan(down[3].x);
  });

  it('les boîtes bus sont à dessin fixe (texte jamais tourné)', () => {
    for (const type of ['BUS', 'DECODER', 'SPLITTER', 'MERGER', 'SLICE']) {
      const def = getDef(type, null, { id: 'x', type, x: 0, y: 0, state: { orientation: 'down' } });
      expect(def.fixedDisplay, type).toBe(true);
    }
    const input8 = getDef('INPUT', null, {
      id: 'i',
      type: 'INPUT',
      x: 0,
      y: 0,
      state: { width: 8, orientation: 'down' },
    });
    expect(input8.fixedDisplay).toBe(true);
    // Une Entrée 1 bit, symétrique, continue de pivoter.
    const input1 = getDef('INPUT', null, {
      id: 'i',
      type: 'INPUT',
      x: 0,
      y: 0,
      state: { width: 1, orientation: 'down' },
    });
    expect(input1.fixedDisplay).toBeFalsy();
  });
});
