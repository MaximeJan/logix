import { describe, it, expect } from 'vitest';
import {
  getDef,
  typeReferences,
  getPortPosition,
  getPortWidth,
} from '../src/gates/registry';

describe('getDef — défs natives', () => {
  it('porte AND : ports in0/in1 → out', () => {
    const def = getDef('AND', null);
    expect(def.inputs.map((p) => p.name)).toEqual(['in0', 'in1']);
    expect(def.outputs.map((p) => p.name)).toEqual(['out']);
    expect(def.w).toBeGreaterThan(0);
    expect(def.h).toBeGreaterThan(0);
  });
  it('INPUT en bus : largeur de sortie suit state.width', () => {
    const def = getDef('INPUT', null, { id: 'i', type: 'INPUT', x: 0, y: 0, state: { width: 8 } });
    const out = def.outputs.find((p) => p.name === 'out');
    expect(out.width).toBe(8);
  });
  it('type inconnu sans customDefs → null/undefined', () => {
    expect(getDef('NOPE', null)).toBeFalsy();
  });
});

describe('getDef — composants personnalisés', () => {
  const customDefs = {
    Foo: {
      name: 'Foo',
      inputs: [{ name: 'a', internalId: 'i1', width: 2 }],
      outputs: [{ name: 'y', internalId: 'o1', width: 2 }],
      circuit: { components: [], wires: [] },
    },
  };
  it('résout une définition personnalisée', () => {
    const def = getDef('Foo', customDefs);
    expect(def.isCustom).toBe(true);
    expect(def.inputs[0]).toMatchObject({ name: 'a', width: 2 });
    expect(def.outputs[0]).toMatchObject({ name: 'y', width: 2 });
    expect(def.customCircuit).toEqual({ components: [], wires: [] });
  });
});

describe('getDef — SEG7 à dessin fixe', () => {
  it('orientation par défaut : entrée D à gauche, dims 56×88', () => {
    const def = getDef('SEG7', null, { id: 's', type: 'SEG7', x: 0, y: 0, state: { mode: 'hex' } });
    expect(def.fixedDisplay).toBe(true);
    expect([def.w, def.h]).toEqual([56, 88]);
    const d = def.inputs.find((p) => p.name === 'D');
    expect([d.x, d.y]).toEqual([0, 44]);
  });
  it('orientation down : dims inchangées, entrée déplacée en haut', () => {
    const def = getDef('SEG7', null, {
      id: 's',
      type: 'SEG7',
      x: 0,
      y: 0,
      state: { mode: 'hex', orientation: 'down' },
    });
    // dimensions NON échangées (le dessin ne tourne pas)
    expect([def.w, def.h]).toEqual([56, 88]);
    const d = def.inputs.find((p) => p.name === 'D');
    expect([d.x, d.y]).toEqual([28, 0]); // bord supérieur, milieu
  });
});

describe('typeReferences (anti-récursion)', () => {
  const defs = {
    A: { inputs: [], outputs: [], circuit: { components: [{ type: 'B' }], wires: [] } },
    B: { inputs: [], outputs: [], circuit: { components: [], wires: [] } },
  };
  it('référence directe et transitive', () => {
    expect(typeReferences('A', defs, 'A')).toBe(true); // type === target
    expect(typeReferences('A', defs, 'B')).toBe(true); // A contient B
    expect(typeReferences('B', defs, 'A')).toBe(false); // B ne contient pas A
  });
  it('ne boucle pas sur un cycle A↔B', () => {
    const cyclic = {
      A: { inputs: [], outputs: [], circuit: { components: [{ type: 'B' }], wires: [] } },
      B: { inputs: [], outputs: [], circuit: { components: [{ type: 'A' }], wires: [] } },
    };
    // cible absente : doit terminer (garde `visited`) et renvoyer false
    expect(typeReferences('A', cyclic, 'Z')).toBe(false);
  });
});

describe('getPortPosition / getPortWidth', () => {
  const and = { id: 'g', type: 'AND', x: 100, y: 50 };
  it('position = origine composant + position locale du port', () => {
    const out = getPortPosition(and, 'out', 'output', null);
    expect(out.x).toBeGreaterThan(100); // décalé par x local du port
    expect(out).toMatchObject({ y: expect.any(Number) });
    const in0 = getPortPosition(and, 'in0', 'input', null);
    expect(in0.x).toBe(100); // in0 local x = 0
  });
  it('port inconnu → null', () => {
    expect(getPortPosition(and, 'zzz', 'output', null)).toBeNull();
  });
  it('largeur de port (bus)', () => {
    const inp = { id: 'i', type: 'INPUT', x: 0, y: 0, state: { width: 4 } };
    expect(getPortWidth(inp, 'out', 'output', null)).toBe(4);
    expect(getPortWidth(and, 'in0', 'input', null)).toBe(1);
    expect(getPortWidth(and, 'zzz', 'input', null)).toBe(1); // défaut
  });
});
