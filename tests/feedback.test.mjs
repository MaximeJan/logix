// Circuits bouclés (rétroaction combinatoire) : bascule SR construite à la main
// avec deux NOR (ou deux NAND), telle que la font les élèves. On pilote la
// simulation comme l'app : chaque appel reçoit les `outValues` du précédent.
import { describe, it, expect } from 'vitest';
import { simulate, getDef } from '../src/gates/registry';
import { verifyExercise } from '../src/lib/exercise-verify';
import { buildCustomDefData } from '../src/lib/custom-def';

const input = (id, value = 0) => ({
  id,
  type: 'INPUT',
  x: 0,
  y: 0,
  label: id,
  state: { value, width: 1 },
});
const gate = (id, type) => ({ id, type, x: 0, y: 0 });
const output = (id) => ({ id, type: 'OUTPUT', x: 0, y: 0, label: id, state: { width: 1 } });
let wn = 0;
const wire = (from, to, toPort, fromPort = 'out') => ({
  id: `w${++wn}`,
  from: { componentId: from, port: fromPort },
  to: { componentId: to, port: toPort },
});

// Bascule SR en deux NOR croisés : Q = NOR(R, Q̄), Q̄ = NOR(S, Q).
// `gatesFirst` change l'ordre de création (l'ancien bug en dépendait).
function norLatch({ gatesFirst = false } = {}) {
  const S = input('S');
  const R = input('R');
  const gates = [gate('n1', 'NOR'), gate('n2', 'NOR')];
  const outs = [output('Q'), output('Qb')];
  const components = gatesFirst ? [...outs, ...gates, S, R] : [S, R, ...gates, ...outs];
  return {
    components,
    wires: [
      wire('R', 'n1', 'in0'),
      wire('n2', 'n1', 'in1'),
      wire('S', 'n2', 'in0'),
      wire('n1', 'n2', 'in1'),
      wire('n1', 'Q', 'in0'),
      wire('n2', 'Qb', 'in0'),
    ],
  };
}

// Pilote le circuit comme l'app : on règle les entrées puis on simule en
// repartant du dernier état. Renvoie [Q, Q̄] à chaque étape.
function driver(circuit, qKey = 'n1:out', qbKey = 'n2:out') {
  let prev;
  let last;
  return {
    set(values) {
      for (const [id, v] of Object.entries(values)) {
        circuit.components.find((c) => c.id === id).state.value = v;
      }
      last = simulate(circuit, null, new Set(), prev);
      prev = last.outValues;
      return [last.outValues.get(qKey), last.outValues.get(qbKey)];
    },
    get result() {
      return last;
    },
  };
}

describe('bascule SR en deux NOR', () => {
  for (const gatesFirst of [false, true]) {
    it(`Set, maintien, Reset, maintien (portes posées ${gatesFirst ? 'en premier' : 'après les entrées'})`, () => {
      const d = driver(norLatch({ gatesFirst }));
      d.set({ S: 0, R: 1 });
      expect(d.set({ S: 0, R: 0 })).toEqual([0, 1]); // maintien après Reset
      // L'ancien bug : Q restait à 0 (et Q̄ tombait à 0) tant que S était enfoncé.
      expect(d.set({ S: 1, R: 0 })).toEqual([1, 0]); // Set immédiat
      expect(d.set({ S: 0, R: 0 })).toEqual([1, 0]); // maintien
      expect(d.set({ S: 0, R: 1 })).toEqual([0, 1]); // Reset immédiat
      expect(d.set({ S: 0, R: 0 })).toEqual([0, 1]); // maintien
    });
  }

  it("une bascule stable n'est ni instable ni signalée comme telle", () => {
    const d = driver(norLatch());
    d.set({ S: 1, R: 0 });
    expect(d.result.hasCycle).toBe(true);
    expect(d.result.unstable).toBe(false);
  });

  it('S = R = 1 : les deux sorties à 0 (état interdit, mais stable)', () => {
    const d = driver(norLatch());
    expect(d.set({ S: 1, R: 1 })).toEqual([0, 0]);
    expect(d.result.unstable).toBe(false);
  });

  it('les Sorties branchées sur la bascule suivent Q et Q̄', () => {
    const c = norLatch({ gatesFirst: true });
    const d = driver(c);
    d.set({ S: 1, R: 0 });
    expect(d.result.inputValues.get('Q:in0')).toBe(1);
    expect(d.result.inputValues.get('Qb:in0')).toBe(0);
  });
});

describe('bascule S̄R̄ en deux NAND', () => {
  it('Set et Reset actifs à 0, maintien à 1', () => {
    const c = {
      components: [input('S', 1), input('R', 1), gate('a', 'NAND'), gate('b', 'NAND')],
      wires: [
        wire('S', 'a', 'in0'),
        wire('b', 'a', 'in1'),
        wire('R', 'b', 'in0'),
        wire('a', 'b', 'in1'),
      ],
    };
    const d = driver(c, 'a:out', 'b:out');
    expect(d.set({ S: 0, R: 1 })).toEqual([1, 0]);
    expect(d.set({ S: 1, R: 1 })).toEqual([1, 0]);
    expect(d.set({ S: 1, R: 0 })).toEqual([0, 1]);
    expect(d.set({ S: 1, R: 1 })).toEqual([0, 1]);
  });
});

describe('boucle qui ne se stabilise pas', () => {
  it('une porte NOT reliée à elle-même est signalée instable', () => {
    const n = gate('n', 'NOT');
    const res = simulate({ components: [n], wires: [wire('n', 'n', 'in0')] });
    expect(res.hasCycle).toBe(true);
    expect(res.unstable).toBe(true);
  });

  it('un circuit sans boucle est stable', () => {
    const res = simulate({
      components: [input('A', 1), gate('g', 'NOT'), output('S')],
      wires: [wire('A', 'g', 'in0'), wire('g', 'S', 'in0')],
    });
    expect(res.hasCycle).toBe(false);
    expect(res.unstable).toBe(false);
  });
});

describe('bascule encapsulée (composant personnalisé)', () => {
  // Les élèves encapsulent leur bascule pour construire la suite (verrou D…) :
  // elle doit garder son état à l'intérieur de la boîte.
  const inner = norLatch();
  const def = buildCustomDefData(
    'BasculeSR',
    [
      { id: 'S', name: 'S' },
      { id: 'R', name: 'R' },
    ],
    [
      { id: 'Q', name: 'Q' },
      { id: 'Qb', name: 'Qb' },
    ],
    inner.components,
    inner.wires,
  );
  const outer = () => ({
    components: [input('s'), input('r'), gate('box', 'BasculeSR'), output('q')],
    wires: [wire('s', 'box', 'S'), wire('r', 'box', 'R'), wire('box', 'q', 'in0', 'Q')],
    customDefinitions: { BasculeSR: def },
  });

  it('garde son état entre deux simulations', () => {
    const d = driver(outer(), 'box:Q', 'box:Qb');
    d.set({ s: 0, r: 1 });
    expect(d.set({ s: 0, r: 0 })).toEqual([0, 1]);
    expect(d.set({ s: 1, r: 0 })).toEqual([1, 0]);
    expect(d.set({ s: 0, r: 0 })).toEqual([1, 0]); // mémorisé dans la boîte
    expect(d.set({ s: 0, r: 1 })).toEqual([0, 1]);
    expect(d.set({ s: 0, r: 0 })).toEqual([0, 1]);
  });

  it('la mémoire interne est rangée sous des clés préfixées, jamais sous « id:port »', () => {
    const d = driver(outer(), 'box:Q', 'box:Qb');
    d.set({ s: 1, r: 0 });
    const keys = [...d.result.outValues.keys()];
    expect(keys.some((k) => k.startsWith('box/'))).toBe(true);
    expect(keys.filter((k) => !k.includes('/')).every((k) => /^[^:]+:[^:]+$/.test(k))).toBe(true);
  });
});

describe('vérification d’un exercice en mode séquence', () => {
  const exercise = {
    title: 'Bascule SR',
    objective: '',
    steps: [],
    allowedTypes: [],
    inputs: [
      { name: 'S', width: 1 },
      { name: 'R', width: 1 },
    ],
    outputs: [{ name: 'Q', width: 1 }],
    verify: {
      type: 'sequence',
      steps: [
        [[1, 0], [1]],
        [[0, 0], [1]],
        [[0, 1], [0]],
        [[0, 0], [0]],
      ],
    },
    autoOpenProperties: false,
    locked: false,
  };

  it('une bascule SR correcte en deux NOR réussit (la mémoire suit d’une ligne à l’autre)', () => {
    for (const gatesFirst of [false, true]) {
      const res = verifyExercise(norLatch({ gatesFirst }), exercise, getDef);
      expect(res.success).toBe(true);
    }
  });

  it('un circuit sans mémoire (Q = S) échoue sur la ligne de maintien', () => {
    const c = {
      components: [input('S'), input('R'), output('Q')],
      wires: [wire('S', 'Q', 'in0')],
    };
    const res = verifyExercise(c, exercise, getDef);
    expect(res.success).toBe(false);
  });
});
