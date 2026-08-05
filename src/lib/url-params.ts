// Lecture des paramètres d'URL au démarrage de l'app.
//
// Deux paramètres seulement :
//   ?ex=<payload>  un exercice complet encodé (voir lib/challenge-url.ts)
//   &embed=1       UI allégée, pour embarquer l'app en iframe dans un site tiers
//
// À appeler une seule fois au montage (useMemo(…, [])) : on ne réagit pas aux
// changements d'URL ultérieurs, l'app n'a pas de routeur.

import { GATES } from '../gates';
import { decodeChallenge, payloadHash, EMBED_PARAM, EXERCISE_PARAM } from './challenge-url';
import { STORAGE_KEY } from './constants';
import type { Level } from '../challenges';

export interface UrlContext {
  /** L'exercice décodé, ou null si absent/invalide (l'app démarre alors normalement). */
  level: Level | null;
  /** true si `&embed=1` : masque onglets, fichiers et encapsulation. */
  embed: boolean;
  /**
   * Clé d'autosave à utiliser. Un exercice-URL a sa propre clé dérivée du
   * payload : le bac à sable personnel de l'élève n'est jamais écrasé, et un
   * rafraîchissement dans l'iframe retrouve son travail en cours.
   */
  storageKey: string;
}

export function readUrlContext(): UrlContext {
  const empty: UrlContext = { level: null, embed: false, storageKey: STORAGE_KEY };
  if (typeof window === 'undefined') return empty;

  const params = new URLSearchParams(window.location.search);
  const payload = params.get(EXERCISE_PARAM);
  const embed = params.get(EMBED_PARAM) === '1';
  if (!payload) return { ...empty, embed };

  const level = decodeChallenge(payload, { isKnownType: (t) => !!GATES[t] });
  if (!level) return { ...empty, embed };

  return { level, embed, storageKey: `${STORAGE_KEY}:ex:${payloadHash(payload)}` };
}
