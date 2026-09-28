import { describe, it, expect } from 'vitest';
import {
  EMPTY_DRAFT,
  draftToExercise,
  exerciseToDraft,
  iframeHeightOf,
  portsFromCircuit,
  IFRAME_H_DEFAULT,
  IFRAME_H_MAX,
} from '../src/lib/exercise-draft';
import { encodeExercise, decodeExercise } from '../src/lib/exercise-url';
import { GATES } from '../src/gates';

const isKnownType = (t) => !!GATES[t];

const preset = { version: 2, name: 'p', components: [], wires: [], customDefinitions: {} };

const ttExercise = {
  title: 'NOT',
  objective: 'Inverser.',
  steps: ['Étape 1', 'Étape 2'],
  allowedTypes: ['INPUT', 'OUTPUT', 'NOT'],
  inputs: [{ name: 'A', width: 1 }],
  outputs: [{ name: 'S', width: 1 }],
  verify: { type: 'truthtable' },
  truthTable: [
    [[0], [1]],
    [[1], [0]],
  ],
  autoOpenProperties: true,
  locked: false,
  preset,
  zoom: 60,
};

describe('draftToExercise', () => {
  it('exige un titre', () => {
    expect(draftToExercise(EMPTY_DRAFT, preset)).toBeNull();
  });

  it('exige ports et lignes, sauf sans vérification', () => {
    const draft = { ...EMPTY_DRAFT, title: 'x' };
    expect(draftToExercise(draft, preset)).toBeNull();
    expect(draftToExercise({ ...draft, verifyKind: 'none' }, preset)).not.toBeNull();
  });

  it("n'embarque le circuit que si demandé (ou verrouillé)", () => {
    const draft = { ...EMPTY_DRAFT, title: 'x', verifyKind: 'none' };
    expect(draftToExercise(draft, preset).preset).toBeUndefined();
    expect(draftToExercise({ ...draft, includePreset: true }, preset).preset).toBe(preset);
    expect(draftToExercise({ ...draft, locked: true }, preset).preset).toBe(preset);
  });

  it("reprend l'identifiant importé seulement si « conserver » est coché", () => {
    const draft = { ...EMPTY_DRAFT, title: 'x', verifyKind: 'none', sourceId: 'abc' };
    expect(draftToExercise(draft, preset).id).toBe('abc');
    expect(draftToExercise({ ...draft, keepProgress: false }, preset).id).toBeUndefined();
    expect(draftToExercise({ ...draft, sourceId: null }, preset).id).toBeUndefined();
  });

  it('zoom null = auto (clé absente)', () => {
    const draft = { ...EMPTY_DRAFT, title: 'x', verifyKind: 'none' };
    expect('zoom' in draftToExercise(draft, preset)).toBe(false);
    expect(draftToExercise({ ...draft, zoom: 75 }, preset).zoom).toBe(75);
  });
});

describe('exerciseToDraft', () => {
  it("rouvrir puis régénérer redonne le même exercice (à l'identifiant près)", () => {
    const decoded = decodeExercise(encodeExercise(ttExercise), { isKnownType });
    const draft = exerciseToDraft(decoded, 'h1', 540);
    expect(draft.iframeHeight).toBe('540');
    expect(draft.includePreset).toBe(true);
    expect(draft.keepProgress).toBe(true);
    expect(draftToExercise(draft, decoded.preset)).toEqual({ ...ttExercise, id: 'h1' });
  });

  it('transporte une séquence et le mode sans vérification', () => {
    const seq = {
      ...ttExercise,
      verify: { type: 'sequence', steps: [[[1], [0]]] },
      truthTable: undefined,
    };
    const draftSeq = exerciseToDraft(seq, 'h');
    expect(draftSeq.verifyKind).toBe('seq');
    expect(draftSeq.rows).toEqual([[[1], [0]]]);

    const free = { ...ttExercise, verify: { type: 'none' }, truthTable: undefined };
    const draftFree = exerciseToDraft(free, 'h');
    expect(draftFree.verifyKind).toBe('none');
    expect(draftFree.rows).toEqual([]);
  });

  it('hauteur par défaut si absente', () => {
    expect(exerciseToDraft(ttExercise, 'h').iframeHeight).toBe(String(IFRAME_H_DEFAULT));
  });
});

describe('iframeHeightOf', () => {
  it('borne et retombe sur la valeur par défaut', () => {
    expect(iframeHeightOf({ ...EMPTY_DRAFT, iframeHeight: '450' })).toBe(450);
    expect(iframeHeightOf({ ...EMPTY_DRAFT, iframeHeight: '99999' })).toBe(IFRAME_H_MAX);
    expect(iframeHeightOf({ ...EMPTY_DRAFT, iframeHeight: 'abc' })).toBe(IFRAME_H_DEFAULT);
  });
});

describe('portsFromCircuit', () => {
  const io = (id, type, x, y, label, width) => ({
    id,
    type,
    x,
    y,
    label,
    ...(width ? { state: { width } } : {}),
  });

  it('étiquettes toutes présentes : ordre de haut en bas, largeurs reprises', () => {
    const res = portsFromCircuit([
      io('b', 'INPUT', 0, 100, 'B', 4),
      io('a', 'INPUT', 0, 20, 'A', 4),
      io('s', 'OUTPUT', 300, 60, 'S', 5),
      io('g', 'AND', 100, 60, ''),
    ]);
    expect(res.inputs).toEqual([
      { name: 'A', width: 4 },
      { name: 'B', width: 4 },
    ]);
    expect(res.outputs).toEqual([{ name: 'S', width: 5 }]);
    expect(res.unlabeled).toBe(0);
  });

  it('sans étiquette : ordre de création et noms libres proposés', () => {
    const res = portsFromCircuit([
      io('x', 'INPUT', 0, 100, ''),
      io('a', 'INPUT', 0, 20, 'A'),
      io('o', 'OUTPUT', 300, 60, ''),
    ]);
    expect(res.inputs).toEqual([
      { name: 'B', width: 1 },
      { name: 'A', width: 1 },
    ]);
    expect(res.outputs).toEqual([{ name: 'S', width: 1 }]);
    expect(res.unlabeled).toBe(2);
  });
});
