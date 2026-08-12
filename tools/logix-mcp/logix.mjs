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

// ============================================================
// CONSTRUCTION DE CIRCUIT (preset / démo / circuit-solution)
// ============================================================
// Construire un circuit à la main (bons types, bons noms de ports, largeurs
// cohérentes, coordonnées lisibles) est la partie pénible. `buildCircuit` prend
// une description HAUT NIVEAU tolérante, VALIDE tout contre la vraie logique du
// repo (getDef), place les composants automatiquement, et renvoie un `preset`
// prêt pour build_exercise / fill_truth_table.

const GRID = 20;
const snap = (v) => Math.round(Number(v) / GRID) * GRID;

// « id », « id.port », {id,port} ou {componentId,port} (format brut) → {id,port}.
function resolveEndpoint(ref) {
  if (ref && typeof ref === 'object') {
    return { id: String(ref.componentId ?? ref.id ?? ref.component ?? ''), port: ref.port };
  }
  const s = String(ref ?? '');
  const dot = s.indexOf('.');
  return dot >= 0 ? { id: s.slice(0, dot), port: s.slice(dot + 1) } : { id: s, port: undefined };
}

// Place les composants sans position en colonnes selon leur profondeur (plus long
// chemin depuis une source) → flux gauche→droite, entrées à gauche, sorties à droite.
function autoLayout(comps, wires) {
  if (!comps.some((c) => c.x == null || c.y == null)) return;
  const outAdj = new Map(comps.map((c) => [c.id, []]));
  const deg = new Map(comps.map((c) => [c.id, 0]));
  for (const w of wires) {
    outAdj.get(w.from.componentId)?.push(w.to.componentId);
    deg.set(w.to.componentId, (deg.get(w.to.componentId) ?? 0) + 1);
  }
  const level = new Map(comps.map((c) => [c.id, 0]));
  const queue = comps.filter((c) => (deg.get(c.id) ?? 0) === 0).map((c) => c.id);
  const seen = new Set();
  while (queue.length) {
    const id = queue.shift();
    if (seen.has(id)) continue;
    seen.add(id);
    for (const nxt of outAdj.get(id) ?? []) {
      level.set(nxt, Math.max(level.get(nxt) ?? 0, (level.get(id) ?? 0) + 1));
      deg.set(nxt, (deg.get(nxt) ?? 0) - 1);
      if ((deg.get(nxt) ?? 0) <= 0) queue.push(nxt);
    }
  }
  const COL = 140;
  const ROW = 90;
  const rowOfLevel = new Map();
  for (const c of comps) {
    const lvl = level.get(c.id) ?? 0;
    const row = rowOfLevel.get(lvl) ?? 0;
    rowOfLevel.set(lvl, row + 1);
    if (c.x == null) c.x = snap(40 + lvl * COL);
    if (c.y == null) c.y = snap(40 + row * ROW);
  }
}

/**
 * Construit (et valide) un circuit à partir d'une description haut niveau :
 *   {
 *     name?,
 *     components: [{ id, type, value?, width?, orientation?, label?, state?, x?, y? }],
 *     wires: [ ["A","g.in0"] | { from:"A", to:"g.in0" } | {from:{componentId,port},…} ]
 *   }
 * - `from` désigne une SORTIE, `to` une ENTRÉE. Port omis = seul port du composant.
 * - Tout est vérifié : type connu, port existant, largeurs égales, un seul fil par entrée.
 * Renvoie { preset, warnings }. Lève une erreur claire au moindre problème.
 */
export function buildCircuit(spec = {}) {
  const rawComps = Array.isArray(spec.components) ? spec.components : [];
  if (rawComps.length === 0) throw new Error('« components » est vide.');
  const rawWires = Array.isArray(spec.wires) ? spec.wires : [];

  // 1. Normalise les composants (état + validation du type).
  const byId = new Map();
  const comps = rawComps.map((rc, i) => {
    const id = String(rc.id ?? `c${i + 1}`);
    if (byId.has(id)) throw new Error(`id de composant en double : « ${id} ».`);
    const type = String(rc.type ?? '');
    if (!GATES[type]) {
      throw new Error(`type inconnu : « ${type} » (composant « ${id} »). Voir list_components.`);
    }
    const state = { ...(rc.state && typeof rc.state === 'object' ? rc.state : {}) };
    if (rc.width != null) state.width = Math.max(1, Math.min(32, Math.floor(Number(rc.width))));
    if (rc.value != null) state.value = Math.floor(Number(rc.value));
    if (rc.orientation) state.orientation = String(rc.orientation);
    const comp = {
      id,
      type,
      x: rc.x != null ? snap(rc.x) : null,
      y: rc.y != null ? snap(rc.y) : null,
      state: Object.keys(state).length ? state : undefined,
      label: rc.label != null ? String(rc.label) : undefined,
    };
    byId.set(id, comp);
    return comp;
  });

  // 2. Résout la def de chaque composant (ports + largeurs à l'état donné).
  const defById = new Map();
  for (const comp of comps) {
    const def = getDef(comp.type, null, comp);
    if (!def) throw new Error(`résolution impossible pour « ${comp.id} » (${comp.type}).`);
    defById.set(comp.id, def);
  }

  // 3. Valide et normalise les fils.
  const warnings = [];
  const driven = new Set();
  const wires = rawWires.map((rw, i) => {
    const pair = Array.isArray(rw) ? { from: rw[0], to: rw[1] } : rw;
    const from = resolveEndpoint(pair.from);
    const to = resolveEndpoint(pair.to);
    if (!byId.has(from.id)) throw new Error(`fil ${i + 1} : source « ${from.id} » inconnue.`);
    if (!byId.has(to.id)) throw new Error(`fil ${i + 1} : cible « ${to.id} » inconnue.`);
    const fromDef = defById.get(from.id);
    const toDef = defById.get(to.id);

    let fromPort = from.port;
    if (fromPort == null) {
      if (fromDef.outputs.length === 1) fromPort = fromDef.outputs[0].name;
      else
        throw new Error(
          `fil ${i + 1} : « ${from.id} » a plusieurs sorties, précise « ${from.id}.PORT » ` +
            `(${fromDef.outputs.map((p) => p.name).join(', ')}).`,
        );
    }
    const fp = fromDef.outputs.find((p) => p.name === fromPort);
    if (!fp)
      throw new Error(
        `fil ${i + 1} : sortie « ${fromPort} » absente de « ${from.id} » ` +
          `(${fromDef.outputs.map((p) => p.name).join(', ')}).`,
      );

    let toPort = to.port;
    if (toPort == null) {
      if (toDef.inputs.length === 1) toPort = toDef.inputs[0].name;
      else
        throw new Error(
          `fil ${i + 1} : « ${to.id} » a plusieurs entrées, précise « ${to.id}.PORT » ` +
            `(${toDef.inputs.map((p) => p.name).join(', ')}).`,
        );
    }
    const tp = toDef.inputs.find((p) => p.name === toPort);
    if (!tp)
      throw new Error(
        `fil ${i + 1} : entrée « ${toPort} » absente de « ${to.id} » ` +
          `(${toDef.inputs.map((p) => p.name).join(', ')}).`,
      );

    const wFrom = fp.width ?? 1;
    const wTo = tp.width ?? 1;
    if (wFrom !== wTo)
      throw new Error(
        `fil ${i + 1} : largeurs incompatibles ${from.id}.${fromPort}/${wFrom} → ` +
          `${to.id}.${toPort}/${wTo}.`,
      );

    const key = `${to.id}.${toPort}`;
    if (driven.has(key)) warnings.push(`entrée « ${key} » pilotée par plusieurs fils.`);
    driven.add(key);

    return {
      id: `w${i + 1}`,
      from: { componentId: from.id, port: fromPort },
      to: { componentId: to.id, port: toPort },
    };
  });

  // 4. Coordonnées auto pour ce qui n'en a pas.
  autoLayout(comps, wires);

  const preset = {
    version: 2,
    name: String(spec.name ?? 'circuit'),
    components: comps.map((c) => ({
      id: c.id,
      type: c.type,
      x: c.x ?? 0,
      y: c.y ?? 0,
      ...(c.state ? { state: c.state } : {}),
      ...(c.label ? { label: c.label } : {}),
    })),
    wires,
    customDefinitions: {},
  };
  return { preset, warnings };
}

// Accepte un circuit BRUT ({components, wires:[{from:{componentId}…}]}) OU une
// description haut niveau, et renvoie toujours la forme brute (validée). Sert à
// fill_truth_table pour tolérer les deux entrées.
function normalizeCircuit(circuit) {
  if (!circuit || !Array.isArray(circuit.components)) {
    throw new Error('« circuit » (avec components/wires) est obligatoire.');
  }
  return buildCircuit(circuit).preset;
}

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
  // Sucre : on peut passer un `circuit` haut niveau au lieu d'un `preset` déjà
  // sérialisé — une démo verrouillée tient alors en un seul appel.
  let warnings = [];
  let effectiveSpec = spec;
  if (!spec.preset && spec.circuit && typeof spec.circuit === 'object') {
    const built = buildCircuit(spec.circuit);
    effectiveSpec = { ...spec, preset: built.preset };
    warnings = built.warnings;
  }

  const ex = assembleExercise(effectiveSpec);
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
  // Accepte un circuit brut OU une description haut niveau (mêmes clés que
  // build_circuit) : dans les deux cas on obtient une forme brute validée.
  const rawCircuit = normalizeCircuit(circuit);
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
  const res = verifyExercise(rawCircuit, ex, getDef, { stopOnFirstFailure: false });
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
