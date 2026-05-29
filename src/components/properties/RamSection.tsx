import { asInt, maskTo, portKey } from '../../lib/sim';
import { BusWidthControl } from '../BusWidthControl';
import type { CircuitComponent, SimResult } from '../../domain/types';
import type { ComponentPatch } from '../PropertiesPanel';

interface Props {
  comp: CircuitComponent;
  onUpdate: (id: string, patch: ComponentPatch) => void;
  sim: SimResult;
}

// Section Propriétés de la RAM : largeurs adresse/mot, effacement, éditeur de cellules.
export function RamSection({ comp, onUpdate, sim }: Props) {
  const id = comp.id;
  const aw = comp.state?.addrWidth ?? 3;
  const dw = comp.state?.dataWidth ?? 4;
  const depth = 1 << aw;
  const mem = Array.isArray(comp.state?.mem) ? comp.state.mem : [];
  const memArr: number[] = [];
  for (let i = 0; i < depth; i++) memArr.push(maskTo(dw, asInt(mem[i] ?? 0)));
  const addrHexLen = Math.max(1, Math.ceil(aw / 4));
  // Adresse courante lue par la RAM (peut être indéfinie si ADDR non câblé : alors 0)
  const liveAddr = maskTo(aw, asInt(sim?.inputValues?.get(portKey(comp.id, 'ADDR')) ?? 0));

  const resizeMem = (newAw: number, newDw: number) => {
    const newDepth = 1 << newAw;
    const next = new Array(newDepth);
    for (let i = 0; i < newDepth; i++) next[i] = maskTo(newDw, asInt(memArr[i] ?? 0));
    return next;
  };

  const setBit = (addr: number, bitIdx: number) => {
    const next = memArr.slice();
    const cur = next[addr];
    next[addr] = maskTo(dw, cur ^ (1 << bitIdx));
    onUpdate(id, { state: { ...(comp.state ?? {}), mem: next } });
  };

  const clearMem = () => {
    onUpdate(id, { state: { ...(comp.state ?? {}), mem: new Array(depth).fill(0) } });
  };

  return (
    <div className="pt-2 border-t border-stone-200 space-y-2">
      <div className="text-[11px] text-stone-500 leading-snug">
        Mémoire{' '}
        <strong>
          {depth}×{dw} bits
        </strong>
        . Lecture continue : DATA_OUT suit mem[ADDR]. Écriture sur <strong>front montant</strong> de
        CLK si WE = 1 : mem[ADDR] ← DATA_IN.
      </div>
      <div>
        <label className="text-stone-500 block mb-1">Bits d'adresse</label>
        <select
          value={aw}
          onChange={(e) => {
            const newAw = Number(e.target.value);
            onUpdate(id, {
              state: {
                ...(comp.state ?? {}),
                addrWidth: newAw,
                mem: resizeMem(newAw, dw),
              },
              _dropMismatchedWires: true,
            });
          }}
          className="w-full px-2 py-1 border border-stone-300 rounded font-mono text-sm bg-white"
        >
          {[1, 2, 3, 4, 5, 6, 7, 8].map((a) => (
            <option key={a} value={a}>
              {a} bit{a > 1 ? 's' : ''} → {1 << a} cases
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="text-stone-500 block mb-1">Largeur des mots (bits)</label>
        <BusWidthControl
          value={dw}
          min={1}
          max={16}
          onChange={(newDw) => {
            onUpdate(id, {
              state: {
                ...(comp.state ?? {}),
                dataWidth: newDw,
                mem: resizeMem(aw, newDw),
              },
              _dropMismatchedWires: true,
            });
          }}
        />
      </div>
      <button
        onClick={clearMem}
        className="w-full text-xs px-2 py-1 rounded border border-stone-300 bg-white text-stone-700 hover:bg-stone-50"
      >
        Effacer la mémoire
      </button>
      <div>
        <div className="text-stone-500 text-xs mb-1">
          Contenu (clic = bascule du bit, MSB à gauche)
        </div>
        <div className="border border-stone-200 rounded bg-stone-50 max-h-64 overflow-y-auto">
          <table className="w-full text-[11px] font-mono">
            <tbody>
              {memArr.map((word, addr) => {
                const isLive = addr === liveAddr;
                return (
                  <tr key={addr} className={isLive ? 'bg-amber-100' : ''}>
                    <td
                      className="px-1 py-0.5 text-stone-500 text-right align-middle"
                      style={{ width: '3em' }}
                    >
                      0x{addr.toString(16).toUpperCase().padStart(addrHexLen, '0')}
                    </td>
                    <td className="py-0.5 align-middle">
                      <div className="flex gap-[1px] justify-end pr-1">
                        {Array.from({ length: dw }).map((_, i) => {
                          // i=0 = MSB (gauche), i=dw-1 = LSB (droite)
                          const bitIdx = dw - 1 - i;
                          const v = (word >> bitIdx) & 1;
                          return (
                            <button
                              key={i}
                              onClick={(e) => {
                                e.stopPropagation();
                                setBit(addr, bitIdx);
                              }}
                              className={`w-3.5 h-3.5 rounded-[2px] border ${
                                v
                                  ? 'bg-lime-500 border-lime-600 text-white'
                                  : 'bg-white border-stone-300 text-stone-400'
                              } flex items-center justify-center leading-none`}
                              style={{ fontSize: '8px' }}
                              title={`bit ${bitIdx}`}
                            >
                              {v}
                            </button>
                          );
                        })}
                      </div>
                    </td>
                    <td
                      className="px-1 py-0.5 text-stone-500 text-right align-middle"
                      style={{ width: '4em' }}
                    >
                      0x
                      {word
                        .toString(16)
                        .toUpperCase()
                        .padStart(Math.max(1, Math.ceil(dw / 4)), '0')}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="text-[10px] text-stone-400 mt-1 leading-snug">
          Ligne en ambre = adresse courante (ADDR).
        </p>
      </div>
    </div>
  );
}
