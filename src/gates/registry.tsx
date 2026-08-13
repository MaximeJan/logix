// Résolution des définitions de composants : defs natives (GATES) + composants
// personnalisés (buildCustomDef), avec cache. Fournit `getDef` (passé à simulate)
// et les helpers de ports.
import { GATES } from './index';
import { applyOrientation, simulate as simulateCore } from '../lib/sim';
import { uprightTransform } from '../lib/geometry';
import type { Circuit, CircuitComponent, ResolvedDef, SimResult, Wire } from '../domain/types';

interface CustomPort {
  name: string;
  internalId: string;
  width?: number;
}

/** Définition d'un composant personnalisé, telle que stockée dans customDefinitions. */
export interface CustomDefData {
  name?: string;
  inputs: CustomPort[];
  outputs: CustomPort[];
  circuit: { components: CircuitComponent[]; wires: Wire[] };
}

// Construit un "def" type-gate à partir d'une définition stockée.
// Le résultat est compatible avec le reste du code (positions des ports, shape SVG…).
function buildCustomDef(name: string, data: CustomDefData): ResolvedDef {
  const nIn = data.inputs.length;
  const nOut = data.outputs.length;
  const maxPorts = Math.max(nIn, nOut, 1);
  // Hauteur : 20px de marge en haut, 20px par port, 20px en bas
  const h = Math.max(50, maxPorts * 20 + 20);
  // Largeur calibrée sur la longueur du nom
  const w = Math.max(80, Math.ceil((name.length * 7 + 30) / 20) * 20);

  const portY = (i: number, n: number) => {
    if (n === 1) return Math.round(h / 2 / 10) * 10;
    const span = (n - 1) * 20;
    const top = Math.round((h - span) / 2 / 10) * 10;
    return top + i * 20;
  };

  const inputs = data.inputs.map((p, i) => ({
    name: p.name,
    internalId: p.internalId,
    x: 0,
    y: portY(i, nIn),
    width: p.width ?? 1,
  }));
  const outputs = data.outputs.map((p, i) => ({
    name: p.name,
    internalId: p.internalId,
    x: w,
    y: portY(i, nOut),
    width: p.width ?? 1,
  }));

  return {
    label: name,
    category: 'Custom',
    w,
    h,
    inputs,
    outputs,
    isCustom: true,
    customName: name,
    customCircuit: data.circuit,
    shape: (
      _comp: CircuitComponent,
      _o?: number,
      _i?: number,
      _ibn?: Record<string, number>,
      angle?: number,
    ) => (
      <>
        <rect x="0" y="0" width={w} height={h} rx="4" fill="#fefdf8" />
        <text
          x={w / 2}
          y={14}
          textAnchor="middle"
          fontSize="11"
          fontWeight="600"
          fontFamily="'IBM Plex Sans', sans-serif"
          fill="#1f2937"
          transform={uprightTransform(angle, w / 2, 10)}
          style={{ userSelect: 'none' }}
        >
          {name}
        </text>
        {/* Étiquettes des ports d'entrée */}
        {inputs.map((p) => (
          <text
            key={'li' + p.name}
            x={7}
            y={p.y + 3}
            fontSize="9"
            fontFamily="'IBM Plex Mono', monospace"
            fill="#64748b"
            transform={uprightTransform(angle, 7, p.y)}
            style={{ userSelect: 'none' }}
          >
            {p.name}
          </text>
        ))}
        {/* Étiquettes des ports de sortie */}
        {outputs.map((p) => (
          <text
            key={'lo' + p.name}
            x={w - 7}
            y={p.y + 3}
            textAnchor="end"
            fontSize="9"
            fontFamily="'IBM Plex Mono', monospace"
            fill="#64748b"
            transform={uprightTransform(angle, w - 7, p.y)}
            style={{ userSelect: 'none' }}
          >
            {p.name}
          </text>
        ))}
      </>
    ),
  };
}

// Cache pour éviter de reconstruire les defs custom à chaque accès.
// La clé inclut un hash de la définition pour invalider quand elle change.
const customDefCache = new WeakMap<CustomDefData, ResolvedDef>();

// Renvoie la définition d'un type. Pour les composants dont la géométrie
// dépend de l'état (INPUT/OUTPUT en mode bus, SPLITTER/MERGER), on fusionne
// la def statique avec les valeurs renvoyées par `getDynamicGeometry(comp)`.
export function getDef(
  type: string,
  customDefs: Record<string, unknown> | null | undefined,
  comp?: CircuitComponent,
): ResolvedDef | null | undefined {
  const baseDef = GATES[type];
  if (baseDef) {
    let def: ResolvedDef;
    if (baseDef.getDynamicGeometry) {
      const fakeComp = comp ?? ({ state: baseDef.defaultState } as CircuitComponent);
      const dyn = baseDef.getDynamicGeometry(fakeComp);
      def = { ...baseDef, ...dyn } as ResolvedDef;
    } else {
      def = baseDef as unknown as ResolvedDef;
    }
    // Dessin fixe (ex. afficheur 7 segments) : l'orientation est déjà prise en
    // compte par getDynamicGeometry (positions des ports), on ne tourne PAS le dessin.
    if (def.fixedDisplay) return def;
    return applyOrientation(def, comp?.state?.orientation);
  }
  if (!customDefs) return null;
  const data = customDefs[type] as CustomDefData | undefined;
  if (!data) return null;
  let cached = customDefCache.get(data);
  if (!cached) {
    cached = buildCustomDef(type, data);
    customDefCache.set(data, cached);
  }
  return applyOrientation(cached, comp?.state?.orientation);
}

// Vérifie si un type fait référence (transitivement) à `target` à travers customDefs.
// Utilisé pour bloquer les auto-références au moment de sauver une définition.
export function typeReferences(
  type: string,
  customDefs: Record<string, CustomDefData> | null | undefined,
  target: string,
  visited: Set<string> = new Set(),
): boolean {
  if (type === target) return true;
  if (visited.has(type)) return false;
  visited.add(type);
  const data = customDefs?.[type];
  if (!data) return false;
  for (const c of data.circuit.components) {
    if (typeReferences(c.type, customDefs, target, visited)) return true;
  }
  return false;
}

export function getPortPosition(
  comp: CircuitComponent,
  portName: string,
  kind: 'input' | 'output',
  customDefs: Record<string, unknown> | null | undefined,
): { x: number; y: number } | null {
  const def = getDef(comp.type, customDefs, comp);
  if (!def) return null;
  const ports = kind === 'input' ? def.inputs : def.outputs;
  const port = ports.find((p) => p.name === portName);
  if (!port) return null;
  return { x: comp.x + (port.x ?? 0), y: comp.y + (port.y ?? 0) };
}

// Renvoie la largeur (en bits) d'un port donné. 1 = signal classique, >1 = bus.
export function getPortWidth(
  comp: CircuitComponent,
  portName: string,
  kind: 'input' | 'output',
  customDefs: Record<string, unknown> | null | undefined,
): number {
  const def = getDef(comp.type, customDefs, comp);
  if (!def) return 1;
  const ports = kind === 'input' ? def.inputs : def.outputs;
  const port = ports.find((p) => p.name === portName);
  return port?.width ?? 1;
}

// Wrapper qui fixe `getDef` : c'est ce `simulate(circuit)` qu'utilise toute l'app.
// `prevOutValues` : voir lib/sim.ts (mémoire d'un feedback combinatoire).
export function simulate(
  circuit: Circuit,
  customDefs: Record<string, unknown> | null = null,
  recursionStack: Set<string> = new Set(),
  prevOutValues?: Map<string, number>,
): SimResult {
  return simulateCore(circuit, getDef, customDefs, recursionStack, prevOutValues);
}
