import type { MouseEvent as ReactMouseEvent, ReactNode } from 'react';
import { Zap, Plus, Timer, Cpu, GitBranch } from 'lucide-react';
import { getLevel, getAllLevels } from '../challenges';
import { PaletteItem } from './PaletteItem';
import type { ChallengeRow } from '../lib/challenge-verify';

export type { ChallengeRow };

export interface ChallengeMode {
  chapterId: string;
  levelId: string;
  result: 'success' | 'fail' | null;
  error: string | null;
  table: ChallengeRow[] | null;
}

interface ChallengePanelProps {
  challengeMode: ChallengeMode | null;
  onBack: () => void;
  onStartLevel: (chapterId: string, levelId: string) => void;
  onVerify: () => void;
  onRetry: () => void;
  onPaletteMouseDown: (e: ReactMouseEvent, type: string) => void;
  placeType: string | null;
  customDefs: Record<string, unknown> | null | undefined;
}

const CHAPTER_ICONS: Record<string, ReactNode> = {
  portes: <Zap size={11} />,
  arithmetique: <Plus size={11} />,
  sequentiel: <Timer size={11} />,
  processeur: <Cpu size={11} />,
  'plus-loin': <GitBranch size={11} />,
};
const CHAPTER_LABELS: Record<string, string> = {
  portes: 'Portes logiques',
  arithmetique: 'Arithmétique',
  sequentiel: 'Circuits séquentiels',
  processeur: 'Vers le processeur',
  'plus-loin': 'Pour aller plus loin',
};

// Panneau gauche en mode Challenge : soit la liste des niveaux (groupés par
// chapitre), soit la vue d'un niveau en cours (composants autorisés, bouton
// Vérifier, puis succès → niveau suivant, ou échec → table des écarts).
export function ChallengePanel({
  challengeMode,
  onBack,
  onStartLevel,
  onVerify,
  onRetry,
  onPaletteMouseDown,
  placeType,
  customDefs,
}: ChallengePanelProps) {
  return (
    <div className="w-52 bg-white border-r border-stone-200 p-3 overflow-y-auto flex flex-col">
      {challengeMode ? (
        <LevelView
          challengeMode={challengeMode}
          onBack={onBack}
          onStartLevel={onStartLevel}
          onVerify={onVerify}
          onRetry={onRetry}
          onPaletteMouseDown={onPaletteMouseDown}
          placeType={placeType}
          customDefs={customDefs}
        />
      ) : (
        <div className="space-y-2 flex-1 overflow-y-auto">
          <LevelList onStartLevel={onStartLevel} />
        </div>
      )}
    </div>
  );
}

function LevelView({
  challengeMode,
  onBack,
  onStartLevel,
  onVerify,
  onRetry,
  onPaletteMouseDown,
  placeType,
  customDefs,
}: Omit<ChallengePanelProps, 'challengeMode'> & { challengeMode: ChallengeMode }) {
  const level = getLevel(challengeMode.chapterId, challengeMode.levelId);
  if (!level) return null;
  return (
    <div className="space-y-3 flex-1">
      <button onClick={onBack} className="text-xs text-stone-600 hover:text-stone-900">
        ← Retour
      </button>
      <div>
        <h3 className="font-bold text-sm mb-1">{level.title}</h3>
        <p className="text-[11px] text-stone-500 leading-snug">
          Consigne détaillée dans le bandeau bleu, en haut du canevas.
        </p>
      </div>
      <div>
        <div className="text-xs font-semibold text-stone-500 uppercase tracking-wider mb-2">
          Composants
        </div>
        <div className="space-y-1.5">
          {level.allowedTypes.map((t: string) => (
            <PaletteItem
              key={t}
              type={t}
              onMouseDown={onPaletteMouseDown}
              picked={placeType === t}
              customDefs={customDefs}
            />
          ))}
        </div>
      </div>
      {!challengeMode.result ? (
        <button
          onClick={onVerify}
          className="w-full px-3 py-1.5 rounded bg-blue-600 text-white text-xs font-medium hover:bg-blue-700"
        >
          Vérifier
        </button>
      ) : challengeMode.result === 'success' ? (
        <div className="space-y-2">
          <div className="p-2 rounded text-xs bg-green-100 text-green-800 font-bold">
            ✓ Réussi !
          </div>
          <NextLevelButton challengeMode={challengeMode} onStartLevel={onStartLevel} />
        </div>
      ) : (
        <div className="space-y-2 flex-1 flex flex-col">
          <div className="p-2 rounded text-xs bg-red-100 text-red-800 font-bold">✗ Échoué</div>
          {challengeMode.table && (
            <div className="text-xs overflow-y-auto flex-1 border rounded bg-stone-50">
              <table className="w-full border-collapse">
                <thead className="bg-stone-200 sticky top-0">
                  <tr>
                    <th className="border px-1 py-1 text-left">Entrée(s)</th>
                    <th className="border px-1 py-1 text-left">Attendu</th>
                    <th className="border px-1 py-1 text-left">Obtenu</th>
                  </tr>
                </thead>
                <tbody>
                  {challengeMode.table.map((row, i) => (
                    <tr key={i} className={row.match ? 'bg-green-100' : 'bg-red-200'}>
                      <td className="border px-1 py-0.5 font-mono">{row.inVals.join(',')}</td>
                      <td className="border px-1 py-0.5 font-mono font-bold">
                        {row.expectedOutVals.join(',')}
                      </td>
                      <td className="border px-1 py-0.5 font-mono font-bold">
                        {row.actualOutVals.join(',')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <button
            onClick={onRetry}
            className="w-full px-3 py-1.5 rounded bg-blue-600 text-white text-xs font-medium hover:bg-blue-700"
          >
            Réessayer
          </button>
        </div>
      )}
    </div>
  );
}

function NextLevelButton({
  challengeMode,
  onStartLevel,
}: {
  challengeMode: ChallengeMode;
  onStartLevel: (chapterId: string, levelId: string) => void;
}) {
  const allLevels = getAllLevels();
  const currentIdx = allLevels.findIndex(
    (l) => l.id === challengeMode.levelId && l.chapterId === challengeMode.chapterId,
  );
  const nextLevel = currentIdx + 1 < allLevels.length ? allLevels[currentIdx + 1] : null;
  return nextLevel ? (
    <button
      onClick={() => onStartLevel(nextLevel.chapterId, nextLevel.id)}
      className="w-full px-3 py-1.5 rounded bg-amber-600 text-white text-xs font-medium hover:bg-amber-700"
    >
      Niveau suivant →
    </button>
  ) : (
    <div className="p-2 rounded text-xs bg-purple-100 text-purple-800">
      🎉 Tous les niveaux complétés !
    </div>
  );
}

function LevelList({
  onStartLevel,
}: {
  onStartLevel: (chapterId: string, levelId: string) => void;
}) {
  const allLevels = getAllLevels();
  return (
    <>
      {allLevels.map((level, i) => {
        const showChapterHeader = i === 0 || allLevels[i - 1].chapterId !== level.chapterId;
        return (
          <div key={level.id}>
            {showChapterHeader && (
              <h3 className="font-semibold text-xs text-stone-700 mb-1 mt-2 flex items-center gap-1">
                {CHAPTER_ICONS[level.chapterId]}
                {CHAPTER_LABELS[level.chapterId] ?? level.chapterId}
              </h3>
            )}
            <button
              onClick={() => onStartLevel(level.chapterId, level.id)}
              className="block w-full text-left px-2 py-1.5 rounded text-xs font-medium transition bg-blue-50 text-blue-900 hover:bg-blue-100"
            >
              {level.title}
            </button>
          </div>
        );
      })}
    </>
  );
}
