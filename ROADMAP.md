# Feuille de route

## ✅ Phase 1 — Fondations (terminée)

Portes logiques 1-bit (AND, OR, NOT, NAND, NOR, XOR) avec symboles ANSI. Entrée / Sortie 1-bit cliquables. Câblage manhattan automatique. Simulation combinatoire par tri topologique de Kahn. Canevas avec grille, déplacement de composants, suppression.

## ✅ Phase 2 — Persistance (terminée)

Format JSON versionné (FORMAT_VERSION=1). Import / export. Autosave navigateur (localStorage). Undo / redo (100 niveaux). Copier-coller. Sélection rectangulaire (shift-additive). Table de vérité automatique pour les entrées/sorties 1-bit.

## ✅ Phase 3 — Composants personnalisés (terminée)

Encapsulation : sélectionner un sous-circuit, le sauver comme nouveau composant réutilisable. Les composants custom peuvent eux-mêmes contenir des composants custom (récursion possible si l'utilisateur ne crée pas de boucle). Édition en place via un banner ambré. Détection automatique des références circulaires.

## ✅ Phase 4 — Bus multi-bits (terminée)

Largeur de port configurable 1-32 (libre, pas seulement les puissances de 2). Bus visualisé en nappe parallèle : N polylines côte à côte, MSB extérieur, LSB extérieur opposé, convergence en éventail aux ports. Réglages d'apparence du bus (épaisseur d'un bit, espacement, couleur du bit éteint). Détection des largeurs incompatibles au câblage avec notification éphémère. Composants ajoutés : SPLITTER, MERGER, MUX, DEMUX, DECODER, tous reconfigurables et fonctionnant aussi bien en 1-bit qu'en bus.

Entrée bus : rangée de N cellules cliquables, un clic par bit pour basculer. Plus de saisie texte ni de sélecteur dec/hex/bin.

Sortie bus : conserve son affichage texte avec sélecteur dec/hex/bin.

## ✅ Phase 5a — Bascule D + Horloge (terminée)

**Bascule D** : trois entrées (D, CLK, RST), une sortie Q. Front montant déclenche la capture de D dans Q. RST=1 force Q=0 immédiatement (asynchrone, prioritaire sur la capture). Largeur configurable 1-32 — en mode bus elle se comporte comme un registre N-bits. Halo lime de 300 ms au moment du front capturé.

**Horloge** : deux modes. Manuel (clic sur le composant ou bouton « ⏵ Tick » dans la toolbar bascule). Auto à fréquence réglable (0,5 / 1 / 2 / 5 / 10 Hz). Pastille rouge clignotante en mode auto.

Architecture : `simulate()` reste pure, le DFF est traité comme une source dont la sortie = `state.q`. Un `useEffect` séparé détecte les fronts montants en comparant `state.lastClk` au CLK courant, et met à jour tous les DFF en lot — atomicité garantie pour les shift registers.

## ✅ Phase 5b — Suite séquentielle (terminée)

**Faits :**

1. ✅ **SR latch** (composant primitif) — mémoire asynchrone S/R, R prioritaire en cas de conflit. 1-bit fixe.
2. ✅ **RAM** — lecture asynchrone (DATA_OUT = mem[ADDR]), écriture synchrone sur front montant de CLK si WE=1. Dimensions configurables : 1-8 bits d'adresse (2-256 cases), 1-16 bits par mot. Édition cellule par cellule dans le panneau, grille cliquable bit par bit, ligne ADDR courante surlignée. Contenu persisté dans le JSON.
3. ✅ **Registre N-bit avec LD** — Q ← D sur front montant uniquement si LD=1, sinon hold. Largeur 1-32. Comportement plus pédagogique que le D-FF en mode bus, qui capture sans condition.
4. ✅ **Compteur N-bit** — Q ← Q+1 sur front montant si EN=1, sinon hold. RST asynchrone force Q=0. Largeur 1-32. Sera le futur PC du CPU.
5. ✅ **Afficheur LED matrix** — écriture synchrone d'un pixel (X, Y, D) sur front montant si WE=1 ; RST asynchrone éteint tous les pixels. Dimensions configurables.

**Retiré du chemin critique** (peu utile pour la phase 6) :

- JK flip-flop et T flip-flop — historiquement intéressants mais peu réutilisés en pratique. À reconsidérer plus tard si un besoin pédagogique apparaît.

## ⏳ Phase 6 — Petit processeur (à faire)

L'idée : un mini-CPU avec quelques instructions (NOP, LOAD, STORE, ADD, SUB, JMP, JZ, HALT), 4 registres généraux, mémoire 256 mots × 8 bits. L'élève peut soit utiliser un CPU « tout monté » pour exécuter des programmes, soit l'examiner / le modifier pour comprendre.

Décisions à prendre quand on y arrive :
- Format des instructions (longueur fixe ou variable)
- Mémoire programme séparée ou unifiée (Harvard vs Von Neumann)
- Affichage de l'état des registres et de la mémoire pendant l'exécution
- Mode pas-à-pas (utilise le « Tick » sur l'horloge système) vs auto-run
- Éventuel petit assembleur côté UI pour écrire du code et le charger en mémoire

## ✅ Exercices partageables par URL (terminé)

L'enseignant compose un exercice depuis l'app (« Challenges » → « Créer un exercice ») : énoncé,
composants proposés, ports attendus, table de vérité ou séquence. Tout est encodé dans le lien
(`?ex=…`), donc aucun backend et rien à redéployer. La table peut être générée automatiquement
(jusqu'à 8 bits d'entrée) et remplie en simulant le circuit de l'onglet courant.

`&embed=1` allège l'UI (ni onglets, ni import/export, ni encapsulation) pour embarquer Logix en
iframe dans un site de théorie. Chaque exercice a sa propre sauvegarde locale : le bac à sable de
l'élève n'est jamais écrasé.

## Idées hors phase

- Signaler la réussite au site parent (`postMessage`) pour qu'il coche la progression de l'élève.
- Suivi de progression : mémoriser les niveaux déjà réussis.
- Export d'un circuit comme image PNG/SVG.
- Mode présentation (plein écran, sans palette ni outils) pour projeter au tableau.
- Hub de partage de circuits entre élèves (nécessite un backend, hors scope actuel).
