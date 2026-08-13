// Batterie de tests du simulateur.
//
// Lance avec : npm test  (ou  node tests/run.mjs)
//
// Couverture :
//   1. Helpers purs (maskTo, asInt) aux bords
//   2. Portes logiques 1-bit
//   3. MUX, DEMUX, DECODER (différentes largeurs)
//   5. Combinatoire complexe : additionneur 4-bit ripple-carry
//   6. Séquentiel 1-bit : DFF (front montant, RST async), SR latch
//   7. Séquentiel multi-bits : DFF 4-bit, shift register (atomicité)
//   8. Registre N-bit avec LD
//   9. RAM : écriture synchrone + lecture asynchrone
//   10. 7 segments : table de décodage hex
//   11. Composants personnalisés : encapsulation, récursion
//   12. Cycle combinatoire détecté

import {
  suite, test, assertEq, assertDeepEq, assertTrue, assertFalse,
} from './vitest-shim.mjs';
import {
  asInt, maskTo, simulate, stepSequential, getDef, SEG7_HEX_TABLE, GATES,
  applyOrientation,
  makeInput, makeOutput, makeGate, makeWire, tid, getOutputAt, getInputAt, portKey,
} from './sim-core.mjs';
import {
  FORMAT_VERSION,
  serialize, deserialize, serializeAll, deserializeAll,
} from '../src/lib/persist';

// =====================================================================
// 1. HELPERS PURS
// =====================================================================
suite('helpers purs');

test('asInt : booléens et null', () => {
  assertEq(asInt(true), 1);
  assertEq(asInt(false), 0);
  assertEq(asInt(null), 0);
  assertEq(asInt(undefined), 0);
});
test('asInt : nombres et coercion', () => {
  assertEq(asInt(0), 0);
  assertEq(asInt(1), 1);
  assertEq(asInt(17), 17);
  assertEq(asInt(-3), -3);
  assertEq(asInt('5'), 5);
});
test('maskTo : largeurs courantes', () => {
  assertEq(maskTo(1, 0xFF), 1);
  assertEq(maskTo(4, 0xA), 0xA);
  assertEq(maskTo(4, 0xFA), 0xA);
  assertEq(maskTo(8, 0x1234), 0x34);
  assertEq(maskTo(16, 0xDEADBEEF), 0xBEEF);
});
test('maskTo : 32 bits (cas spécial signé)', () => {
  // À 32 bits, JS bitwise rebascule en signé. C'est documenté côté code.
  assertEq(maskTo(32, 0xFFFFFFFF) | 0, -1);
});
test('maskTo : largeur 1 isole bien le LSB', () => {
  for (let v = 0; v < 16; v++) {
    assertEq(maskTo(1, v), v & 1, `v=${v}`);
  }
});

// =====================================================================
// 2. PORTES LOGIQUES 1-BIT
// =====================================================================
suite('portes logiques 1-bit');

function evalGate(type, a, b = 0) {
  const def = getDef(type, null, null);
  if (!def.fn) throw new Error(`${type} n'a pas de fn`);
  const inputs = def.inputs.length === 1 ? [a] : [a, b];
  return def.fn(inputs)[0];
}

test('AND : 4 cas', () => {
  assertEq(evalGate('AND', 0, 0), 0);
  assertEq(evalGate('AND', 0, 1), 0);
  assertEq(evalGate('AND', 1, 0), 0);
  assertEq(evalGate('AND', 1, 1), 1);
});
test('OR : 4 cas', () => {
  assertEq(evalGate('OR', 0, 0), 0);
  assertEq(evalGate('OR', 0, 1), 1);
  assertEq(evalGate('OR', 1, 0), 1);
  assertEq(evalGate('OR', 1, 1), 1);
});
test('NOT : 0→1, 1→0', () => {
  assertEq(evalGate('NOT', 0), 1);
  assertEq(evalGate('NOT', 1), 0);
});
test('NAND : 4 cas', () => {
  assertEq(evalGate('NAND', 0, 0), 1);
  assertEq(evalGate('NAND', 0, 1), 1);
  assertEq(evalGate('NAND', 1, 0), 1);
  assertEq(evalGate('NAND', 1, 1), 0);
});
test('NOR : 4 cas', () => {
  assertEq(evalGate('NOR', 0, 0), 1);
  assertEq(evalGate('NOR', 0, 1), 0);
  assertEq(evalGate('NOR', 1, 0), 0);
  assertEq(evalGate('NOR', 1, 1), 0);
});
test('XOR : 4 cas', () => {
  assertEq(evalGate('XOR', 0, 0), 0);
  assertEq(evalGate('XOR', 0, 1), 1);
  assertEq(evalGate('XOR', 1, 0), 1);
  assertEq(evalGate('XOR', 1, 1), 0);
});

// Petit circuit via simulate() : AND(in1, NOT(in2)) doit valoir 1 ssi in1=1 et in2=0
test('simulate() : AND(in, NOT(in))', () => {
  const i1 = makeInput(1, 1);
  const i2 = makeInput(1, 0);
  const not = makeGate('NOT');
  const and = makeGate('AND');
  const out = makeOutput(1);
  const c = {
    components: [i1, i2, not, and, out],
    wires: [
      makeWire(i2, not, 'out', 'in0'),
      makeWire(i1, and, 'out', 'in0'),
      makeWire(not, and, 'out', 'in1'),
      makeWire(and, out, 'out', 'in0'),
    ],
  };
  const sim = simulate(c);
  assertEq(getInputAt(sim, out, 'in0'), 1, 'i1=1 i2=0 → 1');

  i1.state.value = 0;
  assertEq(getInputAt(simulate(c), out, 'in0'), 0, 'i1=0 → 0');
  i1.state.value = 1;
  i2.state.value = 1;
  assertEq(getInputAt(simulate(c), out, 'in0'), 0, 'i2=1 → 0 (NOT bloque)');
});

// =====================================================================
// 3. MUX / DEMUX / DECODER
// =====================================================================
suite('MUX / DEMUX / DECODER');

test('MUX 2:1 1-bit', () => {
  for (const sel of [0, 1]) {
    const inA = makeInput(1, 0);
    const inB = makeInput(1, 1);
    const s   = makeInput(1, sel);
    const mux = { id: tid('mux'), type: 'MUX', x:0, y:0, state: { selectWidth: 1, dataWidth: 1 } };
    const c = {
      components: [inA, inB, s, mux],
      wires: [
        makeWire(inA, mux, 'out', 'in0'),
        makeWire(inB, mux, 'out', 'in1'),
        makeWire(s,   mux, 'out', 'sel'),
      ],
    };
    assertEq(getOutputAt(simulate(c), mux, 'out'), sel, `sel=${sel}`);
  }
});

test('MUX 4:1 sur 4 bits, données distinctes', () => {
  const data = [0xA, 0x5, 0xC, 0x3];
  for (let sel = 0; sel < 4; sel++) {
    const inps = data.map((v) => makeInput(4, v));
    const s = makeInput(2, sel);
    const mux = { id: tid('mux'), type: 'MUX', x:0, y:0, state: { selectWidth: 2, dataWidth: 4 } };
    const c = {
      components: [...inps, s, mux],
      wires: [
        ...inps.map((inp, i) => makeWire(inp, mux, 'out', `in${i}`)),
        makeWire(s, mux, 'out', 'sel'),
      ],
    };
    assertEq(getOutputAt(simulate(c), mux, 'out'), data[sel], `sel=${sel}`);
  }
});

test('DEMUX 1→4 sur 4 bits', () => {
  const v = 0xB;
  for (let sel = 0; sel < 4; sel++) {
    const data = makeInput(4, v);
    const s = makeInput(2, sel);
    const dmx = { id: tid('dmx'), type: 'DEMUX', x:0, y:0, state: { selectWidth: 2, dataWidth: 4 } };
    const c = {
      components: [data, s, dmx],
      wires: [
        makeWire(data, dmx, 'out', 'in'),
        makeWire(s,    dmx, 'out', 'sel'),
      ],
    };
    const sim = simulate(c);
    for (let i = 0; i < 4; i++) {
      const expected = i === sel ? v : 0;
      assertEq(getOutputAt(sim, dmx, `out${i}`), expected, `sel=${sel}, out${i}`);
    }
  }
});

test('DECODER 3-bit : un-hot sur 8 sorties', () => {
  for (let v = 0; v < 8; v++) {
    const inp = makeInput(3, v);
    const dec = { id: tid('dec'), type: 'DECODER', x:0, y:0, state: { width: 3 } };
    const c = {
      components: [inp, dec],
      wires: [makeWire(inp, dec, 'out', 'in')],
    };
    const sim = simulate(c);
    for (let i = 0; i < 8; i++) {
      assertEq(getOutputAt(sim, dec, `out${i}`), i === v ? 1 : 0, `v=${v}, out${i}`);
    }
  }
});

// =====================================================================
// 5. COMBINATOIRE COMPLEXE : ADDITIONNEUR 4-BIT
// =====================================================================
suite('additionneur 4-bit ripple-carry');

// Construit un demi-additionneur (sum=XOR, carry=AND) à partir de portes
function buildHalfAdder() {
  const a = makeInput(1, 0);
  const b = makeInput(1, 0);
  const xor = makeGate('XOR');
  const and = makeGate('AND');
  const sum = makeOutput(1);
  const carry = makeOutput(1);
  return {
    a, b, sum, carry,
    components: [a, b, xor, and, sum, carry],
    wires: [
      makeWire(a, xor, 'out', 'in0'),
      makeWire(b, xor, 'out', 'in1'),
      makeWire(a, and, 'out', 'in0'),
      makeWire(b, and, 'out', 'in1'),
      makeWire(xor, sum, 'out', 'in0'),
      makeWire(and, carry, 'out', 'in0'),
    ],
  };
}

test('demi-additionneur : 4 cas', () => {
  for (const [av, bv, esum, ecarry] of [[0,0,0,0],[0,1,1,0],[1,0,1,0],[1,1,0,1]]) {
    const ha = buildHalfAdder();
    ha.a.state.value = av;
    ha.b.state.value = bv;
    const sim = simulate(ha);
    assertEq(getInputAt(sim, ha.sum, 'in0'), esum, `${av}+${bv} sum`);
    assertEq(getInputAt(sim, ha.carry, 'in0'), ecarry, `${av}+${bv} carry`);
  }
});

// Additionneur 4-bit ripple-carry construit à la main : 4 full-adders en série.
// Un full-adder = (A ⊕ B ⊕ Cin), carry_out = (A & B) | (Cin & (A ⊕ B))
test('additionneur 4-bit ripple-carry : 16×16 = 256 cas', () => {
  for (let A = 0; A < 16; A++) {
    for (let B = 0; B < 16; B++) {
      // Construit le circuit
      const comps = [];
      const wires = [];
      const aBits = [];
      const bBits = [];
      for (let i = 0; i < 4; i++) {
        aBits.push(makeInput(1, (A >> i) & 1));
        bBits.push(makeInput(1, (B >> i) & 1));
      }
      let carryWire = null; // wire qui transporte le carry précédent
      let carrySrc = null;  // composant source du carry
      let carrySrcPort = null;
      const sumOutputs = [];
      for (let i = 0; i < 4; i++) {
        // full-adder : 2 XOR, 2 AND, 1 OR
        const xor1 = makeGate('XOR');
        const xor2 = makeGate('XOR');
        const and1 = makeGate('AND');
        const and2 = makeGate('AND');
        const or1  = makeGate('OR');
        const sumOut = makeOutput(1);
        comps.push(xor1, xor2, and1, and2, or1, sumOut);
        sumOutputs.push(sumOut);

        // a XOR b
        wires.push(makeWire(aBits[i], xor1, 'out', 'in0'));
        wires.push(makeWire(bBits[i], xor1, 'out', 'in1'));
        // a AND b
        wires.push(makeWire(aBits[i], and1, 'out', 'in0'));
        wires.push(makeWire(bBits[i], and1, 'out', 'in1'));
        // sum = (a⊕b) ⊕ Cin
        wires.push(makeWire(xor1, xor2, 'out', 'in0'));
        if (carrySrc) {
          wires.push(makeWire(carrySrc, xor2, carrySrcPort, 'in1'));
          // (a⊕b) AND Cin
          wires.push(makeWire(xor1, and2, 'out', 'in0'));
          wires.push(makeWire(carrySrc, and2, carrySrcPort, 'in1'));
          // Cout = (aANDb) OR ((a⊕b)ANDCin)
          wires.push(makeWire(and1, or1, 'out', 'in0'));
          wires.push(makeWire(and2, or1, 'out', 'in1'));
          carrySrc = or1; carrySrcPort = 'out';
        } else {
          // Cin=0 : on n'a pas besoin de XOR avec 0, mais simulate() considère
          // un port non câblé = 0 donc on laisse tel quel. La 2e entrée du xor2
          // est non câblée → 0, donc xor2 = (a⊕b) ⊕ 0 = (a⊕b). OK.
          carrySrc = and1; carrySrcPort = 'out';
        }
        wires.push(makeWire(xor2, sumOut, 'out', 'in0'));
      }
      // Le carry final
      const coutNode = makeOutput(1);
      comps.push(coutNode);
      wires.push(makeWire(carrySrc, coutNode, carrySrcPort, 'in0'));
      const c = { components: [...aBits, ...bBits, ...comps], wires };
      const sim = simulate(c);
      let sum = 0;
      for (let i = 0; i < 4; i++) sum |= (getInputAt(sim, sumOutputs[i], 'in0') & 1) << i;
      const carryOut = getInputAt(sim, coutNode, 'in0') & 1;
      const total = sum | (carryOut << 4);
      assertEq(total, A + B, `${A}+${B}`);
    }
  }
});

// =====================================================================
// 5b. COMPOSANT ADDER (additionneur intégré, combinatoire)
// =====================================================================
suite('composant ADDER');

function makeAdder(width = 4) {
  return { id: tid('add'), type: 'ADDER', x: 0, y: 0, state: { width } };
}

function runAdder(width, A, B, Cin) {
  const a = makeInput(width, A);
  const b = makeInput(width, B);
  const cin = makeInput(1, Cin);
  const add = makeAdder(width);
  const c = {
    components: [a, b, cin, add],
    wires: [
      makeWire(a, add, 'out', 'A'),
      makeWire(b, add, 'out', 'B'),
      makeWire(cin, add, 'out', 'Cin'),
    ],
  };
  const sim = simulate(c);
  return { S: getOutputAt(sim, add, 'S'), Cout: getOutputAt(sim, add, 'Cout') };
}

test('ADDER 4-bit : somme et retenue sortante', () => {
  const cases = [
    [0, 0, 0, 0, 0],
    [3, 5, 0, 8, 0],
    [7, 8, 0, 15, 0],
    [15, 1, 0, 0, 1],   // débordement → Cout
    [9, 9, 1, 3, 1],    // 19 = 0b10011 → S=3, Cout=1
    [15, 15, 1, 15, 1], // 31 = 0b11111 → S=15, Cout=1
  ];
  for (const [A, B, Cin, S, Cout] of cases) {
    const r = runAdder(4, A, B, Cin);
    assertEq(r.S, S, `${A}+${B}+${Cin} → S`);
    assertEq(r.Cout, Cout, `${A}+${B}+${Cin} → Cout`);
  }
});

test('ADDER 1-bit : identique à un additionneur complet', () => {
  for (let A = 0; A < 2; A++)
    for (let B = 0; B < 2; B++)
      for (let Cin = 0; Cin < 2; Cin++) {
        const r = runAdder(1, A, B, Cin);
        const sum = A + B + Cin;
        assertEq(r.S, sum & 1, `${A}+${B}+${Cin} S`);
        assertEq(r.Cout, sum >> 1, `${A}+${B}+${Cin} Cout`);
      }
});

test('ADDER 8-bit : addition large avec retenue', () => {
  assertEq(runAdder(8, 200, 100, 0).S, 44, '200+100 mod 256');
  assertEq(runAdder(8, 200, 100, 0).Cout, 1, '200+100 → Cout');
  assertEq(runAdder(8, 100, 27, 0).S, 127, '100+27');
  assertEq(runAdder(8, 100, 27, 0).Cout, 0, 'pas de débordement');
});

// =====================================================================
// 5b-bis. COMPOSANT FULLADDER (additionneur complet 1-bit, combinatoire)
// =====================================================================
suite('composant FULLADDER');

function runFullAdder(A, B, Cin) {
  const a = makeInput(1, A);
  const b = makeInput(1, B);
  const cin = makeInput(1, Cin);
  const fa = { id: tid('fa'), type: 'FULLADDER', x: 0, y: 0, state: {} };
  const c = {
    components: [a, b, cin, fa],
    wires: [
      makeWire(a, fa, 'out', 'A'),
      makeWire(b, fa, 'out', 'B'),
      makeWire(cin, fa, 'out', 'Cin'),
    ],
  };
  const sim = simulate(c);
  return { S: getOutputAt(sim, fa, 'S'), Cout: getOutputAt(sim, fa, 'Cout') };
}

test('FULLADDER : table de vérité complète (8 cas)', () => {
  for (let A = 0; A < 2; A++)
    for (let B = 0; B < 2; B++)
      for (let Cin = 0; Cin < 2; Cin++) {
        const sum = A + B + Cin;
        const r = runFullAdder(A, B, Cin);
        assertEq(r.S, sum & 1, `${A}+${B}+${Cin} → S`);
        assertEq(r.Cout, sum >> 1, `${A}+${B}+${Cin} → Cout`);
      }
});

test('FULLADDER : ports 1-bit sur les 4 orientations', () => {
  for (const orientation of ['right', 'down', 'left', 'up']) {
    const def = getDef('FULLADDER', null, { type: 'FULLADDER', state: { orientation } });
    assertDeepEq(def.inputs.map((p) => p.name), ['A', 'B', 'Cin'], `entrées (${orientation})`);
    assertDeepEq(def.outputs.map((p) => p.name), ['S', 'Cout'], `sorties (${orientation})`);
    for (const p of [...def.inputs, ...def.outputs]) {
      assertEq(p.width ?? 1, 1, `largeur ${p.name} (${orientation})`);
    }
  }
});

// =====================================================================
// 5c. SPLITTER / MERGER (bus ↔ bits, combinatoire)
// =====================================================================
suite('composants SPLITTER / MERGER');

test('SPLITTER 4-bit : éclate un bus en 4 bits', () => {
  for (const v of [0, 1, 5, 10, 15]) {
    const inp = makeInput(4, v);
    const sp = { id: tid('sp'), type: 'SPLITTER', x: 0, y: 0, state: { width: 4 } };
    const c = { components: [inp, sp], wires: [makeWire(inp, sp, 'out', 'in')] };
    const sim = simulate(c);
    for (let b = 0; b < 4; b++) {
      assertEq(getOutputAt(sim, sp, `b${b}`), (v >> b) & 1, `v=${v} bit ${b}`);
    }
  }
});

test('MERGER 4-bit : regroupe 4 bits en un bus', () => {
  for (const v of [0, 1, 5, 10, 15]) {
    const bits = [0, 1, 2, 3].map((b) => makeInput(1, (v >> b) & 1));
    const mg = { id: tid('mg'), type: 'MERGER', x: 0, y: 0, state: { width: 4 } };
    const c = {
      components: [...bits, mg],
      wires: bits.map((bi, b) => makeWire(bi, mg, 'out', `b${b}`)),
    };
    assertEq(getOutputAt(simulate(c), mg, 'out'), v, `v=${v}`);
  }
});

test('SPLITTER → MERGER : aller-retour reconstruit la valeur', () => {
  for (const v of [0, 3, 9, 14]) {
    const inp = makeInput(4, v);
    const sp = { id: tid('sp'), type: 'SPLITTER', x: 0, y: 0, state: { width: 4 } };
    const mg = { id: tid('mg'), type: 'MERGER', x: 0, y: 0, state: { width: 4 } };
    const c = {
      components: [inp, sp, mg],
      wires: [
        makeWire(inp, sp, 'out', 'in'),
        ...[0, 1, 2, 3].map((b) => makeWire(sp, mg, `b${b}`, `b${b}`)),
      ],
    };
    assertEq(getOutputAt(simulate(c), mg, 'out'), v, `v=${v}`);
  }
});

// =====================================================================
// 6. SÉQUENTIEL 1-BIT : DFF + SR LATCH
// =====================================================================
suite('séquentiel : DFF (1-bit)');

function makeDFF(state = { q: 0, lastClk: 0, width: 1 }) {
  return { id: tid('dff'), type: 'DFF', x: 0, y: 0, state };
}

test('DFF : capture D sur front montant', () => {
  const d = makeInput(1, 1);
  const clk = makeInput(1, 0);
  const dff = makeDFF();
  let c = {
    components: [d, clk, dff],
    wires: [
      makeWire(d, dff, 'out', 'D'),
      makeWire(clk, dff, 'out', 'CLK'),
    ],
  };
  c = stepSequential(c); // CLK=0 : pas de front, q reste 0
  let curDff = c.components.find((x) => x.type === 'DFF');
  assertEq(curDff.state.q, 0, 'avant front');

  // Monter CLK
  c.components.find((x) => x.id === clk.id).state.value = 1;
  c = stepSequential(c);
  curDff = c.components.find((x) => x.type === 'DFF');
  assertEq(curDff.state.q, 1, 'après front montant');
});

test('DFF : RST asynchrone force Q=0 immédiatement', () => {
  const d = makeInput(1, 1);
  const clk = makeInput(1, 0);
  const rst = makeInput(1, 0);
  const dff = makeDFF({ q: 1, lastClk: 0, width: 1 });
  let c = {
    components: [d, clk, rst, dff],
    wires: [
      makeWire(d, dff, 'out', 'D'),
      makeWire(clk, dff, 'out', 'CLK'),
      makeWire(rst, dff, 'out', 'RST'),
    ],
  };
  // simulate() doit déjà sortir Q=0 quand RST=1 (level-sensitive sur la sortie)
  c.components.find((x) => x.id === rst.id).state.value = 1;
  let sim = simulate(c);
  assertEq(getOutputAt(sim, dff, 'Q'), 0, 'simulate() reset asynchrone');
  // Et stepSequential persiste q=0
  c = stepSequential(c);
  const curDff = c.components.find((x) => x.type === 'DFF');
  assertEq(curDff.state.q, 0, 'state.q persisté à 0');
});

test('DFF : pas de capture sur niveau haut continu (front uniquement)', () => {
  const d = makeInput(1, 0);
  const clk = makeInput(1, 1); // déjà haut au départ
  const dff = makeDFF({ q: 0, lastClk: 1, width: 1 }); // lastClk déjà à 1
  let c = {
    components: [d, clk, dff],
    wires: [
      makeWire(d, dff, 'out', 'D'),
      makeWire(clk, dff, 'out', 'CLK'),
    ],
  };
  // D change, CLK reste à 1 : on simule plusieurs étapes
  c.components.find((x) => x.id === d.id).state.value = 1;
  c = stepSequential(c);
  c = stepSequential(c);
  c = stepSequential(c);
  const curDff = c.components.find((x) => x.type === 'DFF');
  assertEq(curDff.state.q, 0, 'pas de capture sans front');
});

suite('séquentiel : SR latch');

test('SR : set, reset, hold', () => {
  const s = makeInput(1, 1);
  const r = makeInput(1, 0);
  const sr = { id: tid('sr'), type: 'SRLATCH', x:0, y:0, state: { q: 0 } };
  let c = {
    components: [s, r, sr],
    wires: [
      makeWire(s, sr, 'out', 'S'),
      makeWire(r, sr, 'out', 'R'),
    ],
  };
  // S=1 → Q=1
  c = stepSequential(c);
  let cur = c.components.find((x) => x.type === 'SRLATCH');
  assertEq(cur.state.q, 1, 'set');
  // S=0 R=0 → hold (Q reste 1)
  c.components.find((x) => x.id === s.id).state.value = 0;
  c = stepSequential(c);
  cur = c.components.find((x) => x.type === 'SRLATCH');
  assertEq(cur.state.q, 1, 'hold après set');
  // R=1 → Q=0
  c.components.find((x) => x.id === r.id).state.value = 1;
  c = stepSequential(c);
  cur = c.components.find((x) => x.type === 'SRLATCH');
  assertEq(cur.state.q, 0, 'reset');
});

test('SR : R prioritaire quand S=R=1', () => {
  const s = makeInput(1, 1);
  const r = makeInput(1, 1);
  const sr = { id: tid('sr'), type: 'SRLATCH', x:0, y:0, state: { q: 1 } };
  let c = {
    components: [s, r, sr],
    wires: [
      makeWire(s, sr, 'out', 'S'),
      makeWire(r, sr, 'out', 'R'),
    ],
  };
  // simulate() doit déjà refléter Q=0 (R prioritaire en lecture asynchrone)
  assertEq(getOutputAt(simulate(c), sr, 'Q'), 0, 'simulate() R prioritaire');
  c = stepSequential(c);
  const cur = c.components.find((x) => x.type === 'SRLATCH');
  assertEq(cur.state.q, 0, 'state persiste 0');
});

// =====================================================================
// 7. SÉQUENTIEL MULTI-BITS : SHIFT REGISTER
// =====================================================================
suite('séquentiel : DFF multi-bits + shift register');

test('DFF 4-bit : capture mot en bloc', () => {
  const d = makeInput(4, 0b1011);
  const clk = makeInput(1, 0);
  const dff = makeDFF({ q: 0, lastClk: 0, width: 4 });
  let c = {
    components: [d, clk, dff],
    wires: [
      makeWire(d, dff, 'out', 'D'),
      makeWire(clk, dff, 'out', 'CLK'),
    ],
  };
  c.components.find((x) => x.id === clk.id).state.value = 1;
  c = stepSequential(c);
  const cur = c.components.find((x) => x.type === 'DFF');
  assertEq(cur.state.q, 0b1011, 'capture bus 4-bit');
});

test('shift register : 3 DFF 1-bit en cascade, atomicité', () => {
  // d → DFF1 → DFF2 → DFF3
  // Avec atomicité : sur 1 front, chaque DFF capture l'ancienne sortie du précédent.
  const d = makeInput(1, 1);
  const clk = makeInput(1, 0);
  const dff1 = makeDFF({ q: 0, lastClk: 0, width: 1 });
  const dff2 = makeDFF({ q: 0, lastClk: 0, width: 1 });
  const dff3 = makeDFF({ q: 0, lastClk: 0, width: 1 });
  let c = {
    components: [d, clk, dff1, dff2, dff3],
    wires: [
      makeWire(d, dff1, 'out', 'D'),
      makeWire(dff1, dff2, 'Q', 'D'),
      makeWire(dff2, dff3, 'Q', 'D'),
      makeWire(clk, dff1, 'out', 'CLK'),
      makeWire(clk, dff2, 'out', 'CLK'),
      makeWire(clk, dff3, 'out', 'CLK'),
    ],
  };

  const pulse = (cc) => {
    cc.components.find((x) => x.id === clk.id).state.value = 1;
    cc = stepSequential(cc);
    cc.components.find((x) => x.id === clk.id).state.value = 0;
    cc = stepSequential(cc);
    return cc;
  };

  // 1er pulse : DFF1=1, DFF2=0, DFF3=0
  c = pulse(c);
  let q = c.components.filter((x) => x.type === 'DFF').map((x) => x.state.q);
  assertDeepEq(q, [1, 0, 0], '1er pulse');

  // 2e pulse : 1,1,0
  c = pulse(c);
  q = c.components.filter((x) => x.type === 'DFF').map((x) => x.state.q);
  assertDeepEq(q, [1, 1, 0], '2e pulse');

  // D bascule à 0, 3e pulse : 0,1,1
  c.components.find((x) => x.id === d.id).state.value = 0;
  c = pulse(c);
  q = c.components.filter((x) => x.type === 'DFF').map((x) => x.state.q);
  assertDeepEq(q, [0, 1, 1], '3e pulse (D=0)');
});

// =====================================================================
// 8. REGISTRE N-BIT AVEC LD
// =====================================================================
suite('REG : registre N-bit avec LD');

test('REG : capture sur front montant si LD=1', () => {
  const d = makeInput(4, 0b1101);
  const ld = makeInput(1, 1);
  const clk = makeInput(1, 0);
  const reg = { id: tid('reg'), type: 'REG', x:0, y:0, state: { q: 0, lastClk: 0, width: 4 } };
  let c = {
    components: [d, ld, clk, reg],
    wires: [
      makeWire(d, reg, 'out', 'D'),
      makeWire(ld, reg, 'out', 'LD'),
      makeWire(clk, reg, 'out', 'CLK'),
    ],
  };
  c.components.find((x) => x.id === clk.id).state.value = 1;
  c = stepSequential(c);
  let cur = c.components.find((x) => x.type === 'REG');
  assertEq(cur.state.q, 0b1101, 'capture avec LD=1');
});

test('REG : hold (pas de capture) si LD=0', () => {
  const d = makeInput(4, 0b0110);
  const ld = makeInput(1, 0);
  const clk = makeInput(1, 0);
  const reg = { id: tid('reg'), type: 'REG', x:0, y:0, state: { q: 0b1010, lastClk: 0, width: 4 } };
  let c = {
    components: [d, ld, clk, reg],
    wires: [
      makeWire(d, reg, 'out', 'D'),
      makeWire(ld, reg, 'out', 'LD'),
      makeWire(clk, reg, 'out', 'CLK'),
    ],
  };
  c.components.find((x) => x.id === clk.id).state.value = 1;
  c = stepSequential(c);
  const cur = c.components.find((x) => x.type === 'REG');
  assertEq(cur.state.q, 0b1010, 'hold');
});

// =====================================================================
// 8b. COUNTER : compteur N-bit
// =====================================================================
suite('COUNTER : compteur N-bit');

function makeCounter(state = { q: 0, lastClk: 0, width: 4 }) {
  return { id: tid('cnt'), type: 'COUNTER', x: 0, y: 0, state };
}

test('COUNTER : incrémente sur front montant si EN=1', () => {
  const en = makeInput(1, 1);
  const clk = makeInput(1, 0);
  const cnt = makeCounter();
  let c = {
    components: [en, clk, cnt],
    wires: [
      makeWire(en, cnt, 'out', 'EN'),
      makeWire(clk, cnt, 'out', 'CLK'),
    ],
  };
  // 3 fronts montants → Q=3
  const pulse = (cc) => {
    cc.components.find((x) => x.id === clk.id).state.value = 1;
    cc = stepSequential(cc);
    cc.components.find((x) => x.id === clk.id).state.value = 0;
    cc = stepSequential(cc);
    return cc;
  };
  c = pulse(c); c = pulse(c); c = pulse(c);
  let cur = c.components.find((x) => x.type === 'COUNTER');
  assertEq(cur.state.q, 3, '3 pulses → Q=3');
});

test('COUNTER : hold si EN=0', () => {
  const en = makeInput(1, 0); // désactivé
  const clk = makeInput(1, 0);
  const cnt = makeCounter({ q: 7, lastClk: 0, width: 4 });
  let c = {
    components: [en, clk, cnt],
    wires: [
      makeWire(en, cnt, 'out', 'EN'),
      makeWire(clk, cnt, 'out', 'CLK'),
    ],
  };
  c.components.find((x) => x.id === clk.id).state.value = 1;
  c = stepSequential(c);
  c.components.find((x) => x.id === clk.id).state.value = 0;
  c = stepSequential(c);
  const cur = c.components.find((x) => x.type === 'COUNTER');
  assertEq(cur.state.q, 7, 'hold');
});

test('COUNTER : RST async force Q=0 immédiatement', () => {
  const en = makeInput(1, 1);
  const clk = makeInput(1, 0);
  const rst = makeInput(1, 1);
  const cnt = makeCounter({ q: 12, lastClk: 0, width: 4 });
  let c = {
    components: [en, clk, rst, cnt],
    wires: [
      makeWire(en, cnt, 'out', 'EN'),
      makeWire(clk, cnt, 'out', 'CLK'),
      makeWire(rst, cnt, 'out', 'RST'),
    ],
  };
  // simulate() doit déjà sortir Q=0
  assertEq(getOutputAt(simulate(c), cnt, 'Q'), 0, 'simulate() reset');
  c = stepSequential(c);
  const cur = c.components.find((x) => x.type === 'COUNTER');
  assertEq(cur.state.q, 0, 'state persiste 0');
});

test('COUNTER 4-bit : wrap automatique 15 → 0', () => {
  const en = makeInput(1, 1);
  const clk = makeInput(1, 0);
  const cnt = makeCounter({ q: 15, lastClk: 0, width: 4 });
  let c = {
    components: [en, clk, cnt],
    wires: [
      makeWire(en, cnt, 'out', 'EN'),
      makeWire(clk, cnt, 'out', 'CLK'),
    ],
  };
  c.components.find((x) => x.id === clk.id).state.value = 1;
  c = stepSequential(c);
  const cur = c.components.find((x) => x.type === 'COUNTER');
  assertEq(cur.state.q, 0, 'wrap 15+1 → 0');
});

test('COUNTER 1-bit : 0 → 1 → 0 → 1 (toggle)', () => {
  const en = makeInput(1, 1);
  const clk = makeInput(1, 0);
  const cnt = makeCounter({ q: 0, lastClk: 0, width: 1 });
  let c = {
    components: [en, clk, cnt],
    wires: [
      makeWire(en, cnt, 'out', 'EN'),
      makeWire(clk, cnt, 'out', 'CLK'),
    ],
  };
  const pulse = (cc) => {
    cc.components.find((x) => x.id === clk.id).state.value = 1;
    cc = stepSequential(cc);
    cc.components.find((x) => x.id === clk.id).state.value = 0;
    cc = stepSequential(cc);
    return cc;
  };
  c = pulse(c);
  assertEq(c.components.find((x) => x.type === 'COUNTER').state.q, 1, 'tick 1');
  c = pulse(c);
  assertEq(c.components.find((x) => x.type === 'COUNTER').state.q, 0, 'tick 2 (wrap)');
  c = pulse(c);
  assertEq(c.components.find((x) => x.type === 'COUNTER').state.q, 1, 'tick 3');
});

// =====================================================================
// 9. RAM : écriture synchrone + lecture asynchrone
// =====================================================================
suite('RAM');

test('RAM : écriture synchrone, lecture asynchrone', () => {
  const addr = makeInput(3, 0);
  const din  = makeInput(4, 0xA);
  const we   = makeInput(1, 1);
  const clk  = makeInput(1, 0);
  const ram = {
    id: tid('ram'), type: 'RAM', x:0, y:0,
    state: { addrWidth: 3, dataWidth: 4, mem: new Array(8).fill(0), lastClk: 0 },
  };
  let c = {
    components: [addr, din, we, clk, ram],
    wires: [
      makeWire(addr, ram, 'out', 'ADDR'),
      makeWire(din,  ram, 'out', 'DATA_IN'),
      makeWire(we,   ram, 'out', 'WE'),
      makeWire(clk,  ram, 'out', 'CLK'),
    ],
  };
  // Écrire 0xA à @0
  c.components.find((x) => x.id === clk.id).state.value = 1;
  c = stepSequential(c);
  let cur = c.components.find((x) => x.type === 'RAM');
  assertEq(cur.state.mem[0], 0xA, 'mem[0]=0xA');

  // Lecture asynchrone : DATA_OUT = mem[ADDR]
  assertEq(getOutputAt(simulate(c), ram, 'DATA_OUT'), 0xA, 'lecture @0');

  // Redescendre CLK, changer ADDR + DATA_IN
  c.components.find((x) => x.id === clk.id).state.value = 0;
  c.components.find((x) => x.id === addr.id).state.value = 3;
  c.components.find((x) => x.id === din.id).state.value = 0x5;
  c = stepSequential(c);
  // Front montant : écrire @3
  c.components.find((x) => x.id === clk.id).state.value = 1;
  c = stepSequential(c);
  cur = c.components.find((x) => x.type === 'RAM');
  assertEq(cur.state.mem[3], 0x5, 'mem[3]=5');
  assertEq(cur.state.mem[0], 0xA, 'mem[0] inchangé');
});

test('RAM : pas d\'écriture si WE=0', () => {
  const addr = makeInput(3, 2);
  const din  = makeInput(4, 0xF);
  const we   = makeInput(1, 0); // désactivé
  const clk  = makeInput(1, 0);
  const ram = {
    id: tid('ram'), type: 'RAM', x:0, y:0,
    state: { addrWidth: 3, dataWidth: 4, mem: [0,0,0,0,0,0,0,0], lastClk: 0 },
  };
  let c = {
    components: [addr, din, we, clk, ram],
    wires: [
      makeWire(addr, ram, 'out', 'ADDR'),
      makeWire(din,  ram, 'out', 'DATA_IN'),
      makeWire(we,   ram, 'out', 'WE'),
      makeWire(clk,  ram, 'out', 'CLK'),
    ],
  };
  c.components.find((x) => x.id === clk.id).state.value = 1;
  c = stepSequential(c);
  const cur = c.components.find((x) => x.type === 'RAM');
  assertEq(cur.state.mem[2], 0, 'WE=0 : pas d\'écriture');
});

// =====================================================================
// 10. 7 SEGMENTS : TABLE DE DÉCODAGE HEX
// =====================================================================
suite('7 segments : table hex');

// Référence pour les valeurs (b6..b0 = g..a)
const segmentsExpected = {
  0: { a:1,b:1,c:1,d:1,e:1,f:1,g:0 },
  1: { a:0,b:1,c:1,d:0,e:0,f:0,g:0 },
  2: { a:1,b:1,c:0,d:1,e:1,f:0,g:1 },
  3: { a:1,b:1,c:1,d:1,e:0,f:0,g:1 },
  8: { a:1,b:1,c:1,d:1,e:1,f:1,g:1 },
  0xF: { a:1,b:0,c:0,d:0,e:1,f:1,g:1 },
};

test('SEG7_HEX_TABLE a 16 entrées', () => {
  assertEq(SEG7_HEX_TABLE.length, 16);
});

test('SEG7 : 0 affiche a,b,c,d,e,f (pas g)', () => {
  // bit 0 = a, ... bit 6 = g
  const v = SEG7_HEX_TABLE[0];
  for (const [name, expected] of Object.entries(segmentsExpected[0])) {
    const idx = ['a','b','c','d','e','f','g'].indexOf(name);
    assertEq((v >> idx) & 1, expected, `seg ${name}`);
  }
});

test('SEG7 : 8 affiche tous les segments', () => {
  const v = SEG7_HEX_TABLE[8];
  for (let i = 0; i < 7; i++) assertEq((v >> i) & 1, 1, `bit ${i}`);
});

test('SEG7 : F affiche a,e,f,g (pas b,c,d)', () => {
  const v = SEG7_HEX_TABLE[0xF];
  for (const [name, expected] of Object.entries(segmentsExpected[0xF])) {
    const idx = ['a','b','c','d','e','f','g'].indexOf(name);
    assertEq((v >> idx) & 1, expected, `seg ${name}`);
  }
});

test('SEG7 : tous les codes ont au moins 2 segments allumés', () => {
  for (let i = 0; i < 16; i++) {
    let count = 0;
    for (let b = 0; b < 7; b++) if ((SEG7_HEX_TABLE[i] >> b) & 1) count++;
    assertTrue(count >= 2, `code ${i.toString(16)} : ${count} segments`);
  }
});

// =====================================================================
// 11. COMPOSANTS PERSONNALISÉS
// =====================================================================
suite('composants personnalisés');

// On construit une définition custom "DemiAdd" qui encapsule un demi-additionneur.
// L'INPUT interne 'in0' (id 'inA'), INPUT 'in1' (id 'inB'), OUTPUT 'sum' (id 'outS'),
// OUTPUT 'carry' (id 'outC').
function makeHalfAdderDef() {
  const inA = { id: 'inA', type: 'INPUT', x:0, y:0, state: { width: 1, value: 0 } };
  const inB = { id: 'inB', type: 'INPUT', x:0, y:0, state: { width: 1, value: 0 } };
  const xor = { id: 'gxor', type: 'XOR', x:0, y:0 };
  const and = { id: 'gand', type: 'AND', x:0, y:0 };
  const outS = { id: 'outS', type: 'OUTPUT', x:0, y:0, state: { width: 1 } };
  const outC = { id: 'outC', type: 'OUTPUT', x:0, y:0, state: { width: 1 } };
  return {
    name: 'DemiAdd',
    inputs: [
      { name: 'in0', internalId: 'inA', width: 1 },
      { name: 'in1', internalId: 'inB', width: 1 },
    ],
    outputs: [
      { name: 'sum',   internalId: 'outS', width: 1 },
      { name: 'carry', internalId: 'outC', width: 1 },
    ],
    circuit: {
      components: [inA, inB, xor, and, outS, outC],
      wires: [
        { id: 'w1', from: { componentId: 'inA', port: 'out' }, to: { componentId: 'gxor', port: 'in0' } },
        { id: 'w2', from: { componentId: 'inB', port: 'out' }, to: { componentId: 'gxor', port: 'in1' } },
        { id: 'w3', from: { componentId: 'inA', port: 'out' }, to: { componentId: 'gand', port: 'in0' } },
        { id: 'w4', from: { componentId: 'inB', port: 'out' }, to: { componentId: 'gand', port: 'in1' } },
        { id: 'w5', from: { componentId: 'gxor', port: 'out'   }, to: { componentId: 'outS', port: 'in0' } },
        { id: 'w6', from: { componentId: 'gand', port: 'out'   }, to: { componentId: 'outC', port: 'in0' } },
      ],
    },
  };
}

test('custom : DemiAdd encapsulé donne sum=A⊕B, carry=A·B', () => {
  const defs = { DemiAdd: makeHalfAdderDef() };
  for (const [av, bv, esum, ecarry] of [[0,0,0,0],[0,1,1,0],[1,0,1,0],[1,1,0,1]]) {
    const a = makeInput(1, av);
    const b = makeInput(1, bv);
    const ha = { id: tid('ha'), type: 'DemiAdd', x:0, y:0 };
    const sumOut = makeOutput(1);
    const carryOut = makeOutput(1);
    const c = {
      components: [a, b, ha, sumOut, carryOut],
      customDefinitions: defs,
      wires: [
        makeWire(a, ha, 'out', 'in0'),
        makeWire(b, ha, 'out', 'in1'),
        makeWire(ha, sumOut, 'sum', 'in0'),
        makeWire(ha, carryOut, 'carry', 'in0'),
      ],
    };
    const sim = simulate(c);
    assertEq(getInputAt(sim, sumOut, 'in0'),   esum,   `${av}+${bv} sum`);
    assertEq(getInputAt(sim, carryOut, 'in0'), ecarry, `${av}+${bv} carry`);
  }
});

test('custom : additionneur complet construit à partir de 2 DemiAdd + 1 OR', () => {
  // FullAdd = DemiAdd(a,b) → DemiAdd(s1, cin) ; carry = OR(c1, c2)
  // Ici on l'instancie inline (pas en custom) mais avec deux instances DemiAdd.
  const defs = { DemiAdd: makeHalfAdderDef() };
  for (let a = 0; a < 2; a++) for (let b = 0; b < 2; b++) for (let cin = 0; cin < 2; cin++) {
    const A = makeInput(1, a);
    const B = makeInput(1, b);
    const CIN = makeInput(1, cin);
    const ha1 = { id: tid('ha1'), type: 'DemiAdd', x:0, y:0 };
    const ha2 = { id: tid('ha2'), type: 'DemiAdd', x:0, y:0 };
    const or  = makeGate('OR');
    const sumOut = makeOutput(1);
    const coutOut = makeOutput(1);
    const c = {
      components: [A, B, CIN, ha1, ha2, or, sumOut, coutOut],
      customDefinitions: defs,
      wires: [
        makeWire(A, ha1, 'out', 'in0'),
        makeWire(B, ha1, 'out', 'in1'),
        makeWire(ha1, ha2, 'sum', 'in0'),
        makeWire(CIN, ha2, 'out', 'in1'),
        makeWire(ha2, sumOut, 'sum', 'in0'),
        makeWire(ha1, or, 'carry', 'in0'),
        makeWire(ha2, or, 'carry', 'in1'),
        makeWire(or, coutOut, 'out', 'in0'),
      ],
    };
    const sim = simulate(c);
    const s = getInputAt(sim, sumOut, 'in0');
    const co = getInputAt(sim, coutOut, 'in0');
    const total = s | (co << 1);
    assertEq(total, a + b + cin, `${a}+${b}+${cin}`);
  }
});

// =====================================================================
// 12. CYCLE COMBINATOIRE
// =====================================================================
suite('cycle combinatoire');

test('NOT bouclé sur lui-même : hasCycle=true', () => {
  const n = makeGate('NOT');
  const c = {
    components: [n],
    wires: [makeWire(n, n, 'out', 'in0')],
  };
  const sim = simulate(c);
  assertTrue(sim.hasCycle, 'cycle détecté');
});

// Une porte OR dont la sortie reboucle sur UNE de ses deux entrées (l'autre
// reste pilotable) : mémoire minimale bâtie à la main, sans SRLATCH dédié.
// Sans mémoire (repartir de 0 à chaque appel), la sortie ne ferait que recopier
// l'entrée pilotée ; avec `prevOutValues`, une fois mise à 1 elle doit y rester
// même quand l'entrée retombe à 0 — exactement le comportement attendu d'un
// « circuit séquentiel » construit à partir d'une porte de base.
test('OR bouclé sur lui-même : mémoire via prevOutValues (set-and-hold)', () => {
  const a = makeInput(1, 0);
  const orGate = makeGate('OR');
  const c = {
    components: [a, orGate],
    wires: [makeWire(a, orGate, 'out', 'in0'), makeWire(orGate, orGate, 'out', 'in1')],
  };
  const outKey = `${orGate.id}:out`;

  // 1) A=0, aucun historique : la sortie part à 0 (pas de mémoire fantôme).
  let sim = simulate(c);
  assertEq(getOutputAt(sim, orGate, 'out'), 0, 'état initial : 0');
  assertTrue(sim.hasCycle, 'cycle détecté (auto-bouclage)');

  // 2) A=1, en repartant du dernier outValues : la sortie passe à 1.
  a.state.value = 1;
  sim = simulate(c, null, new Set(), sim.outValues);
  assertEq(getOutputAt(sim, orGate, 'out'), 1, 'A=1 → sortie à 1');

  // 3) A retombe à 0, mais avec la mémoire du dernier appel : la sortie RESTE
  // à 1 (feedback OR(0, 1)=1) — c'est le point du test.
  a.state.value = 0;
  sim = simulate(c, null, new Set(), sim.outValues);
  assertEq(getOutputAt(sim, orGate, 'out'), 1, 'A=0 mais mémorisé → sortie reste à 1');
  assertEq(sim.outValues.get(outKey), 1, 'outValues confirme la mémoire');

  // 4) Sans prevOutValues (ex. tout premier appel), pas de mémoire fantôme :
  // avec A=0 d'entrée, la sortie repart bien à 0.
  const fresh = simulate(c);
  assertEq(getOutputAt(fresh, orGate, 'out'), 0, 'appel isolé (sans historique) : 0');
});

test('Chaîne acyclique : hasCycle=false', () => {
  const i = makeInput(1, 0);
  const n = makeGate('NOT');
  const o = makeOutput(1);
  const c = {
    components: [i, n, o],
    wires: [makeWire(i, n, 'out', 'in0'), makeWire(n, o, 'out', 'in0')],
  };
  assertFalse(simulate(c).hasCycle, 'pas de cycle');
});

// =====================================================================
// 13. PERSISTANCE JSON
// =====================================================================
suite('persistance JSON');

// Helper : prédicat « type connu » côté tests (utilise les GATES de sim-core)
const isKnown = (t) => !!GATES[t];
let _idCounter = 0;
const fakeUid = (prefix) => `${prefix}_test_${(_idCounter++).toString(36)}`;

test('FORMAT_VERSION exporté et égal à 2', () => {
  assertEq(FORMAT_VERSION, 2);
});

test('serialize → deserialize : circuit simple (round-trip)', () => {
  const i1 = makeInput(1, 1);
  const i2 = makeInput(1, 0);
  const g = makeGate('AND');
  const o = makeOutput(1);
  const c = {
    name: 'Test',
    components: [i1, i2, g, o],
    wires: [
      makeWire(i1, g, 'out', 'in0'),
      makeWire(i2, g, 'out', 'in1'),
      makeWire(g, o, 'out', 'in0'),
    ],
    customDefinitions: {},
  };
  const json = serialize(c);
  assertEq(json.version, 2);
  assertEq(json.name, 'Test');
  assertEq(json.components.length, 4);
  assertEq(json.wires.length, 3);
  const back = deserialize(json, { isKnownType: isKnown, uid: fakeUid });
  assertEq(back.components.length, 4);
  assertEq(back.wires.length, 3);
  // Vérifie qu'on peut ré-exécuter la simulation
  const sim = simulate(back);
  assertEq(getInputAt(sim, back.components[3], 'in0'), 0, '1 AND 0 = 0');
});

test('deserialize : v1 = v2 mono-onglet (compatibilité ascendante)', () => {
  const v1Payload = {
    version: 1,
    name: 'Ancien',
    components: [{ id: 'i1', type: 'INPUT', x: 0, y: 0, state: { value: 1, width: 1 } }],
    wires: [],
    customDefinitions: {},
  };
  const back = deserialize(v1Payload, { isKnownType: isKnown, uid: fakeUid });
  assertEq(back.name, 'Ancien');
  assertEq(back.components.length, 1);
});

test('deserialize : version inconnue → throw', () => {
  let threw = false;
  try {
    deserialize({ version: 99, components: [], wires: [] }, { isKnownType: isKnown, uid: fakeUid });
  } catch (e) {
    threw = true;
    assertTrue(e.message.includes('Version inconnue'), 'message attendu');
  }
  assertTrue(threw, 'doit lever');
});

test('deserialize : payload invalide (null, undefined, primitive) → throw', () => {
  for (const bad of [null, undefined, 42, 'string']) {
    let threw = false;
    try {
      deserialize(bad, { isKnownType: isKnown, uid: fakeUid });
    } catch {
      threw = true;
    }
    assertTrue(threw, `doit lever pour ${typeof bad}`);
  }
});

test('deserialize : filtre les composants au type inconnu', () => {
  const payload = {
    version: 2,
    components: [
      { id: 'in0', type: 'AND',  x: 0, y: 0 },
      { id: 'in1', type: 'GHOST', x: 0, y: 0 },  // type inexistant
      { id: 'c', type: 'OR',   x: 0, y: 0 },
    ],
    wires: [],
    customDefinitions: {},
  };
  const back = deserialize(payload, { isKnownType: isKnown, uid: fakeUid });
  assertEq(back.components.length, 2, 'GHOST filtré');
  assertEq(back.components.map((c) => c.type).join(','), 'AND,OR');
});

test('deserialize : retire les fils orphelins (vers composant filtré)', () => {
  const payload = {
    version: 2,
    components: [
      { id: 'in0', type: 'AND', x: 0, y: 0 },
      { id: 'in1', type: 'GHOST', x: 0, y: 0 },
    ],
    wires: [
      { id: 'w1', from: { componentId: 'in0', port: 'out' }, to: { componentId: 'in1', port: 'in' } },
    ],
    customDefinitions: {},
  };
  const back = deserialize(payload, { isKnownType: isKnown, uid: fakeUid });
  assertEq(back.wires.length, 0, 'fil orphelin retiré');
});

test('serializeAll → deserializeAll : 3 onglets round-trip', () => {
  const tab1 = { id: 'tA', name: 'A', components: [makeInput(1, 1)], wires: [] };
  const tab2 = { id: 'tB', name: 'B', components: [makeGate('AND')], wires: [] };
  const tab3 = { id: 'tC', name: 'C', components: [], wires: [] };
  const state = { tabs: [tab1, tab2, tab3], activeTabId: 'tB', customDefinitions: {} };
  const json = serializeAll(state);
  assertEq(json.version, 2);
  assertEq(json.multitab, true);
  assertEq(json.tabs.length, 3);
  assertEq(json.activeTabId, 'tB');
  const back = deserializeAll(json, { isKnownType: isKnown, uid: fakeUid });
  assertEq(back.tabs.length, 3);
  assertEq(back.activeTabId, 'tB');
  assertEq(back.tabs[0].name, 'A');
});

test('deserializeAll : mono-onglet (v1 ou v2 sans multitab) → 1 onglet', () => {
  const single = {
    version: 1,
    name: 'Solo',
    components: [makeInput(1, 0)],
    wires: [],
    customDefinitions: {},
  };
  const back = deserializeAll(single, { isKnownType: isKnown, uid: fakeUid });
  assertEq(back.tabs.length, 1);
  assertEq(back.tabs[0].name, 'Solo');
  assertEq(back.tabs[0].components.length, 1);
});

test('deserializeAll : tabs vide → fallback onglet vide', () => {
  const empty = {
    version: 2,
    multitab: true,
    tabs: [],
    activeTabId: 'inexistant',
    customDefinitions: {},
  };
  const back = deserializeAll(empty, { isKnownType: isKnown, uid: fakeUid });
  assertEq(back.tabs.length, 1, 'au moins 1 onglet');
  assertEq(back.tabs[0].components.length, 0);
});

test('deserializeAll : activeTabId invalide → retombe sur le premier onglet', () => {
  const payload = {
    version: 2,
    multitab: true,
    tabs: [{ id: 't1', name: 'T1', components: [], wires: [] }],
    activeTabId: 'ZZZ',
    customDefinitions: {},
  };
  const back = deserializeAll(payload, { isKnownType: isKnown, uid: fakeUid });
  assertEq(back.activeTabId, 't1');
});

test('round-trip préserve state.value des INPUT', () => {
  const i = { id: 'x', type: 'INPUT', x: 10, y: 20, state: { value: 7, width: 4 } };
  const c = { name: 'X', components: [i], wires: [], customDefinitions: {} };
  const back = deserialize(serialize(c), { isKnownType: isKnown, uid: fakeUid });
  assertEq(back.components[0].state.value, 7);
  assertEq(back.components[0].state.width, 4);
  assertEq(back.components[0].x, 10);
  assertEq(back.components[0].y, 20);
});

test('round-trip préserve customDefinitions', () => {
  const customDef = {
    name: 'Foo',
    inputs: [{ name: 'in0', internalId: 'in1', width: 1 }],
    outputs: [{ name: 'out', internalId: 'out1', width: 1 }],
    circuit: { components: [], wires: [] },
  };
  const c = { name: 'X', components: [], wires: [], customDefinitions: { Foo: customDef } };
  const back = deserialize(serialize(c), { isKnownType: isKnown, uid: fakeUid });
  assertDeepEq(back.customDefinitions, { Foo: customDef });
});

// =====================================================================
// 14. COMPOSANTS PEU TESTÉS
// =====================================================================
suite('CLOCK : source 0/1');

test('CLOCK : sortie = state.value', () => {
  const clk = { id: tid('clk'), type: 'CLOCK', x:0, y:0, state: { value: 1 } };
  const o = makeOutput(1);
  const c = {
    components: [clk, o],
    wires: [makeWire(clk, o, 'CLK', 'in0')],
  };
  assertEq(getInputAt(simulate(c), o, 'in0'), 1, 'CLK=1 → 1');
  clk.state.value = 0;
  assertEq(getInputAt(simulate(c), o, 'in0'), 0, 'CLK=0 → 0');
});

suite('INPUT / OUTPUT en mode bus');

test('INPUT bus 8-bit : masquage à la largeur', () => {
  const i = makeInput(8, 0x1FF); // 9-bit value, doit être masqué à 8 bits
  const o = makeOutput(8);
  const c = {
    components: [i, o],
    wires: [makeWire(i, o, 'out', 'in0')],
  };
  assertEq(getInputAt(simulate(c), o, 'in0'), 0xFF, 'masque à 8 bits');
});

test('INPUT bus 16-bit : valeurs jusqu\'à 0xFFFF', () => {
  const i = makeInput(16, 0xBEEF);
  const o = makeOutput(16);
  const c = {
    components: [i, o],
    wires: [makeWire(i, o, 'out', 'in0')],
  };
  assertEq(getInputAt(simulate(c), o, 'in0'), 0xBEEF);
});

test('INPUT bus 32-bit : limite supérieure (cas spécial signed)', () => {
  // À 32 bits, maskTo renvoie v|0 (signed). 0xFFFFFFFF | 0 = -1
  const i = makeInput(32, 0xFFFFFFFF);
  const o = makeOutput(32);
  const c = {
    components: [i, o],
    wires: [makeWire(i, o, 'out', 'in0')],
  };
  assertEq(getInputAt(simulate(c), o, 'in0'), -1, '32-bit signed wrap');
});

suite('MUX / DEMUX / DECODER : largeurs supplémentaires');

test('MUX 8:1 (selectWidth=3, dataWidth=1)', () => {
  for (let sel = 0; sel < 8; sel++) {
    const inps = Array.from({ length: 8 }, (_, i) => makeInput(1, i % 2));
    const s = makeInput(3, sel);
    const mux = { id: tid('mux'), type: 'MUX', x:0, y:0, state: { selectWidth: 3, dataWidth: 1 } };
    const c = {
      components: [...inps, s, mux],
      wires: [
        ...inps.map((inp, i) => makeWire(inp, mux, 'out', `in${i}`)),
        makeWire(s, mux, 'out', 'sel'),
      ],
    };
    assertEq(getOutputAt(simulate(c), mux, 'out'), sel % 2, `sel=${sel}`);
  }
});

test('DEMUX 1→8 (selectWidth=3)', () => {
  const data = makeInput(1, 1);
  for (let sel = 0; sel < 8; sel++) {
    const s = makeInput(3, sel);
    const dmx = { id: tid('dmx'), type: 'DEMUX', x:0, y:0, state: { selectWidth: 3, dataWidth: 1 } };
    const c = {
      components: [data, s, dmx],
      wires: [
        makeWire(data, dmx, 'out', 'in'),
        makeWire(s,    dmx, 'out', 'sel'),
      ],
    };
    const sim = simulate(c);
    for (let i = 0; i < 8; i++) {
      assertEq(getOutputAt(sim, dmx, `out${i}`), i === sel ? 1 : 0, `sel=${sel}, out${i}`);
    }
  }
});

test('DECODER 1-bit : 1→2 sorties', () => {
  for (let v = 0; v < 2; v++) {
    const inp = makeInput(1, v);
    const dec = { id: tid('dec'), type: 'DECODER', x:0, y:0, state: { width: 1 } };
    const c = {
      components: [inp, dec],
      wires: [makeWire(inp, dec, 'out', 'in')],
    };
    const sim = simulate(c);
    assertEq(getOutputAt(sim, dec, 'out0'), v === 0 ? 1 : 0);
    assertEq(getOutputAt(sim, dec, 'out1'), v === 1 ? 1 : 0);
  }
});

test('DECODER 4-bit : 4→16 sorties', () => {
  for (let v = 0; v < 16; v++) {
    const inp = makeInput(4, v);
    const dec = { id: tid('dec'), type: 'DECODER', x:0, y:0, state: { width: 4 } };
    const c = {
      components: [inp, dec],
      wires: [makeWire(inp, dec, 'out', 'in')],
    };
    const sim = simulate(c);
    for (let i = 0; i < 16; i++) {
      assertEq(getOutputAt(sim, dec, `out${i}`), i === v ? 1 : 0, `v=${v}, out${i}`);
    }
  }
});

suite('SEG7 en simulation');

test('SEG7 : composant comme puits (pas de sortie logique)', () => {
  const i = makeInput(4, 0xA);
  const seg = { id: tid('seg'), type: 'SEG7', x:0, y:0, state: { mode: 'hex' } };
  const c = {
    components: [i, seg],
    wires: [makeWire(i, seg, 'out', 'D')],
  };
  const sim = simulate(c);
  // Pas de sortie logique exposée
  assertEq(getInputAt(sim, seg, 'D'), 0xA, 'D reçoit la valeur');
});

test('REG width=1 (1-bit) : capture conditionnelle', () => {
  const d = makeInput(1, 1);
  const ld = makeInput(1, 1);
  const clk = makeInput(1, 0);
  const reg = { id: tid('reg'), type: 'REG', x:0, y:0, state: { q: 0, lastClk: 0, width: 1 } };
  let c = {
    components: [d, ld, clk, reg],
    wires: [
      makeWire(d, reg, 'out', 'D'),
      makeWire(ld, reg, 'out', 'LD'),
      makeWire(clk, reg, 'out', 'CLK'),
    ],
  };
  c.components.find((x) => x.id === clk.id).state.value = 1;
  c = stepSequential(c);
  assertEq(c.components.find((x) => x.type === 'REG').state.q, 1, 'capture 1-bit');
});

// =====================================================================
// 15. CAS LIMITES DE simulate()
// =====================================================================
suite('cas limites simulate');

test('port d\'entrée non câblé : valeur = 0', () => {
  const g = makeGate('AND');
  const o = makeOutput(1);
  const c = {
    components: [g, o],
    wires: [makeWire(g, o, 'out', 'in0')],
  };
  // a et b ne sont câblés à rien → simulate doit lire 0 sur ces ports
  const sim = simulate(c);
  assertEq(getOutputAt(sim, g, 'out'), 0, '0 AND 0 = 0');
});

test('cycle partiel : sous-graphe cyclique + sous-graphe acyclique', () => {
  // n1 -> n2 -> n1 (cycle) ; i -> o (acyclique)
  const n1 = makeGate('NOT');
  const n2 = makeGate('NOT');
  const i = makeInput(1, 1);
  const o = makeOutput(1);
  const c = {
    components: [n1, n2, i, o],
    wires: [
      makeWire(n1, n2, 'out', 'in0'),
      makeWire(n2, n1, 'out', 'in0'), // boucle
      makeWire(i, o, 'out', 'in0'),
    ],
  };
  const sim = simulate(c);
  assertTrue(sim.hasCycle, 'cycle détecté malgré la partie acyclique');
  // La chaîne acyclique reste valide
  assertEq(getInputAt(sim, o, 'in0'), 1, 'partie acyclique évaluée');
});

test('type inconnu : composant ignoré silencieusement', () => {
  const i = makeInput(1, 1);
  const ghost = { id: tid('gh'), type: 'GHOST_TYPE', x:0, y:0 };
  const o = makeOutput(1);
  const c = {
    components: [i, ghost, o],
    wires: [makeWire(i, o, 'out', 'in0')],
  };
  const sim = simulate(c);
  // Aucun crash, et la chaîne i → o fonctionne
  assertEq(getInputAt(sim, o, 'in0'), 1);
});

test('fil pointant vers composant inexistant : ignoré', () => {
  const i = makeInput(1, 1);
  const o = makeOutput(1);
  const c = {
    components: [i, o],
    wires: [
      makeWire(i, o, 'out', 'in0'),
      // Fil vers un id qui n'existe pas
      { id: 'wbad', from: { componentId: 'ghost', port: 'out' }, to: { componentId: o.id, port: 'in0' } },
    ],
  };
  // Ne doit pas crasher
  const sim = simulate(c);
  assertEq(getInputAt(sim, o, 'in0'), 1);
});

test('circuit vide : pas de crash, hasCycle=false', () => {
  const sim = simulate({ components: [], wires: [] });
  assertFalse(sim.hasCycle);
  assertEq(sim.outValues.size, 0);
});

test('1 seul composant sans fils', () => {
  const i = makeInput(1, 1);
  const sim = simulate({ components: [i], wires: [] });
  assertEq(getOutputAt(sim, i, 'out'), 1);
});

test('récursion bloquée : custom qui se réfère à lui-même', () => {
  const selfRef = {
    name: 'Self',
    inputs: [{ name: 'in0', internalId: 'inA', width: 1 }],
    outputs: [{ name: 'out', internalId: 'outY', width: 1 }],
    circuit: {
      components: [
        { id: 'inA', type: 'INPUT', x:0, y:0, state: { value: 0, width: 1 } },
        { id: 'rec', type: 'Self', x:0, y:0 },  // référence à soi
        { id: 'outY', type: 'OUTPUT', x:0, y:0, state: { width: 1 } },
      ],
      wires: [
        { id: 'w1', from: { componentId: 'inA', port: 'out' }, to: { componentId: 'rec', port: 'in0' } },
        { id: 'w2', from: { componentId: 'rec', port: 'out' }, to: { componentId: 'outY', port: 'in0' } },
      ],
    },
  };
  // Le simulateur doit retourner 0 quand il détecte la récursion (recursionStack)
  const a = makeInput(1, 1);
  const inst = { id: tid('s'), type: 'Self', x:0, y:0 };
  const o = makeOutput(1);
  const c = {
    components: [a, inst, o],
    customDefinitions: { Self: selfRef },
    wires: [
      makeWire(a, inst, 'out', 'in0'),
      makeWire(inst, o, 'out', 'in0'),
    ],
  };
  // Ne doit pas exploser en stack overflow ; sortie = 0 par convention
  const sim = simulate(c);
  assertEq(getInputAt(sim, o, 'in0'), 0, 'sortie 0 quand récursion');
});

// =====================================================================
// 15b. stepSequential : stabilité de référence (anti-boucle de re-render)
// useCircuitEngine s'appuie sur `next === circuit` pour ne PAS re-rendre en
// boucle. Si stepSequential renvoyait toujours un nouveau tableau, l'effet
// séquentiel se redéclencherait sans fin et figerait l'horloge auto.
// =====================================================================
suite('stepSequential : stabilité de référence');

test('circuit combinatoire stable → même référence', () => {
  const i = makeInput(1, 1);
  const o = makeOutput(1);
  const c = { components: [i, o], wires: [makeWire(i, o, 'out', 'in0')], customDefinitions: {} };
  assertTrue(stepSequential(c) === c, 'doit renvoyer la même référence si rien ne change');
});

test('CLOCK running stable → même référence', () => {
  const clk = { id: tid('clk'), type: 'CLOCK', x: 0, y: 0, state: { value: 0, running: true, freq: 1, lastToggleAt: 0 } };
  const c = { components: [clk], wires: [], customDefinitions: {} };
  assertTrue(stepSequential(c) === c, 'une horloge seule ne doit pas générer de nouveau circuit');
});

test('DFF qui capture sur front montant → nouvelle référence', () => {
  const inp = makeInput(1, 1);
  const clk = { id: tid('clk'), type: 'CLOCK', x: 0, y: 0, state: { value: 1 } };
  const dff = { id: tid('dff'), type: 'DFF', x: 0, y: 0, state: { q: 0, lastClk: 0, width: 1 } };
  const c = {
    components: [inp, clk, dff],
    wires: [
      makeWire(inp, dff, 'out', 'D'),
      makeWire(clk, dff, 'CLK', 'CLK'),
    ],
    customDefinitions: {},
  };
  const next = stepSequential(c);
  assertTrue(next !== c, 'un changement doit produire un nouveau circuit');
  assertEq(asInt(next.components.find((x) => x.id === dff.id).state.q), 1, 'Q capture D=1');
});

// =====================================================================
// 16. ROTATION : applyOrientation
// =====================================================================
suite('rotation : applyOrientation');

test('orientation right : pas de modification', () => {
  const def = {
    w: 60, h: 40,
    inputs: [{ name: 'in0', x: 0, y: 10, width: 1 }],
    outputs: [{ name: 'out', x: 60, y: 20, width: 1 }],
  };
  const out = applyOrientation(def, 'right');
  assertEq(out.w, 60);
  assertEq(out.h, 40);
  assertEq(out.inputs[0].x, 0);
  assertEq(out.inputs[0].y, 10);
  assertEq(out.outputs[0].x, 60);
  assertEq(out.outputs[0].y, 20);
});

test('orientation down : rotation horaire 90°, w/h échangés', () => {
  const def = {
    w: 60, h: 40,
    inputs: [{ name: 'in0', x: 0, y: 10, width: 1 }],
    outputs: [{ name: 'out', x: 60, y: 20, width: 1 }],
  };
  const out = applyOrientation(def, 'down');
  assertEq(out.w, 40, 'w devient h natif');
  assertEq(out.h, 60, 'h devient w natif');
  // (px, py) → (H - py, px) avec H=40
  assertEq(out.inputs[0].x, 30);  // 40 - 10
  assertEq(out.inputs[0].y, 0);   // px=0
  assertEq(out.outputs[0].x, 20); // 40 - 20
  assertEq(out.outputs[0].y, 60); // px=60
  assertEq(out.nativeW, 60);
  assertEq(out.nativeH, 40);
  assertEq(out.orientation, 'down');
});

test('orientation left : 180°', () => {
  const def = {
    w: 60, h: 40,
    inputs: [{ name: 'in0', x: 0, y: 10, width: 1 }],
    outputs: [{ name: 'out', x: 60, y: 20, width: 1 }],
  };
  const out = applyOrientation(def, 'left');
  assertEq(out.w, 60);
  assertEq(out.h, 40);
  // (px, py) → (W - px, H - py)
  assertEq(out.inputs[0].x, 60);
  assertEq(out.inputs[0].y, 30);
  assertEq(out.outputs[0].x, 0);
  assertEq(out.outputs[0].y, 20);
});

test('orientation up : 270°', () => {
  const def = {
    w: 60, h: 40,
    inputs: [{ name: 'in0', x: 0, y: 10, width: 1 }],
    outputs: [{ name: 'out', x: 60, y: 20, width: 1 }],
  };
  const out = applyOrientation(def, 'up');
  assertEq(out.w, 40);
  assertEq(out.h, 60);
  // (px, py) → (py, W - px)
  assertEq(out.inputs[0].x, 10);
  assertEq(out.inputs[0].y, 60);
  assertEq(out.outputs[0].x, 20);
  assertEq(out.outputs[0].y, 0);
});

test('rotation 4× = identité', () => {
  const def = {
    w: 80, h: 60,
    inputs: [{ name: 'in0', x: 0, y: 25, width: 1 }, { name: 'in1', x: 0, y: 35, width: 1 }],
    outputs: [{ name: 'out', x: 80, y: 30, width: 1 }],
  };
  // right → down → left → up : doit ramener à un état équivalent
  // (les positions tournent mais après 4 rotations on revient au point de départ)
  let d = def;
  for (const o of ['down', 'left', 'up', 'right']) d = applyOrientation(d, o);
  // d est le dernier qui est 'right' donc identique à def
  assertEq(d.w, def.w);
  assertEq(d.h, def.h);
});

test('simulate avec INPUT tourné : ports restent valides', () => {
  const i = makeInput(1, 1);
  i.state.orientation = 'down';
  const o = makeOutput(1);
  const c = {
    components: [i, o],
    wires: [makeWire(i, o, 'out', 'in0')],
  };
  // La simulation doit fonctionner indépendamment de l'orientation
  assertEq(getInputAt(simulate(c), o, 'in0'), 1);
});

test('simulate avec AND tourné : logique préservée', () => {
  const i1 = makeInput(1, 1);
  const i2 = makeInput(1, 1);
  const g = makeGate('AND');
  g.state = { orientation: 'down' };
  const o = makeOutput(1);
  const c = {
    components: [i1, i2, g, o],
    wires: [
      makeWire(i1, g, 'out', 'in0'),
      makeWire(i2, g, 'out', 'in1'),
      makeWire(g, o, 'out', 'in0'),
    ],
  };
  assertEq(getInputAt(simulate(c), o, 'in0'), 1, 'AND tourné fonctionne');
});

// =====================================================================
// 16b. LEDMATRIX : matrice de LEDs adressable
// =====================================================================
suite('LEDMATRIX');

function makeLedMatrix(cols = 4, rows = 4) {
  return {
    id: tid('mat'),
    type: 'LEDMATRIX',
    x: 0, y: 0,
    state: {
      cols, rows,
      pixels: new Array(cols * rows).fill(0),
      lastClk: 0,
    },
  };
}

test('LEDMATRIX : écriture synchrone d\'un pixel', () => {
  const x = makeInput(2, 1);  // X = 1
  const y = makeInput(2, 2);  // Y = 2
  const d = makeInput(1, 1);  // D = 1 (allumer)
  const we = makeInput(1, 1);
  const clk = makeInput(1, 0);
  const rst = makeInput(1, 0);
  const mat = makeLedMatrix(4, 4);
  let c = {
    components: [x, y, d, we, clk, rst, mat],
    wires: [
      makeWire(x, mat, 'out', 'X'),
      makeWire(y, mat, 'out', 'Y'),
      makeWire(d, mat, 'out', 'D'),
      makeWire(we, mat, 'out', 'WE'),
      makeWire(clk, mat, 'out', 'CLK'),
      makeWire(rst, mat, 'out', 'RST'),
    ],
  };
  // Front montant CLK → pixel (1, 2) doit s'allumer
  c.components.find((m) => m.id === clk.id).state.value = 1;
  c = stepSequential(c);
  const after = c.components.find((m) => m.type === 'LEDMATRIX');
  assertEq(after.state.pixels[2 * 4 + 1], 1, 'pixel (1,2) allumé');
  assertEq(after.state.pixels[0], 0, '(0,0) non touché');
});

test('LEDMATRIX : pas d\'écriture si WE=0', () => {
  const x = makeInput(2, 0);
  const y = makeInput(2, 0);
  const d = makeInput(1, 1);
  const we = makeInput(1, 0);  // désactivé
  const clk = makeInput(1, 0);
  const rst = makeInput(1, 0);
  const mat = makeLedMatrix(4, 4);
  let c = {
    components: [x, y, d, we, clk, rst, mat],
    wires: [
      makeWire(x, mat, 'out', 'X'),
      makeWire(y, mat, 'out', 'Y'),
      makeWire(d, mat, 'out', 'D'),
      makeWire(we, mat, 'out', 'WE'),
      makeWire(clk, mat, 'out', 'CLK'),
      makeWire(rst, mat, 'out', 'RST'),
    ],
  };
  c.components.find((m) => m.id === clk.id).state.value = 1;
  c = stepSequential(c);
  const after = c.components.find((m) => m.type === 'LEDMATRIX');
  assertEq(after.state.pixels[0], 0, 'pas d\'écriture');
});

test('LEDMATRIX : RST asynchrone efface tous les pixels', () => {
  const x = makeInput(2, 0);
  const y = makeInput(2, 0);
  const d = makeInput(1, 0);
  const we = makeInput(1, 0);
  const clk = makeInput(1, 0);
  const rst = makeInput(1, 1);  // reset
  // Matrice pré-remplie
  const mat = makeLedMatrix(4, 4);
  mat.state.pixels = mat.state.pixels.map(() => 1);
  let c = {
    components: [x, y, d, we, clk, rst, mat],
    wires: [
      makeWire(x, mat, 'out', 'X'),
      makeWire(y, mat, 'out', 'Y'),
      makeWire(d, mat, 'out', 'D'),
      makeWire(we, mat, 'out', 'WE'),
      makeWire(clk, mat, 'out', 'CLK'),
      makeWire(rst, mat, 'out', 'RST'),
    ],
  };
  c = stepSequential(c);
  const after = c.components.find((m) => m.type === 'LEDMATRIX');
  for (let i = 0; i < 16; i++) {
    assertEq(after.state.pixels[i], 0, `pixel ${i} effacé`);
  }
});

test('LEDMATRIX : écriture de plusieurs pixels successifs', () => {
  // Écrit la diagonale (0,0), (1,1), (2,2), (3,3) via 4 fronts montants
  const x = makeInput(2, 0);
  const y = makeInput(2, 0);
  const d = makeInput(1, 1);
  const we = makeInput(1, 1);
  const clk = makeInput(1, 0);
  const rst = makeInput(1, 0);
  const mat = makeLedMatrix(4, 4);
  let c = {
    components: [x, y, d, we, clk, rst, mat],
    wires: [
      makeWire(x, mat, 'out', 'X'),
      makeWire(y, mat, 'out', 'Y'),
      makeWire(d, mat, 'out', 'D'),
      makeWire(we, mat, 'out', 'WE'),
      makeWire(clk, mat, 'out', 'CLK'),
      makeWire(rst, mat, 'out', 'RST'),
    ],
  };
  for (let i = 0; i < 4; i++) {
    c.components.find((m) => m.id === x.id).state.value = i;
    c.components.find((m) => m.id === y.id).state.value = i;
    c.components.find((m) => m.id === clk.id).state.value = 1;
    c = stepSequential(c);
    c.components.find((m) => m.id === clk.id).state.value = 0;
    c = stepSequential(c);
  }
  const after = c.components.find((m) => m.type === 'LEDMATRIX');
  for (let i = 0; i < 4; i++) {
    assertEq(after.state.pixels[i * 4 + i], 1, `diagonale (${i},${i})`);
  }
  // Hors diagonale → 0
  assertEq(after.state.pixels[1], 0, '(1,0) éteint');
  assertEq(after.state.pixels[14], 0, '(2,3) éteint');
});

test('LEDMATRIX : adresses hors limites ignorées', () => {
  const x = makeInput(3, 5);  // X=5 mais cols=4 → hors limites
  const y = makeInput(3, 0);
  const d = makeInput(1, 1);
  const we = makeInput(1, 1);
  const clk = makeInput(1, 0);
  const rst = makeInput(1, 0);
  const mat = makeLedMatrix(4, 4);
  let c = {
    components: [x, y, d, we, clk, rst, mat],
    wires: [
      makeWire(x, mat, 'out', 'X'),
      makeWire(y, mat, 'out', 'Y'),
      makeWire(d, mat, 'out', 'D'),
      makeWire(we, mat, 'out', 'WE'),
      makeWire(clk, mat, 'out', 'CLK'),
      makeWire(rst, mat, 'out', 'RST'),
    ],
  };
  c.components.find((m) => m.id === clk.id).state.value = 1;
  c = stepSequential(c);
  const after = c.components.find((m) => m.type === 'LEDMATRIX');
  // Aucun pixel ne doit être modifié
  for (let i = 0; i < 16; i++) {
    assertEq(after.state.pixels[i], 0, `pixel ${i} intouché`);
  }
});

// =====================================================================
// 17. SCÉNARIOS SÉQUENTIELS AVANCÉS
// =====================================================================
suite('séquentiels avancés');

// Helper : un « pulse » CLK monte puis descend l'horloge nommée
function pulseClock(c, clkId) {
  c.components.find((x) => x.id === clkId).state.value = 1;
  c = stepSequential(c);
  c.components.find((x) => x.id === clkId).state.value = 0;
  c = stepSequential(c);
  return c;
}

test('compteur 4-bit + RAM : écrit Q dans des cellules successives', () => {
  // Le compteur génère l'adresse, on écrit la même valeur (fixe) à chaque
  // pulse. Après 4 pulses, mem[0..3] doivent tous contenir 0x5.
  const clk = makeInput(1, 0);
  const dataIn = makeInput(4, 0x5);
  const we = makeInput(1, 1);
  const en = makeInput(1, 1);
  const cnt = { id: tid('cnt'), type: 'COUNTER', x:0, y:0, state: { q: 0, lastClk: 0, width: 3 } };
  const ram = {
    id: tid('ram'), type: 'RAM', x:0, y:0,
    state: { addrWidth: 3, dataWidth: 4, mem: new Array(8).fill(0), lastClk: 0 },
  };
  let c = {
    components: [clk, dataIn, we, en, cnt, ram],
    wires: [
      makeWire(clk, cnt, 'out', 'CLK'),
      makeWire(en,  cnt, 'out', 'EN'),
      makeWire(cnt, ram, 'Q',    'ADDR'),
      makeWire(clk, ram, 'out', 'CLK'),
      makeWire(dataIn, ram, 'out', 'DATA_IN'),
      makeWire(we, ram, 'out', 'WE'),
    ],
  };
  // Premier pulse : ADDR=0, écrit puis incrémente à 1
  // Mais comme COUNTER et RAM partagent CLK, ordre subtil :
  // sur le front montant, à ce moment-là COUNTER.q vaut encore l'ancienne valeur
  // (0 au tick 1, puis post-stepSequential q=1, etc.)
  // Donc on écrit successivement à 0, 1, 2, 3
  for (let i = 0; i < 4; i++) {
    c = pulseClock(c, clk.id);
  }
  const finalRam = c.components.find((x) => x.type === 'RAM');
  assertEq(finalRam.state.mem[0], 0x5, 'mem[0]=5');
  assertEq(finalRam.state.mem[1], 0x5, 'mem[1]=5');
  assertEq(finalRam.state.mem[2], 0x5, 'mem[2]=5');
  assertEq(finalRam.state.mem[3], 0x5, 'mem[3]=5');
  assertEq(finalRam.state.mem[4], 0, 'mem[4] intact');
});

test('multiple CLOCK indépendantes : chacune capture ses propres DFF', () => {
  const clkA = { id: 'clkA', type: 'CLOCK', x:0, y:0, state: { value: 0 } };
  const clkB = { id: 'clkB', type: 'CLOCK', x:0, y:0, state: { value: 0 } };
  const dA = makeInput(1, 1);
  const dB = makeInput(1, 1);
  const dffA = { id: 'dffA', type: 'DFF', x:0, y:0, state: { q: 0, lastClk: 0, width: 1 } };
  const dffB = { id: 'dffB', type: 'DFF', x:0, y:0, state: { q: 0, lastClk: 0, width: 1 } };
  let c = {
    components: [clkA, clkB, dA, dB, dffA, dffB],
    wires: [
      makeWire(dA, dffA, 'out', 'D'),
      makeWire(clkA, dffA, 'CLK', 'CLK'),
      makeWire(dB, dffB, 'out', 'D'),
      makeWire(clkB, dffB, 'CLK', 'CLK'),
    ],
  };
  // Pulse seulement clkA : dffA capture, dffB reste à 0
  c = pulseClock(c, 'clkA');
  assertEq(c.components.find((x) => x.id === 'dffA').state.q, 1, 'dffA capture');
  assertEq(c.components.find((x) => x.id === 'dffB').state.q, 0, 'dffB reste 0');
  // Pulse clkB maintenant : dffB capture, dffA reste à 1
  c = pulseClock(c, 'clkB');
  assertEq(c.components.find((x) => x.id === 'dffA').state.q, 1, 'dffA conserve');
  assertEq(c.components.find((x) => x.id === 'dffB').state.q, 1, 'dffB capture');
});

test('mix DFF + SR latch : DFF échantillonne la sortie du SR', () => {
  // SR latch contrôlé par S et R. Sa sortie Q alimente le D d'un DFF.
  // Front montant CLK → DFF capture la valeur courante de SR.q.
  const s = makeInput(1, 1);
  const r = makeInput(1, 0);
  const clk = makeInput(1, 0);
  const sr = { id: 'sr', type: 'SRLATCH', x:0, y:0, state: { q: 0 } };
  const dff = { id: 'dff', type: 'DFF', x:0, y:0, state: { q: 0, lastClk: 0, width: 1 } };
  let c = {
    components: [s, r, clk, sr, dff],
    wires: [
      makeWire(s, sr, 'out', 'S'),
      makeWire(r, sr, 'out', 'R'),
      makeWire(sr, dff, 'Q', 'D'),
      makeWire(clk, dff, 'out', 'CLK'),
    ],
  };
  // S=1 → SR.q monte à 1
  c = stepSequential(c);
  assertEq(c.components.find((x) => x.id === 'sr').state.q, 1);
  // S=0 R=0 → hold ; pulse CLK → DFF capture SR.q=1
  c.components.find((x) => x.id === s.id).state.value = 0;
  c = pulseClock(c, clk.id);
  assertEq(c.components.find((x) => x.id === 'dff').state.q, 1, 'DFF capture SR=1');
});

test('custom récursif sur 2 niveaux : encapsulation imbriquée', () => {
  // Niveau 1 : « Buf » = simple identité (a → y)
  const bufDef = {
    name: 'Buf',
    inputs: [{ name: 'in0', internalId: 'inA', width: 1 }],
    outputs: [{ name: 'out', internalId: 'outY', width: 1 }],
    circuit: {
      components: [
        { id: 'inA', type: 'INPUT', x:0, y:0, state: { value: 0, width: 1 } },
        { id: 'outY', type: 'OUTPUT', x:0, y:0, state: { width: 1 } },
      ],
      wires: [
        { id: 'w1', from: { componentId: 'inA', port: 'out' }, to: { componentId: 'outY', port: 'in0' } },
      ],
    },
  };
  // Niveau 2 : « BufBuf » utilise « Buf » à l'intérieur
  const bufBufDef = {
    name: 'BufBuf',
    inputs: [{ name: 'in0', internalId: 'inA2', width: 1 }],
    outputs: [{ name: 'out', internalId: 'outY2', width: 1 }],
    circuit: {
      components: [
        { id: 'inA2', type: 'INPUT', x:0, y:0, state: { value: 0, width: 1 } },
        { id: 'bufInst', type: 'Buf', x:0, y:0 },
        { id: 'outY2', type: 'OUTPUT', x:0, y:0, state: { width: 1 } },
      ],
      wires: [
        { id: 'w1', from: { componentId: 'inA2', port: 'out' }, to: { componentId: 'bufInst', port: 'in0' } },
        { id: 'w2', from: { componentId: 'bufInst', port: 'out' }, to: { componentId: 'outY2', port: 'in0' } },
      ],
    },
  };
  const a = makeInput(1, 1);
  const inst = { id: tid('bb'), type: 'BufBuf', x:0, y:0 };
  const o = makeOutput(1);
  const c = {
    components: [a, inst, o],
    customDefinitions: { Buf: bufDef, BufBuf: bufBufDef },
    wires: [
      makeWire(a, inst, 'out', 'in0'),
      makeWire(inst, o, 'out', 'in0'),
    ],
  };
  const sim = simulate(c);
  assertEq(getInputAt(sim, o, 'in0'), 1, 'identité à 2 niveaux');
});

test('shift register 4 étages : valeur propagée correctement après 4 pulses', () => {
  const d = makeInput(1, 1);
  const clk = makeInput(1, 0);
  const dffs = [0, 1, 2, 3].map((i) => ({
    id: `dff${i}`, type: 'DFF', x:0, y:0,
    state: { q: 0, lastClk: 0, width: 1 },
  }));
  let c = {
    components: [d, clk, ...dffs],
    wires: [
      makeWire(d, dffs[0], 'out', 'D'),
      makeWire(dffs[0], dffs[1], 'Q', 'D'),
      makeWire(dffs[1], dffs[2], 'Q', 'D'),
      makeWire(dffs[2], dffs[3], 'Q', 'D'),
      ...dffs.map((dff) => makeWire(clk, dff, 'out', 'CLK')),
    ],
  };
  // Pulse 1, 2, 3, 4 avec D=1 → après 4 pulses, [1,1,1,1]
  c = pulseClock(c, clk.id);
  assertDeepEq(c.components.filter((x) => x.type === 'DFF').map((x) => x.state.q), [1, 0, 0, 0]);
  c = pulseClock(c, clk.id);
  assertDeepEq(c.components.filter((x) => x.type === 'DFF').map((x) => x.state.q), [1, 1, 0, 0]);
  c = pulseClock(c, clk.id);
  assertDeepEq(c.components.filter((x) => x.type === 'DFF').map((x) => x.state.q), [1, 1, 1, 0]);
  c = pulseClock(c, clk.id);
  assertDeepEq(c.components.filter((x) => x.type === 'DFF').map((x) => x.state.q), [1, 1, 1, 1]);
  // D bascule à 0, encore 4 pulses → [0, 0, 0, 0]
  c.components.find((x) => x.id === d.id).state.value = 0;
  for (let i = 0; i < 4; i++) c = pulseClock(c, clk.id);
  assertDeepEq(c.components.filter((x) => x.type === 'DFF').map((x) => x.state.q), [0, 0, 0, 0]);
});

// Les tests sont collectés par Vitest via le shim (suite/test → it).
