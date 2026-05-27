# Test du code en isolation

Le simulateur n'a pas de framework de test (Jest, Vitest...) pour rester léger. La logique pure (manipulation de bits, conversions, simulation) se teste en extrayant les fonctions dans un fichier `.mjs` à part et en le lançant avec `node`.

## Pattern

```js
// test_xxx.mjs

// Copier-coller les helpers dont tu as besoin depuis CircuitSimulator.jsx :
const asInt = (v) => { if (v === true) return 1; if (v === false || v == null) return 0; return Number(v) | 0; };
const maskTo = (w, v) => w >= 32 ? (v | 0) : ((v | 0) & ((1 << w) - 1));

// Puis écrire les tests
console.log('maskTo(4, 9) =', maskTo(4, 9), 'expect 9');
console.log('maskTo(4, 23) =', maskTo(4, 23), 'expect 7');
```

```bash
node test_xxx.mjs
```

Affichage attendu / observé côte à côte, vérification visuelle.

## Exemples typiques

### Test MUX

```js
function mux(selectWidth, dataWidth, dataInputs, selValue) {
  const n = 1 << selectWidth;
  const sel = maskTo(selectWidth, asInt(selValue));
  const chosen = sel < n ? asInt(dataInputs[sel]) : 0;
  return maskTo(dataWidth, chosen);
}

console.log('MUX 2:1, in=[1,0], sel=0 →', mux(1, 1, [1, 0], 0), 'expect 1');
console.log('MUX 4:1 4-bit, in=[9,5,12,3], sel=2 →', mux(2, 4, [9, 5, 12, 3], 2), 'expect 12');
```

### Test shift register (D-FF en cascade)

Pour vérifier l'atomicité : à un front montant, le 2e D-FF doit capturer l'ANCIENNE valeur du 1er (pas la nouvelle qui vient juste d'être capturée).

```js
function step(q1, lc1, q2, lc2, D, CLK) {
  let nq1 = q1, nq2 = q2;
  if (lc1 === 0 && CLK === 1) nq1 = D;
  if (lc2 === 0 && CLK === 1) nq2 = q1; // ANCIENNE valeur, atomicité
  return [nq1, CLK, nq2, CLK];
}

let [q1, lc1, q2, lc2] = [0, 0, 0, 0];
[q1, lc1, q2, lc2] = step(q1, lc1, q2, lc2, 1, 1);
console.log('Front 1 (D=1): DFF1=', q1, 'DFF2=', q2, 'expect 1, 0');
[q1, lc1, q2, lc2] = step(q1, lc1, q2, lc2, 1, 0); // descente
[q1, lc1, q2, lc2] = step(q1, lc1, q2, lc2, 1, 1);
console.log('Front 2 (D=1): DFF1=', q1, 'DFF2=', q2, 'expect 1, 1 (décalé)');
```

### Test offsetManhattan (rendu bus)

```js
function offsetManhattan(points, offset) { /* copier depuis CircuitSimulator.jsx */ }

const path = [[0,0], [50,0], [50,30], [80,30]];
console.log('offset +5:', offsetManhattan(path, 5));
// expect [[0,0], [45,5], [45,35], [80,30]]
```

## Vérifier qu'un changement n'a pas cassé le parse

Avant tout commit important :

```bash
npm run parse-check
```

Si ça échoue : ouvrir le fichier à la ligne signalée, le mismatch est très souvent une accolade ou parenthèse oubliée.
