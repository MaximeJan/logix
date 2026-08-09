// Types d'un exercice sur mesure.
//
// Il n'y a pas de catalogue d'exercices dans l'app : un exercice n'existe que
// dans une URL (`?ex=…`, voir lib/exercise-url). L'enseignant le compose depuis
// « Créer un exercice » et partage le lien (ou l'iframe).

/** Un port attendu d'un exercice (nom + largeur en bits). */
export interface ExercisePort {
  name: string;
  width: number;
}

/** Une ligne de vérification : [valeurs d'entrée, valeurs de sortie attendues]. */
export type IoRow = [number[], number[]];

/**
 * Mode de vérification : table de vérité (combinatoire), séquence (séquentiel),
 * ou aucune — un énoncé libre, sans bouton « Vérifier ».
 */
export type Verify =
  | { type: 'truthtable' }
  | { type: 'sequence'; steps: IoRow[] }
  | { type: 'none' };

/** Un exercice complet, tel que transporté par l'URL. */
export interface Exercise {
  title: string;
  objective: string;
  steps: string[];
  allowedTypes: string[];
  inputs: ExercisePort[];
  outputs: ExercisePort[];
  verify: Verify;
  truthTable?: IoRow[];
  /**
   * Ouvre automatiquement le panneau « Propriétés » quand l'élève sélectionne
   * un composant. Faux par défaut : l'enseignant choisit de l'activer si
   * l'exercice a besoin que l'élève renomme des ports ou règle des largeurs
   * de bus depuis ce panneau.
   */
  autoOpenProperties: boolean;
  /**
   * Circuit pré-chargé au démarrage de l'exercice, au format sérialisé produit
   * par `serialize()` (composants, fils, définitions personnalisées). Absent =
   * canevas vide. Sert à donner un point de départ, ou (avec `locked`) à poser
   * une démonstration toute montée. Donnée non fiable : l'orchestrateur la fait
   * passer par `deserializeAll` (qui assainit) avant de l'utiliser.
   */
  preset?: unknown;
  /**
   * Verrouille la structure du circuit : l'élève ne peut ni placer, ni câbler,
   * ni déplacer, ni supprimer de composant. Il peut toujours interagir (basculer
   * les entrées, ticker les horloges). Faux par défaut. Pensé pour les démos
   * (souvent combiné à `preset`).
   */
  locked: boolean;
}
