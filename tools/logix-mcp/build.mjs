// Bundle la logique pure du repo en un seul `core.mjs` (ESM, Node, sans React).
//
// Le JSX des composants (`shape`) est compilé vers une fabrique no-op : ce code
// n'est jamais exécuté côté outil (on encode/simule seulement), donc pas besoin
// de React. On réutilise l'esbuild déjà présent via Vite — aucune dépendance à
// installer, tout est hors-ligne.
import { build } from 'esbuild';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

await build({
  entryPoints: [join(here, 'core.entry.ts')],
  outfile: join(here, 'core.mjs'),
  bundle: true,
  format: 'esm',
  platform: 'node',
  target: 'node18',
  // JSX -> no-op : la fabrique n'est jamais appelée (shape non rendu ici).
  jsx: 'transform',
  jsxFactory: '__noopJsx',
  jsxFragment: '__noopFrag',
  banner: { js: 'const __noopJsx = () => null;\nconst __noopFrag = null;' },
  logLevel: 'info',
});

console.log('core.mjs généré.');
