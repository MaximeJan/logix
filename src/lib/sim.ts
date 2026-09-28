// ============================================================
// Logique pure du simulateur — sans React ni JSX.
// Importée par l'UI (rendu) et par les tests, pour garantir une seule logique.
//
// `simulate()` reçoit `getDef` en argument : ce module est ainsi agnostique au
// format de définition (avec ou sans `shape` JSX).
// ============================================================

import type {
  Circuit,
  GetDef,
  Orientation,
  Port,
  ResolvedDef,
  SimResult,
  Wire,
} from '../domain/types';

// --------- Helpers de bit/conversion ---------
export function asInt(v: unknown): number {
  if (v === true) return 1;
  if (v === false || v == null) return 0;
  return Number(v) | 0;
}

export function maskTo(width: number, v: number): number {
  if (width >= 32) return v | 0;
  return (v | 0) & ((1 << width) - 1);
}

export const portKey = (compId: string, portName: string): string => `${compId}:${portName}`;

// --------- Table de décodage 7 segments (hex) ---------
// bit 0 = a, bit 1 = b, ..., bit 6 = g
export const SEG7_HEX_TABLE: number[] = [
  0x3f, 0x06, 0x5b, 0x4f, 0x66, 0x6d, 0x7d, 0x07, 0x7f, 0x6f, 0x77, 0x7c, 0x39, 0x5e, 0x79, 0x71,
];

// --------- Rotation : applyOrientation ---------
// Pivote la géométrie (w, h, positions des ports) selon l'orientation du composant.
// 'right' = repère natif (sortie à droite). 'down' = 90° horaire, 'left' = 180°, 'up' = 270°.
export function applyOrientation(
  def: ResolvedDef | null | undefined,
  orientation?: Orientation,
): ResolvedDef | null | undefined {
  const o = orientation ?? 'right';
  if (o === 'right' || !def) return def;
  const W = def.w;
  const H = def.h;
  const rotate = (port: Port): Port => {
    const px = port.x ?? 0;
    const py = port.y ?? 0;
    if (o === 'down') return { ...port, x: H - py, y: px };
    if (o === 'left') return { ...port, x: W - px, y: H - py };
    if (o === 'up') return { ...port, x: py, y: W - px };
    return port;
  };
  const swap = o === 'down' || o === 'up';
  return {
    ...def,
    w: swap ? H : W,
    h: swap ? W : H,
    inputs: (def.inputs ?? []).map(rotate),
    outputs: (def.outputs ?? []).map(rotate),
    nativeW: W,
    nativeH: H,
    orientation: o,
  };
}

// --------- Simulation combinatoire ---------
// Tri topologique de Kahn sur le graphe des fils, puis évaluation. Toutes les
// valeurs sont des entiers (les bus sont des Number masqués à `width` bits).
//
// Circuits bouclés (bascule SR en deux NOR, porte OR rebouclée…) : les
// composants que Kahn ne peut pas ordonner — ceux d'une boucle et tout ce qui
// en dépend — sont ré-évalués jusqu'à STABILISATION (point fixe). Une seule
// passe ne suffit pas : la première porte d'une boucle lirait l'ancienne valeur
// de l'autre, et une bascule afficherait Q = Q̄ = 0 au lieu de basculer (ou ne
// basculerait qu'au relâchement de S, selon l'ordre de pose des portes). Un
// circuit qui ne se stabilise jamais (anneau d'inverseurs) est signalé par
// `unstable`.
//
// `prevOutValues` (optionnel) porte les `outValues` du dernier appel : c'est le
// point de départ de la stabilisation, donc la MÉMOIRE d'un circuit bouclé
// (sans lui, une bascule repartirait de zéro à chaque appel). Dans un graphe
// acyclique, la source d'un fil est TOUJOURS évaluée avant sa cible : ce
// paramètre n'a alors aucun effet.
//
// Composants personnalisés : la mémoire de leur circuit interne est rangée dans
// `outValues` sous des clés préfixées `idDuComposant/…` (l'UI ne lit que des
// clés `id:port`), et rendue au sous-circuit à l'appel suivant — une bascule
// encapsulée garde donc son état.

/** Séparateur des clés de mémoire d'un sous-circuit (`idParent/id:port`). */
const CHILD_SEP = '/';
/** Plafond de passes pour stabiliser une boucle (un circuit stable en demande 2 ou 3). */
const MAX_SWEEPS = 200;

/** Le résultat d'une simulation porte-t-il une mémoire à conserver ? */
const hasMemory = (r: SimResult): boolean =>
  r.hasCycle || [...r.outValues.keys()].some((k) => k.includes(CHILD_SEP));

export function simulate(
  circuit: Circuit,
  getDef: GetDef,
  customDefs: Record<string, unknown> | null = null,
  recursionStack: Set<string> = new Set<string>(),
  prevOutValues?: Map<string, number>,
): SimResult {
  const defs = customDefs ?? circuit.customDefinitions ?? {};
  const { components, wires } = circuit;
  const compMap = new Map(components.map((c) => [c.id, c]));
  // Fils valides : ceux dont les deux extrémités pointent vers des composants existants.
  // Sans ce filtre, un fil orphelin écraserait dans wireToInput le bon fil du même port.
  const validWires = wires.filter(
    (w) => compMap.has(w.from.componentId) && compMap.has(w.to.componentId),
  );
  const wireToInput = new Map<string, Wire>();
  for (const w of validWires) {
    wireToInput.set(portKey(w.to.componentId, w.to.port), w);
  }

  // Graphe de dépendances
  const incoming = new Map<string, Set<string>>(components.map((c) => [c.id, new Set<string>()]));
  for (const w of validWires) {
    incoming.get(w.to.componentId)!.add(w.from.componentId);
  }

  const order: string[] = [];
  const inDeg = new Map<string, number>();
  for (const [id, set] of incoming) inDeg.set(id, set.size);
  const queue: string[] = [];
  for (const [id, deg] of inDeg) if (deg === 0) queue.push(id);
  const outgoing = new Map<string, string[]>(components.map((c) => [c.id, []]));
  for (const w of validWires) {
    outgoing.get(w.from.componentId)!.push(w.to.componentId);
  }
  while (queue.length) {
    const id = queue.shift()!;
    order.push(id);
    for (const next of outgoing.get(id) ?? []) {
      const d = inDeg.get(next)! - 1;
      inDeg.set(next, d);
      if (d === 0) queue.push(next);
    }
  }
  const hasCycle = order.length !== components.length;

  // Partie bouclée (boucles + leur aval), en post-ordre inverse d'un parcours en
  // profondeur : l'aval d'une boucle passe après elle, ce qui limite le nombre
  // de passes nécessaires pour se stabiliser.
  const looped: string[] = [];
  if (hasCycle) {
    const ordered = new Set(order);
    const seen = new Set<string>();
    const visit = (id: string) => {
      if (seen.has(id) || ordered.has(id)) return;
      seen.add(id);
      for (const next of outgoing.get(id) ?? []) visit(next);
      looped.push(id);
    };
    for (const c of components) visit(c.id);
    looped.reverse();
  }

  // Mémoire des sous-circuits (composants personnalisés) : celle du dernier
  // appel, regroupée par composant parent à la première demande, et celle
  // calculée pendant CET appel (prioritaire, pour le point fixe).
  let prevChildMem: Map<string, Map<string, number>> | null = null;
  const prevChildOf = (id: string): Map<string, number> | undefined => {
    if (!prevChildMem) {
      const grouped = new Map<string, Map<string, number>>();
      for (const [k, v] of prevOutValues ?? []) {
        const i = k.indexOf(CHILD_SEP);
        if (i < 0) continue;
        const parent = k.slice(0, i);
        let m = grouped.get(parent);
        if (!m) grouped.set(parent, (m = new Map()));
        m.set(k.slice(i + 1), v);
      }
      prevChildMem = grouped;
    }
    return prevChildMem.get(id);
  };
  const childMem = new Map<string, Map<string, number>>();
  const unstableChildren = new Set<string>();

  const outValues = new Map<string, number>();
  const busConflicts = new Set<string>();

  // Évalue un composant et range ses sorties. Renvoie true si l'une d'elles a
  // changé depuis sa dernière évaluation dans CET appel (sert au point fixe).
  const evaluate = (id: string): boolean => {
    const comp = compMap.get(id)!;
    const def = getDef(comp.type, defs, comp);
    if (!def) return false;

    const inputVals = def.inputs.map((p) => {
      const wire = wireToInput.get(portKey(comp.id, p.name));
      if (!wire) return 0;
      const key = portKey(wire.from.componentId, wire.from.port);
      const v = outValues.get(key);
      // Source pas encore résolue dans cette passe (fil de rebouclage) : on
      // retombe sur sa valeur au dernier appel plutôt que sur 0, sinon un
      // feedback combinatoire ne pourrait jamais « tenir » son état.
      return v !== undefined ? asInt(v) : asInt(prevOutValues?.get(key) ?? 0);
    });

    let outVals: number[];
    if (comp.type === 'INPUT') {
      const width = comp.state?.width ?? 1;
      outVals = [maskTo(width, asInt(comp.state?.value))];
    } else if (comp.type === 'OUTPUT') {
      outVals = [];
    } else if (comp.type === 'MUX') {
      const sw = comp.state?.selectWidth ?? 1;
      const dw = comp.state?.dataWidth ?? 1;
      const n = 1 << sw;
      const selVal = maskTo(sw, asInt(inputVals[n]));
      const chosen = selVal < n ? asInt(inputVals[selVal]) : 0;
      outVals = [maskTo(dw, chosen)];
    } else if (comp.type === 'DEMUX') {
      const sw = comp.state?.selectWidth ?? 1;
      const dw = comp.state?.dataWidth ?? 1;
      const n = 1 << sw;
      const dataVal = maskTo(dw, asInt(inputVals[0]));
      const selVal = maskTo(sw, asInt(inputVals[1]));
      outVals = [];
      for (let i = 0; i < n; i++) outVals.push(i === selVal ? dataVal : 0);
    } else if (comp.type === 'DECODER') {
      const w = comp.state?.width ?? 2;
      const n = 1 << w;
      const inVal = maskTo(w, asInt(inputVals[0]));
      outVals = [];
      for (let i = 0; i < n; i++) outVals.push(i === inVal ? 1 : 0);
    } else if (comp.type === 'SPLITTER') {
      // Bus → bits : chaque sortie b{k} = bit k du bus d'entrée.
      const width = comp.state?.width ?? 4;
      const busVal = maskTo(width, asInt(inputVals[0]));
      outVals = def.outputs.map((p) => (busVal >> Number(p.name.slice(1))) & 1);
    } else if (comp.type === 'MERGER') {
      // Bits → bus : reconstitue un entier à partir des entrées b{k}.
      const width = comp.state?.width ?? 4;
      let v = 0;
      def.inputs.forEach((p, idx) => {
        v |= (asInt(inputVals[idx]) & 1) << Number(p.name.slice(1));
      });
      outVals = [maskTo(width, v)];
    } else if (comp.type === 'SLICE') {
      // Extrait le champ de bits [hi..lo] du bus d'entrée : out = (in >> lo) sur
      // (hi-lo+1) bits. Bornes clampées comme dans getDynamicGeometry.
      const width = Math.max(1, Math.min(32, comp.state?.width ?? 8));
      const lo = Math.max(0, Math.min(width - 1, comp.state?.lo ?? 0));
      const hi = Math.max(lo, Math.min(width - 1, comp.state?.hi ?? width - 1));
      const inVal = maskTo(width, asInt(inputVals[0]));
      outVals = [maskTo(hi - lo + 1, inVal >> lo)];
    } else if (comp.type === 'BUS') {
      // Bus « un seul émetteur » : N sources (in{k}, en{k}). La sortie porte la
      // valeur de la source active. Si ≥2 sources sont actives → conflit signalé
      // (règle enseignée : un seul composant écrit sur le bus à la fois).
      // Ports rangés [in0, en0, in1, en1, …] : donnée en 2k, activation en 2k+1.
      const width = comp.state?.width ?? 8;
      const sources = comp.state?.sources ?? 2;
      let active = 0;
      let value = 0;
      for (let k = 0; k < sources; k++) {
        if (asInt(inputVals[2 * k + 1]) & 1) {
          active += 1;
          value |= maskTo(width, asInt(inputVals[2 * k]));
        }
      }
      outVals = [active >= 1 ? maskTo(width, value) : 0];
      if (active > 1) busConflicts.add(comp.id);
      else busConflicts.delete(comp.id);
    } else if (comp.type === 'ADDER') {
      // Additionneur combinatoire N-bit : S = (A + B + Cin) mod 2^width, Cout = retenue.
      const width = comp.state?.width ?? 4;
      const a = maskTo(width, asInt(inputVals[0])) >>> 0;
      const b = maskTo(width, asInt(inputVals[1])) >>> 0;
      const cin = asInt(inputVals[2]) & 1;
      const raw = a + b + cin;
      const limit = Math.pow(2, width);
      outVals = [maskTo(width, raw % limit), raw >= limit ? 1 : 0];
    } else if (comp.type === 'REG') {
      const width = comp.state?.width ?? 4;
      outVals = [maskTo(width, asInt(comp.state?.q))];
    } else if (comp.type === 'COUNTER') {
      // Ports [EN, LD, D, CLK] : LD=1 charge la valeur arbitraire D (asynchrone,
      // prioritaire — remplace l'ancien reset à 0). Idéal pour un compteur de
      // programme : PC ← adresse de saut.
      const width = comp.state?.width ?? 4;
      const ldVal = asInt(inputVals[1]) & 1;
      const setVal = maskTo(width, asInt(inputVals[2]));
      outVals = [ldVal ? setVal : maskTo(width, asInt(comp.state?.q))];
    } else if (comp.type === 'RAM') {
      const aw = comp.state?.addrWidth ?? 3;
      const dw = comp.state?.dataWidth ?? 4;
      const addr = maskTo(aw, asInt(inputVals[0]));
      const memRaw = comp.state?.mem;
      const mem: number[] = Array.isArray(memRaw) ? memRaw : [];
      outVals = [maskTo(dw, asInt(mem[addr] ?? 0))];
    } else if (comp.type === 'SRLATCH') {
      const sVal = asInt(inputVals[0]) & 1;
      const rVal = asInt(inputVals[1]) & 1;
      const storedQ = asInt(comp.state?.q) & 1;
      outVals = [rVal ? 0 : sVal ? 1 : storedQ];
    } else if (comp.type === 'DFF') {
      const width = comp.state?.width ?? 1;
      const rstVal = asInt(inputVals[2]) & 1;
      outVals = [rstVal ? 0 : maskTo(width, asInt(comp.state?.q))];
    } else if (comp.type === 'CLOCK') {
      outVals = [asInt(comp.state?.value) & 1];
    } else if (comp.type === 'SEG7') {
      outVals = [];
    } else if (comp.type === 'LEDMATRIX') {
      // Puits visuel : pas de sortie. L'écriture (front montant + WE) est gérée
      // hors-simulate. Le RST asynchrone met tout à zéro (cf stepSequential).
      outVals = [];
    } else if (def.isCustom) {
      if (recursionStack.has(comp.type)) {
        outVals = def.outputs.map(() => 0);
      } else {
        // Interactif (mini-calculatrice) : les entrées ne sont pas câblées, leur
        // valeur vient des clics stockés dans state.inValues. Sinon : valeurs des
        // fils arrivant sur les ports d'entrée (inputVals).
        const selfVals = (comp.state?.inValues as number[] | undefined) ?? [];
        const childComponents = def.customCircuit!.components.map((c) => {
          if (c.type !== 'INPUT') return c;
          const portIdx = def.inputs.findIndex((p) => p.internalId === c.id);
          if (portIdx < 0) return c;
          const portWidth = def.inputs[portIdx]?.width ?? 1;
          const raw = def.interactive ? selfVals[portIdx] : inputVals[portIdx];
          return {
            ...c,
            state: {
              ...(c.state ?? {}),
              width: portWidth,
              value: maskTo(portWidth, asInt(raw)),
            },
          };
        });
        const childCircuit: Circuit = {
          components: childComponents,
          wires: def.customCircuit!.wires,
        };
        const newStack = new Set(recursionStack);
        newStack.add(comp.type);
        const childResult = simulate(
          childCircuit,
          getDef,
          defs,
          newStack,
          childMem.get(comp.id) ?? prevChildOf(comp.id),
        );
        if (hasMemory(childResult)) childMem.set(comp.id, childResult.outValues);
        if (childResult.unstable) unstableChildren.add(comp.id);
        else unstableChildren.delete(comp.id);
        outVals = def.outputs.map((p) =>
          asInt(childResult.inputValues.get(portKey(p.internalId ?? p.name, 'in0')) ?? 0),
        );
      }
    } else if (def.fn) {
      outVals = def.fn(inputVals).map(asInt);
    } else {
      outVals = def.outputs.map(() => 0);
    }

    let changed = false;
    def.outputs.forEach((p, i) => {
      const key = portKey(comp.id, p.name);
      const v = asInt(outVals[i] ?? 0);
      if (outValues.get(key) !== v) changed = true;
      outValues.set(key, v);
    });
    return changed;
  };

  // Partie acyclique : une passe en ordre topologique suffit.
  for (const id of order) evaluate(id);
  // Partie bouclée : passes répétées jusqu'à ce que plus aucune sortie ne bouge.
  let stable = true;
  if (looped.length > 0) {
    const maxSweeps = Math.min(MAX_SWEEPS, 2 * looped.length + 10);
    stable = false;
    for (let sweep = 0; sweep < maxSweeps && !stable; sweep++) {
      stable = true;
      for (const id of looped) if (evaluate(id)) stable = false;
    }
  }
  const unstable = !stable || unstableChildren.size > 0;

  // Mémoire des sous-circuits, sous des clés préfixées (voir plus haut).
  for (const [id, mem] of childMem) {
    for (const [k, v] of mem) outValues.set(`${id}${CHILD_SEP}${k}`, v);
  }

  // Valeurs sur les fils = valeur de la sortie source (fils valides seulement)
  const wireValues = new Map<string, number>();
  for (const w of validWires) {
    wireValues.set(w.id, asInt(outValues.get(portKey(w.from.componentId, w.from.port)) ?? 0));
  }

  // Valeurs aux ports d'entrée
  const inputValues = new Map<string, number>();
  for (const comp of components) {
    const def = getDef(comp.type, defs, comp);
    if (!def) continue;
    for (const p of def.inputs) {
      const wire = wireToInput.get(portKey(comp.id, p.name));
      const v = wire ? wireValues.get(wire.id) : 0;
      inputValues.set(portKey(comp.id, p.name), asInt(v));
    }
  }

  return {
    outValues,
    wireValues,
    inputValues,
    hasCycle,
    unstable,
    busConflicts: [...busConflicts],
  };
}

// --------- Étape séquentielle ---------
// Met à jour les composants à mémoire (DFF, REG, COUNTER, RAM, SRLATCH, LEDMATRIX)
// à partir d'une simulation calculée AVANT cette étape — d'où l'atomicité.
// `prevOutValues` : mémoire des circuits bouclés (voir simulate).
export function stepSequential(
  circuit: Circuit,
  getDef: GetDef,
  prevOutValues?: Map<string, number>,
): Circuit {
  const sim = simulate(circuit, getDef, null, new Set<string>(), prevOutValues);
  const newComponents = circuit.components.map((comp) => {
    if (comp.type === 'SRLATCH') {
      const sVal = asInt(sim.inputValues.get(portKey(comp.id, 'S'))) & 1;
      const rVal = asInt(sim.inputValues.get(portKey(comp.id, 'R'))) & 1;
      const storedQ = asInt(comp.state?.q) & 1;
      const newQ = rVal ? 0 : sVal ? 1 : storedQ;
      if (newQ !== storedQ) {
        return { ...comp, state: { ...(comp.state ?? {}), q: newQ } };
      }
      return comp;
    }
    if (comp.type === 'REG') {
      const clkVal = asInt(sim.inputValues.get(portKey(comp.id, 'CLK'))) & 1;
      const lastClk = comp.state?.lastClk ?? 0;
      const width = comp.state?.width ?? 4;
      const storedQ = maskTo(width, asInt(comp.state?.q));
      let newQ = storedQ;
      if (lastClk === 0 && clkVal === 1) {
        const ldVal = asInt(sim.inputValues.get(portKey(comp.id, 'LD'))) & 1;
        if (ldVal) {
          const dVal = asInt(sim.inputValues.get(portKey(comp.id, 'D')));
          newQ = maskTo(width, dVal);
        }
      }
      if (newQ !== storedQ || clkVal !== lastClk) {
        return { ...comp, state: { ...(comp.state ?? {}), q: newQ, lastClk: clkVal } };
      }
      return comp;
    }
    if (comp.type === 'COUNTER') {
      const clkVal = asInt(sim.inputValues.get(portKey(comp.id, 'CLK'))) & 1;
      const ldVal = asInt(sim.inputValues.get(portKey(comp.id, 'LD'))) & 1;
      const enVal = asInt(sim.inputValues.get(portKey(comp.id, 'EN'))) & 1;
      const lastClk = comp.state?.lastClk ?? 0;
      const width = comp.state?.width ?? 4;
      const storedQ = maskTo(width, asInt(comp.state?.q));
      let newQ = storedQ;
      if (lastClk === 0 && clkVal === 1 && enVal) {
        newQ = maskTo(width, storedQ + 1);
      }
      // Chargement arbitraire (asynchrone, prioritaire) : LD=1 → Q ← D.
      if (ldVal) newQ = maskTo(width, asInt(sim.inputValues.get(portKey(comp.id, 'D'))));
      if (newQ !== storedQ || clkVal !== lastClk) {
        return { ...comp, state: { ...(comp.state ?? {}), q: newQ, lastClk: clkVal } };
      }
      return comp;
    }
    if (comp.type === 'RAM') {
      const clkVal = asInt(sim.inputValues.get(portKey(comp.id, 'CLK'))) & 1;
      const lastClk = comp.state?.lastClk ?? 0;
      const aw = comp.state?.addrWidth ?? 3;
      const dw = comp.state?.dataWidth ?? 4;
      const depth = 1 << aw;
      const memRaw = comp.state?.mem;
      const mem: number[] = Array.isArray(memRaw) ? memRaw : [];
      const rising = lastClk === 0 && clkVal === 1;
      const weVal = asInt(sim.inputValues.get(portKey(comp.id, 'WE'))) & 1;
      let newMem = mem;
      if (rising && weVal) {
        const addr = maskTo(aw, asInt(sim.inputValues.get(portKey(comp.id, 'ADDR'))));
        const dataIn = maskTo(dw, asInt(sim.inputValues.get(portKey(comp.id, 'DATA_IN'))));
        if (asInt(mem[addr] ?? 0) !== dataIn) {
          newMem = new Array(depth);
          for (let i = 0; i < depth; i++) newMem[i] = asInt(mem[i] ?? 0);
          newMem[addr] = dataIn;
        }
      }
      if (newMem !== mem || clkVal !== lastClk) {
        return { ...comp, state: { ...(comp.state ?? {}), mem: newMem, lastClk: clkVal } };
      }
      return comp;
    }
    if (comp.type === 'DFF') {
      const clkVal = asInt(sim.inputValues.get(portKey(comp.id, 'CLK'))) & 1;
      const rstVal = asInt(sim.inputValues.get(portKey(comp.id, 'RST'))) & 1;
      const dVal = asInt(sim.inputValues.get(portKey(comp.id, 'D')));
      const lastClk = comp.state?.lastClk ?? 0;
      const width = comp.state?.width ?? 1;
      const storedQ = maskTo(width, asInt(comp.state?.q));
      let newQ = storedQ;
      if (lastClk === 0 && clkVal === 1) newQ = maskTo(width, dVal);
      if (rstVal) newQ = 0;
      if (newQ !== storedQ || clkVal !== lastClk) {
        return { ...comp, state: { ...(comp.state ?? {}), q: newQ, lastClk: clkVal } };
      }
      return comp;
    }
    if (comp.type === 'LEDMATRIX') {
      // Écriture synchrone sur front montant de CLK (si WE=1 : pixels[Y*cols+X] := D).
      // RST=1 force tous les pixels à 0 (asynchrone, prioritaire).
      const clkVal = asInt(sim.inputValues.get(portKey(comp.id, 'CLK'))) & 1;
      const lastClk = comp.state?.lastClk ?? 0;
      const rstVal = asInt(sim.inputValues.get(portKey(comp.id, 'RST'))) & 1;
      const cols = comp.state?.cols ?? 8;
      const rows = comp.state?.rows ?? 8;
      const total = cols * rows;
      const pixelsRaw = comp.state?.pixels;
      const pixels: number[] = Array.isArray(pixelsRaw) ? pixelsRaw : [];
      const rising = lastClk === 0 && clkVal === 1;
      const weVal = asInt(sim.inputValues.get(portKey(comp.id, 'WE'))) & 1;
      let newPixels = pixels;
      let pixelsChanged = false;
      if (rstVal) {
        // Reset asynchrone : tous à 0
        let allZero = pixels.length === total;
        if (allZero) {
          for (let i = 0; i < total; i++)
            if (asInt(pixels[i]) !== 0) {
              allZero = false;
              break;
            }
        }
        if (!allZero) {
          newPixels = new Array(total).fill(0);
          pixelsChanged = true;
        }
      } else if (rising && weVal) {
        const x = asInt(sim.inputValues.get(portKey(comp.id, 'X')));
        const y = asInt(sim.inputValues.get(portKey(comp.id, 'Y')));
        const d = asInt(sim.inputValues.get(portKey(comp.id, 'D'))) & 1;
        if (x >= 0 && x < cols && y >= 0 && y < rows) {
          const idx = y * cols + x;
          if (asInt(pixels[idx] ?? 0) !== d) {
            newPixels = pixels.slice();
            // Normalise la taille au cas où mem aurait été redimensionnée à part
            while (newPixels.length < total) newPixels.push(0);
            newPixels.length = total;
            newPixels[idx] = d;
            pixelsChanged = true;
          }
        }
      }
      if (pixelsChanged || clkVal !== lastClk) {
        return { ...comp, state: { ...(comp.state ?? {}), pixels: newPixels, lastClk: clkVal } };
      }
      return comp;
    }
    return comp;
  });
  // Renvoie la MÊME référence si aucun composant n'a changé : `.map` produit
  // toujours un nouveau tableau, mais ses éléments restent identiques quand rien
  // ne bouge. Sans ce court-circuit, l'appelant (useCircuitEngine) croit qu'il y a
  // un changement à chaque passe → boucle de re-render qui fige l'horloge auto.
  const changed = newComponents.some((c, i) => c !== circuit.components[i]);
  return changed ? { ...circuit, components: newComponents } : circuit;
}
