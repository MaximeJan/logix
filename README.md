# Logix

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

- SR latch, registre N-bit avec chargement conditionnel, compteur N-bit
- RAM configurable (1–8 bits d'adresse, 1–16 bits par mot), édition cellule par cellule
- Chronogramme en temps réel
- Afficheur 7 segments, matrice LED

À venir : petit processeur pédagogique (PC, ALU, mémoire, jeu d'instructions minimal).

## Test logique rapide

Le simulateur a un mode parse-check pour vérifier que le fichier reste syntaxiquement valide :

```bash
npm run parse-check
```

Pour tester la logique pure (sans React), extraire les fonctions dans un fichier `.mjs` et lancer avec `node`.

## Déploiement GitHub Pages

Le projet se déploie automatiquement sur GitHub Pages à chaque push sur `main` via le workflow `.github/workflows/deploy.yml`. La base URL est détectée automatiquement depuis le nom du dépôt.

## Licence

[CC BY-NC 4.0](https://creativecommons.org/licenses/by-nc/4.0/) — © 2026 Maxime Jan

Utilisation et adaptation libres à condition de **citer l'auteur**. Usage commercial interdit.
