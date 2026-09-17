import { describe, it, expect } from 'vitest';
import {
  interactiveLayout,
  hitTestInteractiveCell,
  decimalDigits,
} from '../src/lib/custom-interactive';
import { buildCustomDefData } from '../src/lib/custom-def';
import { simulate, getOutputAt } from './sim-core.mjs';

describe('decimalDigits', () => {
  it('nombre de chiffres du max d’une largeur', () => {
    expect(decimalDigits(1)).toBe(1); // 1
    expect(decimalDigits(4)).toBe(2); // 15
    expect(decimalDigits(8)).toBe(3); // 255
  });
});

describe('interactiveLayout', () => {
  const L = interactiveLayout(
    'Add',
    [
      { name: 'A', width: 2 },
      { name: 'B', width: 2 },
    ],
    [{ name: 'S', width: 3 }],
  );

  it('une rangée par port, entrées puis sorties', () => {
    expect(L.rows.map((r) => r.kind)).toEqual(['in', 'in', 'out']);
    expect(L.rows.map((r) => r.index)).toEqual([0, 1, 0]);
  });

  it('ports de sortie posés sur le bord droit, alignés sur leur rangée', () => {
    expect(L.outPorts).toHaveLength(1);
    expect(L.outPorts[0].x).toBe(L.w);
    expect(L.outPorts[0].y).toBe(L.rows[2].y);
  });

  it('les cellules commencent après la colonne d’étiquettes', () => {
    expect(L.cellsX).toBeGreaterThan(L.padX);
  });
});

describe('hitTestInteractiveCell', () => {
  const L = interactiveLayout('Add', [{ name: 'A', width: 2 }], [{ name: 'S', width: 2 }]);
  const rowY = L.rows[0].y;

  it('première cellule = MSB (bit de poids fort)', () => {
    const hit = hitTestInteractiveCell(L, L.cellsX + L.cell * 0.5, rowY);
    expect(hit).toEqual({ inputIndex: 0, bitIdx: 1 });
  });
  it('seconde cellule = LSB', () => {
    const hit = hitTestInteractiveCell(L, L.cellsX + L.cell * 1.5, rowY);
    expect(hit).toEqual({ inputIndex: 0, bitIdx: 0 });
  });
  it('clic sur la rangée de sortie → null', () => {
    expect(hitTestInteractiveCell(L, L.cellsX + 2, L.rows[1].y)).toBeNull();
  });
  it('clic hors des cellules (colonne d’étiquette) → null', () => {
    expect(hitTestInteractiveCell(L, L.padX, rowY)).toBeNull();
  });
});

describe('simulation d’un composant custom interactif', () => {
  // Définition « MyNot » : INPUT A → NOT → OUTPUT S, marquée interactive.
  const sourceComps = [
    { id: 'i', type: 'INPUT', x: 0, y: 0, state: { width: 1 } },
    { id: 'g', type: 'NOT', x: 0, y: 0 },
    { id: 'o', type: 'OUTPUT', x: 0, y: 0 },
  ];
  const wires = [
    { id: 'w1', from: { componentId: 'i', port: 'out' }, to: { componentId: 'g', port: 'in0' } },
    { id: 'w2', from: { componentId: 'g', port: 'out' }, to: { componentId: 'o', port: 'in0' } },
  ];
  const def = buildCustomDefData('MyNot', [{ id: 'i', name: 'A' }], [{ id: 'o', name: 'S' }], sourceComps, wires, true);
  const customDefs = { MyNot: def };

  const run = (inValues) => {
    const comp = { id: 'c1', type: 'MyNot', x: 0, y: 0, state: { inValues } };
    const sim = simulate({ components: [comp], wires: [] }, customDefs);
    return getOutputAt(sim, comp, 'S');
  };

  it('la sortie suit la valeur cliquée (state.inValues), sans câblage externe', () => {
    expect(def.interactive).toBe(true);
    expect(run([1])).toBe(0); // NON 1 = 0
    expect(run([0])).toBe(1); // NON 0 = 1
  });
});
