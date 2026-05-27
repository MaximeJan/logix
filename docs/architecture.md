# Architecture détaillée

Ce document complète `CLAUDE.md`. Si tu reprends le projet, lis CLAUDE.md d'abord (vue d'ensemble), puis ce fichier pour les détails.

## Plan du fichier `src/CircuitSimulator.jsx`

Lignes approximatives (peut bouger après modifs) :

| Plage | Contenu |
|------|---------|
| 1-25 | Imports React + lucide, préférences par défaut |
| ~30-50 | Helpers bus : `asInt`, `maskTo`, `formatValue`, constantes |
| ~55-640 | Objet `GATES` : toutes les définitions de composants primitifs |
| ~640 | `PALETTE_ORDER` : ordre d'affichage dans la palette |
| ~650-700 | Helpers généraux (`snap`, `uid`, `portKey`, hashage) |
| ~700-800 | `buildCustomDef` : construit la def d'un composant custom |
| ~800-870 | `getDef`, `typeReferences`, `getPortPosition`, `getPortWidth` |
| ~880-1130 | `simulate(circuit)` — moteur combinatoire pur |
| ~1140-1230 | Helpers de fils : `routeWire`, `pointsToStr`, `offsetManhattan`, `makeBusTracks` |
| ~1240-1290 | (Dé)sérialisation JSON (`serializeCircuit`, `deserializeCircuit`) |
| ~1300-1450 | `PaletteItem`, `TruthTablePanel` |
| ~1450-1680 | `PropertiesPanel` (le plus gros sous-composant UI) |
| ~1680-1730 | `BusWidthControl` (stepper réutilisable) |
| ~1740-1900 | `PreferencesPanel` (apparence) |
| ~1900-... | Le composant principal `CircuitSimulator` (state, handlers, JSX) |

Pour s'orienter : `grep -n "function "` donne tous les sous-composants ; `grep -n "category: "` donne les composants primitifs.

## Modèle de données

Un circuit est un objet :

```js
{
  name: "mon-circuit",
  components: [{
    id: "c_abc123",          // unique, généré par uid()
    type: "AND",             // clé dans GATES ou nom d'un custom
    x: 100,                  // position canevas
    y: 200,
    state: {…},              // état mutable (valeurs INPUT, q d'un DFF, etc.)
    label: "A",              // label utilisateur pour INPUT/OUTPUT
  }],
  wires: [{
    id: "w_def456",
    from: { componentId, port },
    to:   { componentId, port },
  }],
  customDefinitions: {
    // dictionnaire name → définition encapsulée
    "Adder4": {
      inputs:  [{name, internalId, width}],
      outputs: [{name, internalId, width}],
      circuit: { components, wires },
    },
  },
  preferences: {…},          // copie de prefs (couleur, épaisseurs, etc.)
}
```

Les ports d'un composant ont chacun une `width` (1 pour 1-bit, jusqu'à 32 pour bus). Les valeurs sur les fils sont des **entiers JavaScript** (signed 32-bit pour width=32).

## Flux de rendu et simulation

```
[user action]
     ↓
setCircuit(newCircuit)  ou  commit(newCircuit)
     ↓
React re-render
     ↓
useMemo: sim = simulate(circuit)
     ↓
useEffect: stepSequential (capture fronts DFF, update state.q)
     ↓ (si changement)
setCircuit → boucle jusqu'à stabilité
     ↓
Rendu SVG
```

`commit` ajoute à l'historique (undo). `setCircuit` ne le fait pas (utile pour les toggles interactifs et les évolutions séquentielles automatiques).

## La fonction `simulate`

Réception : un circuit. Retour : `{ outValues, wireValues, inputValues, hasCycle }`.

Algorithme :
1. Construire le graphe : pour chaque fil, ajouter une arête source→dest.
2. Tri topologique de Kahn (incoming-degree). Si tous les nœuds ne sont pas ordonnables → cycle détecté, on évalue quand même dans un ordre arbitraire.
3. Pour chaque composant dans l'ordre :
   - Lire les valeurs sur ses ports d'entrée (via wireValues déjà calculés)
   - Calculer ses sorties selon son type (`fn` ou code dédié inline)
   - Stocker dans `outValues`
4. Calculer `wireValues` (= valeur de la sortie source de chaque fil)
5. Calculer `inputValues` (= valeur que voit chaque port d'entrée)

**Composants traités comme sources** (pas de dépendances entrantes nécessaires pour leur sortie) : INPUT, CLOCK, DFF (dont la sortie = `state.q`). Cela évite les cycles dans le graphe de dépendance pour les circuits séquentiels.

## Composants à géométrie dynamique

Les composants dont la taille / le nombre de ports dépend de leur état :

- **INPUT, OUTPUT** : largeur (state.width) → ports plus larges et composant plus grand
- **SPLITTER, MERGER** : N ports 1-bit selon state.width
- **MUX, DEMUX** : N voies selon state.selectWidth, ports de width=dataWidth
- **DECODER** : 2^width sorties
- **DFF** : width affecte la taille des ports D et Q

Tous fournissent `getDynamicGeometry(comp)` qui retourne `{w, h, inputs, outputs}`. `getDef` fusionne ces valeurs avec la def statique.

⚠ **Pièges classiques :**
- Si tu changes la largeur d'un composant via Properties, les fils connectés à des ports désormais incompatibles ou disparus sont automatiquement nettoyés par `updateComponent` quand on passe `_dropMismatchedWires: true` dans le patch.
- L'aperçu palette n'a pas de `comp` instance : `getDef(type, customDefs)` sans 3e arg utilise `defaultState` pour calculer la géométrie. C'est intentionnel.

## La logique séquentielle

Deux `useEffect` distincts :

**1. Capture de fronts montants (DFF)**

Dépendances : `[circuit, sim]`. Donc s'exécute après chaque changement de circuit, après que sim soit recalculé.

```js
const newComponents = circuit.components.map(comp => {
  if (comp.type !== 'DFF') return comp;
  const clk = sim.inputValues.get(portKey(comp.id, 'CLK')) & 1;
  const lastClk = comp.state.lastClk;
  // Front montant
  if (lastClk === 0 && clk === 1) {
    newQ = D-from-sim;
    newTriggerAt = Date.now();
  }
  // Reset asynchrone, prioritaire
  if (rst) newQ = 0;
  // Toujours mettre à jour lastClk pour détecter le prochain front
  return { ...comp, state: { …, q: newQ, lastClk: clk } };
});
if (changed) setCircuit(...);
```

**L'atomicité de la cascade** vient du fait que toutes les valeurs lues viennent de `sim`, qui est calculé sur l'ANCIEN circuit. Donc dans un shift register, DFF2 voit l'ancienne Q de DFF1, pas la nouvelle.

**Termination** : après l'update, `state.lastClk === clk`. Au prochain rendu, plus de front détecté, plus de changement, useEffect ne re-déclenche pas.

**2. Auto-tick des horloges**

Un `setInterval(30ms)` global qui regarde toutes les CLOCK avec `state.running=true` et les bascule quand `Date.now() - state.lastToggleAt >= halfPeriod`.

Le `forceTick` à 60ms est juste un trick pour faire re-rendre périodiquement le composant principal, ce qui permet à l'animation du halo DFF (basée sur `Date.now() - lastTriggerAt`) de progresser visuellement.

## Conventions visuelles

| Élément | Couleur / forme |
|---------|-----------------|
| Composant sélectionné | Bordure bleu (#0284c7) + halo |
| Port bus | Cercle r+1.5 + rectangle pointillé autour |
| Port 1-bit | Cercle simple |
| Wire 1-bit actif | `prefs.wireOnColor` (lime) |
| Wire 1-bit inactif | `prefs.wireOffColor` (stone) |
| Bus, bit on | `prefs.wireOnColor` |
| Bus, bit off | `prefs.busOffColor` (slate-900) |
| Front capturé sur DFF | Halo lime 300ms |
| CLOCK auto-running | Bordure rouge + pastille pulsée |
| Erreur de largeur | Notification éphémère rose 2.5s |
| Banner édition de def | Ambre (#fef3c7 / #92400e) |

## Conventions de nommage des ports

- Portes : `in0`, `in1`, ..., `out`
- INPUT : pas d'entrée, sortie `out`
- OUTPUT : entrée `in0`, pas de sortie
- SPLITTER : entrée `in`, sorties `bit0`..`bitN-1`
- MERGER : entrées `bit0`..`bitN-1`, sortie `out`
- MUX : entrées `in0`..`in{2^sw-1}` + `sel`, sortie `out`
- DEMUX : entrées `in` + `sel`, sorties `out0`..`out{2^sw-1}`
- DECODER : entrée `in`, sorties `out0`..`out{2^w-1}`
- DFF : entrées `D`, `CLK`, `RST`, sortie `Q`
- CLOCK : pas d'entrée, sortie `CLK`

Si tu ajoutes un composant, suis la même convention (lowercase, anglais pour rester cohérent avec le code).
