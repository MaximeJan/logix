import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import prettier from 'eslint-config-prettier';

export default tseslint.config(
  // `tools/` : scripts Node autonomes + bundle généré (logix-mcp), hors du
  // périmètre ESLint « app React » (voir tools/logix-mcp/README.md).
  { ignores: ['dist', 'coverage', 'node_modules', 'tools'] },
  {
    files: ['**/*.{ts,tsx}'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    languageOptions: {
      ecmaVersion: 2020,
      globals: { window: 'readonly', document: 'readonly', localStorage: 'readonly' },
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      // On garde les règles éprouvées (rules-of-hooks, exhaustive-deps) mais on
      // désactive trois règles « React Compiler » plus strictes que les patterns
      // intentionnels de ce projet :
      //  - `refs` : le canevas lit des refs en rendu pour le curseur et l'aperçu
      //    de câblage (état transitoire non réactif), l'historique par onglet
      //    s'appuie sur un ref-getter pointant sur l'onglet actif, et la
      //    simulation lit/écrit `prevOutValuesRef` (mémoire d'un feedback
      //    combinatoire, ex. porte OR bouclée sur elle-même).
      //  - `immutability` : l'historique undo/redo mute volontairement
      //    `history.current.past/future` (pile par onglet stockée dans un ref).
      //  - `set-state-in-effect` : resync légitime état local ↔ prop (TabButton,
      //    BusWidthControl) quand la valeur externe change.
      'react-hooks/refs': 'off',
      'react-hooks/immutability': 'off',
      'react-hooks/set-state-in-effect': 'off',
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    },
  },
  prettier,
);
