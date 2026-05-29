import { asInt, portKey } from '../lib/sim';
import { simulate } from '../gates/registry';
import type { Circuit } from '../domain/types';

// Table de vérité automatique pour les entrées/sorties 1-bit du circuit.
export function TruthTablePanel({ circuit }: { circuit: Circuit }) {
  const allInputs = circuit.components.filter((c) => c.type === 'INPUT');
  const allOutputs = circuit.components.filter((c) => c.type === 'OUTPUT');
  const inputs = allInputs.filter((c) => (c.state?.width ?? 1) === 1);
  const outputs = allOutputs.filter((c) => (c.state?.width ?? 1) === 1);
  const hasBusEntries = allInputs.length !== inputs.length || allOutputs.length !== outputs.length;

  if (inputs.length === 0 || outputs.length === 0) {
    return (
      <div className="text-sm text-stone-500 italic">
        {hasBusEntries
          ? "Ce circuit utilise des entrées/sorties en mode bus. La table de vérité n'est calculée que pour les entrées/sorties 1-bit."
          : 'Ajoutez au moins une entrée et une sortie 1-bit pour générer la table de vérité.'}
      </div>
    );
  }
  if (inputs.length > 12) {
    return (
      <div className="text-sm text-stone-500 italic">
        Trop d'entrées ({inputs.length}) — limite à 12 pour afficher la table.
      </div>
    );
  }

  const rows: { i: number; inputs: number[]; outputs: number[] }[] = [];
  const n = inputs.length;
  for (let i = 0; i < 1 << n; i++) {
    const overlay: Circuit = { ...circuit };
    overlay.components = circuit.components.map((c) => {
      const idx = inputs.findIndex((inp) => inp.id === c.id);
      if (idx < 0) return c;
      const bit = (i >> (n - 1 - idx)) & 1;
      return { ...c, state: { ...c.state, value: bit } };
    });
    const { inputValues } = simulate(overlay);
    rows.push({
      i,
      inputs: inputs.map((_, idx) => (i >> (n - 1 - idx)) & 1),
      outputs: outputs.map((o) => (asInt(inputValues.get(portKey(o.id, 'in0'))) ? 1 : 0)),
    });
  }

  return (
    <div className="overflow-auto max-h-80">
      {hasBusEntries && (
        <div className="text-[11px] text-stone-500 italic mb-2 leading-snug">
          Bus ignorés : la table n'inclut que les entrées/sorties 1-bit.
        </div>
      )}
      <table className="text-sm w-full" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>
        <thead>
          <tr className="border-b border-stone-300">
            {inputs.map((c, idx) => (
              <th key={c.id} className="px-2 py-1 text-stone-600 font-medium">
                {c.label || `E${idx}`}
              </th>
            ))}
            <th className="px-2 border-l border-stone-300"></th>
            {outputs.map((c, idx) => (
              <th key={c.id} className="px-2 py-1 text-stone-600 font-medium">
                {c.label || `S${idx}`}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.i} className="border-b border-stone-100 hover:bg-stone-50">
              {r.inputs.map((b, idx) => (
                <td
                  key={idx}
                  className={`px-2 py-1 text-center ${b ? 'text-lime-700 font-semibold' : 'text-stone-400'}`}
                >
                  {b}
                </td>
              ))}
              <td className="border-l border-stone-300"></td>
              {r.outputs.map((b, idx) => (
                <td
                  key={idx}
                  className={`px-2 py-1 text-center ${b ? 'text-orange-700 font-semibold' : 'text-stone-400'}`}
                >
                  {b}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
