#!/usr/bin/env node
// Serveur MCP local (stdio) qui expose la fabrique d'exercices Logix.
//
// « Local/stdio » = process Node lancé par le client (Claude Code), dialogue par
// tuyau stdin/stdout — AUCUN réseau. Il réutilise la logique bundlée dans
// core.mjs (via logix.mjs), donc les liens produits sont identiques à ceux de
// l'app « Créer un exercice ».
//
// Prérequis : `npm install && npm run build` dans ce dossier (une seule fois).
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { ListToolsRequestSchema, CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { buildExercise, fillTruthTable, listComponents, DEFAULT_BASE_URL } from './logix.mjs';

const portArray = {
  type: 'array',
  items: {
    type: 'object',
    properties: {
      name: { type: 'string' },
      width: { type: 'number', description: 'largeur en bits (1 = signal, >1 = bus), défaut 1' },
    },
    required: ['name'],
  },
};

const rowsSchema = {
  type: 'array',
  description:
    'Lignes de vérification : chaque ligne est [valeursEntrées, valeursSorties], ' +
    'ex. [[0,1],[1]] pour A=0,B=1 → S=1. Les valeurs sont des entiers (bus compris).',
  items: { type: 'array', items: { type: 'array', items: { type: 'number' } } },
};

const TOOLS = [
  {
    name: 'build_exercise',
    description:
      "Fabrique le lien partageable d'un exercice Logix et l'extrait <iframe> à coller dans le " +
      'cours. Tout l\'exercice tient dans l\'URL (?ex=…), aucun backend. verify:"none" = énoncé ' +
      'libre (aucun bouton Vérifier) ; "truthtable" = circuit combinatoire ; "sequence" = ' +
      'séquentiel (un tick par ligne). locked:true + preset = démonstration non modifiable. ' +
      'Appuie-toi sur list_components pour les allowedTypes et sur fill_truth_table pour les rows.',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: "Titre de l'exercice (obligatoire)." },
        objective: { type: 'string', description: 'Objectif en une phrase.' },
        steps: { type: 'array', items: { type: 'string' }, description: 'Étapes numérotées.' },
        allowedTypes: {
          type: 'array',
          items: { type: 'string' },
          description: 'Types de composants proposés (voir list_components). INPUT/OUTPUT implicites.',
        },
        inputs: { ...portArray, description: 'Entrées attendues, dans l\'ordre de création.' },
        outputs: { ...portArray, description: 'Sorties attendues, dans l\'ordre de création.' },
        verify: {
          type: 'string',
          enum: ['truthtable', 'sequence', 'none'],
          description: 'Mode de vérification. Défaut : "truthtable" si rows fourni, sinon "none".',
        },
        rows: rowsSchema,
        locked: {
          type: 'boolean',
          description: 'Verrouille le circuit (démo non modifiable). Combine avec preset.',
        },
        autoOpenProperties: {
          type: 'boolean',
          description: 'Ouvre auto le panneau Propriétés à la sélection (défaut false).',
        },
        preset: {
          type: 'object',
          description:
            'Circuit préchargé au format serialize() : {version:2, components:[...], wires:[...], ' +
            'customDefinitions:{}}. Sert de point de départ ou de démo (avec locked).',
        },
        baseUrl: {
          type: 'string',
          description: `Base où Logix est servi. Défaut : ${DEFAULT_BASE_URL}`,
        },
        iframeHeight: { type: 'number', description: "Hauteur de l'iframe en px (200–2000, défaut 700)." },
      },
      required: ['title'],
    },
  },
  {
    name: 'fill_truth_table',
    description:
      'Simule un circuit-solution et renvoie la table de vérité remplie (sorties correctes). ' +
      "Équivalent hors-ligne du bouton « Remplir les sorties depuis le circuit courant » : " +
      'construis le circuit correct, récupère les bonnes réponses, puis passe-les à build_exercise. ' +
      'Les INPUT/OUTPUT sont appariés par ordre de création.',
    inputSchema: {
      type: 'object',
      properties: {
        circuit: {
          type: 'object',
          description:
            'Circuit-solution : {components:[{id,type,x,y,state?}], wires:[{id,from:{componentId,port},to:{componentId,port}}]}.',
        },
        inputPorts: { ...portArray, description: 'Colonnes d\'entrée (ordre = ordre des INPUT).' },
        outputPorts: { ...portArray, description: 'Colonnes de sortie (ordre = ordre des OUTPUT).' },
        rows: {
          type: 'array',
          description: 'Lignes d\'entrée [[v0,v1,…], …]. Omis + generate:true → toutes les combinaisons.',
          items: { type: 'array', items: { type: 'number' } },
        },
        generate: {
          type: 'boolean',
          description: 'Énumère toutes les combinaisons (≤ 8 bits d\'entrée au total).',
        },
      },
      required: ['circuit', 'inputPorts', 'outputPorts'],
    },
  },
  {
    name: 'list_components',
    description:
      'Liste les composants disponibles (type, libellé, catégorie, ports) — utile pour choisir ' +
      'allowedTypes et pour construire un circuit-solution ou un preset.',
    inputSchema: { type: 'object', properties: {} },
  },
];

const server = new Server({ name: 'logix', version: '0.1.0' }, { capabilities: { tools: {} } });

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const { name, arguments: args = {} } = req.params;
  try {
    let result;
    if (name === 'build_exercise') result = buildExercise(args);
    else if (name === 'fill_truth_table') result = fillTruthTable(args);
    else if (name === 'list_components') result = listComponents();
    else throw new Error(`Outil inconnu : ${name}`);
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { content: [{ type: 'text', text: `Erreur : ${message}` }], isError: true };
  }
});

await server.connect(new StdioServerTransport());
