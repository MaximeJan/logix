// Point d'entrée du bundle « core » : réexporte la logique PURE du repo dont
// l'outil a besoin (encodage d'URL, simulation, résolution de composants).
//
// esbuild (voir build.mjs) transpile tout ça en un seul `core.mjs` sans React :
// le champ `shape` (JSX) des composants n'est JAMAIS appelé ici — ni pour encoder
// un exercice, ni pour simuler — donc la fabrique JSX est remplacée par un no-op.
// C'est la MÊME logique que l'app : aucune duplication, aucun risque de dérive.
export { encodeExercise, MAX_PAYLOAD } from '../../src/lib/exercise-url';
export { verifyExercise } from '../../src/lib/exercise-verify';
export { getDef, simulate } from '../../src/gates/registry';
export { GATES } from '../../src/gates';
export { PALETTE_ORDER } from '../../src/lib/constants';
