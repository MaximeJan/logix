interface DeleteDefinitionModalProps {
  name: string;
  onCancel: () => void;
  onConfirm: () => void;
}

// Confirmation de suppression d'une définition de composant personnalisé.
export function DeleteDefinitionModal({ name, onCancel, onConfirm }: DeleteDefinitionModalProps) {
  return (
    <div
      className="absolute inset-0 bg-black/40 flex items-center justify-center z-50"
      onClick={onCancel}
    >
      <div className="bg-white rounded-lg shadow-xl w-96" onClick={(e) => e.stopPropagation()}>
        <div className="px-5 py-4">
          <h2 className="text-base font-medium mb-2">Supprimer la définition ?</h2>
          <p className="text-sm text-stone-600">
            Voulez-vous vraiment supprimer le composant{' '}
            <strong className="font-mono">{name}</strong> ?
          </p>
          <p className="text-xs text-stone-500 mt-2">Cette action est annulable via Ctrl+Z.</p>
        </div>
        <div className="px-5 py-3 border-t border-stone-200 flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="px-3 py-1.5 text-sm text-stone-600 hover:bg-stone-100 rounded"
          >
            Annuler
          </button>
          <button
            onClick={onConfirm}
            className="px-3 py-1.5 text-sm font-medium bg-rose-600 text-white rounded hover:bg-rose-700"
          >
            Supprimer
          </button>
        </div>
      </div>
    </div>
  );
}
