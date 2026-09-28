import { describe, it, expect } from 'vitest';
import { usedCustomDefs, mergeImportedTab } from '../src/lib/tab-import';

// Définition personnalisée minimale : seuls `circuit.components[].type` comptent ici.
const def = (name, innerTypes = [], extra = {}) => ({
  name,
  inputs: [],
  outputs: [],
  circuit: {
    components: innerTypes.map((type, i) => ({ id: `${name}${i}`, type, x: 0, y: 0 })),
    wires: [],
  },
  ...extra,
});

const comp = (id, type) => ({ id, type, x: 0, y: 0 });
const tab = (id, components = []) => ({ id, name: id, components, wires: [] });

describe('usedCustomDefs', () => {
  const defs = {
    HA: def('HA', ['AND', 'XOR']),
    FA: def('FA', ['HA', 'HA', 'OR']),
    Unused: def('Unused', ['NOT']),
  };

  it('ne garde que les définitions utilisées, y compris imbriquées', () => {
    const used = usedCustomDefs([comp('a', 'FA'), comp('b', 'INPUT')], defs);
    expect(Object.keys(used).sort()).toEqual(['FA', 'HA']);
  });

  it('renvoie un objet vide sans composant personnalisé', () => {
    expect(usedCustomDefs([comp('a', 'AND')], defs)).toEqual({});
  });

  it('ignore les clés héritées du prototype', () => {
    expect(usedCustomDefs([comp('a', 'constructor')], defs)).toEqual({});
  });
});

describe('mergeImportedTab', () => {
  const state = (tabs, customDefinitions = {}, activeTabId = tabs[0].id) => ({
    tabs,
    activeTabId,
    customDefinitions,
  });

  it("remplace l'onglet actif s'il est vide", () => {
    const s = state([tab('t1')]);
    const res = mergeImportedTab(s, tab('imp', [comp('x', 'AND')]), {}, 10);
    expect(res.state.tabs.map((t) => t.id)).toEqual(['imp']);
    expect(res.state.activeTabId).toBe('imp');
    expect(res.replacedTabId).toBe('t1');
  });

  it("ajoute un onglet si l'actif contient du travail", () => {
    const s = state([tab('t1', [comp('a', 'OR')])]);
    const res = mergeImportedTab(s, tab('imp'), {}, 10);
    expect(res.state.tabs.map((t) => t.id)).toEqual(['t1', 'imp']);
    expect(res.state.activeTabId).toBe('imp');
    expect(res.replacedTabId).toBeNull();
  });

  it("refuse au-delà du nombre maximal d'onglets", () => {
    const s = state([tab('t1', [comp('a', 'OR')]), tab('t2', [comp('b', 'OR')])]);
    expect(mergeImportedTab(s, tab('imp'), {}, 2)).toHaveProperty('error');
  });

  it('ajoute les nouvelles définitions et partage les identiques', () => {
    const HA = def('HA', ['AND', 'XOR']);
    const s = state([tab('t1')], { HA });
    const imported = { HA: def('HA', ['AND', 'XOR']), NEW: def('NEW', ['NOT']) };
    const res = mergeImportedTab(s, tab('imp', [comp('x', 'HA')]), imported, 10);
    expect(res.renamed).toEqual({});
    expect(Object.keys(res.state.customDefinitions).sort()).toEqual(['HA', 'NEW']);
    expect(res.state.customDefinitions.HA).toBe(HA);
  });

  it("renomme une définition en conflit sans toucher à celle de l'enseignant", () => {
    const mine = def('HA', ['AND', 'XOR']);
    const s = state([tab('t1', [comp('a', 'HA')])], { HA: mine });
    const theirs = def('HA', ['NAND']);
    const res = mergeImportedTab(s, tab('imp', [comp('x', 'HA')]), { HA: theirs }, 10);
    expect(res.renamed).toEqual({ HA: 'HA (2)' });
    expect(res.state.customDefinitions.HA).toBe(mine);
    expect(res.state.customDefinitions['HA (2)'].name).toBe('HA (2)');
    expect(res.state.customDefinitions['HA (2)'].circuit.components[0].type).toBe('NAND');
    const imported = res.state.tabs.find((t) => t.id === 'imp');
    expect(imported.components[0].type).toBe('HA (2)');
    // L'onglet de l'enseignant n'est pas touché.
    expect(res.state.tabs[0].components[0].type).toBe('HA');
  });

  it('propage le renommage aux définitions qui utilisent une définition renommée', () => {
    const s = state([tab('t1')], { HA: def('HA', ['AND']), FA: def('FA', ['HA', 'OR']) });
    const imported = { HA: def('HA', ['NAND']), FA: def('FA', ['HA', 'OR']) };
    const res = mergeImportedTab(s, tab('imp', [comp('x', 'FA')]), imported, 10);
    expect(res.renamed).toEqual({ HA: 'HA (2)', FA: 'FA (2)' });
    const fa2 = res.state.customDefinitions['FA (2)'];
    expect(fa2.circuit.components.map((c) => c.type)).toEqual(['HA (2)', 'OR']);
    expect(res.state.tabs[0].components[0].type).toBe('FA (2)');
  });

  it('choisit un nom libre si « Nom (2) » est déjà pris', () => {
    const s = state([tab('t1')], { HA: def('HA', ['AND']), 'HA (2)': def('HA (2)', ['OR']) });
    const res = mergeImportedTab(s, tab('imp'), { HA: def('HA', ['NAND']) }, 10);
    expect(res.renamed).toEqual({ HA: 'HA (3)' });
  });
});
