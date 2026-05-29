import { useEffect, useState } from 'react';
import { storage } from '../lib/storage';
import { DEFAULT_PREFS, PREFS_STORAGE_KEY, type Prefs } from '../lib/constants';

// Préférences d'apparence : chargées une fois depuis le stockage local au montage,
// puis re-sauvegardées (debounce léger) à chaque changement. Indépendantes du circuit.
export function usePrefs() {
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS);

  useEffect(() => {
    (async () => {
      try {
        const rp = await storage.get(PREFS_STORAGE_KEY);
        if (rp?.value) {
          const p = JSON.parse(rp.value) as Partial<Prefs>;
          setPrefs((prev) => ({ ...DEFAULT_PREFS, ...prev, ...p }));
        }
      } catch {
        // pas grave : on garde les valeurs par défaut
      }
    })();
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      try {
        storage.set(PREFS_STORAGE_KEY, JSON.stringify(prefs));
      } catch {
        // ignore
      }
    }, 200);
    return () => clearTimeout(t);
  }, [prefs]);

  return [prefs, setPrefs] as const;
}
