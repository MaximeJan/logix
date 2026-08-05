import { useEffect } from 'react';
import { storage } from '../lib/storage';
import { STORAGE_KEY } from '../lib/constants';
import type { TabsState } from '../domain/types';

// Auto-sauvegarde du circuit dans le stockage local : charge l'état au montage,
// puis re-sauvegarde (debounce 300 ms) à chaque changement. En mode édition de
// composant custom on n'écrit pas (sinon un rechargement perdrait le circuit
// principal, conservé dans editMode.backupCircuit). serialize/deserialize sont
// injectés car ils dépendent du registre de types (isKnownType) et de `uid`.
//
// `storageKey` permet d'isoler une session : un exercice ouvert par URL utilise
// sa propre clé, pour ne jamais écraser le bac à sable personnel de l'élève.
export function useAutosave(
  tabsState: TabsState,
  setTabsState: (state: TabsState) => void,
  editMode: unknown,
  serializeAll: (state: TabsState) => unknown,
  deserializeAll: (data: unknown) => TabsState,
  storageKey: string = STORAGE_KEY,
) {
  useEffect(() => {
    (async () => {
      try {
        const r = await storage.get(storageKey);
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
        storage.set(storageKey, JSON.stringify(serializeAll(tabsState)));
      } catch {
        // ignore
      }
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabsState, editMode]);
}
