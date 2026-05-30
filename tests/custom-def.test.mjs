import { describe, it, expect } from 'vitest';
import { buildCustomDefData } from '../src/lib/custom-def';

describe('buildCustomDefData', () => {
  const sourceComps = [
    { id: 'i1', type: 'INPUT', x: 0, y: 0, state: { width: 4 } },
    { id: 'i2', type: 'INPUT', x: 0, y: 0, state: { width: 1 } },
    { id: 'o1', type: 'OUTPUT', x: 0, y: 0, state: { width: 4 } },
    { id: 'g', type: 'AND', x: 0, y: 0 },
  ];
  const internalWires = [
    { id: 'w', from: { componentId: 'i1', port: 'out' }, to: { componentId: 'g', port: 'in0' } },
  ];

  it('reprend la largeur du composant interne pour chaque port', () => {
    const def = buildCustomDefData(
      'Foo',
      [{ id: 'i1', name: 'a' }, { id: 'i2', name: 'b' }],
      [{ id: 'o1', name: 'y' }],
      sourceComps,
      internalWires,
    );
    expect(def.name).toBe('Foo');
    expect(def.inputs).toEqual([
      { name: 'a', internalId: 'i1', width: 4 },
      { name: 'b', internalId: 'i2', width: 1 },
    ]);
    expect(def.outputs).toEqual([{ name: 'y', internalId: 'o1', width: 4 }]);
  });

  it('ignore les ports dont l’internalId n’existe plus', () => {
    const def = buildCustomDefData(
      'Foo',
      [{ id: 'i1', name: 'a' }, { id: 'ghost', name: 'z' }],
      [],
      sourceComps,
      [],
    );
    expect(def.inputs.map((p) => p.internalId)).toEqual(['i1']);
  });

  it('clone composants et fils (pas de partage de référence)', () => {
    const def = buildCustomDefData('Foo', [{ id: 'i1', name: 'a' }], [], sourceComps, internalWires);
    expect(def.circuit.components[0]).not.toBe(sourceComps[0]);
    expect(def.circuit.wires[0]).not.toBe(internalWires[0]);
    expect(def.circuit.wires[0].from).not.toBe(internalWires[0].from);
    // mais le contenu est identique
    expect(def.circuit.wires[0]).toEqual(internalWires[0]);
  });

  it('trim les noms de ports', () => {
    const def = buildCustomDefData('Foo', [{ id: 'i1', name: '  a  ' }], [], sourceComps, []);
    expect(def.inputs[0].name).toBe('a');
  });
});
