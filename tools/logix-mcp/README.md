# logix-mcp — fabrique d'exercices Logix (hors-ligne)

Génère les liens d'exercices Logix (`?ex=…`) **sans ouvrir l'app** ni cliquer dans « Créer un
exercice ». Deux emballages de la même logique :

- un **CLI** (`cli.mjs`) — zéro dépendance, marche tout de suite ;
- un **serveur MCP local** (`server.mjs`) — pour qu'un autre Claude (Claude Code) fabrique les
  liens lui-même en rédigeant ton cours.

Tout est **local et hors-ligne** : « MCP local (stdio) » = un simple process Node lancé par le
client, aucun réseau. La logique vient du bundle `core.mjs`, qui réutilise la **vraie** logique du
repo (`encodeExercise`, `simulate`, `getDef`) — les liens sont donc identiques à ceux de l'app.

## Installation (une fois)

```bash
cd tools/logix-mcp
npm install     # récupère le SDK MCP (le CLI, lui, n'en a pas besoin)
npm run build   # génère core.mjs (bundle de la logique du repo, via l'esbuild déjà présent)
```

`npm run build` est à relancer si tu modifies la logique d'exercice/simulation dans `src/`.

## CLI

```bash
# Génère un lien + <iframe> depuis un « spec » JSON (fichier ou stdin)
node cli.mjs exo.json
echo '{ "title":"NOT", "verify":"none", "allowedTypes":["INPUT","OUTPUT","NAND"] }' | node cli.mjs

# Liste les composants disponibles (types, ports)
node cli.mjs --components

# Remplit une table de vérité en simulant un circuit-solution
node cli.mjs --fill solution.json
```

## Serveur MCP (pour Claude Code)

Dans le **dossier du cours** (`t-doc/janm`), crée `.mcp.json` :

```json
{
  "mcpServers": {
    "logix": {
      "command": "node",
      "args": ["C:\\Users\\maxim\\Desktop\\Projets\\circuit-simulator\\tools\\logix-mcp\\server.mjs"]
    }
  }
}
```

Relance Claude Code dans ce dossier : il voit alors les outils `build_exercise`,
`fill_truth_table`, `list_components` et fabrique les liens tout seul.

Test de fumée du serveur : `node smoke.mjs`.

## Les trois outils

| Outil | Rôle |
| --- | --- |
| `build_exercise` | Spec d'exercice → `{ url, embedUrl, iframe, tooLong }`. |
| `fill_truth_table` | Circuit-solution → table de vérité aux **bonnes** réponses (= bouton « Remplir depuis le circuit courant »). |
| `list_components` | Composants dispo (type, libellé, catégorie, ports). |

## Format d'un « spec » `build_exercise`

```jsonc
{
  "title": "NOT avec un NAND",          // obligatoire
  "objective": "Fabrique une porte NOT.",
  "steps": ["Place une Entrée A", "Place un NAND", "…"],
  "allowedTypes": ["INPUT", "OUTPUT", "NAND"], // INPUT/OUTPUT implicites
  "inputs":  [{ "name": "A", "width": 1 }],    // ordre = ordre de création attendu
  "outputs": [{ "name": "S", "width": 1 }],
  "verify": "truthtable",               // "truthtable" | "sequence" | "none"
  "rows": [[[0],[1]], [[1],[0]]],       // [entrées, sorties] par ligne
  "locked": false,                       // true = démo non modifiable (avec preset)
  "autoOpenProperties": false,
  "preset": { "version": 2, "components": [], "wires": [], "customDefinitions": {} },
  "baseUrl": "https://maximejan.github.io/logix/", // défaut
  "iframeHeight": 700
}
```

- `verify:"none"` → énoncé libre, pas de bouton Vérifier ; ni `rows` ni ports obligatoires.
- `verify:"sequence"` → une ligne = un tick (circuits séquentiels).
- `preset` sans `locked` = point de départ à compléter ; avec `locked` = démonstration.
- Si le lien dépasse le plafond (`tooLong:true`), allège le `preset`.

> **Base URL** : en Node il n'y a pas de navigateur, donc le lien pointe par défaut vers le
> déploiement GitHub Pages `https://maximejan.github.io/logix/`. Change `baseUrl` si tu sers Logix
> ailleurs.

## Fichiers

| Fichier | Rôle |
| --- | --- |
| `core.entry.ts` → `core.mjs` | réexporte + bundle la logique pure du repo (sans React). |
| `logix.mjs` | couche métier : assemble/encode, simule, liste. |
| `cli.mjs` | CLI. |
| `server.mjs` | serveur MCP stdio. |
| `build.mjs` | génère `core.mjs` via esbuild. |
| `smoke.mjs` | test de fumée du serveur. |
