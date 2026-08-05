import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Link2, Check, Plus, Trash2, Wand2, Copy } from 'lucide-react';
import { GATES } from '../gates';
import { PALETTE_ORDER } from '../lib/constants';
import { buildExerciseUrl } from '../lib/exercise-url';
import { BusWidthControl } from './BusWidthControl';
import type { Exercise, ExercisePort, IoRow } from '../domain/exercise';
import type { Circuit } from '../domain/types';

const MONO = { fontFamily: "'IBM Plex Mono', monospace" } as const;

// Au-delà, la génération automatique des 2^n lignes devient ingérable : on
// bascule sur une saisie ligne par ligne.
const MAX_AUTO_BITS = 8;

// Hauteur de l'iframe proposée dans l'extrait à coller (en pixels).
const IFRAME_H_DEFAULT = 700;
const IFRAME_H_MIN = 200;
const IFRAME_H_MAX = 2000;

/** Mode de vérification choisi par l'enseignant. */
type VerifyKind = 'tt' | 'seq' | 'none';

interface ExerciseBuilderModalProps {
  /** Circuit de l'onglet actif — sert au remplissage automatique des sorties. */
  circuit: Circuit;
  /** Simule le circuit sur les lignes du brouillon et renvoie les sorties obtenues. */
  computeOutputs: (draft: Exercise) => { rows: number[][] } | { error: string };
  onClose: () => void;
}

interface Draft {
  title: string;
  objective: string;
  stepsText: string;
  allowedTypes: string[];
  inputs: ExercisePort[];
  outputs: ExercisePort[];
  verifyKind: VerifyKind;
  rows: IoRow[];
}

const EMPTY: Draft = {
  title: '',
  objective: '',
  stepsText: '',
  allowedTypes: ['INPUT', 'OUTPUT'],
  inputs: [{ name: 'A', width: 1 }],
  outputs: [{ name: 'S', width: 1 }],
  verifyKind: 'tt',
  rows: [],
};

// Modale de création d'exercice : l'enseignant compose un énoncé, éventuellement
// une table de vérité (ou une séquence), et récupère le lien partageable — tout
// l'exercice tient dans l'URL, aucun backend n'est nécessaire.
export function ExerciseBuilderModal({
  circuit,
  computeOutputs,
  onClose,
}: ExerciseBuilderModalProps) {
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [fillError, setFillError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  // Saisie libre pendant la frappe, bornée à la lecture (et normalisée au blur).
  const [heightText, setHeightText] = useState(String(IFRAME_H_DEFAULT));
  const iframeHeight = useMemo(() => {
    const n = Math.floor(Number(heightText));
    if (!Number.isFinite(n) || n <= 0) return IFRAME_H_DEFAULT;
    return Math.min(IFRAME_H_MAX, Math.max(IFRAME_H_MIN, n));
  }, [heightText]);

  const patch = (p: Partial<Draft>) => setDraft((d) => ({ ...d, ...p }));

  const noVerify = draft.verifyKind === 'none';
  const totalInBits = draft.inputs.reduce((s, p) => s + p.width, 0);
  const canAutoGenerate =
    draft.verifyKind === 'tt' && totalInBits > 0 && totalInBits <= MAX_AUTO_BITS;

  const exercise = useMemo<Exercise | null>(() => {
    const title = draft.title.trim();
    if (!title) return null;
    // Sans vérification, ni ports ni lignes ne sont obligatoires.
    if (
      !noVerify &&
      (draft.inputs.length === 0 || draft.outputs.length === 0 || draft.rows.length === 0)
    ) {
      return null;
    }
    const steps = draft.stepsText
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);
    return {
      title,
      objective: draft.objective.trim(),
      steps,
      allowedTypes: draft.allowedTypes,
      inputs: draft.inputs,
      outputs: draft.outputs,
      verify: noVerify
        ? { type: 'none' }
        : draft.verifyKind === 'seq'
          ? { type: 'sequence', steps: draft.rows }
          : { type: 'truthtable' },
      ...(draft.verifyKind === 'tt' ? { truthTable: draft.rows } : {}),
    };
  }, [draft, noVerify]);

  const urls = useMemo(() => {
    if (!exercise) return null;
    const plain = buildExerciseUrl(exercise);
    const embedded = buildExerciseUrl(exercise, { embed: true });
    return {
      plain,
      iframe: `<iframe src="${embedded}" width="100%" height="${iframeHeight}" style="border:0"></iframe>`,
    };
  }, [exercise, iframeHeight]);

  // -------- édition des ports --------
  const setPort = (kind: 'inputs' | 'outputs', i: number, p: Partial<ExercisePort>) =>
    setDraft((d) => {
      const list = d[kind].slice();
      list[i] = { ...list[i], ...p };
      return { ...d, [kind]: list, rows: [] };
    });

  const addPort = (kind: 'inputs' | 'outputs') =>
    setDraft((d) => ({
      ...d,
      [kind]: [
        ...d[kind],
        { name: kind === 'inputs' ? nextName(d.inputs) : nextName(d.outputs, 'S'), width: 1 },
      ],
      rows: [],
    }));

  const removePort = (kind: 'inputs' | 'outputs', i: number) =>
    setDraft((d) => ({ ...d, [kind]: d[kind].filter((_, j) => j !== i), rows: [] }));

  // -------- édition des lignes --------
  const generateRows = () =>
    setDraft((d) => {
      const combos = 1 << totalInBits;
      const rows: IoRow[] = [];
      for (let n = 0; n < combos; n++) {
        // On répartit les bits de n sur les entrées, la 1re entrée en tête.
        let rest = n;
        const inVals: number[] = [];
        for (let k = d.inputs.length - 1; k >= 0; k--) {
          const w = d.inputs[k].width;
          inVals[k] = rest & ((1 << w) - 1);
          rest >>>= w;
        }
        rows.push([inVals, d.outputs.map(() => 0)]);
      }
      return { ...d, rows };
    });

  const addRow = () =>
    setDraft((d) => ({
      ...d,
      rows: [...d.rows, [d.inputs.map(() => 0), d.outputs.map(() => 0)]],
    }));

  const setCell = (rowIdx: number, side: 0 | 1, colIdx: number, value: number) =>
    setDraft((d) => {
      const rows = d.rows.map((r): IoRow => [r[0].slice(), r[1].slice()]);
      rows[rowIdx][side][colIdx] = value;
      return { ...d, rows };
    });

  const fillFromCircuit = () => {
    setFillError(null);
    if (!exercise) {
      setFillError('Complète le titre, les ports et les lignes avant de remplir.');
      return;
    }
    const res = computeOutputs(exercise);
    if ('error' in res) {
      setFillError(res.error);
      return;
    }
    setDraft((d) => ({
      ...d,
      rows: d.rows.map((r, i): IoRow => [r[0], res.rows[i] ?? r[1]]),
    }));
  };

  const copy = async (text: string, tag: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(tag);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      setFillError('Copie impossible — sélectionne le texte et copie-le à la main.');
    }
  };

  return (
    <div
      className="absolute inset-0 bg-black/40 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-xl w-[760px] max-h-[88vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-stone-200 flex items-center gap-2">
          <Link2 size={18} className="text-blue-600" />
          <h2 className="text-base font-medium">Créer un exercice partageable</h2>
        </div>

        <div className="px-5 py-4 space-y-5">
          {/* ---- Énoncé ---- */}
          <div className="space-y-3">
            <Field label="Titre">
              <input
                type="text"
                value={draft.title}
                onChange={(e) => patch({ title: e.target.value })}
                placeholder="ex. NOT avec un NAND"
                autoFocus
                className="w-full px-3 py-1.5 border border-stone-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
              />
            </Field>
            <Field label="Objectif (une phrase)">
              <textarea
                value={draft.objective}
                onChange={(e) => patch({ objective: e.target.value })}
                rows={2}
                placeholder="Fabriquer une porte NOT en n'utilisant qu'un seul NAND."
                className="w-full px-3 py-1.5 border border-stone-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
              />
            </Field>
            <Field label="Étapes — une par ligne (facultatif)">
              <textarea
                value={draft.stepsText}
                onChange={(e) => patch({ stepsText: e.target.value })}
                rows={4}
                placeholder={'Place une Entrée et renomme-la « A ».\nPlace une porte NAND.'}
                className="w-full px-3 py-1.5 border border-stone-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
              />
            </Field>
          </div>

          {/* ---- Composants autorisés ---- */}
          <Field label="Composants proposés à l'élève">
            <div className="grid grid-cols-4 gap-x-3 gap-y-1">
              {PALETTE_ORDER.map((t) => {
                const locked = t === 'INPUT' || t === 'OUTPUT';
                const checked = draft.allowedTypes.includes(t);
                return (
                  <label key={t} className="flex items-center gap-1.5 text-xs text-stone-700">
                    <input
                      type="checkbox"
                      checked={checked || locked}
                      disabled={locked}
                      onChange={(e) =>
                        patch({
                          allowedTypes: e.target.checked
                            ? PALETTE_ORDER.filter((x) => x === t || draft.allowedTypes.includes(x))
                            : draft.allowedTypes.filter((x) => x !== t),
                        })
                      }
                    />
                    {GATES[t]?.label ?? t}
                  </label>
                );
              })}
            </div>
          </Field>

          {/* ---- Ports ---- */}
          <div className="grid grid-cols-2 gap-4">
            <PortList
              title="Entrées"
              ports={draft.inputs}
              onChange={(i, p) => setPort('inputs', i, p)}
              onAdd={() => addPort('inputs')}
              onRemove={(i) => removePort('inputs', i)}
            />
            <PortList
              title="Sorties"
              ports={draft.outputs}
              onChange={(i, p) => setPort('outputs', i, p)}
              onAdd={() => addPort('outputs')}
              onRemove={(i) => removePort('outputs', i)}
            />
          </div>
          <div className="text-[11px] text-stone-500 -mt-3">
            {noVerify ? (
              <>
                Sans vérification, les ports ne servent que d'indication dans la consigne.
                Retire-les tous si tu n'en veux aucune.
              </>
            ) : (
              <>
                La vérification apparie les Entrée/Sortie de l'élève{' '}
                <strong>par ordre de création</strong>, pas par étiquette : précise cet ordre dans
                les étapes.
              </>
            )}
          </div>

          {/* ---- Vérification ---- */}
          <Field label="Vérification">
            <div className="flex flex-wrap items-center gap-4 text-xs text-stone-700 mb-2">
              <label className="flex items-center gap-1.5">
                <input
                  type="radio"
                  checked={draft.verifyKind === 'tt'}
                  onChange={() => patch({ verifyKind: 'tt', rows: [] })}
                />
                Table de vérité (circuit combinatoire)
              </label>
              <label className="flex items-center gap-1.5">
                <input
                  type="radio"
                  checked={draft.verifyKind === 'seq'}
                  onChange={() => patch({ verifyKind: 'seq', rows: [] })}
                />
                Séquence (circuit séquentiel, un tick par ligne)
              </label>
              <label className="flex items-center gap-1.5">
                <input
                  type="radio"
                  checked={noVerify}
                  onChange={() => patch({ verifyKind: 'none', rows: [] })}
                />
                Aucune vérification
              </label>
            </div>

            {noVerify ? (
              <div className="text-[11px] text-stone-500">
                L'élève reçoit l'énoncé et les composants, sans bouton « Vérifier ». Utile pour une
                exploration libre ou un exercice corrigé en classe.
              </div>
            ) : (
              <>
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  {canAutoGenerate && (
                    <button
                      onClick={generateRows}
                      className="px-2.5 py-1 rounded border border-stone-300 text-xs font-medium text-stone-700 hover:bg-stone-50 flex items-center gap-1.5"
                    >
                      <Wand2 size={12} />
                      Générer les {1 << totalInBits} combinaisons
                    </button>
                  )}
                  <button
                    onClick={addRow}
                    className="px-2.5 py-1 rounded border border-stone-300 text-xs font-medium text-stone-700 hover:bg-stone-50 flex items-center gap-1.5"
                  >
                    <Plus size={12} />
                    Ajouter une ligne
                  </button>
                  <button
                    onClick={fillFromCircuit}
                    disabled={draft.rows.length === 0 || circuit.components.length === 0}
                    className="px-2.5 py-1 rounded border border-stone-300 text-xs font-medium text-stone-700 hover:bg-stone-50 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
                    title="Simule le circuit de l'onglet courant pour pré-remplir les sorties attendues"
                  >
                    <Wand2 size={12} />
                    Remplir les sorties depuis le circuit courant
                  </button>
                </div>

                {draft.verifyKind === 'tt' && !canAutoGenerate && totalInBits > MAX_AUTO_BITS && (
                  <div className="text-[11px] text-amber-700 mb-2">
                    {totalInBits} bits d'entrée : trop de combinaisons pour une table complète.
                    Ajoute les lignes qui t'intéressent à la main.
                  </div>
                )}

                {draft.rows.length > 0 && (
                  <div className="border border-stone-200 rounded max-h-64 overflow-y-auto">
                    <table className="w-full text-xs border-collapse">
                      <thead className="bg-stone-100 sticky top-0">
                        <tr>
                          <th className="border border-stone-200 px-1 py-1 w-8"></th>
                          {draft.inputs.map((p, i) => (
                            <th
                              key={`i${i}`}
                              className="border border-stone-200 px-1 py-1 font-mono"
                            >
                              {p.name || `E${i + 1}`}
                            </th>
                          ))}
                          {draft.outputs.map((p, i) => (
                            <th
                              key={`o${i}`}
                              className="border border-stone-200 px-1 py-1 font-mono bg-blue-50"
                            >
                              {p.name || `S${i + 1}`}
                            </th>
                          ))}
                          <th className="border border-stone-200 px-1 py-1 w-8"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {draft.rows.map((row, ri) => (
                          <tr key={ri}>
                            <td className="border border-stone-200 px-1 py-0.5 text-stone-400 text-center">
                              {ri + 1}
                            </td>
                            {draft.inputs.map((p, ci) => (
                              <Cell
                                key={`i${ci}`}
                                value={row[0][ci] ?? 0}
                                width={p.width}
                                onChange={(v) => setCell(ri, 0, ci, v)}
                              />
                            ))}
                            {draft.outputs.map((p, ci) => (
                              <Cell
                                key={`o${ci}`}
                                value={row[1][ci] ?? 0}
                                width={p.width}
                                expected
                                onChange={(v) => setCell(ri, 1, ci, v)}
                              />
                            ))}
                            <td className="border border-stone-200 text-center">
                              <button
                                onClick={() =>
                                  patch({ rows: draft.rows.filter((_, j) => j !== ri) })
                                }
                                className="text-stone-400 hover:text-rose-600"
                                title="Supprimer la ligne"
                              >
                                <Trash2 size={11} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}
            {fillError && <div className="mt-2 text-[11px] text-rose-700">{fillError}</div>}
          </Field>

          {/* ---- Résultat ---- */}
          <div className="pt-3 border-t border-stone-200 space-y-2">
            {!urls ? (
              <div className="text-xs text-stone-500">
                {noVerify
                  ? 'Renseigne au minimum un titre pour obtenir le lien.'
                  : 'Renseigne au minimum un titre, une entrée, une sortie et une ligne de vérification pour obtenir le lien.'}
              </div>
            ) : (
              <>
                <UrlRow
                  label="Lien de l'exercice"
                  value={urls.plain}
                  copied={copied === 'plain'}
                  onCopy={() => copy(urls.plain, 'plain')}
                />
                <div className="flex items-center gap-2 pt-1">
                  <label className="text-[11px] font-medium text-stone-500">
                    Hauteur de l'iframe
                  </label>
                  <input
                    type="number"
                    min={IFRAME_H_MIN}
                    max={IFRAME_H_MAX}
                    step={10}
                    value={heightText}
                    onChange={(e) => setHeightText(e.target.value)}
                    onBlur={() => setHeightText(String(iframeHeight))}
                    className="w-20 px-2 py-1 border border-stone-300 rounded text-[11px] focus:outline-none focus:ring-2 focus:ring-blue-300"
                    style={MONO}
                  />
                  <span className="text-[11px] text-stone-400">
                    px (de {IFRAME_H_MIN} à {IFRAME_H_MAX})
                  </span>
                </div>
                <UrlRow
                  label="<iframe>"
                  value={urls.iframe}
                  copied={copied === 'iframe'}
                  onCopy={() => copy(urls.iframe, 'iframe')}
                />
                <a
                  href={urls.plain}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-block text-xs text-blue-700 hover:underline"
                >
                  Tester dans un nouvel onglet ↗
                </a>
              </>
            )}
          </div>
        </div>

        <div className="px-5 py-3 border-t border-stone-200 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-sm font-medium bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center gap-1.5"
          >
            <Check size={14} />
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ petits blocs

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-stone-500 mb-1">{label}</label>
      {children}
    </div>
  );
}

function Cell({
  value,
  width,
  expected,
  onChange,
}: {
  value: number;
  width: number;
  expected?: boolean;
  onChange: (v: number) => void;
}) {
  const max = width >= 32 ? 0xffffffff : (1 << width) - 1;
  // 1 bit : une cellule cliquable 0/1, plus rapide à remplir qu'un champ.
  if (width === 1) {
    return (
      <td className={`border border-stone-200 p-0 text-center ${expected ? 'bg-blue-50' : ''}`}>
        <button
          onClick={() => onChange(value ? 0 : 1)}
          className={`w-full px-1 py-0.5 font-mono font-bold ${
            value ? 'text-lime-700' : 'text-stone-400'
          } hover:bg-stone-100`}
          style={MONO}
        >
          {value ? 1 : 0}
        </button>
      </td>
    );
  }
  return (
    <td className={`border border-stone-200 p-0 ${expected ? 'bg-blue-50' : ''}`}>
      <input
        type="number"
        min={0}
        max={max}
        value={value}
        onChange={(e) => {
          const n = Math.floor(Number(e.target.value));
          onChange(Number.isFinite(n) ? Math.max(0, Math.min(max, n)) : 0);
        }}
        className="w-full px-1 py-0.5 text-center font-mono bg-transparent focus:outline-none"
        style={MONO}
      />
    </td>
  );
}

function PortList({
  title,
  ports,
  onChange,
  onAdd,
  onRemove,
}: {
  title: string;
  ports: ExercisePort[];
  onChange: (i: number, p: Partial<ExercisePort>) => void;
  onAdd: () => void;
  onRemove: (i: number) => void;
}) {
  return (
    <div>
      <div className="text-xs font-medium text-stone-500 mb-1">
        {title} ({ports.length})
      </div>
      <div className="space-y-1.5">
        {ports.map((p, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <span className="text-xs text-stone-400 w-4 text-right">{i + 1}.</span>
            <input
              type="text"
              value={p.name}
              onChange={(e) => onChange(i, { name: e.target.value })}
              className="flex-1 min-w-0 px-2 py-1 border border-stone-300 rounded text-sm"
              style={MONO}
            />
            <div className="w-24">
              <BusWidthControl value={p.width} onChange={(w) => onChange(i, { width: w })} />
            </div>
            <button
              onClick={() => onRemove(i)}
              className="text-stone-400 hover:text-rose-600"
              title="Retirer ce port"
            >
              <Trash2 size={12} />
            </button>
          </div>
        ))}
      </div>
      <button
        onClick={onAdd}
        className="mt-1.5 text-xs text-blue-700 hover:underline flex items-center gap-1"
      >
        <Plus size={11} /> Ajouter
      </button>
    </div>
  );
}

function UrlRow({
  label,
  value,
  copied,
  onCopy,
}: {
  label: string;
  value: string;
  copied: boolean;
  onCopy: () => void;
}) {
  return (
    <div>
      <div className="text-[11px] font-medium text-stone-500 mb-0.5">{label}</div>
      <div className="flex items-stretch gap-1.5">
        <input
          readOnly
          value={value}
          onFocus={(e) => e.currentTarget.select()}
          className="flex-1 min-w-0 px-2 py-1 border border-stone-300 rounded text-[11px] bg-stone-50"
          style={MONO}
        />
        <button
          onClick={onCopy}
          className="px-2 rounded border border-stone-300 text-xs text-stone-700 hover:bg-stone-50 flex items-center gap-1"
        >
          {copied ? <Check size={12} className="text-green-600" /> : <Copy size={12} />}
          {copied ? 'Copié' : 'Copier'}
        </button>
      </div>
    </div>
  );
}

// Propose A, B, C… (ou S, T, U… pour les sorties) en évitant les doublons.
function nextName(existing: ExercisePort[], start = 'A'): string {
  const base = start.charCodeAt(0);
  for (let i = 0; i < 26; i++) {
    const name = String.fromCharCode(base + i);
    if (!existing.some((p) => p.name === name)) return name;
  }
  return `P${existing.length + 1}`;
}
