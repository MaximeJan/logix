import type { RefObject } from 'react';
import {
  Save,
  Upload,
  Undo2,
  Redo2,
  Copy,
  ClipboardPaste,
  Trash2,
  Package,
  X,
  Link2,
  ExternalLink,
} from 'lucide-react';
import logixLogo from '../assets/logix_text.svg';
import { ToolbarButton, Separator, SettingsIcon } from './ui';
import type { ViewBox } from '../hooks/useViewport';

interface ToolbarProps {
  onSave: () => void;
  fileInputRef: RefObject<HTMLInputElement>;
  onLoadFile: (file: File) => void;
  onUndo: () => void;
  canUndo: boolean;
  onRedo: () => void;
  canRedo: boolean;
  onCopy: () => void;
  canCopy: boolean;
  onPaste: () => void;
  canPaste: boolean;
  onDelete: () => void;
  canDelete: boolean;
  onEncapsulate: () => void;
  canEncapsulate: boolean;
  editMode: boolean;
  onCancelEdit: () => void;
  /** Mode embed (iframe) : masque import, encapsulation et générateur d'exercice. */
  embed?: boolean;
  /** Ouvre le même exercice dans Logix en plein écran (nouvel onglet) — mode embed. */
  onOpenFull?: () => void;
  viewBox: ViewBox | null;
  viewBoxBase: { w: number; h: number } | null;
  onResetView: () => void;
  onOpenBuilder: () => void;
  preferencesOpen: boolean;
  onTogglePreferences: () => void;
  hasManualClock: boolean;
  onTick: () => void;
  hasCycle: boolean;
  /** ≥1 nœud BUS avec deux sources actives simultanément. */
  busConflict: boolean;
  wireWidthMismatch: { wFrom: number; wTo: number } | null;
}

// Barre d'outils du haut : logo, actions fichier (save/load), undo/redo, copier/
// coller/supprimer, encapsulation, reset vue, générateur d'exercice et Apparence.
// Composant purement présentationnel — l'orchestrateur fournit états et callbacks.
export function Toolbar({
  onSave,
  fileInputRef,
  onLoadFile,
  onUndo,
  canUndo,
  onRedo,
  canRedo,
  onCopy,
  canCopy,
  onPaste,
  canPaste,
  onDelete,
  canDelete,
  onEncapsulate,
  canEncapsulate,
  editMode,
  onCancelEdit,
  embed,
  onOpenFull,
  viewBox,
  viewBoxBase,
  onResetView,
  onOpenBuilder,
  preferencesOpen,
  onTogglePreferences,
  hasManualClock,
  onTick,
  hasCycle,
  busConflict,
  wireWidthMismatch,
}: ToolbarProps) {
  const zoomChanged =
    !!viewBox &&
    !!viewBoxBase &&
    (viewBox.w !== viewBoxBase.w || viewBox.x !== 0 || viewBox.y !== 0);

  return (
    <div className="flex items-center gap-1 px-3 py-2 bg-white border-b border-stone-200 shadow-sm">
      <div className="flex items-center pr-3 mr-2 border-r border-stone-200">
        <img src={logixLogo} alt="Logix" className="h-7 w-auto select-none" draggable={false} />
      </div>

      {/* Télécharger reste disponible en iframe : l'élève doit pouvoir rendre sa
          solution. Le chargement d'un JSON, lui, est réservé au site complet. */}
      <ToolbarButton onClick={onSave} title="Télécharger le circuit en JSON (Ctrl+S)">
        <Save size={16} />
      </ToolbarButton>
      {!embed && (
        <>
          <ToolbarButton onClick={() => fileInputRef.current?.click()} title="Charger un JSON">
            <Upload size={16} />
          </ToolbarButton>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            className="hidden"
            onChange={(e) => {
              if (e.target.files?.[0]) {
                onLoadFile(e.target.files[0]);
                e.target.value = '';
              }
            }}
          />
        </>
      )}

      <Separator />

      <ToolbarButton onClick={onUndo} title="Annuler (Ctrl+Z)" disabled={!canUndo}>
        <Undo2 size={16} />
      </ToolbarButton>
      <ToolbarButton onClick={onRedo} title="Refaire (Ctrl+Y)" disabled={!canRedo}>
        <Redo2 size={16} />
      </ToolbarButton>

      <Separator />

      <ToolbarButton onClick={onCopy} title="Copier (Ctrl+C)" disabled={!canCopy}>
        <Copy size={16} />
      </ToolbarButton>
      <ToolbarButton onClick={onPaste} title="Coller (Ctrl+V)" disabled={!canPaste}>
        <ClipboardPaste size={16} />
      </ToolbarButton>
      <ToolbarButton onClick={onDelete} title="Supprimer (Suppr)" disabled={!canDelete}>
        <Trash2 size={16} />
      </ToolbarButton>

      {!embed && (
        <>
          <Separator />

          <button
            onClick={onEncapsulate}
            disabled={!canEncapsulate}
            className={`px-2.5 h-8 flex items-center gap-1.5 rounded text-sm font-medium transition
          ${
            canEncapsulate
              ? 'text-stone-700 hover:bg-stone-100 active:bg-stone-200'
              : 'text-stone-300 cursor-not-allowed'
          }`}
            title={
              editMode
                ? 'Enregistrer les modifications de la définition'
                : canEncapsulate
                  ? 'Encapsuler la sélection en un composant réutilisable'
                  : 'Sélectionnez ≥1 entrée + ≥1 sortie + ≥1 porte pour activer'
            }
          >
            <Package size={15} />
            {editMode ? 'Terminer' : 'Encapsuler la sélection'}
          </button>
          {editMode && (
            <button
              onClick={onCancelEdit}
              className="px-2.5 h-8 flex items-center gap-1.5 rounded text-sm font-medium text-rose-700 hover:bg-rose-50"
              title="Annuler les modifications et revenir au circuit principal"
            >
              <X size={15} />
              Annuler l'édition
            </button>
          )}
        </>
      )}

      <div className="flex-1" />

      {/* En iframe : rouvrir le même exercice dans Logix en plein écran (nouvel
          onglet). Le travail de l'élève suit (même sauvegarde locale). */}
      {embed && onOpenFull && (
        <button
          onClick={onOpenFull}
          className="px-2.5 h-8 flex items-center gap-1.5 rounded text-sm font-medium text-blue-700 border border-blue-200 bg-blue-50 hover:bg-blue-100 transition"
          title="Ouvrir ce même exercice dans Logix en plein écran (nouvel onglet)"
        >
          <ExternalLink size={14} /> Ouvrir sur Logix
        </button>
      )}

      {zoomChanged && viewBox && viewBoxBase && (
        <button
          onClick={onResetView}
          className="px-2.5 h-8 flex items-center gap-1.5 rounded text-sm font-medium text-stone-700 hover:bg-stone-100"
          title="Réinitialiser le zoom et la position"
        >
          <span className="font-mono text-xs">
            {Math.round((viewBoxBase.w / viewBox.w) * 100)}%
          </span>
          Reset vue
        </button>
      )}

      {!embed && (
        <button
          onClick={onOpenBuilder}
          className="px-2.5 h-8 flex items-center gap-1.5 rounded text-sm font-medium text-stone-700 hover:bg-stone-100 transition"
          title="Composer un exercice sur mesure et obtenir son lien partageable"
        >
          <Link2 size={14} /> Créer un exercice
        </button>
      )}

      <button
        onClick={onTogglePreferences}
        className={`px-2.5 h-8 flex items-center gap-1.5 rounded text-sm font-medium transition ${
          preferencesOpen ? 'bg-stone-200 text-stone-800' : 'text-stone-700 hover:bg-stone-100'
        }`}
        title="Réglages d'apparence (couleurs, épaisseurs, fond)"
      >
        <SettingsIcon /> Apparence
      </button>

      {hasManualClock && (
        <button
          onClick={onTick}
          className="text-xs px-3 py-1.5 rounded border border-stone-300 bg-white text-stone-700 hover:bg-stone-50 hover:border-stone-400 transition flex items-center gap-1.5 font-mono"
          title="Bascule toutes les horloges manuelles (un appui = une transition)"
        >
          <span className="text-base leading-none">⏵</span>
          Tick
        </button>
      )}

      {hasCycle && (
        <div className="text-xs text-rose-600 px-2 py-1 bg-rose-50 rounded border border-rose-200">
          ⚠ Cycle détecté
        </div>
      )}
      {busConflict && (
        <div className="text-xs text-rose-700 px-2 py-1 bg-rose-50 rounded border border-rose-300">
          ⚠ Conflit de bus : deux sources actives
        </div>
      )}
      {wireWidthMismatch && (
        <div
          className="text-xs text-rose-700 px-2 py-1 bg-rose-50 rounded border border-rose-300 font-mono"
          style={{ fontFamily: "'IBM Plex Mono', monospace" }}
        >
          ⚠ Largeurs incompatibles : /{wireWidthMismatch.wFrom} → /{wireWidthMismatch.wTo}
        </div>
      )}
    </div>
  );
}
