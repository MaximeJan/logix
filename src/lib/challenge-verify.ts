// Vérification des challenges — logique pure, sans React.
// Appariement entrées/sorties PAR ORDRE DE CRÉATION (les labels sont ignorés) :
// les N premiers INPUT/OUTPUT du circuit de l'élève sont confrontés à la table
// de vérité (combinatoire) ou à la séquence (séquentiel) du niveau.
import { asInt, portKey, simulate, stepSequential } from './sim';
import type { Circuit, GetDef } from '../domain/types';
import type { Level } from '../challenges';

/** Une ligne de résultat : valeurs injectées, attendues, obtenues, et verdict. */
export interface ChallengeRow {
  inVals: number[];
  expectedOutVals: number[];
  actualOutVals: number[];
  match: boolean;
}

export interface VerifyResult {
  success: boolean;
  error?: string;
  table?: ChallengeRow[];
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

export function verifyChallenge(
  circuit: Circuit,
  level: Level,
  getDef: GetDef,
  options: VerifyOptions = {},
): VerifyResult {
  const stopOnFirstFailure = options.stopOnFirstFailure !== false;
  // Récupère les INPUT/OUTPUT du circuit courant par ordre (ignore les labels)
  const inputComps = circuit.components.filter((c) => c.type === 'INPUT');
  const outputComps = circuit.components.filter((c) => c.type === 'OUTPUT');

  // Vérifie que le nombre d'entrées/sorties correspond
  if (inputComps.length < level.inputs.length) {
    return {
      success: false,
      error: `Il faut ${level.inputs.length} entrée(s), trouvées ${inputComps.length}`,
    };
  }
  if (outputComps.length < level.outputs.length) {
    return {
      success: false,
      error: `Il faut ${level.outputs.length} sortie(s), trouvées ${outputComps.length}`,
    };
  }

  // Utilise les N premiers INPUT et OUTPUT (ordre de création)
  const inputIds = inputComps.slice(0, level.inputs.length).map((c) => c.id);
  const outputIds = outputComps.slice(0, level.outputs.length).map((c) => c.id);

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

  if (level.verify.type === 'truthtable') {
    const allRows: ChallengeRow[] = [];
    const truthTable = level.truthTable ?? [];
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

  if (level.verify.type === 'sequence') {
    // Reset des DFF avant la séquence (état mémoire à 0)
    let testCircuit: Circuit = {
      ...circuit,
      components: circuit.components.map((c) =>
        c.type === 'DFF' ? { ...c, state: { ...(c.state ?? {}), q: 0 } } : c,
      ),
    };
    const allSteps: ChallengeRow[] = [];
    for (const [inVals, expectedOutVals] of level.verify.steps) {
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

  return { success: false, error: 'Type de vérification inconnu' };
}
