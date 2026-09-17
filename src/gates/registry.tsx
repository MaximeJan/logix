// Résolution des définitions de composants : defs natives (GATES) + composants
// personnalisés (buildCustomDef), avec cache. Fournit `getDef` (passé à simulate)
// et les helpers de ports.
import { GATES } from './index';
import { applyOrientation, simulate as simulateCore } from '../lib/sim';
import { interactiveLayout } from '../lib/custom-interactive';
import { rectLayout } from './rectLayout';
import { RectShape } from './RectShape';
import type {
  Circuit,
  CircuitComponent,
  Port,
  ResolvedDef,
  SimResult,
  Wire,
} from '../domain/types';

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
  /** Mode « mini-calculatrice » : entrées cliquables, sorties affichées. */
  interactive?: boolean;
}

// Composant custom INTERACTIF : entrées cliquables + sorties affichées, dans une
// seule boîte (mini-calculatrice). Les cellules et valeurs sont dessinées par le
// canevas (il a l'état + la simulation) ; la shape ne pose que la boîte + le
// titre, ce qui suffit à l'aperçu de palette. `fixedDisplay` : jamais tournée.
function buildInteractiveDef(name: string, data: CustomDefData): ResolvedDef {
  const L = interactiveLayout(name, data.inputs, data.outputs);
  const inRowY = new Map(L.rows.filter((r) => r.kind === 'in').map((r) => [r.index, r.y]));
  const inputs = data.inputs.map((p, i) => ({
    name: p.name,
    internalId: p.internalId,
    x: 0,
    y: inRowY.get(i) ?? 0,
    width: p.width ?? 1,
  }));
  const outputs = L.outPorts.map((op) => ({
    name: op.name,
    internalId: op.internalId,
    x: op.x,
    y: op.y,
    width: op.width,
  }));

  return {
    label: name,
    category: 'Custom',
    w: L.w,
    h: L.h,
    inputs,
    outputs,
    isCustom: true,
    interactive: true,
    fixedDisplay: true,
    customName: name,
    customCircuit: data.circuit,
    defaultState: { inValues: data.inputs.map(() => 0) },
    shape: () => (
      <>
        <rect x={0} y={0} width={L.w} height={L.h} rx={5} fill="#fefdf8" />
        <line x1={0} y1={L.titleH} x2={L.w} y2={L.titleH} stroke="#e7e5e4" strokeWidth={1} />
        <text
          x={L.w / 2}
          y={15}
          textAnchor="middle"
          fontSize="11"
          fontWeight="600"
          fontFamily="'IBM Plex Sans', sans-serif"
          fill="#1f2937"
          style={{ userSelect: 'none' }}
        >
          {name}
        </text>
      </>
    ),
  };
}

// Disposition d'un composant personnalisé (non interactif) : c'est une boîte
// rectangulaire « à dessin fixe » (comme ADDER/REG…), d'où l'usage de rectLayout.
// La boîte et le nom restent DROITS ; l'orientation ne fait que déplacer les ports
// sur le bord adéquat (le nom ne « sort » plus de la boîte quand on tourne).
function customLayout(name: string, data: CustomDefData, comp?: CircuitComponent) {
  const maxLen = (ports: CustomPort[]) => ports.reduce((m, p) => Math.max(m, p.name.length), 0);
  const CHAR = 7; // ~ largeur d'un caractère mono 12px (labels de port)
  const inMargin = data.inputs.length ? Math.max(12, maxLen(data.inputs) * CHAR + 8) : 10;
  const outMargin = data.outputs.length ? Math.max(12, maxLen(data.outputs) * CHAR + 8) : 10;
  const contentW = Math.max(28, Math.ceil(name.length * 6.5)); // place pour le nom centré
  return rectLayout({
    orientation: comp?.state?.orientation,
    inputs: data.inputs.map((p) => ({ name: p.name, label: p.name, width: p.width ?? 1 })),
    outputs: data.outputs.map((p) => ({ name: p.name, label: p.name, width: p.width ?? 1 })),
    contentW,
    contentH: 18,
    inMargin,
    outMargin,
  });
}

// Construit un "def" type-gate à partir d'une définition stockée.
// Le résultat est compatible avec le reste du code (positions des ports, shape SVG…).
function buildCustomDef(name: string, data: CustomDefData): ResolvedDef {
  if (data.interactive) return buildInteractiveDef(name, data);

  // rectLayout ne connaît pas `internalId` (nécessaire à la simulation d'un
  // custom : def.inputs[i].internalId ↔ id de l'INPUT interne). On le réattache
  // par index, l'ordre étant préservé par rectLayout.
  const attachIds = (ports: Port[], src: CustomPort[]): Port[] =>
    ports.map((p, i) => ({ ...p, internalId: src[i]?.internalId }));
  const geometry = (comp?: CircuitComponent) => {
    const L = customLayout(name, data, comp);
    return {
      w: L.w,
      h: L.h,
      content: L.content,
      inputs: attachIds(L.inputs, data.inputs),
      outputs: attachIds(L.outputs, data.outputs),
    };
  };
  const base = geometry();

  return {
    label: name,
    category: 'Custom',
    w: base.w,
    h: base.h,
    inputs: base.inputs,
    outputs: base.outputs,
    isCustom: true,
    customName: name,
    customCircuit: data.circuit,
    fixedDisplay: true,
    defaultState: {},
    // Ports replacés sur le bon bord selon l'orientation (dessin non tourné).
    getDynamicGeometry: (comp) => {
      const g = geometry(comp);
      return { w: g.w, h: g.h, inputs: g.inputs, outputs: g.outputs };
    },
    shape: (comp) => {
      const L = customLayout(name, data, comp);
      const { content } = L;
      return (
        <RectShape layout={L}>
          <text
            x={content.x + content.w / 2}
            y={content.y + content.h / 2 + 4}
            textAnchor="middle"
            fontSize="11"
            fontWeight="600"
            fontFamily="'IBM Plex Sans', sans-serif"
            fill="#1f2937"
            style={{ userSelect: 'none', pointerEvents: 'none' }}
          >
            {name}
          </text>
        </RectShape>
      );
    },
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
  // Custom « à dessin fixe » (boîte rectangulaire, ou mini-calculatrice) : on ne
  // tourne PAS le dessin ; getDynamicGeometry replace les ports selon l'orientation.
  if (cached.fixedDisplay) {
    if (cached.getDynamicGeometry) {
      const fakeComp = comp ?? ({ state: cached.defaultState } as CircuitComponent);
      const dyn = cached.getDynamicGeometry(fakeComp);
      return { ...cached, ...dyn };
    }
    return cached;
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

// Direction (normale sortante) dans laquelle un port fait face, déduite du bord
// du composant sur lequel il est posé — dans le repère DÉJÀ orienté (getDef
// applique l'orientation). Un composant orienté « down » a ainsi sa sortie sur
// le bord bas → [0,1]. Sert au routage des fils (routeWireDirected). Repli sur
// la convention gauche→droite si le port est introuvable.
export function getPortFacing(
  comp: CircuitComponent,
  portName: string,
  kind: 'input' | 'output',
  customDefs: Record<string, unknown> | null | undefined,
): [number, number] {
  const fallback: [number, number] = kind === 'output' ? [1, 0] : [-1, 0];
  const def = getDef(comp.type, customDefs, comp);
  if (!def) return fallback;
  const ports = kind === 'input' ? def.inputs : def.outputs;
  const port = ports.find((p) => p.name === portName);
  if (!port) return fallback;
  const px = port.x ?? 0;
  const py = port.y ?? 0;
  // Distance à chacun des quatre bords ; le plus proche donne la face.
  const dLeft = px;
  const dRight = def.w - px;
  const dTop = py;
  const dBottom = def.h - py;
  const m = Math.min(dLeft, dRight, dTop, dBottom);
  if (m === dRight) return [1, 0];
  if (m === dLeft) return [-1, 0];
  if (m === dBottom) return [0, 1];
  return [0, -1];
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
