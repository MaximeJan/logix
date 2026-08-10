// Couche métier de l'outil : assemble un objet `Exercise`, l'encode en lien
// partageable, simule un circuit pour pré-remplir des sorties, et liste les
// composants disponibles. Partagée par le CLI et le serveur MCP.
//
// Toute la logique « dure » vient de core.mjs (bundle de la VRAIE logique du
// repo) — ici on ne fait qu'emballer et parer aux entrées mal formées.
import {
  encodeExercise,
  MAX_PAYLOAD,
  verifyExercise,
  getDef,
  GATES,
  PALETTE_ORDER,
} from './core.mjs';

/** URL où Logix est servi pour les élèves (déploiement GitHub Pages). */
export const DEFAULT_BASE_URL = 'https://maximejan.github.io/logix/';

const asPorts = (list) =>
  (Array.isArray(list) ? list : []).map((p) => ({
    name: String(p?.name ?? ''),
    width: Math.max(1, Math.min(32, Math.floor(Number(p?.width) || 1))),
  }));

// Construit un `Exercise` (forme attendue par encodeExercise) à partir d'un
// « spec » simplifié et tolérant.
function assembleExercise(spec = {}) {
  const rows = Array.isArray(spec.rows) ? spec.rows : [];
  const verify = spec.verify ?? (rows.length ? 'truthtable' : 'none');
  const inputs = asPorts(spec.inputs);
  const outputs = asPorts(spec.outputs);

  const ex = {
    title: String(spec.title ?? '').trim(),
    objective: String(spec.objective ?? '').trim(),
    steps: (Array.isArray(spec.steps) ? spec.steps : []).map(String),
    allowedTypes: (Array.isArray(spec.allowedTypes) ? spec.allowedTypes : []).filter(
      (t) => !!GATES[t],
    ),
    inputs,
    outputs,
    autoOpenProperties: !!spec.autoOpenProperties,
    locked: !!spec.locked,
    verify:
      verify === 'sequence'
        ? { type: 'sequence', steps: rows }
        : verify === 'none'
          ? { type: 'none' }
          : { type: 'truthtable' },
  };
  if (verify === 'truthtable') ex.truthTable = rows;
  if (spec.preset && typeof spec.preset === 'object') ex.preset = spec.preset;
  return ex;
}

/**
 * Construit le lien partageable d'un exercice + l'extrait <iframe>.
 * Renvoie aussi la taille du payload et un drapeau `tooLong` si le lien
 * dépasse le plafond (auquel cas Logix l'ignorerait au chargement).
 */
export function buildExercise(spec = {}) {
  const ex = assembleExercise(spec);
  if (!ex.title) throw new Error('« title » est obligatoire.');
  if (ex.verify.type !== 'none' && (ex.inputs.length === 0 || ex.outputs.length === 0)) {
    throw new Error(
      'Une vérification (truthtable/sequence) exige au moins une entrée et une sortie. ' +
        'Utilise verify:"none" pour un énoncé libre.',
    );
  }
  if (ex.verify.type !== 'none') {
    const rows = ex.verify.type === 'sequence' ? ex.verify.steps : ex.truthTable;
    if (!rows || rows.length === 0) {
      throw new Error('Fournis au moins une ligne dans « rows » (ou passe verify:"none").');
    }
  }

  const payload = encodeExercise(ex);
  const tooLong = payload.length > MAX_PAYLOAD;
  const base = String(spec.baseUrl || DEFAULT_BASE_URL);
  const url = `${base}?ex=${payload}`;
  const embedUrl = `${url}&embed=1`;
  const height = Math.max(200, Math.min(2000, Math.floor(Number(spec.iframeHeight) || 700)));
  const iframe = `<iframe src="${embedUrl}" width="100%" height="${height}" style="border:0"></iframe>`;

  return { url, embedUrl, iframe, payloadLength: payload.length, maxPayload: MAX_PAYLOAD, tooLong };
}

// Répartit un entier `n` sur des entrées de largeurs données (1re entrée en tête),
// comme le générateur de combinaisons de l'app.
function splitCombo(n, widths) {
  const vals = [];
  let rest = n;
  for (let k = widths.length - 1; k >= 0; k--) {
    const w = widths[k];
    vals[k] = rest & ((1 << w) - 1);
    rest >>>= w;
  }
  return vals;
}

/**
 * Simule un circuit-solution et renvoie la table de vérité remplie (sorties
 * obtenues). C'est l'équivalent hors-ligne du bouton « Remplir les sorties
 * depuis le circuit courant » : construis le circuit correct, récupère les
 * bonnes réponses, sans jamais te tromper à la main.
 *
 * - `circuit`   : { components:[...], wires:[...] } (INPUT/OUTPUT appariés par
 *                 ordre de création, comme dans l'app).
 * - `inputPorts`/`outputPorts` : [{name,width}] décrivant les colonnes.
 * - `rows`      : lignes d'entrée [[v0,v1,...], ...] ; ou `generate:true` pour
 *                 énumérer toutes les combinaisons (≤ 8 bits d'entrée au total).
 */
export function fillTruthTable({ circuit, inputPorts, outputPorts, rows, generate } = {}) {
  if (!circuit || !Array.isArray(circuit.components)) {
    throw new Error('« circuit » (avec components/wires) est obligatoire.');
  }
  const inputs = asPorts(inputPorts);
  const outputs = asPorts(outputPorts);
  if (inputs.length === 0 || outputs.length === 0) {
    throw new Error('« inputPorts » et « outputPorts » sont obligatoires.');
  }

  let inRows = Array.isArray(rows) ? rows : null;
  if (!inRows) {
    if (!generate) throw new Error('Fournis « rows », ou passe generate:true.');
    const widths = inputs.map((p) => p.width);
    const total = widths.reduce((s, w) => s + w, 0);
    if (total > 8) throw new Error(`${total} bits d'entrée : trop pour générer (max 8).`);
    inRows = [];
    for (let n = 0; n < 1 << total; n++) inRows.push(splitCombo(n, widths));
  }

  const truthTable = inRows.map((r) => [r, outputs.map(() => 0)]);
  const ex = {
    title: '_',
    objective: '',
    steps: [],
    allowedTypes: [],
    inputs,
    outputs,
    autoOpenProperties: false,
    locked: false,
    verify: { type: 'truthtable' },
    truthTable,
  };
  const res = verifyExercise({ components: circuit.components, wires: circuit.wires ?? [] }, ex, getDef, {
    stopOnFirstFailure: false,
  });
  if (!res.table) throw new Error(res.error ?? 'Simulation impossible.');
  return res.table.map((t) => ({ inputs: t.inVals, outputs: t.actualOutVals }));
}

/** Liste les composants disponibles (type, libellé, catégorie, ports). */
export function listComponents() {
  return PALETTE_ORDER.filter((t) => !!GATES[t]).map((type) => {
    const def = getDef(type, null);
    const port = (p) => ({ name: p.name, width: p.width ?? 1 });
    return {
      type,
      label: def?.label ?? type,
      category: def?.category ?? '',
      inputs: (def?.inputs ?? []).map(port),
      outputs: (def?.outputs ?? []).map(port),
    };
  });
}
