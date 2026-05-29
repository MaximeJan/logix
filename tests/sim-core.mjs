// Adaptateur de test : ré-exporte la logique pure ET les VRAIES définitions de
// composants (src/gates + src/gates/registry), pour que les tests valident le
// code de production et non une copie. Ajoute des helpers de construction de
// circuits. `getDef`/`simulate`/`stepSequential` sont liés au vrai registre.
import {
  asInt,
  maskTo,
  portKey,
  SEG7_HEX_TABLE,
  applyOrientation,
  simulate as simulateCore,
  stepSequential as stepSequentialCore,
} from '../src/lib/sim';
import { GATES } from '../src/gates';
import { getDef } from '../src/gates/registry';

export { asInt, maskTo, portKey, SEG7_HEX_TABLE, applyOrientation, GATES, getDef };

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
// Par défaut : sortie 'out' → entrée 'in0' (noms réels des portes logiques).
export function makeWire(from, to, fromPort = 'out', toPort = 'in0') {
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
