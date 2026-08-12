// Test de fumée du serveur MCP : le lance en sous-process, fait la poignée de
// main (initialize), liste les outils, puis appelle build_exercise, list_components
// et fill_truth_table. Vérifie qu'on reçoit des réponses valides. Jetable.
import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const child = spawn('node', [join(here, 'server.mjs')], { stdio: ['pipe', 'pipe', 'inherit'] });

let buf = '';
const pending = new Map();
child.stdout.on('data', (d) => {
  buf += d.toString();
  let i;
  while ((i = buf.indexOf('\n')) >= 0) {
    const line = buf.slice(0, i).trim();
    buf = buf.slice(i + 1);
    if (!line) continue;
    const msg = JSON.parse(line);
    if (msg.id && pending.has(msg.id)) {
      pending.get(msg.id)(msg);
      pending.delete(msg.id);
    }
  }
});

let id = 0;
function rpc(method, params) {
  const myId = ++id;
  return new Promise((resolve) => {
    pending.set(myId, resolve);
    child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: myId, method, params }) + '\n');
  });
}
function notify(method, params) {
  child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method, params }) + '\n');
}

const ok = (cond, label) => {
  if (!cond) {
    console.error('ÉCHEC:', label);
    child.kill();
    process.exit(1);
  }
  console.log('ok:', label);
};

const init = await rpc('initialize', {
  protocolVersion: '2024-11-05',
  capabilities: {},
  clientInfo: { name: 'smoke', version: '0' },
});
ok(init.result?.serverInfo?.name === 'logix', 'initialize → serverInfo.name = logix');
notify('notifications/initialized', {});

const tools = await rpc('tools/list', {});
const names = (tools.result?.tools ?? []).map((t) => t.name).sort();
ok(
  JSON.stringify(names) ===
    JSON.stringify(['build_circuit', 'build_exercise', 'fill_truth_table', 'list_components']),
  'tools/list → ' + names.join(', '),
);

const circuit = await rpc('tools/call', {
  name: 'build_circuit',
  arguments: {
    components: [
      { id: 'A', type: 'INPUT', value: 1 },
      { id: 'g', type: 'NAND' },
      { id: 'S', type: 'OUTPUT' },
    ],
    wires: [
      ['A', 'g.in0'],
      ['A', 'g.in1'],
      ['g', 'S'],
    ],
  },
});
const circuitJson = JSON.parse(circuit.result?.content?.[0]?.text ?? '{}');
ok(
  circuitJson.preset?.components?.length === 3 && circuitJson.preset?.wires?.length === 3,
  'build_circuit → preset 3 composants / 3 fils',
);

const badCircuit = await rpc('tools/call', {
  name: 'build_circuit',
  arguments: {
    components: [{ id: 'A', type: 'INPUT' }, { id: 'g', type: 'NAND' }],
    wires: [['A', 'g.in7']],
  },
});
ok(badCircuit.result?.isError === true, 'build_circuit → erreur claire sur port inexistant');

const built = await rpc('tools/call', {
  name: 'build_exercise',
  arguments: {
    title: 'Démo MCP',
    verify: 'none',
    allowedTypes: ['INPUT', 'OUTPUT', 'XOR'],
    baseUrl: 'https://maximejan.github.io/logix/',
  },
});
const builtText = built.result?.content?.[0]?.text ?? '';
ok(
  builtText.includes('https://maximejan.github.io/logix/?ex=') && !built.result?.isError,
  'build_exercise → lien Pages',
);

const comps = await rpc('tools/call', { name: 'list_components', arguments: {} });
ok((comps.result?.content?.[0]?.text ?? '').includes('FULLADDER'), 'list_components → contient FULLADDER');

const fill = await rpc('tools/call', {
  name: 'fill_truth_table',
  arguments: {
    circuit: {
      components: [
        { id: 'a', type: 'INPUT', state: { value: 0, width: 1 } },
        { id: 'b', type: 'INPUT', state: { value: 0, width: 1 } },
        { id: 'g', type: 'XOR' },
        { id: 's', type: 'OUTPUT' },
      ],
      wires: [
        { id: 'w1', from: { componentId: 'a', port: 'out' }, to: { componentId: 'g', port: 'in0' } },
        { id: 'w2', from: { componentId: 'b', port: 'out' }, to: { componentId: 'g', port: 'in1' } },
        { id: 'w3', from: { componentId: 'g', port: 'out' }, to: { componentId: 's', port: 'in0' } },
      ],
    },
    inputPorts: [
      { name: 'A', width: 1 },
      { name: 'B', width: 1 },
    ],
    outputPorts: [{ name: 'S', width: 1 }],
    generate: true,
  },
});
const fillRows = JSON.parse(fill.result?.content?.[0]?.text ?? '[]');
// XOR : 00->0, 01->1, 10->1, 11->0
const expected = [
  { inputs: [0, 0], outputs: [0] },
  { inputs: [0, 1], outputs: [1] },
  { inputs: [1, 0], outputs: [1] },
  { inputs: [1, 1], outputs: [0] },
];
ok(JSON.stringify(fillRows) === JSON.stringify(expected), 'fill_truth_table → XOR correct');

console.log('\nTous les tests MCP passent.');
child.kill();
process.exit(0);
