// Lecture des paramètres d'URL au démarrage de l'app.
//
// Deux paramètres seulement :
//   ?ex=<payload>  un exercice complet encodé (voir lib/exercise-url.ts)
//   &embed=1       UI allégée, pour embarquer l'app en iframe dans un site tiers
//
// À appeler une seule fois au montage (useMemo(…, [])) : on ne réagit pas aux
// changements d'URL ultérieurs, l'app n'a pas de routeur.

import { GATES } from '../gates';
import { decodeExercise, payloadHash, EMBED_PARAM, EXERCISE_PARAM } from './exercise-url';
import { STORAGE_KEY } from './constants';
import type { Exercise } from '../domain/exercise';

export interface UrlContext {
  /** L'exercice décodé, ou null si absent/invalide (l'app démarre alors normalement). */
  exercise: Exercise | null;
  /** true si `&embed=1` : masque onglets, import et encapsulation. */
  embed: boolean;
  /**
   * Clé d'autosave à utiliser. Un exercice-URL a sa propre clé dérivée du
   * payload : le bac à sable personnel de l'élève n'est jamais écrasé, et un
   * rafraîchissement dans l'iframe retrouve son travail en cours.
   */
  storageKey: string;
}

export function readUrlContext(): UrlContext {
  const empty: UrlContext = { exercise: null, embed: false, storageKey: STORAGE_KEY };
  if (typeof window === 'undefined') return empty;

  const params = new URLSearchParams(window.location.search);
  const payload = params.get(EXERCISE_PARAM);
  const embed = params.get(EMBED_PARAM) === '1';
  if (!payload) return { ...empty, embed };

  const exercise = decodeExercise(payload, { isKnownType: (t) => !!GATES[t] });
  if (!exercise) return { ...empty, embed };

  return { exercise, embed, storageKey: `${STORAGE_KEY}:ex:${payloadHash(payload)}` };
}
