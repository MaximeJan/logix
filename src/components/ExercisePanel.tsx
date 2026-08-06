import type { MouseEvent as ReactMouseEvent } from 'react';
import { PaletteItem } from './PaletteItem';
import type { Exercise } from '../domain/exercise';
import type { ExerciseRow } from '../lib/exercise-verify';

export type { ExerciseRow };

/** Verdict de la dernière vérification (null tant que l'élève n'a pas cliqué). */
export interface ExerciseResult {
  success: boolean;
  error: string | null;
  table: ExerciseRow[] | null;
}

interface ExercisePanelProps {
  exercise: Exercise;
  result: ExerciseResult | null;
  onVerify: () => void;
  onRetry: () => void;
  onPaletteMouseDown: (e: ReactMouseEvent, type: string) => void;
  placeType: string | null;
  customDefs: Record<string, unknown> | null | undefined;
  /** Mode embed (iframe) : tout le contenu du panneau passe à l'échelle compacte. */
  embed?: boolean;
}

// Deux échelles de rendu pour le panneau. En iframe (embed) la place verticale
// est comptée : on garde la même largeur (la consigne doit rester lisible) mais
// tout le contenu tient sur ~la moitié de la hauteur. Sur le site normal, rien
// ne change.
const SCALE = {
  normal: {
    panelPad: 'p-3',
    section: 'space-y-3',
    title: 'text-base',
    body: 'text-xs',
    text: 'text-[11px]',
    list: 'space-y-1.5',
    heading: 'text-xs mb-1.5',
    button: 'px-3 py-1.5 text-xs',
    box: 'p-2',
    tableMaxH: 'max-h-48',
  },
  compact: {
    panelPad: 'p-1.5',
    section: 'space-y-1.5',
    title: 'text-sm',
    body: 'text-[11px]',
    text: 'text-[10px]',
    list: 'space-y-1',
    heading: 'text-[10px] mb-1',
    button: 'px-2 py-1 text-[10px]',
    box: 'p-1',
    tableMaxH: 'max-h-24',
  },
} as const;

// Panneau gauche quand l'app est ouverte sur un exercice (`?ex=…`). Il porte
// TOUTE la consigne (objectif, étapes) — il n'y a pas de bandeau au-dessus du
// canevas, qui reste entièrement disponible pour construire le circuit. Les
// entrées/sorties attendues ne sont plus rappelées ici : elles doivent être
// précisées dans les étapes si besoin. La consigne défile, le pied « Vérifier »
// reste épinglé en bas. Un exercice sans vérification n'a pas de pied du tout.
export function ExercisePanel({
  exercise,
  result,
  onVerify,
  onRetry,
  onPaletteMouseDown,
  placeType,
  customDefs,
  embed,
}: ExercisePanelProps) {
  const S = embed ? SCALE.compact : SCALE.normal;
  const verifiable = exercise.verify.type !== 'none';

  return (
    <div
      className={`w-52 bg-white border-r border-stone-200 flex flex-col overflow-hidden ${S.panelPad}`}
    >
      {/* Consigne + composants : la seule zone qui défile */}
      <div className={`flex-1 min-h-0 overflow-y-auto ${S.section}`}>
        <div>
          <h3 className={`font-bold text-stone-800 leading-snug ${S.title}`}>{exercise.title}</h3>
          {exercise.objective && (
            <p className={`mt-0.5 text-stone-600 leading-snug ${S.body}`}>{exercise.objective}</p>
          )}
        </div>

        {exercise.steps.length > 0 && (
          <ol
            className={`list-decimal pl-4 text-stone-700 leading-snug marker:text-sky-600 marker:font-semibold ${S.body} ${S.list}`}
          >
            {exercise.steps.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ol>
        )}

        {exercise.allowedTypes.length > 0 && (
          <div>
            <div className={`font-semibold text-stone-500 uppercase tracking-wider ${S.heading}`}>
              Composants
            </div>
            <div className={S.list}>
              {exercise.allowedTypes.map((t) => (
                <PaletteItem
                  key={t}
                  type={t}
                  onMouseDown={onPaletteMouseDown}
                  picked={placeType === t}
                  customDefs={customDefs}
                  compact={embed}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Pied fixe : vérification et résultat, toujours visibles */}
      {verifiable && (
        <div className="shrink-0 pt-2 mt-2 border-t border-stone-200">
          {!result ? (
            <button
              onClick={onVerify}
              className={`w-full rounded bg-blue-600 text-white font-medium hover:bg-blue-700 ${S.button}`}
            >
              Vérifier
            </button>
          ) : result.success ? (
            <div className={`rounded bg-green-100 text-green-800 font-bold ${S.box} ${S.text}`}>
              ✓ Réussi !
            </div>
          ) : (
            <div className="space-y-1.5">
              <div className={`rounded bg-red-100 text-red-800 font-bold ${S.box} ${S.text}`}>
                ✗ Échoué
              </div>
              {result.error && <div className={`text-red-700 ${S.text}`}>{result.error}</div>}
              {result.table && result.table.length > 0 && (
                <div
                  className={`overflow-y-auto border rounded bg-stone-50 ${S.tableMaxH} ${S.text}`}
                >
                  <table className="w-full border-collapse">
                    <thead className="bg-stone-200 sticky top-0">
                      <tr>
                        <th className="border px-1 py-0.5 text-left">Entrée(s)</th>
                        <th className="border px-1 py-0.5 text-left">Attendu</th>
                        <th className="border px-1 py-0.5 text-left">Obtenu</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.table.map((row, i) => (
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
                className={`w-full rounded bg-blue-600 text-white font-medium hover:bg-blue-700 ${S.button}`}
              >
                Réessayer
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
