import { describe, it, expect } from 'vitest';
import { encodeExercise, decodeExercise, payloadHash } from '../src/lib/exercise-url';
import { verifyExercise } from '../src/lib/exercise-verify';
import { getDef } from '../src/gates/registry';
import { GATES } from '../src/gates';

const isKnownType = (t) => !!GATES[t];

// Circuit NOT correct : INPUT(i) → NOT(g) → OUTPUT(o)
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

const notExercise = {
  title: 'NOT maison',
  objective: 'Inverser le signal.',
  steps: ['Place une Entrée « A ».', 'Place une Sortie « S ».'],
  allowedTypes: ['INPUT', 'OUTPUT', 'NOT'],
  inputs: [{ name: 'A', width: 1 }],
  outputs: [{ name: 'S', width: 1 }],
  verify: { type: 'truthtable' },
  truthTable: [
    [[0], [1]],
    [[1], [0]],
  ],
  autoOpenProperties: false,
};

describe('encodeExercise / decodeExercise', () => {
  it('fait un aller-retour fidèle sur un exercice combinatoire', () => {
    const decoded = decodeExercise(encodeExercise(notExercise), { isKnownType });
    expect(decoded).toEqual(notExercise);
  });

  it('préserve les valeurs de bus multi-bits', () => {
    const busExercise = {
      ...notExercise,
      inputs: [
        { name: 'A', width: 4 },
        { name: 'B', width: 4 },
      ],
      outputs: [{ name: 'S', width: 5 }],
      truthTable: [
        [[5, 3], [8]],
        [[15, 15], [30]],
      ],
    };
    const decoded = decodeExercise(encodeExercise(busExercise), { isKnownType });
    expect(decoded.truthTable).toEqual(busExercise.truthTable);
    expect(decoded.inputs).toEqual(busExercise.inputs);
  });

  it('transporte une vérification par séquence', () => {
    const seqExercise = {
      ...notExercise,
      verify: {
        type: 'sequence',
        steps: [
          [[0, 0], [0]],
          [[1, 0], [1]],
        ],
      },
      inputs: [
        { name: 'S', width: 1 },
        { name: 'R', width: 1 },
      ],
    };
    delete seqExercise.truthTable;
    const decoded = decodeExercise(encodeExercise(seqExercise), { isKnownType });
    expect(decoded.verify).toEqual(seqExercise.verify);
    expect(decoded.truthTable).toBeUndefined();
  });

  it('transporte autoOpenProperties (absent = false par défaut)', () => {
    const decodedDefault = decodeExercise(encodeExercise(notExercise), { isKnownType });
    expect(decodedDefault.autoOpenProperties).toBe(false);

    const withOpen = { ...notExercise, autoOpenProperties: true };
    const decodedOpen = decodeExercise(encodeExercise(withOpen), { isKnownType });
    expect(decodedOpen.autoOpenProperties).toBe(true);
  });
});

describe('exercice sans vérification', () => {
  const free = {
    title: 'Explore les portes',
    objective: 'Essaie les portes librement.',
    steps: ['Place ce que tu veux.'],
    allowedTypes: ['INPUT', 'OUTPUT', 'AND'],
    inputs: [],
    outputs: [],
    verify: { type: 'none' },
    autoOpenProperties: false,
  };

  it('fait un aller-retour fidèle, même sans port ni ligne', () => {
    const decoded = decodeExercise(encodeExercise(free), { isKnownType });
    expect(decoded).toEqual(free);
  });

  it('reste valide avec des ports déclarés (simple indication)', () => {
    const withPorts = { ...free, inputs: [{ name: 'A', width: 2 }] };
    const decoded = decodeExercise(encodeExercise(withPorts), { isKnownType });
    expect(decoded.inputs).toEqual([{ name: 'A', width: 2 }]);
    expect(decoded.verify).toEqual({ type: 'none' });
  });

  it('exige quand même un titre', () => {
    expect(decodeExercise(encodeExercise({ ...free, title: '' }), { isKnownType })).toBeNull();
  });

  it('verifyExercise réussit sans rien simuler', () => {
    const res = verifyExercise({ components: [], wires: [] }, free, getDef);
    expect(res.success).toBe(true);
    expect(res.table).toEqual([]);
  });
});

describe('decodeExercise — payloads invalides', () => {
  const bad = (payload) => expect(decodeExercise(payload, { isKnownType })).toBeNull();

  it('rejette une chaîne vide', () => bad(''));
  it('rejette du base64 invalide', () => bad('!!!pas-du-base64!!!'));
  it("rejette du base64 valide qui n'est pas du JSON", () => bad(btoa('coucou')));
  it('rejette un payload trop long', () => bad('A'.repeat(20000)));

  it('rejette une version de format inconnue', () => {
    const payload = encodeExercise(notExercise);
    const obj = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
    obj.v = 99;
    bad(btoa(JSON.stringify(obj)));
  });

  it('rejette un exercice vérifiable sans titre, sans port ou sans ligne', () => {
    bad(encodeExercise({ ...notExercise, title: '' }));
    bad(encodeExercise({ ...notExercise, inputs: [] }));
    bad(encodeExercise({ ...notExercise, outputs: [] }));
    bad(encodeExercise({ ...notExercise, truthTable: [] }));
  });
});

describe('decodeExercise — assainissement', () => {
  it('retire les types de composants inconnus', () => {
    const payload = encodeExercise({
      ...notExercise,
      allowedTypes: ['INPUT', 'OUTPUT', 'NOT', 'FUSEE_LUNAIRE'],
    });
    expect(decodeExercise(payload, { isKnownType }).allowedTypes).toEqual([
      'INPUT',
      'OUTPUT',
      'NOT',
    ]);
  });

  it('clampe les largeurs de port dans 1..32', () => {
    const payload = encodeExercise({
      ...notExercise,
      inputs: [{ name: 'A', width: 999 }],
      outputs: [{ name: 'S', width: 0 }],
    });
    const decoded = decodeExercise(payload, { isKnownType });
    expect(decoded.inputs[0].width).toBe(32);
    expect(decoded.outputs[0].width).toBe(1);
  });

  it('tronque les textes trop longs', () => {
    const payload = encodeExercise({ ...notExercise, title: 'x'.repeat(5000) });
    expect(decodeExercise(payload, { isKnownType }).title.length).toBe(400);
  });

  it('ignore les lignes malformées', () => {
    const payload = encodeExercise(notExercise);
    const obj = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
    obj.r = [[[0], [1]], 'pas une ligne'];
    expect(decodeExercise(btoa(JSON.stringify(obj)), { isKnownType })).toBeNull();
  });
});

describe('exercice décodé → verifyExercise', () => {
  const decoded = () => decodeExercise(encodeExercise(notExercise), { isKnownType });

  it('valide un circuit correct', () => {
    const res = verifyExercise(notCircuit(), decoded(), getDef);
    expect(res.success).toBe(true);
  });

  it('rejette un circuit faux', () => {
    const direct = {
      components: [
        { id: 'i', type: 'INPUT', x: 0, y: 0, state: { value: 0, width: 1 } },
        { id: 'o', type: 'OUTPUT', x: 0, y: 0 },
      ],
      wires: [
        { id: 'w', from: { componentId: 'i', port: 'out' }, to: { componentId: 'o', port: 'in0' } },
      ],
    };
    const res = verifyExercise(direct, decoded(), getDef);
    expect(res.success).toBe(false);
  });

  it("stopOnFirstFailure:false renvoie toutes les lignes (générateur d'exercices)", () => {
    const direct = {
      components: [
        { id: 'i', type: 'INPUT', x: 0, y: 0, state: { value: 0, width: 1 } },
        { id: 'o', type: 'OUTPUT', x: 0, y: 0 },
      ],
      wires: [
        { id: 'w', from: { componentId: 'i', port: 'out' }, to: { componentId: 'o', port: 'in0' } },
      ],
    };
    const res = verifyExercise(direct, decoded(), getDef, { stopOnFirstFailure: false });
    expect(res.success).toBe(false);
    expect(res.table).toHaveLength(2);
    expect(res.table.map((r) => r.actualOutVals)).toEqual([[0], [1]]);
  });
});

describe('payloadHash', () => {
  it('est stable et distinct selon le payload', () => {
    const a = payloadHash('abc');
    expect(payloadHash('abc')).toBe(a);
    expect(payloadHash('abd')).not.toBe(a);
    expect(a).toMatch(/^[0-9a-z]+$/);
  });
});
