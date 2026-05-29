import { useEffect } from 'react';
import { storage } from '../lib/storage';
import { STORAGE_KEY } from '../lib/constants';
import type { TabsState } from '../domain/types';

// Auto-sauvegarde du circuit dans le stockage local : charge l'état au montage,
// puis re-sauvegarde (debounce 300 ms) à chaque changement. En mode édition de
// composant custom on n'écrit pas (sinon un rechargement perdrait le circuit
// principal, conservé dans editMode.backupCircuit). serialize/deserialize sont
// injectés car ils dépendent du registre de types (isKnownType) et de `uid`.
export function useAutosave(
  tabsState: TabsState,
  setTabsState: (state: TabsState) => void,
  editMode: unknown,
  serializeAll: (state: TabsState) => unknown,
  deserializeAll: (data: unknown) => TabsState,
) {
  useEffect(() => {
    (async () => {
      try {
        const r = await storage.get(STORAGE_KEY);
        if (r?.value) {
          setTabsState(deserializeAll(JSON.parse(r.value)));
        }
      } catch {
        // pas grave : on démarre vide
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (editMode) return;
    const t = setTimeout(() => {
      try {
        storage.set(STORAGE_KEY, JSON.stringify(serializeAll(tabsState)));
      } catch {
        // ignore
      }
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabsState, editMode]);
}
