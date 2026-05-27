# Logix — projet pédagogique

Simulateur de circuits logiques de type Logisim destiné à des élèves d'OC informatique au gymnase suisse (Fribourg). L'objectif est qu'un élève puisse progresser des portes logiques de base jusqu'à un petit processeur, sans rien installer (app web, autosave navigateur).

## Public et style pédagogique

- Élèves 16-18 ans avec quelques bases (Python, binaire). Ils ne sont pas développeurs.
- Convention visuelle : sources/entrées à gauche, sorties à droite, fils horizontaux/verticaux uniquement (manhattan).
- Convention bus : **MSB à gauche/extérieur**, LSB à droite/intérieur (lecture binaire naturelle de gauche à droite).
- Aucun jargon EE inutile. Les composants ont des labels FR (« Entrée », « Sortie », « Bascule D », « Multiplexeur »).

## Stack et organisation

- **React 18 + Vite + JSX pur** (pas de TypeScript)
- **Tailwind CSS** pour le style
- **lucide-react** pour les icônes
- **IBM Plex Sans + Mono** chargées via Google Fonts dans `index.html`
- Tout le code applicatif est dans **un seul fichier** : `src/CircuitSimulator.jsx` (~3800 lignes). C'est intentionnel — un fichier unique se navigue très bien avec un `grep -n` et évite la dispersion des décisions. Ne pas découper en multiples fichiers sans raison forte.
- Le fichier exporte par défaut le composant `CircuitSimulator`. `src/main.jsx` le monte.

## Comment développer

```bash
npm install
npm run dev    # http://localhost:5173
```

Vérifier le parse après chaque grosse édition :

```bash
node -e "require('@babel/parser').parse(require('fs').readFileSync('src/CircuitSimulator.jsx','utf8'), {sourceType:'module', plugins:['jsx']})"
```

(Installer `@babel/parser` en dev si besoin : `npm i -D @babel/parser`.)

Pour tester la logique pure (simulation, parsing, conversions de bits) sans React : extraire les fonctions concernées dans un `.mjs` temporaire et le lancer avec `node`. Voir `docs/test-examples.md` pour le pattern.

## Architecture interne

Une seule grosse structure de données : l'objet **`GATES`** au début du fichier. Il contient TOUS les composants primitifs (portes, INPUT, OUTPUT, SPLITTER, MERGER, MUX, DEMUX, DECODER, DFF, CLOCK). Chaque entrée a la même forme :

```js
TYPE: {
  label, category, w, h,
  inputs:  [{name, x, y, width}],
  outputs: [{name, x, y, width}],
  defaultState: {…},
  getDynamicGeometry: (comp) => ({w, h, inputs, outputs}),  // optionnel
  shape: (comp, outputValue, inputValue) => <>…</>,
  fn: (ins) => [outs],  // optionnel — sinon traité dans simulate()
}
```

Quand un composant a une géométrie qui dépend de son état (bus, splitter à N sorties, MUX à 2^N voies), il fournit `getDynamicGeometry`. `getDef(type, customDefs, comp)` fusionne la def statique avec la géométrie dynamique. **Toujours passer `comp` à `getDef` quand on l'a sous la main**, sinon les ports renvoyés correspondent au `defaultState` (utile uniquement pour les aperçus de palette).

**Le simulateur** (`simulate(circuit)`) est purement combinatoire : tri topologique de Kahn sur le graphe des fils, puis évaluation. Toutes les valeurs sont des **entiers** (les buses sont des `Number` avec masquage `maskTo(width, v)`). Les DFF/CLOCK sont traités comme des sources (sortie = `state.q` ou `state.value`), donc le graphe reste acyclique.

**La logique séquentielle** vit dans un `useEffect` séparé qui :
1. Lit `sim.inputValues` pour chaque DFF (les valeurs combinatoires sur D, CLK, RST)
2. Compare `state.lastClk` à la valeur courante sur CLK
3. Si front montant détecté (`lastClk=0 && CLK=1`), capture D dans Q
4. Si RST=1, force Q=0 (asynchrone, prioritaire sur la capture)
5. Met à jour tous les DFF en un seul `setCircuit` → **atomicité** garantie pour les shift registers

Une horloge auto-running utilise un autre `useEffect` avec un `setInterval` à 30ms qui bascule les CLOCK ayant `state.running=true`.

**Le rendu des fils bus** utilise `makeBusTracks(points, n, pitch)` qui appelle `offsetManhattan(points, offset)` pour chaque piste. Les premiers et derniers sommets restent fixes : les pistes convergent en éventail aux ports.

## Conventions de code

- **Pas de booléens dans le simulateur.** Tout est entier. `asInt(v)` normalise (booléens, undefined, null → 0/1).
- **Patte d'oie de l'historique** : `commit(updater)` pour les changements structurels (placement, câblage, suppression), `setCircuit(updater)` pour les changements interactifs (toggle d'une entrée, tick d'horloge). Ce sont les seuls deux moyens de muter le circuit.
- **Pas de fragments orphelins.** Toujours `e.stopPropagation()` quand un clic ne doit pas bouilloter au canevas.
- **Test du parser après toute édition de structure.** Un parse cassé bloque tout le rendu.
- **Toujours `view` le fichier avant `str_replace`** (le fichier change, et les indentations matter).
- **Aux dégradés silencieux** : `maskTo(width, …)` est sûr pour width ≥ 32 (renvoie `v|0`, signé 32 bits). Au-delà de 32 bits, on n'est pas garanti.

## État des phases

Voir `ROADMAP.md` pour le détail. Très brièvement :

- **1-3** : Portes 1-bit, persistance JSON, undo/redo, composants personnalisés (encapsulation) — fait
- **4** : Bus multi-bits 1-32, ribbon visuel, MUX/DEMUX/DECODER reconfigurables — fait
- **5a** : Bascule D (1-bit ou N-bit registre), horloge manuelle + auto, capture sur front montant — fait
- **5b** : SR latch, JK/T flip-flop, registres explicites, RAM — à faire
- **6** : Petit processeur (PC, mémoire, ALU, registres, jeu d'instructions minimal) — à faire

## Pièges connus

- **`getDef(type, customDefs)` sans comp** renvoie la def avec le `defaultState`. Ça marche pour les aperçus, **pas** pour la simulation ou le rendu d'un composant réel. Toujours passer `comp` quand disponible.
- **Les fils orphelins** après changement de largeur sont nettoyés par `updateComponent` via le flag `_dropMismatchedWires: true` dans le patch. Si tu ajoutes un nouveau type de composant à géométrie variable, pense à ce flag dans son sélecteur de largeur.
- **`requestAnimationFrame` non utilisé.** L'animation du halo DFF passe par un `setInterval(60ms)` qui force un re-render via `forceTick`. C'est pas optimal mais ça reste cheap (sim mémoïsé sur `circuit`).
- **L'éditeur de composant custom** entre en `editMode` et travaille sur un circuit séparé. Au commit, il reconstruit la définition. Le banner ambré indique le mode édition.
- **Le toggle 1-bit d'une INPUT** passe par `toggleInput`. Le clic sur un bit d'INPUT bus passe par `toggleInputBit(id, bitIdx)`. La détection du bit cliqué se fait géométriquement (position locale ÷ `INPUT_BUS_CELL_SIZE`).

## Quand ajouter un nouveau composant

1. Ajouter une entrée dans `GATES` avec `label`, `category`, ports, `defaultState`, `shape`, et soit `fn` (combinatoire pure) soit gestion explicite dans `simulate()`.
2. Si géométrie variable : ajouter `getDynamicGeometry(comp)`.
3. Ajouter le type dans `PALETTE_ORDER`.
4. Si nouvelle catégorie de palette : ajouter une section dans le JSX de la palette (cherche `category === 'Bus'` pour le pattern).
5. Si propriétés configurables : ajouter un bloc dans `PropertiesPanel`. Pour la largeur de bus, réutiliser `<BusWidthControl />`.
6. Si état évolutif (comme DFF) : ajouter un `useEffect` ou compléter celui qui existe.
7. Test parse + ouvrir l'app + placer le composant + tester ses bornes.

## Quand tu hésites

- **« Faut-il splitter ce gros fichier ? »** Non. La navigation par `grep -n` et `view` avec ranges est plus rapide que parcourir 10 fichiers.
- **« Faut-il ajouter une dépendance ? »** Probablement pas. Tailwind, lucide-react, React. C'est tout. Tout le reste se fait en JS pur.
- **« Faut-il rajouter du TypeScript ? »** Non, pas demandé, ajouterait beaucoup de bruit pour peu de valeur sur un fichier unique.
- **« Comment tester du React ? »** Visuellement, dans le navigateur. Pas de Jest, pas de Vitest pour l'instant. La logique pure (simulate, masking) se teste en `.mjs` standalone.
