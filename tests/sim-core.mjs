// Adapter minimal pour les tests Node.js : importe la logique pure depuis
// src/sim.js (la même que celle utilisée par CircuitSimulator.jsx en prod).
// Définit uniquement les `GATES` (structure des ports, fn des portes simples,
// defaultState, getDynamicGeometry) — pas de JSX, pas de `shape`/`label`/`category`
// puisque les tests ne s'en servent pas.

import {
  asInt,
  maskTo,
  portKey,
  SEG7_HEX_TABLE,
  applyOrientation,
  simulate as simulateCore,
  stepSequential as stepSequentialCore,
} from '../src/sim.js';

export { asInt, maskTo, portKey, SEG7_HEX_TABLE, applyOrientation };

// --------- GATES (sans JSX, juste la structure logique) ---------
export const GATES = {
  INPUT: {
    inputs: [],
    outputs: [{ name: 'out0', width: 1 }],
    defaultState: { value: 0, width: 1 },
    getDynamicGeometry: (comp) => ({
      inputs: [],
      outputs: [{ name: 'out0', x: 0, y: 0, width: comp?.state?.width ?? 1 }],
    }),
  },
  OUTPUT: {
    inputs: [{ name: 'in0', width: 1 }],
    outputs: [],
    defaultState: { width: 1 },
    getDynamicGeometry: (comp) => ({
      inputs: [{ name: 'in0', x: 0, y: 0, width: comp?.state?.width ?? 1 }],
      outputs: [],
    }),
  },
  AND: {
    inputs: [{ name: 'a', width: 1 }, { name: 'b', width: 1 }],
    outputs: [{ name: 'y', width: 1 }],
    fn: ([a, b]) => [(asInt(a) & asInt(b)) & 1],
  },
  OR: {
    inputs: [{ name: 'a', width: 1 }, { name: 'b', width: 1 }],
    outputs: [{ name: 'y', width: 1 }],
    fn: ([a, b]) => [(asInt(a) | asInt(b)) & 1],
  },
  NOT: {
    inputs: [{ name: 'a', width: 1 }],
    outputs: [{ name: 'y', width: 1 }],
    fn: ([a]) => [(~asInt(a)) & 1],
  },
  NAND: {
    inputs: [{ name: 'a', width: 1 }, { name: 'b', width: 1 }],
    outputs: [{ name: 'y', width: 1 }],
    fn: ([a, b]) => [(~(asInt(a) & asInt(b))) & 1],
  },
  NOR: {
    inputs: [{ name: 'a', width: 1 }, { name: 'b', width: 1 }],
    outputs: [{ name: 'y', width: 1 }],
    fn: ([a, b]) => [(~(asInt(a) | asInt(b))) & 1],
  },
  XOR: {
    inputs: [{ name: 'a', width: 1 }, { name: 'b', width: 1 }],
    outputs: [{ name: 'y', width: 1 }],
    fn: ([a, b]) => [(asInt(a) ^ asInt(b)) & 1],
  },
  MUX: {
    defaultState: { selectWidth: 1, dataWidth: 1 },
    getDynamicGeometry: (comp) => {
      const sw = comp?.state?.selectWidth ?? 1;
      const dw = comp?.state?.dataWidth ?? 1;
      const n = 1 << sw;
      const inputs = Array.from({ length: n }, (_, i) => ({ name: `in${i}`, x: 0, y: 0, width: dw }));
      inputs.push({ name: 'sel', x: 0, y: 0, width: sw });
      return { inputs, outputs: [{ name: 'out', x: 0, y: 0, width: dw }] };
    },
  },
  DEMUX: {
    defaultState: { selectWidth: 1, dataWidth: 1 },
    getDynamicGeometry: (comp) => {
      const sw = comp?.state?.selectWidth ?? 1;
      const dw = comp?.state?.dataWidth ?? 1;
      const n = 1 << sw;
      return {
        inputs: [
          { name: 'in', x: 0, y: 0, width: dw },
          { name: 'sel', x: 0, y: 0, width: sw },
        ],
        outputs: Array.from({ length: n }, (_, i) => ({ name: `out${i}`, x: 0, y: 0, width: dw })),
      };
    },
  },
  DECODER: {
    defaultState: { width: 2 },
    getDynamicGeometry: (comp) => {
      const w = comp?.state?.width ?? 2;
      const n = 1 << w;
      return {
        inputs: [{ name: 'in', x: 0, y: 0, width: w }],
        outputs: Array.from({ length: n }, (_, i) => ({ name: `out${i}`, x: 0, y: 0, width: 1 })),
      };
    },
  },
  SRLATCH: {
    defaultState: { q: 0 },
    inputs: [
      { name: 'S', x: 0, y: 0, width: 1 },
      { name: 'R', x: 0, y: 0, width: 1 },
    ],
    outputs: [{ name: 'Q', x: 0, y: 0, width: 1 }],
  },
  DFF: {
    defaultState: { q: 0, lastClk: 0, width: 1 },
    getDynamicGeometry: (comp) => {
      const w = comp?.state?.width ?? 1;
      return {
        inputs: [
          { name: 'D', x: 0, y: 0, width: w },
          { name: 'CLK', x: 0, y: 0, width: 1 },
          { name: 'RST', x: 0, y: 0, width: 1 },
        ],
        outputs: [{ name: 'Q', x: 0, y: 0, width: w }],
      };
    },
  },
  REG: {
    defaultState: { q: 0, lastClk: 0, width: 4 },
    getDynamicGeometry: (comp) => {
      const w = comp?.state?.width ?? 4;
      return {
        inputs: [
          { name: 'D', x: 0, y: 0, width: w },
          { name: 'LD', x: 0, y: 0, width: 1 },
          { name: 'CLK', x: 0, y: 0, width: 1 },
        ],
        outputs: [{ name: 'Q', x: 0, y: 0, width: w }],
      };
    },
  },
  COUNTER: {
    defaultState: { q: 0, lastClk: 0, width: 4 },
    getDynamicGeometry: (comp) => {
      const w = comp?.state?.width ?? 4;
      return {
        inputs: [
          { name: 'EN',  x: 0, y: 0, width: 1 },
          { name: 'CLK', x: 0, y: 0, width: 1 },
          { name: 'RST', x: 0, y: 0, width: 1 },
        ],
        outputs: [{ name: 'Q', x: 0, y: 0, width: w }],
      };
    },
  },
  SPLITTER: {
    defaultState: { width: 4 },
    getDynamicGeometry: (comp) => {
      const n = comp?.state?.width ?? 4;
      const outputs = [];
      for (let i = 0; i < n; i++) {
        const bit = n - 1 - i;
        outputs.push({ name: `b${bit}`, x: 0, y: 0, width: 1 });
      }
      return { inputs: [{ name: 'in', x: 0, y: 0, width: n }], outputs };
    },
  },
  MERGER: {
    defaultState: { width: 4 },
    getDynamicGeometry: (comp) => {
      const n = comp?.state?.width ?? 4;
      const inputs = [];
      for (let i = 0; i < n; i++) {
        const bit = n - 1 - i;
        inputs.push({ name: `b${bit}`, x: 0, y: 0, width: 1 });
      }
      return { inputs, outputs: [{ name: 'out', x: 0, y: 0, width: n }] };
    },
  },
  ADDER: {
    defaultState: { width: 4 },
    getDynamicGeometry: (comp) => {
      const w = comp?.state?.width ?? 4;
      return {
        inputs: [
          { name: 'A',   x: 0, y: 0, width: w },
          { name: 'B',   x: 0, y: 0, width: w },
          { name: 'Cin', x: 0, y: 0, width: 1 },
        ],
        outputs: [
          { name: 'S',    x: 0, y: 0, width: w },
          { name: 'Cout', x: 0, y: 0, width: 1 },
        ],
      };
    },
  },
  RAM: {
    defaultState: { addrWidth: 3, dataWidth: 4, mem: [0,0,0,0,0,0,0,0], lastClk: 0 },
    getDynamicGeometry: (comp) => {
      const aw = comp?.state?.addrWidth ?? 3;
      const dw = comp?.state?.dataWidth ?? 4;
      return {
        inputs: [
          { name: 'ADDR',    x: 0, y: 0, width: aw },
          { name: 'DATA_IN', x: 0, y: 0, width: dw },
          { name: 'WE',      x: 0, y: 0, width: 1 },
          { name: 'CLK',     x: 0, y: 0, width: 1 },
        ],
        outputs: [{ name: 'DATA_OUT', x: 0, y: 0, width: dw }],
      };
    },
  },
  CLOCK: {
    defaultState: { value: 0 },
    inputs: [],
    outputs: [{ name: 'CLK', x: 0, y: 0, width: 1 }],
  },
  SEG7: {
    defaultState: { mode: 'hex' },
    getDynamicGeometry: (comp) => {
      const mode = comp?.state?.mode ?? 'hex';
      if (mode === 'hex') {
        return { inputs: [{ name: 'D', x: 0, y: 0, width: 4 }], outputs: [] };
      }
      return {
        inputs: ['a','b','c','d','e','f','g'].map((n) => ({ name: n, x: 0, y: 0, width: 1 })),
        outputs: [],
      };
    },
  },
  LEDMATRIX: {
    defaultState: { cols: 8, rows: 8, pixels: new Array(64).fill(0), lastClk: 0 },
    getDynamicGeometry: (comp) => {
      const cols = comp?.state?.cols ?? 8;
      const rows = comp?.state?.rows ?? 8;
      const xWidth = Math.max(1, Math.ceil(Math.log2(Math.max(2, cols))));
      const yWidth = Math.max(1, Math.ceil(Math.log2(Math.max(2, rows))));
      return {
        inputs: [
          { name: 'X',   x: 0, y: 0, width: xWidth },
          { name: 'Y',   x: 0, y: 0, width: yWidth },
          { name: 'D',   x: 0, y: 0, width: 1 },
          { name: 'WE',  x: 0, y: 0, width: 1 },
          { name: 'CLK', x: 0, y: 0, width: 1 },
          { name: 'RST', x: 0, y: 0, width: 1 },
        ],
        outputs: [],
      };
    },
  },
};

// --------- buildCustomDef (logique seule, sans JSX) ---------
export function buildCustomDef(name, data) {
  const inputs = data.inputs.map((p) => ({
    name: p.name,
    internalId: p.internalId,
    x: 0, y: 0,
    width: p.width ?? 1,
  }));
  const outputs = data.outputs.map((p) => ({
    name: p.name,
    internalId: p.internalId,
    x: 0, y: 0,
    width: p.width ?? 1,
  }));
  return {
    label: name,
    category: 'Custom',
    w: 80, h: 60,
    inputs,
    outputs,
    isCustom: true,
    customName: name,
    customCircuit: data.circuit,
  };
}

const customDefCache = new WeakMap();

export function getDef(type, customDefs, comp) {
  const baseDef = GATES[type];
  if (baseDef) {
    let def;
    if (baseDef.getDynamicGeometry) {
      const fakeComp = comp ?? { state: baseDef.defaultState };
      const dyn = baseDef.getDynamicGeometry(fakeComp);
      def = { ...baseDef, ...dyn };
    } else {
      def = baseDef;
    }
    return applyOrientation(def, comp?.state?.orientation);
  }
  if (!customDefs) return null;
  const data = customDefs[type];
  if (!data) return null;
  let cached = customDefCache.get(data);
  if (!cached) {
    cached = buildCustomDef(type, data);
    customDefCache.set(data, cached);
  }
  return applyOrientation(cached, comp?.state?.orientation);
}

// --------- Wrappers qui fixent `getDef` pour les tests ---------
export function simulate(circuit, customDefs = null, recursionStack = new Set()) {
  return simulateCore(circuit, getDef, customDefs, recursionStack);
}

export function stepSequential(circuit) {
  return stepSequentialCore(circuit, getDef);
}

// --------- Helpers de construction de circuits pour les tests ---------
let _uidN = 0;
export const tid = (prefix = 'c') => `${prefix}_${(_uidN++).toString(36)}`;

export function makeInput(width = 1, value = 0) {
  return { id: tid('in'), type: 'INPUT', x: 0, y: 0, state: { width, value } };
}
export function makeOutput(width = 1) {
  return { id: tid('out'), type: 'OUTPUT', x: 0, y: 0, state: { width } };
}
export function makeGate(type) {
  return { id: tid('g'), type, x: 0, y: 0 };
}
export function makeWire(from, to, fromPort = 'y', toPort = 'a') {
  return {
    id: tid('w'),
    from: { componentId: from.id ?? from, port: fromPort },
    to: { componentId: to.id ?? to, port: toPort },
  };
}

export function getInputAt(sim, comp, portName) {
  return sim.inputValues.get(portKey(comp.id, portName)) ?? 0;
}
export function getOutputAt(sim, comp, portName) {
  return sim.outValues.get(portKey(comp.id, portName)) ?? 0;
}
