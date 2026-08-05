// Encodage / décodage d'un exercice dans une URL — logique pure, sans React.
//
// But : un enseignant peut fabriquer un exercice sur mesure et le partager par un
// simple lien (ou l'embarquer en iframe dans un site de théorie), sans backend et
// sans redéployer l'app. Tout l'énoncé tient dans le paramètre `?ex=`.
//
// Format « fil » (clés d'une lettre pour garder l'URL courte) :
//   { v:1, t:titre, o:objectif, s:[étapes], a:[typesAutorisés],
//     i:[[nom,largeur]], u:[[nom,largeur]], k:'tt'|'seq'|'none', r:[[[in],[out]]] }
// puis JSON → UTF-8 → base64url.
//
// Le payload vient de l'URL : c'est une donnée NON FIABLE. `decodeExercise` ne
// lève jamais et assainit tout (plafonds de taille, largeurs clampées, types de
// composants filtrés contre GATES). En cas de doute il renvoie null.

import type { Exercise, IoRow, Verify } from '../domain/exercise';

/** Version du format d'exercice transporté par l'URL. */
export const EXERCISE_FORMAT_VERSION = 1;

/** Nom du paramètre d'URL portant l'exercice. */
export const EXERCISE_PARAM = 'ex';
/** Nom du paramètre d'URL activant l'UI allégée (iframe). */
export const EMBED_PARAM = 'embed';

// Plafonds d'assainissement — largement au-dessus d'un usage pédagogique normal,
// mais suffisants pour empêcher une URL forgée de faire ramer l'app.
const MAX_PAYLOAD = 16384; // caractères de base64url
const MAX_TEXT = 400; // titre / objectif / une étape / un nom de port
const MAX_STEPS = 30;
const MAX_PORTS = 16;
const MAX_ROWS = 512;
const MAX_WIDTH = 32;

// ---------------------------------------------------------------- base64url

function bytesToBase64(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function toBase64Url(b64: string): string {
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(s: string): string {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/');
  return b64 + '='.repeat((4 - (b64.length % 4)) % 4);
}

// ---------------------------------------------------------------- encodage

type WirePort = [string, number];
type WireKind = 'tt' | 'seq' | 'none';

interface WireExercise {
  v: number;
  t: string;
  o: string;
  s: string[];
  a: string[];
  i: WirePort[];
  u: WirePort[];
  k: WireKind;
  r: IoRow[];
}

const wireKind = (v: Verify): WireKind =>
  v.type === 'sequence' ? 'seq' : v.type === 'none' ? 'none' : 'tt';

/** Sérialise un exercice en chaîne base64url à mettre dans `?ex=`. */
export function encodeExercise(exercise: Exercise): string {
  const rows =
    exercise.verify.type === 'sequence'
      ? exercise.verify.steps
      : exercise.verify.type === 'truthtable'
        ? (exercise.truthTable ?? [])
        : [];
  const wire: WireExercise = {
    v: EXERCISE_FORMAT_VERSION,
    t: exercise.title,
    o: exercise.objective,
    s: exercise.steps,
    a: exercise.allowedTypes,
    i: exercise.inputs.map((p): WirePort => [p.name, p.width]),
    u: exercise.outputs.map((p): WirePort => [p.name, p.width]),
    k: wireKind(exercise.verify),
    r: rows,
  };
  const bytes = new TextEncoder().encode(JSON.stringify(wire));
  return toBase64Url(bytesToBase64(bytes));
}

// ---------------------------------------------------------------- décodage

const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

const text = (v: unknown): string => (typeof v === 'string' ? v.slice(0, MAX_TEXT) : '');

const textList = (v: unknown, max: number): string[] =>
  Array.isArray(v)
    ? v
        .slice(0, max)
        .filter((s) => typeof s === 'string')
        .map(text)
    : [];

const clampWidth = (v: unknown): number => {
  const n = Math.floor(Number(v));
  if (!Number.isFinite(n)) return 1;
  return Math.min(MAX_WIDTH, Math.max(1, n));
};

function parsePorts(v: unknown): { name: string; width: number }[] {
  if (!Array.isArray(v)) return [];
  return v
    .slice(0, MAX_PORTS)
    .filter(Array.isArray)
    .map((p) => ({ name: text(p[0]), width: clampWidth(p[1]) }));
}

// Une valeur de bus : entier non signé, borné à 32 bits.
const cell = (v: unknown): number => {
  const n = Math.floor(Number(v));
  return Number.isFinite(n) ? n >>> 0 : 0;
};

function parseRows(v: unknown): IoRow[] {
  if (!Array.isArray(v)) return [];
  const rows: IoRow[] = [];
  for (const row of v.slice(0, MAX_ROWS)) {
    if (!Array.isArray(row) || !Array.isArray(row[0]) || !Array.isArray(row[1])) return [];
    rows.push([row[0].slice(0, MAX_PORTS).map(cell), row[1].slice(0, MAX_PORTS).map(cell)]);
  }
  return rows;
}

export interface DecodeOptions {
  /** Prédicat de type connu (basé sur GATES) — les types inconnus sont retirés. */
  isKnownType?: (type: string) => boolean;
}

/**
 * Décode le paramètre `?ex=` en un `Exercise` utilisable tel quel par
 * `verifyExercise`. Renvoie `null` si le payload est absent, corrompu, d'une
 * version inconnue, ou s'il ne décrit pas un exercice exploitable.
 */
export function decodeExercise(payload: string, opts: DecodeOptions = {}): Exercise | null {
  if (!payload || payload.length > MAX_PAYLOAD) return null;

  let data: unknown;
  try {
    const bytes = base64ToBytes(fromBase64Url(payload));
    data = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return null;
  }

  if (!isObj(data) || data.v !== EXERCISE_FORMAT_VERSION) return null;

  const isKnownType = opts.isKnownType ?? (() => true);
  const title = text(data.t);
  // Un exercice sans titre n'est pas exploitable, quel que soit son mode.
  if (!title) return null;

  const base = {
    title,
    objective: text(data.o),
    steps: textList(data.s, MAX_STEPS),
    allowedTypes: textList(data.a, MAX_PORTS * 4).filter(isKnownType),
    inputs: parsePorts(data.i),
    outputs: parsePorts(data.u),
  };

  // Exercice libre : ni ports ni lignes obligatoires, pas de bouton « Vérifier ».
  if (data.k === 'none') return { ...base, verify: { type: 'none' } };

  const rows = parseRows(data.r);
  if (base.inputs.length === 0 || base.outputs.length === 0 || rows.length === 0) return null;

  const sequence = data.k === 'seq';
  const verify: Verify = sequence ? { type: 'sequence', steps: rows } : { type: 'truthtable' };

  return { ...base, verify, ...(sequence ? {} : { truthTable: rows }) };
}

// ---------------------------------------------------------------- URL & clé

/** Base de l'URL de l'app (origine + chemin), sans query ni fragment. */
function appBaseUrl(): string {
  return window.location.origin + window.location.pathname;
}

/** Construit l'URL partageable d'un exercice (optionnellement en mode embed). */
export function buildExerciseUrl(exercise: Exercise, options: { embed?: boolean } = {}): string {
  const params = new URLSearchParams();
  params.set(EXERCISE_PARAM, encodeExercise(exercise));
  if (options.embed) params.set(EMBED_PARAM, '1');
  return `${appBaseUrl()}?${params.toString()}`;
}

/**
 * Hash court et stable d'un payload (FNV-1a 32 bits, en base 36). Sert à donner
 * à chaque exercice sa propre clé d'autosave, pour ne jamais écraser le bac à
 * sable personnel de l'élève.
 */
export function payloadHash(payload: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < payload.length; i++) {
    h ^= payload.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}
