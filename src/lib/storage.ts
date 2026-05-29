// Adaptateur de stockage : utilise window.storage (Tauri/Electron) si disponible,
// sinon localStorage standard (navigateur web / GitHub Pages).

export interface StorageAdapter {
  get: (key: string) => Promise<{ value: string | null }>;
  set: (key: string, value: string) => void;
}

const win = window as unknown as { storage?: StorageAdapter };

export const storage: StorageAdapter = win.storage ?? {
  get: (key) => Promise.resolve({ value: localStorage.getItem(key) }),
  set: (key, value) => {
    localStorage.setItem(key, value);
  },
};
