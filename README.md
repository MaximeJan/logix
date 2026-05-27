# Circuit Simulator

Simulateur de circuits logiques pour le cours d'OC informatique au gymnase. App web React, aucune installation côté élève.

## Lancement local

Prérequis : Node.js 18 ou plus.

```bash
npm install
npm run dev
```

Ouvre [http://localhost:5173](http://localhost:5173).

## Build de production

```bash
npm run build
npm run preview
```

Le dossier `dist/` contient les fichiers statiques à déployer sur n'importe quel serveur web (GitHub Pages, Netlify, OVH, etc.).

## Structure du projet

- `src/CircuitSimulator.jsx` — TOUT le code de l'app (un seul fichier par choix de design)
- `src/main.jsx` — point d'entrée React
- `src/index.css` — Tailwind base
- `CLAUDE.md` — contexte projet pour Claude Code (lis-le avant de bosser dessus avec un assistant)
- `ROADMAP.md` — phases passées et à venir

## Fonctionnalités

Phases terminées :

- Portes logiques : AND, OR, NOT, NAND, NOR, XOR
- Entrées / sorties 1-bit et bus (1–32 bits configurables)
- Câblage manhattan avec routage automatique
- Sauvegarde / chargement JSON
- Undo / redo, copier-coller, sélection rectangulaire
- Composants personnalisés (encapsuler un sous-circuit dans une seule boîte)
- Bus visualisé en nappe parallèle, MSB côté extérieur
- Multiplexeur, démultiplexeur, décodeur — reconfigurables 1-bit ou bus
- Splitter, merger
- Bascule D (1-bit ou registre N-bit), horloge manuelle et automatique
- Table de vérité automatique
- Apparence personnalisable (couleurs, épaisseurs, grille)

À venir : SR latch, JK / T flip-flop, RAM, petit processeur pédagogique.

## Test logique rapide

Le simulateur a un mode parse-check pour vérifier que le fichier reste syntaxiquement valide :

```bash
npm run parse-check
```

Pour tester la logique pure (sans React), extraire les fonctions dans un fichier `.mjs` et lancer avec `node`.

## Licence

Projet pédagogique, libre d'usage pour l'éducation.
