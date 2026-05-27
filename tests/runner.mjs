// Mini-runner sans dépendances. Affiche OK/FAIL par test, résumé final.
// Usage:
//   import { suite, test, assertEq, assertDeepEq, run } from './runner.mjs';
//   suite('mon sujet');
//   test('cas 1', () => { assertEq(1+1, 2); });
//   run();

const state = {
  suites: [],         // [{ name, tests: [{name, fn}] }]
  currentSuite: null,
};

export function suite(name) {
  state.currentSuite = { name, tests: [] };
  state.suites.push(state.currentSuite);
}

export function test(name, fn) {
  if (!state.currentSuite) {
    state.currentSuite = { name: '(défaut)', tests: [] };
    state.suites.push(state.currentSuite);
  }
  state.currentSuite.tests.push({ name, fn });
}

class AssertionError extends Error {
  constructor(msg, details) {
    super(msg);
    this.details = details;
  }
}

function fmt(v) {
  if (v === undefined) return 'undefined';
  if (typeof v === 'string') return JSON.stringify(v);
  if (Array.isArray(v)) return '[' + v.map(fmt).join(', ') + ']';
  if (v && typeof v === 'object') {
    try { return JSON.stringify(v); } catch { return String(v); }
  }
  return String(v);
}

export function assertEq(actual, expected, msg = '') {
  if (actual !== expected) {
    throw new AssertionError(`assertEq${msg ? ' ' + msg : ''}: expected ${fmt(expected)}, got ${fmt(actual)}`);
  }
}

export function assertDeepEq(actual, expected, msg = '') {
  const aJson = JSON.stringify(actual);
  const bJson = JSON.stringify(expected);
  if (aJson !== bJson) {
    throw new AssertionError(`assertDeepEq${msg ? ' ' + msg : ''}: expected ${bJson}, got ${aJson}`);
  }
}

export function assertTrue(cond, msg = '') {
  if (!cond) throw new AssertionError(`assertTrue${msg ? ' ' + msg : ''}: condition fausse`);
}

export function assertFalse(cond, msg = '') {
  if (cond) throw new AssertionError(`assertFalse${msg ? ' ' + msg : ''}: condition vraie`);
}

export function run() {
  let pass = 0, fail = 0;
  const failures = [];
  const C = { reset: '\x1b[0m', red: '\x1b[31m', green: '\x1b[32m', dim: '\x1b[2m', cyan: '\x1b[36m', bold: '\x1b[1m' };
  for (const s of state.suites) {
    console.log(`\n${C.cyan}${C.bold}■ ${s.name}${C.reset}`);
    for (const t of s.tests) {
      try {
        t.fn();
        pass += 1;
        console.log(`  ${C.green}✓${C.reset} ${t.name}`);
      } catch (e) {
        fail += 1;
        failures.push({ suite: s.name, test: t.name, error: e });
        console.log(`  ${C.red}✗ ${t.name}${C.reset}`);
        console.log(`    ${C.dim}${e.message}${C.reset}`);
      }
    }
  }
  console.log(`\n${C.bold}Résumé :${C.reset} ${C.green}${pass} OK${C.reset}, ${fail > 0 ? C.red : ''}${fail} échec(s)${C.reset}`);
  if (fail > 0) {
    process.exitCode = 1;
  }
}
