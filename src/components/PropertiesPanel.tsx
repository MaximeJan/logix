import { asInt, maskTo } from '../lib/sim';
import { getDef } from '../gates/registry';
import { BusWidthControl } from './BusWidthControl';
import { LedMatrixSection } from './properties/LedMatrixSection';
import { RamSection } from './properties/RamSection';
import type { Circuit, ComponentState, Orientation, SimResult } from '../domain/types';

export interface ComponentPatch {
  state?: ComponentState;
  label?: string;
  _dropMismatchedWires?: boolean;
}

interface PropertiesPanelProps {
  circuit: Circuit;
  selection: { components: string[]; wires: string[] };
  onUpdate: (id: string, patch: ComponentPatch) => void;
  sim: SimResult;
}

// Panneau Propriétés : édite le composant sélectionné (largeur de bus, orientation,
// mode, contenu RAM/LEDMATRIX…). Affiche un message pour les sélections multiples.
export function PropertiesPanel({ circuit, selection, onUpdate, sim }: PropertiesPanelProps) {
  if (selection.components.length === 1 && selection.wires.length === 0) {
    const id = selection.components[0];
    const comp = circuit.components.find((c) => c.id === id);
    if (!comp) return null;
    const def = getDef(comp.type, circuit.customDefinitions, comp);
    if (!def) {
      return (
        <div className="text-sm text-rose-600">
          Type inconnu : <code>{comp.type}</code>
        </div>
      );
    }

    const isBusCapable =
      comp.type === 'INPUT' ||
      comp.type === 'OUTPUT' ||
      comp.type === 'DFF' ||
      comp.type === 'REG' ||
      comp.type === 'COUNTER' ||
      comp.type === 'ADDER' ||
      comp.type === 'SPLITTER' ||
      comp.type === 'MERGER';
    const isMuxLike = comp.type === 'MUX' || comp.type === 'DEMUX';
    const isDecoder = comp.type === 'DECODER';
    const isBus = comp.type === 'BUS';
    const isSlice = comp.type === 'SLICE';
    const isDFF = comp.type === 'DFF';
    const isSRLatch = comp.type === 'SRLATCH';
    const isREG = comp.type === 'REG';
    const isCounter = comp.type === 'COUNTER';
    const isRAM = comp.type === 'RAM';
    const isSeg7 = comp.type === 'SEG7';
    const isLedMatrix = comp.type === 'LEDMATRIX';
    const isClock = comp.type === 'CLOCK';
    const currentWidth = comp.state?.width ?? def.defaultState?.width ?? 1;

    const orientation = comp.state?.orientation ?? 'right';
    const ORIENTATIONS: { key: Orientation; label: string; title: string }[] = [
      { key: 'right', label: '→', title: 'Sortie à droite (par défaut)' },
      { key: 'down', label: '↓', title: 'Sortie en bas' },
      { key: 'left', label: '←', title: 'Sortie à gauche' },
      { key: 'up', label: '↑', title: 'Sortie en haut' },
    ];

    return (
      <div className="space-y-3 text-sm">
        <div>
          <div className="text-stone-500 mb-1">Type</div>
          <div className="font-medium" style={{ fontFamily: "'IBM Plex Sans', sans-serif" }}>
            {def.label as string}
          </div>
          {def.isCustom && (
            <div className="text-xs text-stone-500 mt-0.5">Composant personnalisé</div>
          )}
        </div>

        <div>
          <label className="text-stone-500 block mb-1">Orientation</label>
          <div className="flex gap-1">
            {ORIENTATIONS.map((o) => (
              <button
                key={o.key}
                onClick={() =>
                  onUpdate(id, {
                    state: { ...(comp.state ?? {}), orientation: o.key },
                    _dropMismatchedWires: true,
                  })
                }
                title={o.title}
                className={`flex-1 px-2 py-1 text-base rounded border font-mono ${
                  orientation === o.key
                    ? 'bg-stone-800 text-white border-stone-800'
                    : 'bg-white text-stone-700 border-stone-300 hover:bg-stone-50'
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>
          <p className="text-[11px] text-stone-500 mt-1 leading-snug">
            La flèche indique la direction de la sortie.
          </p>
        </div>

        {(comp.type === 'INPUT' || comp.type === 'OUTPUT') && (
          <div>
            <label className="text-stone-500 block mb-1">Étiquette</label>
            <input
              type="text"
              value={comp.label ?? ''}
              onChange={(e) => onUpdate(id, { label: e.target.value })}
              maxLength={6}
              className="w-full px-2 py-1 border border-stone-300 rounded font-mono text-sm"
              placeholder={comp.type === 'INPUT' ? 'A' : 'S'}
            />
          </div>
        )}

        {isSeg7 && (
          <div className="pt-2 border-t border-stone-200 space-y-2">
            <div>
              <label className="text-stone-500 block mb-1">Mode d'entrée</label>
              <div className="flex gap-1">
                <button
                  onClick={() =>
                    onUpdate(id, {
                      state: { ...(comp.state ?? {}), mode: 'hex' },
                      _dropMismatchedWires: true,
                    })
                  }
                  className={`flex-1 px-2 py-1 text-xs rounded border ${
                    (comp.state?.mode ?? 'hex') === 'hex'
                      ? 'bg-stone-800 text-white border-stone-800'
                      : 'bg-white text-stone-700 border-stone-300 hover:bg-stone-50'
                  }`}
                >
                  Hex (4 bits)
                </button>
                <button
                  onClick={() =>
                    onUpdate(id, {
                      state: { ...(comp.state ?? {}), mode: 'raw' },
                      _dropMismatchedWires: true,
                    })
                  }
                  className={`flex-1 px-2 py-1 text-xs rounded border ${
                    (comp.state?.mode ?? 'hex') === 'raw'
                      ? 'bg-stone-800 text-white border-stone-800'
                      : 'bg-white text-stone-700 border-stone-300 hover:bg-stone-50'
                  }`}
                >
                  Brut (7 segments)
                </button>
              </div>
            </div>
            <p className="text-[11px] text-stone-500 leading-snug">
              {(comp.state?.mode ?? 'hex') === 'hex'
                ? "Une entrée bus 4 bits. L'afficheur décode 0–F automatiquement."
                : "Sept entrées 1-bit (a..g). À l'élève de construire son propre décodeur."}
            </p>
            <p className="text-[10px] text-stone-400 leading-snug">
              Couleurs configurables dans Apparence → Afficheur 7 segments.
            </p>
          </div>
        )}

        {isBusCapable && (
          <div className="pt-2 border-t border-stone-200">
            <label className="text-stone-500 block mb-1">Largeur (bits)</label>
            <BusWidthControl
              value={currentWidth}
              min={1}
              max={32}
              onChange={(newWidth) => {
                const newState = {
                  ...(comp.state ?? {}),
                  width: newWidth,
                };
                if (comp.type === 'INPUT') {
                  newState.value = maskTo(newWidth, asInt(comp.state?.value));
                }
                onUpdate(id, { state: newState, _dropMismatchedWires: true });
              }}
            />
            {(() => {
              const s = currentWidth > 1 ? 's' : '';
              const bits = `${currentWidth} bit${s}`;
              return (
                <p className="text-[11px] text-stone-500 mt-1 leading-snug">
                  {comp.type === 'INPUT'
                    ? `${currentWidth} cellule${s} cliquable${s} sur le composant — cliquer un bit pour le basculer.`
                    : comp.type === 'DFF'
                      ? `Bascule D ${bits} : Q capture D au front montant${currentWidth > 1 ? ' (se comporte comme un registre)' : ''}.`
                      : comp.type === 'REG'
                        ? `Registre ${bits} : Q ← D au front montant uniquement si LD = 1.`
                        : comp.type === 'COUNTER'
                          ? `Compteur ${bits} : Q ← Q+1 au front montant si EN = 1. Boucle à 0 après ${currentWidth >= 32 ? '2³²-1' : (1 << currentWidth) - 1}.`
                          : comp.type === 'ADDER'
                            ? `Additionneur ${bits} : S = A + B + Cin, Cout = retenue. Combinatoire (pas d'horloge).`
                            : comp.type === 'SPLITTER'
                              ? `Séparateur : éclate un bus de ${bits} en ${currentWidth} fil${s} 1-bit (b0 = poids faible).`
                              : comp.type === 'MERGER'
                                ? `Fusionneur : regroupe ${currentWidth} fil${s} 1-bit en un bus de ${bits} (b0 = poids faible).`
                                : currentWidth > 1
                                  ? `Bus de ${bits} dessiné en ${currentWidth} pistes parallèles.`
                                  : `Signal classique de 1 bit (ce n'est pas un bus).`}
                </p>
              );
            })()}
          </div>
        )}

        {isMuxLike && (
          <div className="pt-2 border-t border-stone-200 space-y-2">
            <div>
              <label className="text-stone-500 block mb-1">Bits de sélection</label>
              <select
                value={comp.state?.selectWidth ?? 1}
                onChange={(e) => {
                  const sw = Number(e.target.value);
                  onUpdate(id, {
                    state: { ...(comp.state ?? {}), selectWidth: sw },
                    _dropMismatchedWires: true,
                  });
                }}
                className="w-full px-2 py-1 border border-stone-300 rounded font-mono text-sm bg-white"
              >
                <option value={1}>1 bit → 2 voies</option>
                <option value={2}>2 bits → 4 voies</option>
                <option value={3}>3 bits → 8 voies</option>
              </select>
            </div>
            <div>
              <label className="text-stone-500 block mb-1">Largeur des données (bits)</label>
              <BusWidthControl
                value={comp.state?.dataWidth ?? 1}
                min={1}
                max={32}
                onChange={(dw) => {
                  onUpdate(id, {
                    state: { ...(comp.state ?? {}), dataWidth: dw },
                    _dropMismatchedWires: true,
                  });
                }}
              />
            </div>
            <p className="text-[11px] text-stone-500 leading-snug">
              {comp.type === 'MUX'
                ? "Choisit une voie d'entrée selon la valeur sur sel."
                : "Route l'entrée vers la voie sélectionnée par sel ; les autres sorties valent 0."}
            </p>
          </div>
        )}

        {isDecoder && (
          <div className="pt-2 border-t border-stone-200">
            <label className="text-stone-500 block mb-1">Largeur d'entrée</label>
            <select
              value={comp.state?.width ?? 2}
              onChange={(e) => {
                const w = Number(e.target.value);
                onUpdate(id, {
                  state: { ...(comp.state ?? {}), width: w },
                  _dropMismatchedWires: true,
                });
              }}
              className="w-full px-2 py-1 border border-stone-300 rounded font-mono text-sm bg-white"
            >
              {[1, 2, 3, 4].map((w) => (
                <option key={w} value={w}>
                  {w} bit{w > 1 ? 's' : ''} → {1 << w} sorties
                </option>
              ))}
            </select>
            <p className="text-[11px] text-stone-500 mt-1 leading-snug">
              Seule la sortie correspondant à la valeur d'entrée vaut 1, les autres 0.
            </p>
          </div>
        )}

        {isBus && (
          <div className="pt-2 border-t border-stone-200 space-y-2">
            <div>
              <label className="text-stone-500 block mb-1">Largeur du bus (bits)</label>
              <BusWidthControl
                value={comp.state?.width ?? 8}
                min={1}
                max={32}
                onChange={(w) => {
                  onUpdate(id, {
                    state: { ...(comp.state ?? {}), width: w },
                    _dropMismatchedWires: true,
                  });
                }}
              />
            </div>
            <div>
              <label className="text-stone-500 block mb-1">Nombre de sources</label>
              <select
                value={comp.state?.sources ?? 2}
                onChange={(e) => {
                  onUpdate(id, {
                    state: { ...(comp.state ?? {}), sources: Number(e.target.value) },
                    _dropMismatchedWires: true,
                  });
                }}
                className="w-full px-2 py-1 border border-stone-300 rounded font-mono text-sm bg-white"
              >
                {[2, 3, 4, 5, 6, 7, 8].map((n) => (
                  <option key={n} value={n}>
                    {n} sources
                  </option>
                ))}
              </select>
            </div>
            <p className="text-[11px] text-stone-500 leading-snug">
              Chaque source a une donnée <code>in</code> et une activation <code>en</code>. La
              sortie porte la source dont <code>en</code> = 1. <strong>Une seule</strong> à la fois
              : deux <code>en</code> = 1 → conflit (rouge).
            </p>
          </div>
        )}

        {isSlice &&
          (() => {
            const sw = Math.max(1, Math.min(32, comp.state?.width ?? 8));
            const lo = Math.max(0, Math.min(sw - 1, comp.state?.lo ?? 0));
            const hi = Math.max(lo, Math.min(sw - 1, comp.state?.hi ?? sw - 1));
            const numField = (label: string, value: number, onCommit: (v: number) => void) => (
              <div className="flex-1">
                <label className="text-stone-500 block mb-1">{label}</label>
                <input
                  type="number"
                  min={0}
                  max={sw - 1}
                  value={value}
                  onChange={(e) => onCommit(Math.floor(Number(e.target.value)))}
                  className="w-full px-2 py-1 border border-stone-300 rounded font-mono text-sm"
                />
              </div>
            );
            return (
              <div className="pt-2 border-t border-stone-200 space-y-2">
                <div>
                  <label className="text-stone-500 block mb-1">Largeur d'entrée (bits)</label>
                  <BusWidthControl
                    value={sw}
                    min={1}
                    max={32}
                    onChange={(w) =>
                      onUpdate(id, {
                        state: {
                          ...(comp.state ?? {}),
                          width: w,
                          lo: Math.min(lo, w - 1),
                          hi: Math.min(hi, w - 1),
                        },
                        _dropMismatchedWires: true,
                      })
                    }
                  />
                </div>
                <div className="flex gap-2">
                  {numField('Bit haut', hi, (v) =>
                    onUpdate(id, {
                      state: { ...(comp.state ?? {}), hi: Math.max(lo, Math.min(sw - 1, v)) },
                      _dropMismatchedWires: true,
                    }),
                  )}
                  {numField('Bit bas', lo, (v) =>
                    onUpdate(id, {
                      state: { ...(comp.state ?? {}), lo: Math.max(0, Math.min(hi, v)) },
                      _dropMismatchedWires: true,
                    }),
                  )}
                </div>
                <p className="text-[11px] text-stone-500 leading-snug">
                  Extrait les bits{' '}
                  <code>
                    [{hi}:{lo}]
                  </code>{' '}
                  → sortie de{' '}
                  <strong>
                    {hi - lo + 1} bit{hi - lo + 1 > 1 ? 's' : ''}
                  </strong>
                  . Ex. décoder une instruction : opcode <code>[7:4]</code>, Rd <code>[3:2]</code>,
                  Rs <code>[1:0]</code>.
                </p>
              </div>
            );
          })()}

        {isSRLatch && (
          <div className="pt-2 border-t border-stone-200 space-y-2">
            <div className="text-[11px] text-stone-500 leading-snug">
              Latch SR : mémoire <strong>asynchrone</strong>. S = 1 met Q à 1, R = 1 met Q à 0, S =
              R = 0 conserve Q. Si S et R valent 1 simultanément, R l'emporte (Q = 0).
            </div>
            <div className="flex items-center justify-between">
              <span className="text-stone-500 text-xs">État Q actuel</span>
              <code className="text-xs font-mono px-2 py-0.5 bg-stone-100 rounded">
                {String(asInt(comp.state?.q) & 1)}
              </code>
            </div>
            <button
              onClick={() => onUpdate(id, { state: { ...(comp.state ?? {}), q: 0 } })}
              className="w-full text-xs px-2 py-1 rounded border border-stone-300 bg-white text-stone-700 hover:bg-stone-50"
            >
              Forcer Q ← 0
            </button>
          </div>
        )}

        {isDFF && (
          <div className="pt-2 border-t border-stone-200 space-y-2">
            <div className="text-[11px] text-stone-500 leading-snug">
              Bascule D déclenchée sur <strong>front montant</strong> de CLK. RST = 1 force Q à 0
              immédiatement (asynchrone).
              {currentWidth > 1 &&
                ' Avec une largeur > 1 bit, cette bascule se comporte comme un registre.'}
            </div>
            <div className="flex items-center justify-between">
              <span className="text-stone-500 text-xs">État Q actuel</span>
              <code className="text-xs font-mono px-2 py-0.5 bg-stone-100 rounded">
                {currentWidth === 1
                  ? String(asInt(comp.state?.q) & 1)
                  : maskTo(currentWidth, asInt(comp.state?.q))
                      .toString(2)
                      .padStart(currentWidth, '0')}
              </code>
            </div>
            <button
              onClick={() =>
                onUpdate(id, { state: { ...(comp.state ?? {}), q: 0, lastTriggerAt: Date.now() } })
              }
              className="w-full text-xs px-2 py-1 rounded border border-stone-300 bg-white text-stone-700 hover:bg-stone-50"
            >
              Forcer Q ← 0
            </button>
          </div>
        )}

        {isREG && (
          <div className="pt-2 border-t border-stone-200 space-y-2">
            <div className="text-[11px] text-stone-500 leading-snug">
              Registre {currentWidth}-bit déclenché sur <strong>front montant</strong> de CLK.
              Capture D dans Q uniquement si <strong>LD = 1</strong>, sinon conserve Q (hold).
            </div>
            <div className="flex items-center justify-between">
              <span className="text-stone-500 text-xs">État Q actuel</span>
              <code className="text-xs font-mono px-2 py-0.5 bg-stone-100 rounded">
                {currentWidth === 1
                  ? String(asInt(comp.state?.q) & 1)
                  : maskTo(currentWidth, asInt(comp.state?.q))
                      .toString(2)
                      .padStart(currentWidth, '0')}
              </code>
            </div>
            <button
              onClick={() => onUpdate(id, { state: { ...(comp.state ?? {}), q: 0 } })}
              className="w-full text-xs px-2 py-1 rounded border border-stone-300 bg-white text-stone-700 hover:bg-stone-50"
            >
              Forcer Q ← 0
            </button>
          </div>
        )}

        {isCounter && (
          <div className="pt-2 border-t border-stone-200 space-y-2">
            <div className="text-[11px] text-stone-500 leading-snug">
              Compteur {currentWidth}-bit. Sur <strong>front montant</strong> de CLK, Q est
              incrémenté de 1 si <strong>EN = 1</strong>, sinon conservé. Le compteur boucle
              naturellement de {currentWidth >= 32 ? '2³²-1' : (1 << currentWidth) - 1} à 0. RST = 1
              force Q à 0 (asynchrone).
            </div>
            <div className="flex items-center justify-between">
              <span className="text-stone-500 text-xs">État Q actuel</span>
              <code className="text-xs font-mono px-2 py-0.5 bg-stone-100 rounded">
                {currentWidth === 1
                  ? String(asInt(comp.state?.q) & 1)
                  : `${maskTo(currentWidth, asInt(comp.state?.q))} (${maskTo(currentWidth, asInt(comp.state?.q)).toString(2).padStart(currentWidth, '0')})`}
              </code>
            </div>
            <button
              onClick={() => onUpdate(id, { state: { ...(comp.state ?? {}), q: 0 } })}
              className="w-full text-xs px-2 py-1 rounded border border-stone-300 bg-white text-stone-700 hover:bg-stone-50"
            >
              Forcer Q ← 0
            </button>
          </div>
        )}

        {isLedMatrix && <LedMatrixSection comp={comp} onUpdate={onUpdate} />}

        {isRAM && <RamSection comp={comp} onUpdate={onUpdate} sim={sim} />}

        {isClock && (
          <div className="pt-2 border-t border-stone-200 space-y-2">
            <div>
              <label className="text-stone-500 block mb-1">Mode</label>
              <div className="flex gap-1">
                <button
                  onClick={() =>
                    onUpdate(id, {
                      state: { ...(comp.state ?? {}), running: false },
                    })
                  }
                  className={`flex-1 px-2 py-1 text-xs rounded border ${
                    !comp.state?.running
                      ? 'bg-stone-800 text-white border-stone-800'
                      : 'bg-white text-stone-700 border-stone-300 hover:bg-stone-50'
                  }`}
                >
                  Manuel (clic ou Tick)
                </button>
                <button
                  onClick={() =>
                    onUpdate(id, {
                      state: { ...(comp.state ?? {}), running: true, lastToggleAt: Date.now() },
                    })
                  }
                  className={`flex-1 px-2 py-1 text-xs rounded border ${
                    comp.state?.running
                      ? 'bg-rose-600 text-white border-rose-600'
                      : 'bg-white text-stone-700 border-stone-300 hover:bg-stone-50'
                  }`}
                >
                  ▶ Auto
                </button>
              </div>
            </div>
            {comp.state?.running && (
              <div>
                <label className="text-stone-500 block mb-1">Fréquence (Hz)</label>
                <select
                  value={comp.state?.freq ?? 1}
                  onChange={(e) =>
                    onUpdate(id, {
                      state: {
                        ...(comp.state ?? {}),
                        freq: Number(e.target.value),
                        lastToggleAt: Date.now(),
                      },
                    })
                  }
                  className="w-full px-2 py-1 border border-stone-300 rounded font-mono text-sm bg-white"
                >
                  <option value={0.5}>0,5 Hz (1 cycle / 2 s)</option>
                  <option value={1}>1 Hz</option>
                  <option value={2}>2 Hz</option>
                  <option value={5}>5 Hz</option>
                  <option value={10}>10 Hz</option>
                </select>
              </div>
            )}
            <p className="text-[11px] text-stone-500 leading-snug">
              {comp.state?.running
                ? `Auto-bascule à ${comp.state?.freq ?? 1} cycles/s.`
                : 'Clic sur le composant ou bouton « Tick » pour basculer.'}
            </p>
          </div>
        )}

        <div className="text-xs text-stone-500 pt-2 border-t border-stone-200">
          Position : ({comp.x}, {comp.y})<br />
          ID : <code className="text-[10px]">{comp.id}</code>
        </div>
      </div>
    );
  }
  if (selection.components.length + selection.wires.length > 1) {
    return (
      <div className="text-sm text-stone-500">
        {selection.components.length} composant(s), {selection.wires.length} fil(s) sélectionné(s).
      </div>
    );
  }
  return (
    <div className="text-sm text-stone-500 italic">
      Sélectionnez un élément pour voir ses propriétés.
    </div>
  );
}
