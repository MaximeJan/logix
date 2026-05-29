import { useCallback, useRef } from 'react';
import type { Circuit, Selection } from '../domain/types';

type TabHistory = { past: Circuit[]; future: Circuit[] };
type Updater = Circuit | ((prev: Circuit) => Circuit);

// Historique par onglet : { [tabId]: { past, future } }. Le getter `history.current`
// pointe toujours sur l'onglet actif (via activeTabIdRef tenu à jour à chaque render),
// pour que commit/undo/redo créés au premier render restent corrects après changement
// d'onglet. `commit` = changement structurel (place/câble/supprime) ; les changements
// interactifs (toggle, tick) passent directement par setCircuit.
export function useHistory(
  activeTabId: string,
  setCircuit: (updater: Updater) => void,
  setSelection: (sel: Selection) => void,
) {
  const historyByTab = useRef<Record<string, TabHistory>>({});
  const activeTabIdRef = useRef(activeTabId);
  activeTabIdRef.current = activeTabId;
  const historyRef = useRef({
    get current(): TabHistory {
      const id = activeTabIdRef.current;
      if (!historyByTab.current[id]) historyByTab.current[id] = { past: [], future: [] };
      return historyByTab.current[id];
    },
  });
  const history = historyRef.current;

  const commit = useCallback(
    (updater: Updater) => {
      setCircuit((prev) => {
        const next = typeof updater === 'function' ? updater(prev) : updater;
        history.current.past.push(prev);
        if (history.current.past.length > 100) history.current.past.shift();
        history.current.future = [];
        return next;
      });
    },
    [setCircuit, history],
  );

  const undo = useCallback(() => {
    if (history.current.past.length === 0) return;
    setCircuit((prev) => {
      history.current.future.unshift(prev);
      return history.current.past.pop()!;
    });
    setSelection({ components: [], wires: [] });
  }, [setCircuit, setSelection, history]);

  const redo = useCallback(() => {
    if (history.current.future.length === 0) return;
    setCircuit((prev) => {
      history.current.past.push(prev);
      return history.current.future.shift()!;
    });
    setSelection({ components: [], wires: [] });
  }, [setCircuit, setSelection, history]);

  const resetHistory = useCallback(() => {
    historyByTab.current = {};
  }, []);

  const dropTabHistory = useCallback((tabId: string) => {
    delete historyByTab.current[tabId];
  }, []);

  return { history, commit, undo, redo, resetHistory, dropTabHistory };
}
