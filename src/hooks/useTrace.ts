import { useCallback, useEffect, useRef, useState } from 'react';
import { asInt, maskTo, portKey } from '../lib/sim';
import { getDef } from '../gates/registry';
import type { Circuit, Signal, SimResult, TraceSample } from '../domain/types';

const TRACE_MAX_LEN = 100;

// Chronogramme : capture un instantané des signaux intéressants (INPUT/OUTPUT/CLOCK
// et Q des composants à mémoire) à chaque transition d'horloge. Stocké en état React
// pour alimenter le panneau Chrono. Désactivé en mode édition de composant custom.
export function useTrace(circuit: Circuit, sim: SimResult, editMode: unknown) {
  const [trace, setTrace] = useState<TraceSample[]>([]);
  const [enabled, setEnabled] = useState(true);
  // Mémorise l'état précédent des CLOCK pour détecter les transitions.
  const prevClocksRef = useRef<Map<string, number>>(new Map());
  // Compteur de ticks (pour étiqueter chaque échantillon).
  const tickCounterRef = useRef(0);

  useEffect(() => {
    if (!enabled) return;
    if (editMode) return;
    // Détecte si une CLOCK a transité depuis la dernière capture
    const currentClocks = new Map<string, number>();
    let transitioned = false;
    for (const comp of circuit.components) {
      if (comp.type !== 'CLOCK') continue;
      const v = asInt(comp.state?.value) & 1;
      currentClocks.set(comp.id, v);
      const prev = prevClocksRef.current.get(comp.id);
      if (prev === undefined || prev !== v) transitioned = true;
    }
    // Détecte aussi la disparition d'une CLOCK
    for (const id of prevClocksRef.current.keys()) {
      if (!currentClocks.has(id)) transitioned = true;
    }
    prevClocksRef.current = currentClocks;
    if (!transitioned) return;
    if (currentClocks.size === 0) return; // pas d'horloge, rien à échantillonner

    // Construit l'échantillon : INPUT/OUTPUT, CLOCK, et Q des composants à mémoire.
    const signals: Signal[] = [];
    for (const comp of circuit.components) {
      const def = getDef(comp.type, circuit.customDefinitions ?? null, comp);
      if (!def) continue;
      if (comp.type === 'INPUT') {
        const width = comp.state?.width ?? 1;
        signals.push({
          key: `${comp.id}:in`,
          label: comp.label || 'In',
          kind: 'input',
          width,
          value: maskTo(width, asInt(comp.state?.value)),
        });
      } else if (comp.type === 'OUTPUT') {
        const width = comp.state?.width ?? 1;
        const value = asInt(sim.inputValues.get(portKey(comp.id, 'in0')) ?? 0);
        signals.push({
          key: `${comp.id}:out`,
          label: comp.label || 'Out',
          kind: 'output',
          width,
          value: maskTo(width, value),
        });
      } else if (comp.type === 'CLOCK') {
        signals.push({
          key: `${comp.id}:clk`,
          label: 'CLK',
          kind: 'clock',
          width: 1,
          value: asInt(comp.state?.value) & 1,
        });
      } else if (comp.type === 'DFF' || comp.type === 'REG' || comp.type === 'COUNTER') {
        const width = comp.state?.width ?? 1;
        signals.push({
          key: `${comp.id}:Q`,
          label: `${def.label as string} Q`,
          kind: 'q',
          width,
          value: maskTo(width, asInt(comp.state?.q)),
        });
      } else if (comp.type === 'SRLATCH') {
        signals.push({
          key: `${comp.id}:Q`,
          label: 'SR Q',
          kind: 'q',
          width: 1,
          value: asInt(comp.state?.q) & 1,
        });
      }
    }
    tickCounterRef.current += 1;
    setTrace((old) => {
      const next = old.concat([{ tick: tickCounterRef.current, signals }]);
      if (next.length > TRACE_MAX_LEN) next.splice(0, next.length - TRACE_MAX_LEN);
      return next;
    });
  }, [circuit, sim, enabled, editMode]);

  const clear = useCallback(() => {
    setTrace([]);
    tickCounterRef.current = 0;
    prevClocksRef.current = new Map();
  }, []);

  return { trace, enabled, setEnabled, clear };
}
