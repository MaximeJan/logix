# Logix — projet pédagogique

Simulateur de circuits logiques de type Logisim destiné à des élèves d'OC informatique au gymnase suisse (Fribourg). L'objectif est qu'un élève puisse progresser des portes logiques de base jusqu'à un petit processeur, sans rien installer (app web, autosave navigateur).

## Public et style pédagogique

- Élèves 16-18 ans avec quelques bases (Python, binaire). Ils ne sont pas développeurs.
- Convention visuelle : sources/entrées à gauche, sorties à droite, fils horizontaux/verticaux uniquement (manhattan).
- Convention bus : **MSB à gauche/extérieur**, LSB à droite/intérieur (lecture binaire naturelle de gauche à droite).
- Aucun jargon EE inutile. Les composants ont des labels FR (« Entrée », « Sortie », « Bascule D », « Multiplexeur »).

## Stack et organisation

- **React 18 + Vite + TypeScript** (Tailwind CSS, lucide-react, IBM Plex Sans + Mono via Google Fonts).
- **Vitest** pour les tests de logique pure, **ESLint** (flat config) + **Prettier** pour le style.
- Le code est **modulaire et entièrement TypeScript** : la logique pure, les composants UI et les hooks sont séparés. L'orchestrateur `src/CircuitSimulator.tsx` ne fait plus que tenir l'état, les handlers, et composer les composants. `src/main.tsx` le monte.

> `tsconfig` est en mode `strict`. Tout `src/` est en `.ts`/`.tsx` (plus aucun `.js`), vérifié par `tsc`. Les seuls `.mjs` sont les tests dans `tests/`.

### Carte des fichiers

```
src/
  main.tsx                 montage React
  CircuitSimulator.tsx     ORCHESTRATEUR : état, handlers, composition du rendu
  domain/
    types.ts               types du domaine (Circuit, CircuitComponent, Wire,
                           ResolvedDef, Selection, SimResult, Prefs côté lib…)
  lib/                     logique pure & utilitaires, SANS React :
    sim.ts                 simulate(), stepSequential(), asInt, maskTo, portKey,
                           applyOrientation, SEG7_HEX_TABLE
    persist.ts             serialize/deserialize (+ …All), FORMAT_VERSION
    geometry.ts            routeWire, pointsToStr, offsetManhattan, makeBusTracks,
                           uprightTransform, widthForBits, addrBitsFor, roundedRectPath
    constants.ts           GRID, PORT_R, STORAGE_KEY, PALETTE_ORDER, DEFAULT_PREFS…
    bits.ts, storage.ts    formatBitsGrouped ; adaptateur de stockage
  challenges.ts            données des niveaux (typées) + getLevel/getAllLevels
  gates/                   définitions des composants primitifs :
    types.ts               interfaces GateDef / DynamicGeometry (dont `fixedDisplay`)
    shared.tsx             helpers de rendu partagés (bitCells, seg7Layout)
    rectLayout.ts          layout générique « boîte rectangulaire » : pose les
                           ports sur le bord correspondant à l'orientation, calcule
                           la dimension de la boîte, fournit le ▷ d'horloge.
    RectShape.tsx          rendu standardisé d'une boîte rectangulaire (cadre,
                           stubs, labels, ▷ CLK, halo) à partir d'un `RectLayout`.
    UprightText.tsx        texte qui se contre-tourne (`-angle`) en pivotant
                           autour de son ancre (left/center/right).
    io / logic / bus /     défs par catégorie (Record<string, GateDef>)
    arith / sequential / display
    index.tsx              agrège les catégories → `export const GATES`
    registry.tsx           getDef, buildCustomDef, typeReferences, getPortPosition,
                           getPortWidth, et le wrapper simulate(circuit)
  components/              présentation (.tsx) :
    Toolbar, TabsBar, TabButton, PalettePanel, PaletteItem, ChallengePanel,
    ChallengeBanner, CircuitCanvas, RightPanel, PropertiesPanel, TruthTablePanel,
    ChronogramPanel, PreferencesPanel, BusWidthControl, HoverTooltip,
    SaveAsComponentModal, DeleteDefinitionModal, ui.tsx
    properties/            sections de PropertiesPanel (RamSection, LedMatrixSection)
  hooks/                   logique d'état réutilisable :
    usePrefs, useTrace, useCircuitEngine, useHistory, useAutosave,
    useViewport, useKeyboardShortcuts
tests/                     Vitest (.mjs) : sim-core (importe la VRAIE GATES),
                           geometry, bits, registry, run.test (logique + persist)
```

## Comment développer

```bash
npm install
npm run dev        # http://localhost:5173
npm run typecheck  # tsc --noEmit
npm run lint       # eslint .
npm run format     # prettier --write
npm run test          # vitest run
npm run test:coverage # vitest run --coverage (rapport text + html)
npm run build         # tsc --noEmit && vite build
```

Après une édition non triviale, **lancer `npm run build`** (il enchaîne `tsc` strict puis le bundle) et `npm run lint`. Le typage attrape la plupart des régressions de logique ; le rendu, lui, se vérifie **visuellement dans le navigateur** (cf. ci-dessous).

La logique pure (`simulate`, masking, conversions de bits, géométrie, résolution de défs) est testée avec Vitest (`tests/`), sans React. **Les tests importent la VRAIE `GATES` de `src/gates`** (pas une copie) : toute modif d'une porte (ports, `fn`, géométrie) est donc gardée. `src/lib` est couvert à ~95 %. Le rendu React (composants/hooks) n'est pas testé — il se vérifie à l'œil dans le navigateur.

## Architecture interne

L'objet **`GATES`** (`src/gates/index.tsx`) agrège TOUS les composants primitifs, répartis par catégorie dans `gates/io|logic|bus|arith|sequential|display.tsx` (portes, INPUT, OUTPUT, SPLITTER, MERGER, MUX, DEMUX, DECODER, DFF, CLOCK, REG, COUNTER, RAM, SRLATCH, SEG7, LEDMATRIX, ADDER…). Chaque entrée a la même forme :

```ts
TYPE: {
  label, category, w, h,
  inputs:  [{name, x, y, width}],
  outputs: [{name, x, y, width}],
  defaultState: {…},
  getDynamicGeometry: (comp) => ({w, h, inputs, outputs}),  // optionnel
  shape: (comp, outputValue, inputValue, inputsByName, angle) => <>…</>,
  fn: (ins) => [outs],  // optionnel — sinon traité dans simulate()
}
```

Quand un composant a une géométrie dépendant de son état (bus, splitter à N sorties, MUX à 2^N voies), il fournit `getDynamicGeometry`. `getDef(type, customDefs, comp)` (dans `gates/registry.tsx`) fusionne la def statique avec la géométrie dynamique. **Toujours passer `comp` à `getDef` quand on l'a sous la main**, sinon les ports renvoyés correspondent au `defaultState` (utile uniquement pour les aperçus de palette).

**Le simulateur** (`simulate(circuit, getDef)` dans `lib/sim.ts`, exposé via le wrapper `simulate(circuit)` de `gates/registry.tsx`) est purement combinatoire : tri topologique de Kahn sur le graphe des fils, puis évaluation. Toutes les valeurs sont des **entiers** (les bus sont des `Number` masqués par `maskTo(width, v)`). Les DFF/CLOCK sont traités comme des sources (sortie = `state.q` ou `state.value`), donc le graphe reste acyclique.

**La logique séquentielle et temporelle** vit dans `hooks/useCircuitEngine.ts` :

1. `stepSequential(circuit, getDef)` lit les valeurs combinatoires (D, CLK, RST…) et met à jour TOUS les composants à mémoire en un seul `setCircuit` → **atomicité** garantie pour les registres à décalage. Le front montant se détecte en comparant `state.lastClk` à la valeur courante de CLK ; RST=1 force Q=0 (asynchrone, prioritaire).
2. Une horloge auto-running : un `setInterval` (30 ms) bascule les CLOCK `state.running=true` selon leur fréquence.
3. Un `setInterval` (60 ms) force un re-render pour animer le halo du D-FF.

Le **chronogramme** est géré par `hooks/useTrace.ts`, l'**historique par onglet** (undo/redo + `commit`) par `hooks/useHistory.ts`, l'**autosave** par `hooks/useAutosave.ts`, le **zoom/pan** par `hooks/useViewport.ts`, les **raccourcis clavier** par `hooks/useKeyboardShortcuts.ts`, les **préférences** par `hooks/usePrefs.ts`.

**Le rendu du canevas** (`components/CircuitCanvas.tsx`) dessine la grille, les fils, les composants et les ports ; c'est un composant présentationnel piloté par les props/handlers de l'orchestrateur. **Le rendu des fils bus** utilise `makeBusTracks(points, n, pitch)` qui appelle `offsetManhattan(points, offset)` pour chaque piste — les premiers/derniers sommets restent fixes, les pistes convergent en éventail aux ports.

### Composants rectangulaires « à dessin fixe » (`fixedDisplay`)

Pour les composants rectangulaires complexes (SR-latch, DFF, REG, COUNTER, RAM, ADDER, SEG7…) qui contiennent un LCD/des libellés et qui ne supportent pas bien d'être réellement tournés, on utilise le modèle **`fixedDisplay: true`** :

1. La `shape` n'est **jamais** rotée par `CircuitCanvas` (angle 0). Le contenu reste droit, peu importe l'orientation.
2. C'est `getDynamicGeometry(comp)` qui place les ports sur le **bord** correspondant à l'orientation (`right`→gauche/droite, `down`→haut/bas, etc.).
3. Toute la mécanique vit dans `rectLayout({ orientation, inputs, outputs, contentW, contentH, inMargin, outMargin })` (`gates/rectLayout.ts`) qui renvoie :
   - `w`, `h` : dimensions de la boîte englobante (assez large pour étaler les ports le long du bord, assez haute pour le contenu).
   - `box` : rectangle du boîtier (sans les stubs).
   - `content` : zone réservée au contenu interne (LCD, valeur…), centrée sur l'axe « long ».
   - `inputs`, `outputs` : ports au format `Port[]` (pour `getDynamicGeometry`).
   - `ports` : détails de rendu (px/py = connexion, sx/sy = bout de stub, lx/ly + anchor = label, edge L/R/T/B, clk).
4. La `shape` instancie `<RectShape layout={L} halo={…}>` (`gates/RectShape.tsx`) qui dessine cadre + stubs + labels + ▷ CLK + halo, et glisse son contenu via `children` dans `L.content`.

Constantes (`rectLayout.ts`) : `STUB=14, SPACING=24, EDGE_PAD=10, PORT_END_PAD=12, CLK_GAP=8`. Le label d'un port marqué `clk: true` est automatiquement décalé de `CLK_GAP` pour laisser passer le triangle ▷.

Pour les composants qui ont des **labels qui doivent rester droits malgré la rotation** (sans passer par `fixedDisplay`), utiliser `<UprightText angle={angle} textAnchor=…>` qui se contre-tourne autour de son ancre.

## Conventions de code

- **Pas de booléens dans le simulateur.** Tout est entier. `asInt(v)` normalise (booléens, undefined, null → 0/1).
- **Patte d'oie de l'historique** : `commit(updater)` (via `useHistory`) pour les changements structurels (placement, câblage, suppression), `setCircuit(updater)` pour les changements interactifs (toggle d'une entrée, tick d'horloge). Ce sont les seuls deux moyens de muter le circuit.
- **Logique pure typée et testée** : tout ce qui ne dépend pas de React va dans `lib/` ou `gates/`, en `.ts(x)` strict, avec un test Vitest si c'est faisable sans React.
- **Pas de fragments orphelins.** Toujours `e.stopPropagation()` quand un clic ne doit pas remonter au canevas.
- **Vérifier `npm run build` + `npm run lint`** après une édition de structure.
- **Aux dégradés silencieux** : `maskTo(width, …)` est sûr pour width ≤ 32 (renvoie `v|0`, signé 32 bits). Au-delà de 32 bits, on n'est pas garanti.

## État des phases

Voir `ROADMAP.md` pour le détail. Très brièvement :

- **1-3** : Portes 1-bit, persistance JSON, undo/redo, composants personnalisés (encapsulation) — fait
- **4** : Bus multi-bits 1-32, ribbon visuel, MUX/DEMUX/DECODER reconfigurables — fait
- **5a** : Bascule D (1-bit ou N-bit registre), horloge manuelle + auto, capture sur front montant — fait
- **5b** : SR latch, JK/T flip-flop, registres explicites, RAM — à faire
- **6** : Petit processeur (PC, mémoire, ALU, registres, jeu d'instructions minimal) — à faire

## Pièges connus

- **`getDef(type, customDefs)` sans comp** renvoie la def avec le `defaultState`. OK pour les aperçus, **pas** pour la simulation/le rendu d'un composant réel. Toujours passer `comp` quand disponible.
- **Les fils orphelins** après changement de largeur sont nettoyés par `updateComponent` via le flag `_dropMismatchedWires: true` dans le patch. Si tu ajoutes un composant à géométrie variable, pense à ce flag dans son sélecteur de largeur.
- **L'éditeur de composant custom** entre en `editMode` et travaille sur un circuit séparé ; au commit il reconstruit la définition. Le banner ambré indique le mode édition. L'autosave est suspendu pendant l'édition.
- **Le toggle 1-bit d'une INPUT** passe par `toggleInput`. Le clic sur un bit d'INPUT bus passe par `toggleInputBit(id, bitIdx)` ; la détection du bit cliqué est géométrique (position locale ÷ `INPUT_BUS_CELL_SIZE`).
- **Refs lues en rendu** (curseur du canevas, aperçu de câblage, ref-getter d'historique) : intentionnel. Les règles ESLint « React Compiler » correspondantes (`react-hooks/refs`, `react-hooks/immutability`, `react-hooks/set-state-in-effect`) sont désactivées dans `eslint.config.js` avec justification.

## Quand ajouter un nouveau composant

1. Ajouter une entrée dans le **fichier de catégorie** adapté (`src/gates/io|logic|bus|arith|sequential|display.tsx`) : `label`, `category`, ports, `defaultState`, `shape`, et soit `fn` (combinatoire pure) soit gestion explicite dans `simulate()` (`lib/sim.ts`). `index.tsx` l'agrège automatiquement. Ajouter aussi un cas dans les tests (`tests/run.test.mjs`) qui valident la vraie `GATES`.
2. Si géométrie variable : ajouter `getDynamicGeometry(comp)`.
3. **Si c'est une boîte rectangulaire** (LCD, registre, latch, RAM…) : marquer `fixedDisplay: true`, écrire un petit `xxxLayout(comp)` qui appelle `rectLayout(…)`, exposer son résultat dans `getDynamicGeometry`, et rendre via `<RectShape layout={L}>…</RectShape>`. Voir `arith.tsx` (ADDER) ou `sequential.tsx` (DFF/REG/COUNTER/RAM/SRLATCH) pour le pattern.
4. Ajouter le type dans `PALETTE_ORDER` (`lib/constants.ts`).
5. La palette (`components/PalettePanel.tsx`) groupe par `category` automatiquement ; une nouvelle catégorie n'a qu'à exister dans `GATES` et `PALETTE_ORDER`.
6. Si propriétés configurables : ajouter un bloc dans `components/PropertiesPanel.tsx` (ou une section dédiée dans `components/properties/` si c'est un gros éditeur, cf. RAM/LEDMATRIX). Pour la largeur de bus, réutiliser `<BusWidthControl />`.
7. Si état séquentiel (comme DFF) : compléter `stepSequential` (`lib/sim.ts`) et, au besoin, `useCircuitEngine`.
8. `npm run build` + ouvrir l'app + placer le composant + tester ses bornes (notamment les 4 orientations).

## Quand tu hésites

- **« Où mettre ce code ? »** Logique pure → `lib/`. Définition/résolution de composant → `gates/`. État réutilisable → un `hook`. Présentation → `components/`. L'orchestrateur ne garde que l'état partagé et la composition.
- **« Faut-il ajouter une dépendance ? »** Probablement pas. React, Tailwind, lucide-react. Le reste se fait en TS pur.
- **« Comment tester ? »** Logique pure → Vitest. Rendu/interaction React → visuellement dans le navigateur (je ne peux pas le vérifier moi-même : signale-le si tu ne peux pas tester l'UI).
- **« Puis-je continuer à découper l'orchestrateur ? »** Oui — c'est la direction. Extraire vers `components/` (rendu) ou `hooks/` (état), en gardant `tsc`/`vitest`/`build` verts à chaque étape.
