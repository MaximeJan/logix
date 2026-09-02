// Vérification d'un exercice — logique pure, sans React.
// Appariement entrées/sorties PAR ÉTIQUETTE quand c'est possible : chaque port
// attendu (`A`, `B`, `S`…) est confronté à l'INPUT/OUTPUT de l'élève qui porte ce
// nom (insensible à la casse/espaces). L'ordre de création n'a alors aucune
// importance — un élève qui pose B avant A obtient quand même le bon verdict.
// Repli sur l'ORDRE DE CRÉATION si les étiquettes ne forment pas un appariement
// complet (ports non nommés, anciens liens) : comportement historique, préservé.
import { asInt, portKey, simulate, stepSequential } from './sim';
import type { Circuit, CircuitComponent, GetDef } from '../domain/types';
import type { Exercise, ExercisePort } from '../domain/exercise';

/** Normalise une étiquette pour la comparaison (insensible casse/espaces). */
const normLabel = (s: unknown): string => (typeof s === 'string' ? s.trim().toLowerCase() : '');

/**
 * Aligne les composants de l'élève sur les ports attendus PAR ÉTIQUETTE.
 * Renvoie la liste des ids dans l'ordre des `expected`, ou `null` si les
 * étiquettes ne couvrent pas tous les ports attendus de façon univoque (dans ce
 * cas l'appelant retombe sur l'ordre de création).
 */
function orderByLabel(comps: CircuitComponent[], expected: ExercisePort[]): string[] | null {
  const used = new Set<string>();
  const ids: string[] = [];
  for (const port of expected) {
    const want = normLabel(port.name);
    if (!want) return null; // port attendu sans nom → pas d'appariement par étiquette
    const found = comps.find((c) => !used.has(c.id) && normLabel(c.label) === want);
    if (!found) return null; // aucune étiquette correspondante → repli sur l'ordre
    used.add(found.id);
    ids.push(found.id);
  }
  return ids;
}

/** Une ligne de résultat : valeurs injectées, attendues, obtenues, et verdict. */
export interface ExerciseRow {
  inVals: number[];
  expectedOutVals: number[];
  actualOutVals: number[];
  match: boolean;
}

export interface VerifyResult {
  success: boolean;
  error?: string;
  table?: ExerciseRow[];
}

// Lit les valeurs des OUTPUT (port d'entrée 'in0') après simulation.
function readOutputs(sim: ReturnType<typeof simulate>, outputIds: string[]): number[] {
  return outputIds.map((outId) => asInt(sim.inputValues.get(portKey(outId, 'in0')) ?? 0));
}

export interface VerifyOptions {
  /**
   * Par défaut on s'arrête à la première ligne fausse (retour rapide pour
   * l'élève). Le générateur d'exercices passe `false` : il veut les sorties
   * obtenues pour TOUTES les lignes, afin de pré-remplir la table attendue.
   */
  stopOnFirstFailure?: boolean;
}

export function verifyExercise(
  circuit: Circuit,
  exercise: Exercise,
  getDef: GetDef,
  options: VerifyOptions = {},
): VerifyResult {
  // Exercice libre : rien à vérifier (ni ports imposés, ni lignes).
  if (exercise.verify.type === 'none') return { success: true, table: [] };

  const stopOnFirstFailure = options.stopOnFirstFailure !== false;
  // Récupère les INPUT/OUTPUT du circuit courant par ordre (ignore les labels)
  const inputComps = circuit.components.filter((c) => c.type === 'INPUT');
  const outputComps = circuit.components.filter((c) => c.type === 'OUTPUT');

  // Vérifie que le nombre d'entrées/sorties correspond
  if (inputComps.length < exercise.inputs.length) {
    return {
      success: false,
      error: `Il faut ${exercise.inputs.length} entrée(s), trouvées ${inputComps.length}`,
    };
  }
  if (outputComps.length < exercise.outputs.length) {
    return {
      success: false,
      error: `Il faut ${exercise.outputs.length} sortie(s), trouvées ${outputComps.length}`,
    };
  }

  // Apparie par étiquette si l'élève a nommé ses ports comme l'énoncé ; sinon,
  // repli sur les N premiers INPUT/OUTPUT (ordre de création — historique).
  const inputIds =
    orderByLabel(inputComps, exercise.inputs) ??
    inputComps.slice(0, exercise.inputs.length).map((c) => c.id);
  const outputIds =
    orderByLabel(outputComps, exercise.outputs) ??
    outputComps.slice(0, exercise.outputs.length).map((c) => c.id);

  // Injecte des valeurs sur les INPUT repérés par leur id.
  const withInputs = (c: Circuit, inVals: number[]): Circuit => ({
    ...c,
    components: c.components.map((comp) => {
      const inputIdx = inputIds.indexOf(comp.id);
      if (inputIdx < 0) return comp;
      return { ...comp, state: { ...(comp.state ?? {}), value: inVals[inputIdx] } };
    }),
  });

  const rowMatches = (expected: number[], actual: number[]) =>
    expected.every((exp, i) => (actual[i] ?? 0) === exp);

  if (exercise.verify.type === 'truthtable') {
    const allRows: ExerciseRow[] = [];
    const truthTable = exercise.truthTable ?? [];
    for (const [inVals, expectedOutVals] of truthTable) {
      const sim = simulate(withInputs(circuit, inVals), getDef);
      const actualOutVals = readOutputs(sim, outputIds);
      const match = rowMatches(expectedOutVals, actualOutVals);
      allRows.push({ inVals, expectedOutVals, actualOutVals, match });
      if (!match && stopOnFirstFailure) {
        return { success: false, error: 'Table échouée', table: allRows };
      }
    }
    const failed = allRows.some((r) => !r.match);
    return failed
      ? { success: false, error: 'Table échouée', table: allRows }
      : { success: true, table: allRows };
  }

  // Reset des DFF avant la séquence (état mémoire à 0)
  let testCircuit: Circuit = {
    ...circuit,
    components: circuit.components.map((c) =>
      c.type === 'DFF' ? { ...c, state: { ...(c.state ?? {}), q: 0 } } : c,
    ),
  };
  const allSteps: ExerciseRow[] = [];
  for (const [inVals, expectedOutVals] of exercise.verify.steps) {
    testCircuit = withInputs(testCircuit, inVals);
    testCircuit = stepSequential(testCircuit, getDef);
    const sim = simulate(testCircuit, getDef);
    const actualOutVals = readOutputs(sim, outputIds);
    const match = rowMatches(expectedOutVals, actualOutVals);
    allSteps.push({ inVals, expectedOutVals, actualOutVals, match });
    if (!match && stopOnFirstFailure) {
      return { success: false, error: 'Séquence échouée', table: allSteps };
    }
  }
  const failed = allSteps.some((r) => !r.match);
  return failed
    ? { success: false, error: 'Séquence échouée', table: allSteps }
    : { success: true, table: allSteps };
}
