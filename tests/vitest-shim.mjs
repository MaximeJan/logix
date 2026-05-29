// Mappe l'API du mini-runner maison (suite/test/assert*) vers Vitest, pour
// réutiliser la batterie de tests existante sans la réécrire. `suite` n'est
// qu'une étiquette ; chaque `test` devient un `it` Vitest de premier niveau.
import { it, expect } from 'vitest';

export function suite(_name) {
  /* étiquette seulement — Vitest regroupe les `it` au niveau racine */
}

export function test(name, fn) {
  it(name, fn);
}

export function assertEq(actual, expected, msg = '') {
  expect(actual, msg || undefined).toBe(expected);
}

export function assertDeepEq(actual, expected, msg = '') {
  expect(actual, msg || undefined).toStrictEqual(expected);
}

export function assertTrue(cond, msg = '') {
  expect(Boolean(cond), msg || undefined).toBe(true);
}

export function assertFalse(cond, msg = '') {
  expect(Boolean(cond), msg || undefined).toBe(false);
}
