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

Il n'y a pas de catalogue d'exercices dans l'app : un exercice sur mesure tient **entièrement dans
son lien**, aucun backend, rien à redéployer. Pratique pour embarquer Logix dans un site de théorie
et proposer des exercices au fil du cours.

1. Clique **« Créer un exercice »** dans la barre d'outils.
2. Remplis le titre, l'objectif, les étapes, les composants proposés à l'élève et les entrées /
   sorties attendues.
3. Choisis la vérification :
   - **Table de vérité** — génère toutes les combinaisons d'un clic (jusqu'à 8 bits d'entrée).
   - **Séquence** — une ligne par tick, pour un circuit séquentiel.
   - **Aucune vérification** — l'élève reçoit l'énoncé et les composants, sans bouton
     « Vérifier ». Ni ports ni lignes ne sont alors obligatoires : un titre suffit.

   Pour les deux premières, le bouton **« Remplir les sorties depuis le circuit courant »** déduit
   les réponses attendues en simulant le circuit de l'onglet actif : construis la solution, et la
   table se remplit toute seule.
4. Coche (ou non) **« Ouvrir automatiquement le panneau Propriétés »** — décoché par défaut, pour
   que l'élève reste concentré sur le canevas. Active-le si l'exercice demande de renommer des
   ports ou de régler des largeurs de bus depuis ce panneau.
5. **Circuit de départ** (facultatif) : construis d'abord un circuit dans l'onglet, puis, dans la
   fenêtre de création, coche **« Précharger le circuit courant »** pour le fournir tout monté à
   l'élève (point de départ à compléter). Coche plutôt **« Verrouiller le circuit »** pour une
   **démonstration** : l'élève ne peut ni déplacer, ni câbler, ni supprimer, mais peut toujours
   cliquer les entrées et ticker les horloges pour observer le comportement.
6. Choisis la hauteur de l'iframe (200–2000 px), puis copie l'un des deux champs : le lien de
   l'exercice, ou l'extrait `<iframe>` prêt à coller dans ta page.

```html
<iframe src="https://…/logix/?ex=…&embed=1" width="100%" height="700" style="border:0"></iframe>
```

Deux paramètres d'URL :

| Paramètre | Effet |
| --- | --- |
| `?ex=<payload>` | Charge l'exercice encodé (base64url) : sa consigne remplace la palette dans le panneau de gauche. |
| `&embed=1` | UI allégée pour l'iframe : ni onglets, ni import de JSON, ni encapsulation, ni générateur d'exercice, et panneau de consigne compact. Le bouton **Télécharger** reste disponible pour que l'élève rende sa solution. |

La consigne complète (objectif, étapes, entrées/sorties attendues) s'affiche dans le panneau de
gauche ; le canevas reste entièrement libre. Le bouton **Vérifier** est épinglé en bas du panneau,
donc atteignable même dans une iframe basse.

L'élève travaille sur une sauvegarde propre à l'exercice : son bac à sable personnel n'est jamais
écrasé, et un rafraîchissement de la page conserve son circuit en cours. Un circuit préchargé sert
de point de départ à la première ouverture ; ensuite, c'est le travail de l'élève qui est restauré.
Une URL corrompue est ignorée — l'app démarre alors normalement.

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
