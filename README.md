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

App **React 18 + Vite + TypeScript**, code modulaire :

- `src/CircuitSimulator.tsx` — orchestrateur : état, handlers, composition du rendu
- `src/main.tsx` — point d'entrée React
- `src/domain/` — types du domaine
- `src/lib/` — logique pure sans React (simulation, persistance, géométrie, constantes, exercices-URL)
- `src/gates/` — définitions des composants par catégorie (`io/logic/bus/arith/sequential/display`), agrégées dans `index.tsx`, + résolution (`getDef`, `simulate`)
- `src/components/` — composants d'interface (barre d'outils, canevas, panneaux, modales…)
- `src/hooks/` — hooks d'état réutilisables (historique, autosave, moteur, chronogramme…)
- `tests/` — tests de logique pure (Vitest) : sim, géométrie, bits, registre, persistance
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

## Créer des exercices par URL

Un exercice sur mesure tient **entièrement dans son lien** : aucun backend, rien à redéployer.
Pratique pour embarquer Logix dans un site de théorie et proposer des exercices au fil du cours.

1. Ouvre **Challenges** dans la barre d'outils, puis **« Créer un exercice »** en bas du panneau.
2. Remplis le titre, l'objectif, les étapes, les composants proposés à l'élève et les entrées /
   sorties attendues.
3. Génère la table de vérité (jusqu'à 8 bits d'entrée, toutes les combinaisons d'un clic), ou
   choisis « Séquence » pour un circuit séquentiel. Le bouton **« Remplir les sorties depuis le
   circuit courant »** déduit les réponses attendues en simulant le circuit de l'onglet actif :
   construis la solution, et la table se remplit toute seule.
4. Copie le lien, ou directement l'extrait `<iframe>` prêt à coller dans ta page.

```html
<iframe src="https://…/logix/?ex=…&embed=1" width="100%" height="700" style="border:0"></iframe>
```

Deux paramètres d'URL :

| Paramètre | Effet |
| --- | --- |
| `?ex=<payload>` | Charge l'exercice encodé (base64url) et démarre en mode challenge. |
| `&embed=1` | UI allégée pour l'iframe : ni onglets, ni import/export, ni encapsulation. |

L'élève travaille sur une sauvegarde propre à l'exercice : son bac à sable personnel n'est jamais
écrasé, et un rafraîchissement de la page conserve son circuit en cours. Une URL corrompue est
ignorée — l'app démarre alors normalement.

> La vérification apparie les Entrée/Sortie de l'élève **par ordre de création**, pas par étiquette.
> Précise donc l'ordre attendu dans les étapes de l'énoncé.

## Qualité du code

```bash
npm run typecheck     # vérification des types (tsc)
npm run lint          # ESLint
npm run format        # Prettier
npm run test          # tests de logique pure (Vitest)
npm run test:coverage # tests + rapport de couverture
npm run build         # tsc + build de production
```

La logique pure (simulation, masquage de bits, géométrie, résolution des définitions, persistance) est couverte par Vitest dans `tests/` — qui importent la **vraie** `GATES` de `src/gates` (≈ 95 % sur `src/lib`). Le rendu React se vérifie visuellement dans le navigateur.

## Déploiement GitHub Pages

Le projet se déploie automatiquement sur GitHub Pages à chaque push sur `main` via le workflow `.github/workflows/deploy.yml`. La base URL est détectée automatiquement depuis le nom du dépôt.

## Licence

[CC BY-NC 4.0](https://creativecommons.org/licenses/by-nc/4.0/) — © 2026 Maxime Jan

Utilisation et adaptation libres à condition de **citer l'auteur**. Usage commercial interdit.
