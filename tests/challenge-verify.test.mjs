import { describe, it, expect } from 'vitest';
import { verifyChallenge } from '../src/lib/challenge-verify';
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

describe('verifyChallenge — table de vérité', () => {
  const level = {
    inputs: [{ name: 'a', width: 1 }],
    outputs: [{ name: 'y', width: 1 }],
    verify: { type: 'truthtable' },
    truthTable: [
      [[0], [1]],
      [[1], [0]],
    ],
  };

  it('réussit pour un vrai NOT', () => {
    const res = verifyChallenge(notCircuit(), level, getDef);
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
    const res = verifyChallenge(direct, level, getDef);
    expect(res.success).toBe(false);
    expect(res.table[0].match).toBe(false);
    expect(res.table[0].actualOutVals).toEqual([0]); // 0 au lieu du 1 attendu
  });

  it('signale un nombre insuffisant d’entrées', () => {
    const twoIn = { ...level, inputs: [{ name: 'a', width: 1 }, { name: 'b', width: 1 }] };
    const res = verifyChallenge(notCircuit(), twoIn, getDef);
    expect(res.success).toBe(false);
    expect(res.error).toMatch(/entrée/);
  });
});

describe('verifyChallenge — séquence (DFF)', () => {
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
    const level = {
      inputs: [{ name: 'D', width: 1 }, { name: 'CLK', width: 1 }],
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
    const res = verifyChallenge(seqCircuit(), level, getDef);
    expect(res.success).toBe(true);
    expect(res.table).toHaveLength(4);
  });
});
