import { useMemo, useState } from 'react';
import type { Dispatch, ReactNode, SetStateAction } from 'react';
import {
  Link2,
  Check,
  Plus,
  Trash2,
  Wand2,
  Copy,
  FolderOpen,
  FilePlus,
  ScanLine,
  MonitorPlay,
} from 'lucide-react';
import { GATES } from '../gates';
import { PALETTE_ORDER } from '../lib/constants';
import {
  buildExerciseUrl,
  decodeExercise,
  encodeExercise,
  exerciseStorageId,
  parseExerciseLink,
  MAX_PAYLOAD,
} from '../lib/exercise-url';
import {
  EMPTY_DRAFT,
  IFRAME_H_MAX,
  IFRAME_H_MIN,
  draftToExercise,
  exerciseToDraft,
  iframeHeightOf,
  nextName,
  portsFromCircuit,
  type ExerciseDraft,
} from '../lib/exercise-draft';
import { usedCustomDefs } from '../lib/tab-import';
import { serialize } from '../lib/persist';
import { BusWidthControl } from './BusWidthControl';
import type { Exercise, ExercisePort, IoRow } from '../domain/exercise';
import type { Circuit } from '../domain/types';

const MONO = { fontFamily: "'IBM Plex Mono', monospace" } as const;

// Au-delà, la génération automatique des 2^n lignes devient ingérable : on
// bascule sur une saisie ligne par ligne.
const MAX_AUTO_BITS = 8;

// Zooms proposés pour l'iframe (en %). « Auto » (null) recadre le circuit.
const ZOOM_CHOICES = [50, 60, 75, 90, 100];

type Msg = { kind: 'ok' | 'error' | 'info'; text: string } | null;

interface ExerciseBuilderModalProps {
  /** Circuit de l'onglet actif — préchargement et remplissage automatique des sorties. */
  circuit: Circuit;
  /** Brouillon, tenu par l'orchestrateur : il survit à la fermeture de la modale. */
  draft: ExerciseDraft;
  setDraft: Dispatch<SetStateAction<ExerciseDraft>>;
  /** Simule le circuit sur les lignes du brouillon et renvoie les sorties obtenues. */
  computeOutputs: (draft: Exercise) => { rows: number[][] } | { error: string };
  /**
   * Ouvre le circuit préchargé d'un exercice importé dans le bac à sable (il
   * devient le circuit courant). Renvoie une erreur, ou un avertissement.
   */
  onImportPreset: (preset: unknown, name: string) => { error?: string; notice?: string };
  onClose: () => void;
}

// Modale de création d'exercice : l'enseignant compose un énoncé, éventuellement
// une table de vérité (ou une séquence), et récupère le lien partageable — tout
// l'exercice tient dans l'URL, aucun backend n'est nécessaire. Un exercice
// existant se modifie en recollant son lien (« Modifier un exercice existant »).
export function ExerciseBuilderModal({
  circuit,
  draft,
  setDraft,
  computeOutputs,
  onImportPreset,
  onClose,
}: ExerciseBuilderModalProps) {
  const [fillError, setFillError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [importText, setImportText] = useState('');
  const [importMsg, setImportMsg] = useState<Msg>(null);
  const [portsMsg, setPortsMsg] = useState<Msg>(null);

  const patch = (p: Partial<ExerciseDraft>) => setDraft((d) => ({ ...d, ...p }));
  const dirty = JSON.stringify(draft) !== JSON.stringify(EMPTY_DRAFT);
  const iframeHeight = iframeHeightOf(draft);

  const noVerify = draft.verifyKind === 'none';
  const totalInBits = draft.inputs.reduce((s, p) => s + p.width, 0);
  const canAutoGenerate =
    draft.verifyKind === 'tt' && totalInBits > 0 && totalInBits <= MAX_AUTO_BITS;

  // Circuit courant sérialisé (composants, fils, définitions perso utilisées).
  // Le canevas est figé derrière la modale ; il ne change que si l'on importe
  // un exercice (son circuit de départ devient l'onglet courant). Seules les
  // définitions réellement utilisées sont embarquées, pour ne pas alourdir le
  // lien de toute la bibliothèque de l'enseignant.
  const presetData = useMemo(
    () => ({
      ...serialize(circuit),
      customDefinitions: usedCustomDefs(circuit.components, circuit.customDefinitions ?? {}),
    }),
    [circuit],
  );
  const presetCount = circuit.components.length;

  const exercise = useMemo(() => draftToExercise(draft, presetData), [draft, presetData]);

  const urls = useMemo(() => {
    if (!exercise) return null;
    // Un circuit préchargé peut faire dépasser le plafond de l'URL : le lien
    // serait alors ignoré au chargement. On prévient plutôt que de donner un
    // lien cassé.
    if (encodeExercise(exercise).length > MAX_PAYLOAD) return { tooLong: true as const };
    const plain = buildExerciseUrl(exercise);
    const embedded = buildExerciseUrl(exercise, { embed: true });
    return {
      plain,
      iframe: `<iframe src="${embedded}" width="100%" height="${iframeHeight}" style="border:0"></iframe>`,
      // Liens de test : sauvegarde propre à cette version (voir TEST_PARAM).
      test: buildExerciseUrl(exercise, { test: true }),
      testEmbed: buildExerciseUrl(exercise, { embed: true, test: true }),
    };
  }, [exercise, iframeHeight]);

  // -------- modifier un exercice existant --------
  const importLink = () => {
    setImportMsg(null);
    const parsed = parseExerciseLink(importText);
    const ex = parsed && decodeExercise(parsed.payload, { isKnownType: (t) => !!GATES[t] });
    if (!parsed || !ex) {
      setImportMsg({
        kind: 'error',
        text: "Ce texte ne contient pas d'exercice Logix lisible. Colle le lien complet ou l'extrait <iframe>.",
      });
      return;
    }
    if (dirty && !window.confirm('Remplacer le brouillon en cours par cet exercice ?')) return;
    let notice = '';
    if (ex.preset !== undefined) {
      const res = onImportPreset(ex.preset, ex.title);
      if (res.error) {
        setImportMsg({ kind: 'error', text: res.error });
        return;
      }
      notice = res.notice ? ` ${res.notice}` : '';
    }
    setDraft(exerciseToDraft(ex, exerciseStorageId(ex, parsed.payload), parsed.height));
    setImportText('');
    setPortsMsg(null);
    setFillError(null);
    setImportMsg({
      kind: 'ok',
      text:
        `« ${ex.title} » est chargé.` +
        (ex.preset !== undefined
          ? ' Son circuit de départ est ouvert dans l’onglet courant : retouche-le si besoin, puis rouvre cette fenêtre.'
          : '') +
        notice,
    });
  };

  const startNew = () => {
    if (dirty && !window.confirm('Effacer le brouillon et commencer un nouvel exercice ?')) return;
    setDraft(EMPTY_DRAFT);
    setImportMsg(null);
    setPortsMsg(null);
    setFillError(null);
  };

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

  const circuitHasIo = circuit.components.some((c) => c.type === 'INPUT' || c.type === 'OUTPUT');
  const deducePorts = () => {
    const { inputs, outputs, unlabeled } = portsFromCircuit(circuit.components);
    setDraft((d) => {
      // Mêmes ports qu'avant : on garde la table déjà saisie.
      const same = JSON.stringify([inputs, outputs]) === JSON.stringify([d.inputs, d.outputs]);
      return { ...d, inputs, outputs, rows: same ? d.rows : [] };
    });
    setPortsMsg(
      unlabeled > 0
        ? {
            kind: 'info',
            text: `${unlabeled} Entrée/Sortie sans étiquette dans le circuit : un nom leur a été proposé (modifiable ci-dessous).`,
          }
        : {
            kind: 'ok',
            text: `${inputs.length} entrée(s) et ${outputs.length} sortie(s) reprises du circuit.`,
          },
    );
  };

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

  // Aperçu fidèle de l'iframe : une petite page jetable qui embarque l'exercice
  // à la hauteur choisie, comme le fera le site de l'enseignant.
  const openIframePreview = (src: string) => {
    const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Aperçu — ${escapeHtml(
      exercise?.title ?? '',
    )}</title><style>body{margin:0;padding:24px;background:#f5f5f4;font-family:system-ui,sans-serif}main{max-width:960px;margin:0 auto}p{color:#57534e;font-size:13px;margin:0 0 8px}</style></head><body><main><p>Aperçu de l'iframe (${iframeHeight} px de haut), telle que l'élève la verra dans ta page.</p><iframe src="${escapeHtml(
      src,
    )}" width="100%" height="${iframeHeight}" style="border:0;background:#fff"></iframe></main></body></html>`;
    const url = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
    const opened = window.open(url, '_blank');
    if (opened) opened.opener = null;
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
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
          <h2 className="text-base font-medium flex-1">
            {draft.sourceId ? 'Modifier un exercice' : 'Créer un exercice partageable'}
          </h2>
          {dirty && (
            <button
              onClick={startNew}
              className="px-2.5 py-1 rounded border border-stone-300 text-xs font-medium text-stone-700 hover:bg-stone-50 flex items-center gap-1.5"
              title="Effacer le brouillon et repartir d'un exercice vierge"
            >
              <FilePlus size={12} />
              Nouvel exercice
            </button>
          )}
        </div>

        <div className="px-5 py-4 space-y-5">
          {/* ---- Modifier un exercice existant ---- */}
          <div className="rounded border border-stone-200 bg-stone-50 px-3 py-2.5 space-y-1.5">
            <div className="text-xs font-medium text-stone-600">Modifier un exercice existant</div>
            <div className="flex items-stretch gap-1.5">
              <input
                type="text"
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') importLink();
                }}
                placeholder="Colle ici le lien de l'exercice ou son extrait <iframe>"
                className="flex-1 min-w-0 px-2 py-1 border border-stone-300 rounded text-xs bg-white focus:outline-none focus:ring-2 focus:ring-blue-300"
                style={MONO}
              />
              <button
                onClick={importLink}
                disabled={!importText.trim()}
                className="px-2.5 rounded border border-stone-300 bg-white text-xs font-medium text-stone-700 hover:bg-stone-100 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
              >
                <FolderOpen size={12} />
                Charger
              </button>
            </div>
            {importMsg ? (
              <MsgLine msg={importMsg} />
            ) : (
              <div className="text-[11px] text-stone-500">
                Le formulaire se pré-remplit et le circuit de départ s'ouvre dans un onglet. Tu
                obtiens ensuite un nouveau lien à mettre à la place de l'ancien.
              </div>
            )}
          </div>

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

          {/* ---- Panneau Propriétés ---- */}
          <label className="flex items-center gap-1.5 text-xs text-stone-700">
            <input
              type="checkbox"
              checked={draft.autoOpenProperties}
              onChange={(e) => patch({ autoOpenProperties: e.target.checked })}
            />
            Ouvrir automatiquement le panneau « Propriétés » quand l'élève sélectionne un composant
          </label>

          {/* ---- Circuit préchargé ---- */}
          <Field label="Circuit de départ">
            <div className="space-y-1.5">
              <label className="flex items-center gap-1.5 text-xs text-stone-700">
                <input
                  type="checkbox"
                  checked={draft.includePreset || draft.locked}
                  disabled={draft.locked}
                  onChange={(e) => patch({ includePreset: e.target.checked })}
                />
                Précharger le circuit courant ({presetCount} composant
                {presetCount > 1 ? 's' : ''}) comme point de départ
              </label>
              <label className="flex items-center gap-1.5 text-xs text-stone-700">
                <input
                  type="checkbox"
                  checked={draft.locked}
                  onChange={(e) => patch({ locked: e.target.checked })}
                />
                Verrouiller le circuit — démonstration non modifiable (implique le préchargement)
              </label>
              {presetCount === 0 && (draft.includePreset || draft.locked) && (
                <div className="text-[11px] text-amber-700">
                  L'onglet courant est vide : construis d'abord le circuit à fournir, puis rouvre
                  cette fenêtre (ton brouillon est conservé).
                </div>
              )}
            </div>
          </Field>

          {/* ---- Ports ---- */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-end">
              <button
                onClick={deducePorts}
                disabled={!circuitHasIo}
                className="px-2.5 py-1 rounded border border-stone-300 text-xs font-medium text-stone-700 hover:bg-stone-50 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
                title="Reprend les étiquettes et largeurs des Entrée/Sortie de l'onglet courant"
              >
                <ScanLine size={12} />
                Déduire des Entrée/Sortie du circuit
              </button>
            </div>
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
            {portsMsg && <MsgLine msg={portsMsg} />}
            <div className="text-[11px] text-stone-500">
              {noVerify ? (
                <>
                  Sans vérification, les ports ne servent que d'indication dans la consigne.
                  Retire-les tous si tu n'en veux aucune.
                </>
              ) : (
                <>
                  La vérification apparie les Entrée/Sortie <strong>par étiquette</strong> : en mode
                  exercice, Logix nomme automatiquement les ports déposés (A, B… / S, T…), donc
                  l'ordre de placement de l'élève n'a aucune importance.
                </>
              )}
            </div>
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
            {draft.sourceId && (
              <div className="rounded border border-amber-200 bg-amber-50 px-3 py-2 space-y-1">
                <label className="flex items-center gap-1.5 text-xs text-stone-800 font-medium">
                  <input
                    type="checkbox"
                    checked={draft.keepProgress}
                    onChange={(e) => patch({ keepProgress: e.target.checked })}
                  />
                  Conserver le travail déjà commencé par les élèves
                </label>
                <div className="text-[11px] text-stone-600 leading-snug">
                  {draft.keepProgress
                    ? "Un élève qui avait commencé l'ancienne version retrouve son circuit sur le nouveau lien. Décoche si tu as changé le circuit de départ : l'élève garderait sinon l'ancien."
                    : "Le nouveau lien repart d'une sauvegarde neuve : chaque élève redémarre sur le circuit de départ actuel."}{' '}
                  Dans les deux cas, le lien change : remplace l'ancien (ou l'iframe) sur ta page.
                </div>
              </div>
            )}

            {!urls ? (
              <div className="text-xs text-stone-500">
                {noVerify
                  ? 'Renseigne au minimum un titre pour obtenir le lien.'
                  : 'Renseigne au minimum un titre, une entrée, une sortie et une ligne de vérification pour obtenir le lien.'}
              </div>
            ) : 'tooLong' in urls ? (
              <div className="text-xs text-rose-700">
                Le circuit préchargé rend le lien trop long pour tenir dans une URL. Allège-le
                (moins de composants / définitions personnalisées) ou renonce au préchargement.
              </div>
            ) : (
              <>
                <UrlRow
                  label="Lien de l'exercice"
                  value={urls.plain}
                  copied={copied === 'plain'}
                  onCopy={() => copy(urls.plain, 'plain')}
                />
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 pt-1">
                  <label className="text-[11px] font-medium text-stone-500">
                    Hauteur de l'iframe
                  </label>
                  <input
                    type="number"
                    min={IFRAME_H_MIN}
                    max={IFRAME_H_MAX}
                    step={10}
                    value={draft.iframeHeight}
                    onChange={(e) => patch({ iframeHeight: e.target.value })}
                    onBlur={() => patch({ iframeHeight: String(iframeHeight) })}
                    className="w-20 px-2 py-1 border border-stone-300 rounded text-[11px] focus:outline-none focus:ring-2 focus:ring-blue-300"
                    style={MONO}
                  />
                  <span className="text-[11px] text-stone-400">
                    px (de {IFRAME_H_MIN} à {IFRAME_H_MAX})
                  </span>
                  <label className="ml-3 text-[11px] font-medium text-stone-500">
                    Zoom initial
                  </label>
                  <select
                    value={draft.zoom ?? 'auto'}
                    onChange={(e) =>
                      patch({ zoom: e.target.value === 'auto' ? null : Number(e.target.value) })
                    }
                    className="px-1.5 py-1 border border-stone-300 rounded text-[11px] bg-white focus:outline-none focus:ring-2 focus:ring-blue-300"
                    title="Taille des composants dans l'iframe. Auto : le circuit de départ est recadré pour tenir dans la vue."
                  >
                    <option value="auto">Auto (recadrer)</option>
                    {/* Un zoom importé hors liste reste sélectionnable. */}
                    {[...new Set([...ZOOM_CHOICES, ...(draft.zoom ? [draft.zoom] : [])])]
                      .sort((a, b) => a - b)
                      .map((z) => (
                        <option key={z} value={z}>
                          {z} %
                        </option>
                      ))}
                  </select>
                </div>
                <UrlRow
                  label="<iframe>"
                  value={urls.iframe}
                  copied={copied === 'iframe'}
                  onCopy={() => copy(urls.iframe, 'iframe')}
                />
                <div className="flex items-center gap-4">
                  <a
                    href={urls.test}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-block text-xs text-blue-700 hover:underline"
                  >
                    Tester dans un nouvel onglet ↗
                  </a>
                  <button
                    onClick={() => openIframePreview(urls.testEmbed)}
                    className="text-xs text-blue-700 hover:underline flex items-center gap-1"
                    title="Ouvre une page d'aperçu avec l'iframe à la hauteur choisie"
                  >
                    <MonitorPlay size={12} />
                    Tester en iframe ↗
                  </button>
                </div>
                <div className="text-[11px] text-stone-400">
                  Les tests ont leur propre sauvegarde : ils ne se mélangent pas au travail des
                  élèves, et chaque nouvelle version repart du circuit de départ.
                </div>
              </>
            )}
          </div>
        </div>

        <div className="px-5 py-3 border-t border-stone-200 flex items-center justify-end gap-3">
          <span className="text-[11px] text-stone-400 mr-auto">
            Le brouillon est conservé si tu fermes cette fenêtre (jusqu'au rechargement de la page).
          </span>
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

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function MsgLine({ msg }: { msg: NonNullable<Msg> }) {
  const color =
    msg.kind === 'error'
      ? 'text-rose-700'
      : msg.kind === 'ok'
        ? 'text-green-700'
        : 'text-amber-700';
  return <div className={`text-[11px] leading-snug ${color}`}>{msg.text}</div>;
}

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
