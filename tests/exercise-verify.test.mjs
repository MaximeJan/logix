import { describe, it, expect } from 'vitest';
import { verifyExercise } from '../src/lib/exercise-verify';
import { getDef } from '../src/gates/registry';

// Circuit NOT : INPUT(i) → NOT(g) → OUTPUT(o)
const notCircuit = () => ({
  components: [
    { id: 'i', type: 'INPUT', x: 0, y: 0, state: { value: 0, width: 1 } },
    { id: 'g', type: 'NOT', x: 0, y: 0 },
    { id: 'o', type: 'OUTPUT', x: 0, y: 0 },
  ],
  wires: [
    { id: 'w1', from: { componentId: 'i', port: 'out' }, to: { componentId: 'g', port: 'in0' } },
    { id: 'w2', from: { componentId: 'g', port: 'out' }, to: { componentId: 'o', port: 'in0' } },
  ],
});

describe('verifyExercise — table de vérité', () => {
  const exercise = {
    inputs: [{ name: 'a', width: 1 }],
    outputs: [{ name: 'y', width: 1 }],
    verify: { type: 'truthtable' },
    truthTable: [
      [[0], [1]],
      [[1], [0]],
    ],
  };

  it('réussit pour un vrai NOT', () => {
    const res = verifyExercise(notCircuit(), exercise, getDef);
    expect(res.success).toBe(true);
    expect(res.table).toHaveLength(2);
    expect(res.table.every((r) => r.match)).toBe(true);
  });

  it('échoue (et renvoie la ligne fautive) pour un fil direct', () => {
    const direct = {
      components: [
        { id: 'i', type: 'INPUT', x: 0, y: 0, state: { value: 0, width: 1 } },
        { id: 'o', type: 'OUTPUT', x: 0, y: 0 },
      ],
      wires: [
        { id: 'w', from: { componentId: 'i', port: 'out' }, to: { componentId: 'o', port: 'in0' } },
      ],
    };
    const res = verifyExercise(direct, exercise, getDef);
    expect(res.success).toBe(false);
    expect(res.table[0].match).toBe(false);
    expect(res.table[0].actualOutVals).toEqual([0]); // 0 au lieu du 1 attendu
  });

  it('signale un nombre insuffisant d’entrées', () => {
    const twoIn = {
      ...exercise,
      inputs: [
        { name: 'a', width: 1 },
        { name: 'b', width: 1 },
      ],
    };
    const res = verifyExercise(notCircuit(), twoIn, getDef);
    expect(res.success).toBe(false);
    expect(res.error).toMatch(/entrée/);
  });
});

describe('verifyExercise — appariement par étiquette (ordre de création indifférent)', () => {
  // out = A ET NON B. Les INPUT sont créés dans l'ordre INVERSE (B avant A) pour
  // prouver que seul l'étiquette compte, pas l'ordre de placement de l'élève.
  const andNotB = (labelA, labelB) => ({
    components: [
      { id: 'b', type: 'INPUT', x: 0, y: 0, label: labelB, state: { value: 0, width: 1 } },
      { id: 'a', type: 'INPUT', x: 0, y: 0, label: labelA, state: { value: 0, width: 1 } },
      { id: 'nb', type: 'NOT', x: 0, y: 0 },
      { id: 'and', type: 'AND', x: 0, y: 0 },
      { id: 'o', type: 'OUTPUT', x: 0, y: 0 },
    ],
    wires: [
      { id: 'w1', from: { componentId: 'b', port: 'out' }, to: { componentId: 'nb', port: 'in0' } },
      { id: 'w2', from: { componentId: 'a', port: 'out' }, to: { componentId: 'and', port: 'in0' } },
      { id: 'w3', from: { componentId: 'nb', port: 'out' }, to: { componentId: 'and', port: 'in1' } },
      { id: 'w4', from: { componentId: 'and', port: 'out' }, to: { componentId: 'o', port: 'in0' } },
    ],
  });

  const exercise = {
    inputs: [
      { name: 'A', width: 1 },
      { name: 'B', width: 1 },
    ],
    outputs: [{ name: 'S', width: 1 }],
    verify: { type: 'truthtable' },
    truthTable: [
      [[0, 0], [0]],
      [[0, 1], [0]],
      [[1, 0], [1]],
      [[1, 1], [0]],
    ],
  };

  it('réussit malgré l’ordre de création inversé quand les étiquettes correspondent', () => {
    const res = verifyExercise(andNotB('A', 'B'), exercise, getDef);
    expect(res.success).toBe(true);
  });

  it('apparie sans tenir compte de la casse ni des espaces', () => {
    const res = verifyExercise(andNotB(' a ', 'B'), exercise, getDef);
    expect(res.success).toBe(true);
  });

  it('retombe sur l’ordre de création si les étiquettes sont absentes (échoue ici)', () => {
    // Sans étiquette → appariement positionnel : la 1re entrée créée (b) reçoit
    // la colonne A, donc le circuit calcule B ET NON A → table fausse.
    const res = verifyExercise(andNotB('', ''), exercise, getDef);
    expect(res.success).toBe(false);
  });
});

describe('verifyExercise — séquence (DFF)', () => {
  const seqCircuit = () => ({
    components: [
      { id: 'd', type: 'INPUT', x: 0, y: 0, state: { value: 0, width: 1 } },
      { id: 'k', type: 'INPUT', x: 0, y: 0, state: { value: 0, width: 1 } },
      { id: 'f', type: 'DFF', x: 0, y: 0, state: { q: 0, width: 1 } },
      { id: 'q', type: 'OUTPUT', x: 0, y: 0 },
    ],
    wires: [
      { id: 'w1', from: { componentId: 'd', port: 'out' }, to: { componentId: 'f', port: 'D' } },
      { id: 'w2', from: { componentId: 'k', port: 'out' }, to: { componentId: 'f', port: 'CLK' } },
      { id: 'w3', from: { componentId: 'f', port: 'Q' }, to: { componentId: 'q', port: 'in0' } },
    ],
  });

  it('capture D sur le front montant de CLK', () => {
    const exercise = {
      inputs: [
        { name: 'D', width: 1 },
        { name: 'CLK', width: 1 },
      ],
      outputs: [{ name: 'Q', width: 1 }],
      verify: {
        type: 'sequence',
        steps: [
          [[1, 0], [0]], // D=1 mais CLK encore bas → Q=0
          [[1, 1], [1]], // front montant → capture 1
          [[0, 0], [1]], // CLK redescend → maintien
          [[0, 1], [0]], // front montant → capture 0
        ],
      },
    };
    const res = verifyExercise(seqCircuit(), exercise, getDef);
    expect(res.success).toBe(true);
    expect(res.table).toHaveLength(4);
  });
});
