// Sérialisation / désérialisation JSON, sans React.
// Format v1 : mono-onglet historique. Format v2 : multi-onglets (multitab=true)
// ou mono-onglet (sans `multitab`, traité comme un seul onglet).
//
// Les fonctions reçoivent en option :
//   - isKnownType(t) → bool : prédicat pour filtrer les composants au type inconnu
//     (par défaut : toujours true, donc rien n'est filtré côté tests)
//   - uid(prefix) → string : générateur d'IDs uniques (par défaut : préfixe + compteur)

export const FORMAT_VERSION = 2;

// Générateur par défaut (utilisé si l'appelant n'en fournit pas).
let _defaultCounter = 0;
const defaultUid = (prefix) => `${prefix}_${(_defaultCounter++).toString(36)}`;

// --------- Sérialisation d'un circuit individuel ---------
export function serialize(circuit) {
  return {
    version: FORMAT_VERSION,
    name: circuit.name ?? 'circuit',
    components: circuit.components.map((c) => ({
      id: c.id,
      type: c.type,
      x: c.x,
      y: c.y,
      ...(c.state !== undefined ? { state: c.state } : {}),
      ...(c.label ? { label: c.label } : {}),
    })),
    wires: circuit.wires.map((w) => ({
      id: w.id,
      from: { componentId: w.from.componentId, port: w.from.port },
      to: { componentId: w.to.componentId, port: w.to.port },
    })),
    customDefinitions: circuit.customDefinitions ?? {},
  };
}

// --------- Désérialisation mono-onglet ---------
// Accepte v1 et v2 (identique pour un circuit individuel).
export function deserialize(data, { isKnownType = () => true, uid = defaultUid } = {}) {
  if (!data || typeof data !== 'object') throw new Error('Format invalide');
  if (data.version !== 1 && data.version !== FORMAT_VERSION) {
    throw new Error(`Version inconnue: ${data.version}`);
  }
  const customDefinitions = data.customDefinitions ?? {};
  // Type connu = type natif ou type défini dans customDefinitions
  const known = (t) => isKnownType(t) || !!customDefinitions[t];

  const validIds = new Set();
  const components = [];
  for (const c of (data.components ?? [])) {
    if (!known(c.type)) continue;
    const comp = {
      id: c.id ?? uid('c'),
      type: c.type,
      x: c.x ?? 0,
      y: c.y ?? 0,
      state: c.state ?? undefined,
      label: c.label ?? '',
    };
    validIds.add(comp.id);
    components.push(comp);
  }

  const wires = (data.wires ?? [])
    .filter((w) => validIds.has(w.from.componentId) && validIds.has(w.to.componentId))
    .map((w) => ({
      id: w.id ?? uid('w'),
      from: { componentId: w.from.componentId, port: w.from.port },
      to: { componentId: w.to.componentId, port: w.to.port },
    }));

  return {
    name: data.name ?? 'circuit',
    components,
    wires,
    customDefinitions,
  };
}

// --------- Sérialisation multi-onglets ---------
export function serializeAll(tabsState) {
  return {
    version: FORMAT_VERSION,
    multitab: true,
    tabs: tabsState.tabs.map((t) => ({
      id: t.id,
      name: t.name,
      components: t.components.map((c) => ({
        id: c.id,
        type: c.type,
        x: c.x,
        y: c.y,
        ...(c.state !== undefined ? { state: c.state } : {}),
        ...(c.label ? { label: c.label } : {}),
      })),
      wires: t.wires.map((w) => ({
        id: w.id,
        from: { componentId: w.from.componentId, port: w.from.port },
        to: { componentId: w.to.componentId, port: w.to.port },
      })),
    })),
    activeTabId: tabsState.activeTabId,
    customDefinitions: tabsState.customDefinitions ?? {},
  };
}

// --------- Désérialisation multi-onglets ---------
// Accepte aussi le format mono-onglet (sans `multitab`) qui sera converti en un onglet.
export function deserializeAll(data, opts = {}) {
  if (!data || typeof data !== 'object') throw new Error('Format invalide');
  const { isKnownType = () => true, uid = defaultUid } = opts;
  if (!data.multitab) {
    const single = deserialize(data, { isKnownType, uid });
    const tab = {
      id: uid('tab'),
      name: single.name,
      components: single.components,
      wires: single.wires,
    };
    return {
      tabs: [tab],
      activeTabId: tab.id,
      customDefinitions: single.customDefinitions,
    };
  }
  if (data.version !== FORMAT_VERSION) {
    throw new Error(`Version inconnue: ${data.version}`);
  }
  const customDefinitions = data.customDefinitions ?? {};
  const known = (t) => isKnownType(t) || !!customDefinitions[t];
  const tabs = (data.tabs ?? []).map((raw) => {
    const validIds = new Set();
    const components = [];
    for (const c of (raw.components ?? [])) {
      if (!known(c.type)) continue;
      const comp = {
        id: c.id ?? uid('c'),
        type: c.type,
        x: c.x ?? 0,
        y: c.y ?? 0,
        state: c.state ?? undefined,
        label: c.label ?? '',
      };
      validIds.add(comp.id);
      components.push(comp);
    }
    const wires = (raw.wires ?? [])
      .filter((w) => validIds.has(w.from.componentId) && validIds.has(w.to.componentId))
      .map((w) => ({
        id: w.id ?? uid('w'),
        from: { componentId: w.from.componentId, port: w.from.port },
        to: { componentId: w.to.componentId, port: w.to.port },
      }));
    return {
      id: raw.id ?? uid('tab'),
      name: raw.name ?? 'Nouveau circuit',
      components,
      wires,
    };
  });
  if (tabs.length === 0) {
    const fallback = { id: uid('tab'), name: 'Nouveau circuit', components: [], wires: [] };
    tabs.push(fallback);
  }
  const activeTabId = tabs.some((t) => t.id === data.activeTabId)
    ? data.activeTabId
    : tabs[0].id;
  return { tabs, activeTabId, customDefinitions };
}
