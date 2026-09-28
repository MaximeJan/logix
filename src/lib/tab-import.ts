// Import d'un circuit (onglet + définitions personnalisées) dans l'état multi-
// onglets — logique pure, sans React. Sert à « Partir d'un lien existant » : le
// circuit préchargé d'un exercice est rouvert dans le bac à sable de
// l'enseignant pour être retouché.

import type { CircuitComponent, Tab, TabsState } from '../domain/types';

type Defs = Record<string, unknown>;

const has = (o: object, k: string) => Object.prototype.hasOwnProperty.call(o, k);

/** Composants internes d'une définition personnalisée (donnée non typée). */
function innerComponents(def: unknown): CircuitComponent[] {
  const comps = (def as { circuit?: { components?: unknown } } | null)?.circuit?.components;
  return Array.isArray(comps) ? (comps as CircuitComponent[]) : [];
}

/**
 * Sous-ensemble de `defs` réellement utilisé par `components`, en suivant les
 * définitions imbriquées. Un exercice n'embarque ainsi que les composants
 * personnalisés de son circuit, pas toute la bibliothèque de l'enseignant.
 */
export function usedCustomDefs(components: CircuitComponent[], defs: Defs): Defs {
  const out: Defs = {};
  const visit = (type: string) => {
    if (has(out, type) || !has(defs, type)) return;
    out[type] = defs[type];
    for (const c of innerComponents(defs[type])) visit(c.type);
  };
  for (const c of components) visit(c.type);
  return out;
}

export type ImportTabResult =
  | {
      state: TabsState;
      /** Définitions renommées pour éviter un conflit : ancien nom → nouveau. */
      renamed: Record<string, string>;
      /** Onglet vide remplacé par l'import (son historique peut être jeté). */
      replacedTabId: string | null;
    }
  | { error: string };

/**
 * Ajoute `tab` (et ses définitions `importedDefs`) à `state` et l'active.
 *
 * - Si l'onglet actif est vide, il est remplacé plutôt que d'en empiler un
 *   nouveau ; sinon l'import est ajouté en dernier (refusé au-delà de maxTabs).
 * - Une définition identique à celle déjà présente est partagée. Une
 *   définition de même nom mais de contenu différent est renommée « Nom (2) »
 *   (ainsi que celles qui l'utilisent) : on ne touche jamais aux définitions
 *   de l'enseignant, dont ses autres onglets dépendent.
 */
export function mergeImportedTab(
  state: TabsState,
  tab: Tab,
  importedDefs: Defs,
  maxTabs: number,
): ImportTabResult {
  const active = state.tabs.find((t) => t.id === state.activeTabId);
  const replace = !!active && active.components.length === 0 && active.wires.length === 0;
  if (!replace && state.tabs.length >= maxTabs) {
    return {
      error: `Trop d'onglets ouverts (${maxTabs} au maximum) : fermes-en un puis réessaie.`,
    };
  }

  const existing = state.customDefinitions ?? {};
  const names = Object.keys(importedDefs);
  const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

  // 1. Conflits directs, puis propagation : une définition identique qui
  //    utilise une définition renommée doit suivre, sinon elle pointerait vers
  //    la version de l'enseignant.
  const toRename = new Set(
    names.filter((n) => has(existing, n) && !same(existing[n], importedDefs[n])),
  );
  for (let changed = true; changed; ) {
    changed = false;
    for (const n of names) {
      if (toRename.has(n)) continue;
      if (innerComponents(importedDefs[n]).some((c) => toRename.has(c.type))) {
        toRename.add(n);
        changed = true;
      }
    }
  }

  // 2. Nouveaux noms libres.
  const taken = new Set([...Object.keys(existing), ...names]);
  const renamed: Record<string, string> = {};
  for (const n of toRename) {
    let k = 2;
    while (taken.has(`${n} (${k})`)) k++;
    renamed[n] = `${n} (${k})`;
    taken.add(renamed[n]);
  }
  const retype = (c: CircuitComponent): CircuitComponent =>
    has(renamed, c.type) ? { ...c, type: renamed[c.type] } : c;

  // 3. Fusion : les définitions déjà présentes (identiques) sont conservées.
  const customDefinitions: Defs = { ...existing };
  for (const n of names) {
    if (has(existing, n) && !has(renamed, n)) continue;
    const target = renamed[n] ?? n;
    const def = importedDefs[n] as { circuit?: object; name?: unknown };
    customDefinitions[target] = has(renamed, n)
      ? {
          ...def,
          ...(def.name !== undefined ? { name: target } : {}),
          circuit: { ...def.circuit, components: innerComponents(def).map(retype) },
        }
      : def;
  }

  const newTab: Tab = { ...tab, components: tab.components.map(retype) };
  const tabs = replace
    ? state.tabs.map((t) => (t.id === state.activeTabId ? newTab : t))
    : [...state.tabs, newTab];
  return {
    state: { tabs, activeTabId: newTab.id, customDefinitions },
    renamed,
    replacedTabId: replace ? state.activeTabId : null,
  };
}
