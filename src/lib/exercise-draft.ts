// Brouillon du générateur d'exercices — logique pure, sans React.
//
// Le brouillon vit dans l'orchestrateur (il survit à la fermeture de la
// modale) ; ce module le convertit vers/depuis un `Exercise`, ce qui permet de
// rouvrir un exercice existant (« Partir d'un lien existant ») pour le modifier.

import type { CircuitComponent } from '../domain/types';
import type { Exercise, ExercisePort, IoRow } from '../domain/exercise';

/** Mode de vérification choisi par l'enseignant. */
export type VerifyKind = 'tt' | 'seq' | 'none';

// Hauteur de l'iframe proposée dans l'extrait à coller (en pixels).
export const IFRAME_H_DEFAULT = 700;
export const IFRAME_H_MIN = 200;
export const IFRAME_H_MAX = 2000;

export interface ExerciseDraft {
  title: string;
  objective: string;
  stepsText: string;
  allowedTypes: string[];
  inputs: ExercisePort[];
  outputs: ExercisePort[];
  verifyKind: VerifyKind;
  rows: IoRow[];
  autoOpenProperties: boolean;
  /** Inclure le circuit courant comme point de départ (démo, scaffolding). */
  includePreset: boolean;
  /** Verrouiller le circuit : l'élève ne peut pas le modifier. */
  locked: boolean;
  /** Zoom initial en iframe (%), null = auto. */
  zoom: number | null;
  /** Hauteur de l'iframe, saisie libre (bornée à la lecture). */
  iframeHeight: string;
  /** Identifiant de sauvegarde de l'exercice importé ; null = nouvel exercice. */
  sourceId: string | null;
  /** Reprendre `sourceId` : les élèves retrouvent le travail commencé. */
  keepProgress: boolean;
}

export const EMPTY_DRAFT: ExerciseDraft = {
  title: '',
  objective: '',
  stepsText: '',
  allowedTypes: ['INPUT', 'OUTPUT'],
  inputs: [{ name: 'A', width: 1 }],
  outputs: [{ name: 'S', width: 1 }],
  verifyKind: 'tt',
  rows: [],
  autoOpenProperties: false,
  includePreset: false,
  locked: false,
  zoom: null,
  iframeHeight: String(IFRAME_H_DEFAULT),
  sourceId: null,
  keepProgress: true,
};

/** Hauteur d'iframe exploitable à partir de la saisie libre. */
export function iframeHeightOf(draft: ExerciseDraft): number {
  const n = Math.floor(Number(draft.iframeHeight));
  if (!Number.isFinite(n) || n <= 0) return IFRAME_H_DEFAULT;
  return Math.min(IFRAME_H_MAX, Math.max(IFRAME_H_MIN, n));
}

/**
 * Exercice décrit par le brouillon, ou null s'il est incomplet (titre manquant,
 * ou — hors mode sans vérification — pas de port ou pas de ligne). `preset` est
 * le circuit courant sérialisé, embarqué si l'enseignant le demande.
 */
export function draftToExercise(draft: ExerciseDraft, preset: unknown): Exercise | null {
  const title = draft.title.trim();
  if (!title) return null;
  const noVerify = draft.verifyKind === 'none';
  // Sans vérification, ni ports ni lignes ne sont obligatoires.
  if (
    !noVerify &&
    (draft.inputs.length === 0 || draft.outputs.length === 0 || draft.rows.length === 0)
  ) {
    return null;
  }
  const steps = draft.stepsText
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);
  return {
    title,
    objective: draft.objective.trim(),
    steps,
    allowedTypes: draft.allowedTypes,
    inputs: draft.inputs,
    outputs: draft.outputs,
    verify: noVerify
      ? { type: 'none' }
      : draft.verifyKind === 'seq'
        ? { type: 'sequence', steps: draft.rows }
        : { type: 'truthtable' },
    ...(draft.verifyKind === 'tt' ? { truthTable: draft.rows } : {}),
    autoOpenProperties: draft.autoOpenProperties,
    locked: draft.locked,
    // Verrouiller implique de fournir un circuit (sinon rien à montrer).
    ...(draft.includePreset || draft.locked ? { preset } : {}),
    ...(draft.zoom !== null ? { zoom: draft.zoom } : {}),
    ...(draft.sourceId && draft.keepProgress ? { id: draft.sourceId } : {}),
  };
}

/**
 * Brouillon pré-rempli à partir d'un exercice existant, pour le modifier.
 * `sourceId` est son identifiant de sauvegarde (cf. exerciseStorageId) : le
 * garder permet aux élèves de retrouver leur travail sur le nouveau lien.
 */
export function exerciseToDraft(
  exercise: Exercise,
  sourceId: string,
  iframeHeight?: number,
): ExerciseDraft {
  const v = exercise.verify;
  return {
    title: exercise.title,
    objective: exercise.objective,
    stepsText: exercise.steps.join('\n'),
    allowedTypes: exercise.allowedTypes,
    inputs: exercise.inputs,
    outputs: exercise.outputs,
    verifyKind: v.type === 'sequence' ? 'seq' : v.type === 'none' ? 'none' : 'tt',
    rows:
      v.type === 'sequence' ? v.steps : v.type === 'truthtable' ? (exercise.truthTable ?? []) : [],
    autoOpenProperties: exercise.autoOpenProperties,
    includePreset: exercise.preset !== undefined,
    locked: exercise.locked,
    zoom: exercise.zoom ?? null,
    iframeHeight: String(iframeHeight ?? IFRAME_H_DEFAULT),
    sourceId,
    keepProgress: true,
  };
}

/** Propose A, B, C… (ou S, T, U… pour les sorties) en évitant les doublons. */
export function nextName(existing: ExercisePort[], start = 'A'): string {
  const base = start.charCodeAt(0);
  for (let i = 0; i < 26; i++) {
    const name = String.fromCharCode(base + i);
    if (!existing.some((p) => p.name === name)) return name;
  }
  return `P${existing.length + 1}`;
}

/**
 * Ports attendus déduits des Entrée/Sortie d'un circuit (étiquette + largeur).
 *
 * Si toutes portent une étiquette, on les range de haut en bas (ordre de
 * lecture) : la vérification apparie par étiquette, l'ordre est libre. Sinon on
 * garde l'ordre de création, celui sur lequel la vérification se replie, et les
 * ports sans étiquette reçoivent un nom libre — `unlabeled` le signale.
 */
export function portsFromCircuit(components: CircuitComponent[]): {
  inputs: ExercisePort[];
  outputs: ExercisePort[];
  unlabeled: number;
} {
  let unlabeled = 0;
  const pick = (type: string, start: string): ExercisePort[] => {
    let comps = components.filter((c) => c.type === type);
    const label = (c: CircuitComponent) => (c.label ?? '').trim();
    if (comps.every((c) => label(c))) {
      comps = comps.slice().sort((a, b) => a.y - b.y || a.x - b.x);
    }
    const ports: ExercisePort[] = comps.map((c) => ({
      name: label(c),
      width: c.state?.width ?? 1,
    }));
    for (const p of ports) {
      if (p.name) continue;
      unlabeled++;
      p.name = nextName(ports, start);
    }
    return ports;
  };
  return { inputs: pick('INPUT', 'A'), outputs: pick('OUTPUT', 'S'), unlabeled };
}
