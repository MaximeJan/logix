// Types du domaine — modèle de circuit, partagés par la logique pure et l'UI.
import type { ReactNode } from 'react';

export type Orientation = 'right' | 'down' | 'left' | 'up';

/** Un port (entrée ou sortie) d'un composant, dans le repère local. */
export interface Port {
  name: string;
  x?: number;
  y?: number;
  width: number;
  /** Pour les composants personnalisés : id du INPUT/OUTPUT interne correspondant. */
  internalId?: string;
}

/**
 * État d'un composant : sac de propriétés dont la présence dépend du type
 * (valeur d'une entrée, `q`/`lastClk` d'une bascule, `mem` d'une RAM, etc.).
 */
export interface ComponentState {
  width?: number;
  value?: number;
  q?: number;
  lastClk?: number;
  selectWidth?: number;
  dataWidth?: number;
  addrWidth?: number;
  mem?: number[];
  pixels?: number[];
  cols?: number;
  rows?: number;
  running?: boolean;
  freq?: number;
  lastTriggerAt?: number;
  lastToggleAt?: number;
  orientation?: Orientation;
  label?: string;
  mode?: string;
  [key: string]: unknown;
}

/** Un composant placé sur le canevas. */
export interface CircuitComponent {
  id: string;
  type: string;
  x: number;
  y: number;
  state?: ComponentState;
  label?: string;
}

/** Un fil reliant un port de sortie à un port d'entrée. */
export interface Wire {
  id: string;
  from: { componentId: string; port: string };
  to: { componentId: string; port: string };
}

/** Un circuit : composants + fils, plus les définitions personnalisées partagées. */
export interface Circuit {
  name?: string;
  components: CircuitComponent[];
  wires: Wire[];
  customDefinitions?: Record<string, unknown>;
}

/** Un onglet (zone de travail). */
export interface Tab {
  id: string;
  name: string;
  components: CircuitComponent[];
  wires: Wire[];
}

export interface TabsState {
  tabs: Tab[];
  activeTabId: string;
  customDefinitions: Record<string, unknown>;
}

/**
 * Définition résolue d'un composant, telle que la renvoie `getDef`. La logique de
 * simulation n'utilise que `inputs`, `outputs`, `fn`, `isCustom`/`customCircuit` ;
 * les champs d'UI (label, category, shape…) passent par l'index signature.
 */
export interface ResolvedDef {
  w: number;
  h: number;
  inputs: Port[];
  outputs: Port[];
  fn?: (ins: number[]) => number[];
  isCustom?: boolean;
  customCircuit?: { components: CircuitComponent[]; wires: Wire[] };
  defaultState?: ComponentState;
  nativeW?: number;
  nativeH?: number;
  orientation?: Orientation;
  /** Dessin fixe : l'orientation ne tourne PAS le dessin, elle repositionne
   *  seulement les ports (la géométrie dynamique en tient compte elle-même). */
  fixedDisplay?: boolean;
  shape?: (
    comp: CircuitComponent,
    outputValue?: number,
    inputValue?: number,
    inputsByName?: Record<string, number>,
    angle?: number,
  ) => ReactNode;
  [key: string]: unknown;
}

/** Résout la définition d'un type donné (natif ou personnalisé). */
export type GetDef = (
  type: string,
  customDefs: Record<string, unknown> | null,
  comp?: CircuitComponent,
) => ResolvedDef | null | undefined;

/** Sélection courante : ids des composants et des fils sélectionnés. */
export interface Selection {
  components: string[];
  wires: string[];
}

/** Un signal échantillonné dans le chronogramme. */
export interface Signal {
  key: string;
  label: string;
  kind?: string;
  width: number;
  value: number;
}

/** Un échantillon du chronogramme (un par transition d'horloge). */
export interface TraceSample {
  tick: number;
  signals: Signal[];
}

/** Résultat d'une passe de simulation combinatoire. */
export interface SimResult {
  outValues: Map<string, number>;
  wireValues: Map<string, number>;
  inputValues: Map<string, number>;
  hasCycle: boolean;
}
