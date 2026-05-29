import { useEffect, useState } from 'react';
import { asInt, stepSequential } from '../lib/sim';
import { getDef } from '../gates/registry';
import type { Circuit, SimResult } from '../domain/types';

// Moteur temporel du circuit :
//  1. Logique séquentielle — applique stepSequential (mise à jour atomique des
//     DFF/REG/COUNTER/RAM/SRLATCH) et marque lastTriggerAt pour le halo du D-FF.
//  2. Horloge auto — bascule les CLOCK en mode `running` selon leur fréquence.
//  3. Re-render périodique — anime le halo lime du D-FF et la pastille clignotante.
export function useCircuitEngine(
  circuit: Circuit,
  sim: SimResult,
  setCircuit: (updater: (c: Circuit) => Circuit) => void,
) {
  // 1. Logique séquentielle (le `lastTriggerAt` est purement visuel)
  useEffect(() => {
    const next = stepSequential(circuit, getDef);
    const changed = next !== circuit && next.components !== circuit.components;
    if (!changed) return;
    const components = next.components.map((comp, idx) => {
      if (comp.type !== 'DFF') return comp;
      const old = circuit.components[idx];
      if (!old) return comp;
      const captured = (old.state?.lastClk ?? 0) === 0 && (comp.state?.lastClk ?? 0) === 1;
      if (captured) {
        return { ...comp, state: { ...comp.state, lastTriggerAt: Date.now() } };
      }
      return comp;
    });
    setCircuit((c) => ({ ...c, components }));
  }, [circuit, sim, setCircuit]);

  // 2. Auto-tick des CLOCK en mode running. Une seule timer pour toute l'app.
  useEffect(() => {
    const id = setInterval(() => {
      const now = Date.now();
      setCircuit((c) => {
        let changed = false;
        const newComps = c.components.map((comp) => {
          if (comp.type !== 'CLOCK' || !comp.state?.running) return comp;
          const freq = comp.state?.freq ?? 1;
          // Période d'une demi-onde (ms) : 1 cycle = 2 transitions
          const halfPeriod = 500 / Math.max(0.1, freq);
          const lastT = comp.state?.lastToggleAt ?? 0;
          if (now - lastT >= halfPeriod) {
            changed = true;
            return {
              ...comp,
              state: { ...comp.state, value: asInt(comp.state?.value) ? 0 : 1, lastToggleAt: now },
            };
          }
          return comp;
        });
        return changed ? { ...c, components: newComps } : c;
      });
    }, 30);
    return () => clearInterval(id);
  }, [setCircuit]);

  // 3. Re-render périodique pour animer le halo du D-FF (300 ms) et la pastille CLOCK.
  const [, forceTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => forceTick((n) => (n + 1) % 1000), 60);
    return () => clearInterval(id);
  }, []);
}
