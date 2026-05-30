// Sérialisation / désérialisation JSON, sans React.
// Format v1 : mono-onglet historique. Format v2 : multi-onglets (multitab=true)
// ou mono-onglet (sans `multitab`, traité comme un seul onglet).
//
// Les fonctions reçoivent en option :
//   - isKnownType(t) → bool : filtre les composants au type inconnu
//   - uid(prefix) → string : générateur d'IDs uniques

import type {
  Circuit,
  CircuitComponent,
  ComponentState,
  Tab,
  TabsState,
  Wire,
} from '../domain/types';

export const FORMAT_VERSION = 2;

interface PersistOptions {
  isKnownType?: (type: string) => boolean;
  uid?: (prefix: string) => string;
}

// Formes brutes (non fiables) lues depuis le JSON. On les valide/normalise à la
// désérialisation. Champs optionnels car un fichier externe peut être incomplet.
interface RawComponent {
  id?: string;
  type: string;
  x?: number;
  y?: number;
  state?: ComponentState;
  label?: string;
}
interface RawWire {
  id?: string;
  from: { componentId: string; port: string };
  to: { componentId: string; port: string };
}
interface RawTab {
  id?: string;
  name?: string;
  components?: RawComponent[];
  wires?: RawWire[];
}
interface RawData {
  version?: number;
  multitab?: boolean;
  name?: string;
  components?: RawComponent[];
  wires?: RawWire[];
  tabs?: RawTab[];
  activeTabId?: string;
  customDefinitions?: Record<string, unknown>;
}

// Générateur par défaut (utilisé si l'appelant n'en fournit pas).
let _defaultCounter = 0;
const defaultUid = (prefix: string): string => `${prefix}_${(_defaultCounter++).toString(36)}`;

// Valide/normalise les composants et fils bruts d'un onglet (ou d'un circuit
// mono-onglet) : on ignore les composants au type inconnu, on génère les IDs
// manquants, puis on ne garde que les fils dont les deux extrémités existent.
// Partagé par `deserialize` (mono) et `deserializeAll` (multi) pour éviter la
// duplication de cette logique sensible.
function parseComponentsAndWires(
  rawComponents: RawComponent[] | undefined,
  rawWires: RawWire[] | undefined,
  known: (type: string) => boolean,
  uid: (prefix: string) => string,
): { components: CircuitComponent[]; wires: Wire[] } {
  const validIds = new Set<string>();
  const components: CircuitComponent[] = [];
  for (const c of rawComponents ?? []) {
    if (!known(c.type)) continue;
    const comp: CircuitComponent = {
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
  const wires: Wire[] = (rawWires ?? [])
    .filter((w: RawWire) => validIds.has(w.from.componentId) && validIds.has(w.to.componentId))
    .map((w: RawWire) => ({
      id: w.id ?? uid('w'),
      from: { componentId: w.from.componentId, port: w.from.port },
      to: { componentId: w.to.componentId, port: w.to.port },
    }));
  return { components, wires };
}

const serializeComponent = (c: CircuitComponent) => ({
  id: c.id,
  type: c.type,
  x: c.x,
  y: c.y,
  ...(c.state !== undefined ? { state: c.state } : {}),
  ...(c.label ? { label: c.label } : {}),
});

const serializeWire = (w: Wire) => ({
  id: w.id,
  from: { componentId: w.from.componentId, port: w.from.port },
  to: { componentId: w.to.componentId, port: w.to.port },
});

// --------- Sérialisation d'un circuit individuel ---------
// NB : l'application n'utilise que `serializeAll`/`deserializeAll` (multi-onglets).
// `serialize` est conservé pour la symétrie d'API et le round-trip testé en Vitest.
export function serialize(circuit: Circuit) {
  return {
    version: FORMAT_VERSION,
    name: circuit.name ?? 'circuit',
    components: circuit.components.map(serializeComponent),
    wires: circuit.wires.map(serializeWire),
    customDefinitions: circuit.customDefinitions ?? {},
  };
}

// --------- Désérialisation mono-onglet (accepte v1 et v2) ---------
export function deserialize(
  raw: unknown,
  { isKnownType = () => true, uid = defaultUid }: PersistOptions = {},
): Circuit {
  if (!raw || typeof raw !== 'object') throw new Error('Format invalide');
  const data = raw as RawData;
  if (data.version !== 1 && data.version !== FORMAT_VERSION) {
    throw new Error(`Version inconnue: ${data.version}`);
  }
  const customDefinitions = data.customDefinitions ?? {};
  // Type connu = type natif ou type défini dans customDefinitions
  const known = (t: string) => isKnownType(t) || !!customDefinitions[t];

  const { components, wires } = parseComponentsAndWires(data.components, data.wires, known, uid);

  return {
    name: data.name ?? 'circuit',
    components,
    wires,
    customDefinitions,
  };
}

// --------- Sérialisation multi-onglets ---------
export function serializeAll(tabsState: TabsState) {
  return {
    version: FORMAT_VERSION,
    multitab: true,
    tabs: tabsState.tabs.map((t) => ({
      id: t.id,
      name: t.name,
      components: t.components.map(serializeComponent),
      wires: t.wires.map(serializeWire),
    })),
    activeTabId: tabsState.activeTabId,
    customDefinitions: tabsState.customDefinitions ?? {},
  };
}

// --------- Désérialisation multi-onglets ---------
// Accepte aussi le format mono-onglet (sans `multitab`), converti en un onglet.
export function deserializeAll(raw: unknown, opts: PersistOptions = {}): TabsState {
  if (!raw || typeof raw !== 'object') throw new Error('Format invalide');
  const data = raw as RawData;
  const { isKnownType = () => true, uid = defaultUid } = opts;
  if (!data.multitab) {
    const single = deserialize(data, { isKnownType, uid });
    const tab: Tab = {
      id: uid('tab'),
      name: single.name ?? 'circuit',
      components: single.components,
      wires: single.wires,
    };
    return {
      tabs: [tab],
      activeTabId: tab.id,
      customDefinitions: single.customDefinitions ?? {},
    };
  }
  if (data.version !== FORMAT_VERSION) {
    throw new Error(`Version inconnue: ${data.version}`);
  }
  const customDefinitions = data.customDefinitions ?? {};
  const known = (t: string) => isKnownType(t) || !!customDefinitions[t];
  const tabs: Tab[] = (data.tabs ?? []).map((rawTab: RawTab) => {
    const { components, wires } = parseComponentsAndWires(
      rawTab.components,
      rawTab.wires,
      known,
      uid,
    );
    return {
      id: rawTab.id ?? uid('tab'),
      name: rawTab.name ?? 'Nouveau circuit',
      components,
      wires,
    };
  });
  if (tabs.length === 0) {
    tabs.push({ id: uid('tab'), name: 'Nouveau circuit', components: [], wires: [] });
  }
  const activeTabId = tabs.find((t) => t.id === data.activeTabId)?.id ?? tabs[0].id;
  return { tabs, activeTabId, customDefinitions };
}
