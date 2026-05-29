import { useEffect } from 'react';
import type { Selection } from '../domain/types';

interface ShortcutActions {
  // États de modale (Échap les ferme en priorité).
  saveAsCompState: unknown;
  deletePromptName: unknown;
  setSaveAsCompState: (v: null) => void;
  setDeletePromptName: (v: null) => void;
  // Annulations d'interaction (Échap).
  setPlaceType: (v: null) => void;
  setWireStart: (v: null) => void;
  setSelection: (sel: Selection) => void;
  // Commandes d'édition.
  deleteSelection: () => void;
  undo: () => void;
  redo: () => void;
  copySelection: () => void;
  pasteClipboard: () => void;
  saveToFile: () => void;
}

// Raccourcis clavier globaux (Échap, Suppr/Backspace, Ctrl/Cmd+Z/Y/C/V/S). Ignore
// les frappes dans un champ de saisie (sauf Échap pour fermer une modale). Pas de
// tableau de dépendances : on ré-enregistre à chaque render pour toujours capturer
// les callbacks à jour (comportement historique de l'orchestrateur).
export function useKeyboardShortcuts(actions: ShortcutActions) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isTyping = target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA';
      const mod = e.ctrlKey || e.metaKey;
      if (e.key === 'Escape') {
        if (actions.saveAsCompState) {
          actions.setSaveAsCompState(null);
          return;
        }
        if (actions.deletePromptName) {
          actions.setDeletePromptName(null);
          return;
        }
        if (isTyping) return;
        actions.setPlaceType(null);
        actions.setWireStart(null);
        actions.setSelection({ components: [], wires: [] });
        return;
      }
      if (isTyping) return;
      if ((e.key === 'Delete' || e.key === 'Backspace') && !mod) {
        e.preventDefault();
        actions.deleteSelection();
      } else if (mod && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        e.preventDefault();
        actions.undo();
      } else if (
        mod &&
        (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey))
      ) {
        e.preventDefault();
        actions.redo();
      } else if (mod && e.key.toLowerCase() === 'c') {
        e.preventDefault();
        actions.copySelection();
      } else if (mod && e.key.toLowerCase() === 'v') {
        e.preventDefault();
        actions.pasteClipboard();
      } else if (mod && e.key.toLowerCase() === 's') {
        e.preventDefault();
        actions.saveToFile();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });
}
