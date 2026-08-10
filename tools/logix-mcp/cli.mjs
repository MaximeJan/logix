#!/usr/bin/env node
// CLI hors-ligne : lit un « spec » JSON (fichier en argument, ou stdin) et
// imprime le lien de l'exercice + l'extrait <iframe> en JSON.
//
//   node cli.mjs exo.json
//   echo '{"title":"NOT","verify":"none","allowedTypes":["INPUT","OUTPUT","NAND"]}' | node cli.mjs
//   node cli.mjs --components        # liste les composants disponibles
//   node cli.mjs --fill circuit.json # remplit une table depuis un circuit-solution
//
// Aucune dépendance à installer : s'appuie sur core.mjs (déjà bundlé).
import { readFile } from 'node:fs/promises';
import { buildExercise, fillTruthTable, listComponents } from './logix.mjs';

async function readInput(pathArg) {
  if (pathArg) return readFile(pathArg, 'utf8');
  const chunks = [];
  for await (const c of process.stdin) chunks.push(c);
  return Buffer.concat(chunks).toString('utf8');
}

const out = (obj) => process.stdout.write(JSON.stringify(obj, null, 2) + '\n');

try {
  const [flag, arg] = process.argv.slice(2);
  if (flag === '--components') {
    out(listComponents());
  } else if (flag === '--fill') {
    const spec = JSON.parse(await readInput(arg));
    out(fillTruthTable(spec));
  } else {
    const pathArg = flag && !flag.startsWith('--') ? flag : undefined;
    const spec = JSON.parse(await readInput(pathArg));
    out(buildExercise(spec));
  }
} catch (err) {
  process.stderr.write('Erreur : ' + (err instanceof Error ? err.message : String(err)) + '\n');
  process.exit(1);
}
