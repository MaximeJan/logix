import { describe, it, expect } from 'vitest';
import { encodeChallenge, decodeChallenge, payloadHash } from '../src/lib/challenge-url';
import { verifyChallenge } from '../src/lib/challenge-verify';
import { getAllLevels } from '../src/challenges';
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

const notLevel = {
  id: 'custom',
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
};

describe('encodeChallenge / decodeChallenge', () => {
  it('fait un aller-retour fidèle sur un exercice combinatoire', () => {
    const decoded = decodeChallenge(encodeChallenge(notLevel), { isKnownType });
    expect(decoded).toEqual(notLevel);
  });

  it('fait un aller-retour fidèle sur chaque niveau du catalogue', () => {
    for (const level of getAllLevels()) {
      // chapterId n'est pas transporté : on compare le reste.
      const { chapterId, id, ...rest } = level;
      const decoded = decodeChallenge(encodeChallenge(level), { isKnownType });
      expect(decoded, level.id).not.toBeNull();
      const { id: decodedId, ...decodedRest } = decoded;
      expect(decodedRest, level.id).toEqual(rest);
    }
  });

  it('préserve les valeurs de bus multi-bits', () => {
    const busLevel = {
      ...notLevel,
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
    const decoded = decodeChallenge(encodeChallenge(busLevel), { isKnownType });
    expect(decoded.truthTable).toEqual(busLevel.truthTable);
    expect(decoded.inputs).toEqual(busLevel.inputs);
  });

  it('transporte une vérification par séquence', () => {
    const seqLevel = {
      ...notLevel,
      verify: {
        type: 'sequence',
        steps: [
          [[0, 0], [0]],
          [[1, 0], [1]],
        ],
      },
      truthTable: undefined,
      inputs: [
        { name: 'S', width: 1 },
        { name: 'R', width: 1 },
      ],
    };
    delete seqLevel.truthTable;
    const decoded = decodeChallenge(encodeChallenge(seqLevel), { isKnownType });
    expect(decoded.verify).toEqual(seqLevel.verify);
    expect(decoded.truthTable).toBeUndefined();
  });
});

describe('decodeChallenge — payloads invalides', () => {
  const bad = (payload) => expect(decodeChallenge(payload, { isKnownType })).toBeNull();

  it('rejette une chaîne vide', () => bad(''));
  it('rejette du base64 invalide', () => bad('!!!pas-du-base64!!!'));
  it('rejette du base64 valide qui n\'est pas du JSON', () => bad(btoa('coucou')));
  it('rejette un payload trop long', () => bad('A'.repeat(20000)));

  it('rejette une version de format inconnue', () => {
    const payload = encodeChallenge(notLevel);
    const obj = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
    obj.v = 99;
    bad(btoa(JSON.stringify(obj)));
  });

  it('rejette un exercice sans titre, sans port ou sans ligne', () => {
    bad(encodeChallenge({ ...notLevel, title: '' }));
    bad(encodeChallenge({ ...notLevel, inputs: [] }));
    bad(encodeChallenge({ ...notLevel, outputs: [] }));
    bad(encodeChallenge({ ...notLevel, truthTable: [] }));
  });
});

describe('decodeChallenge — assainissement', () => {
  it('retire les types de composants inconnus', () => {
    const payload = encodeChallenge({
      ...notLevel,
      allowedTypes: ['INPUT', 'OUTPUT', 'NOT', 'FUSEE_LUNAIRE'],
    });
    expect(decodeChallenge(payload, { isKnownType }).allowedTypes).toEqual([
      'INPUT',
      'OUTPUT',
      'NOT',
    ]);
  });

  it('clampe les largeurs de port dans 1..32', () => {
    const payload = encodeChallenge({
      ...notLevel,
      inputs: [{ name: 'A', width: 999 }],
      outputs: [{ name: 'S', width: 0 }],
    });
    const decoded = decodeChallenge(payload, { isKnownType });
    expect(decoded.inputs[0].width).toBe(32);
    expect(decoded.outputs[0].width).toBe(1);
  });

  it('tronque les textes trop longs', () => {
    const payload = encodeChallenge({ ...notLevel, title: 'x'.repeat(5000) });
    expect(decodeChallenge(payload, { isKnownType }).title.length).toBe(400);
  });

  it('ignore les lignes malformées', () => {
    const payload = encodeChallenge(notLevel);
    const obj = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
    obj.r = [[[0], [1]], 'pas une ligne'];
    expect(decodeChallenge(btoa(JSON.stringify(obj)), { isKnownType })).toBeNull();
  });
});

describe('exercice décodé → verifyChallenge', () => {
  const decoded = () => decodeChallenge(encodeChallenge(notLevel), { isKnownType });

  it('valide un circuit correct', () => {
    const res = verifyChallenge(notCircuit(), decoded(), getDef);
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
    const res = verifyChallenge(direct, decoded(), getDef);
    expect(res.success).toBe(false);
  });

  it('stopOnFirstFailure:false renvoie toutes les lignes (générateur d\'exercices)', () => {
    const direct = {
      components: [
        { id: 'i', type: 'INPUT', x: 0, y: 0, state: { value: 0, width: 1 } },
        { id: 'o', type: 'OUTPUT', x: 0, y: 0 },
      ],
      wires: [
        { id: 'w', from: { componentId: 'i', port: 'out' }, to: { componentId: 'o', port: 'in0' } },
      ],
    };
    const res = verifyChallenge(direct, decoded(), getDef, { stopOnFirstFailure: false });
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
