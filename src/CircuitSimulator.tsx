import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import type { MouseEvent as ReactMouseEvent } from 'react';
import { Package } from 'lucide-react';
import { asInt, maskTo } from './lib/sim';
import {
  serializeAll as serializeAllCore,
  deserializeAll as deserializeAllCore,
} from './lib/persist';
import { verifyExercise } from './lib/exercise-verify';
import { buildCustomDefData } from './lib/custom-def';
import { readUrlContext } from './lib/url-params';
import { GRID, INPUT_BUS_CELL_SIZE } from './lib/constants';
import { GATES } from './gates';
import {
  getDef,
  simulate,
  typeReferences,
  getPortPosition,
  getPortWidth,
  type CustomDefData,
} from './gates/registry';
import { Toolbar } from './components/Toolbar';
import { TabsBar } from './components/TabsBar';
import { SaveAsComponentModal } from './components/SaveAsComponentModal';
import { DeleteDefinitionModal } from './components/DeleteDefinitionModal';
import { RightPanel } from './components/RightPanel';
import { PalettePanel } from './components/PalettePanel';
import { ExercisePanel } from './components/ExercisePanel';
import { ExerciseBuilderModal } from './components/ExerciseBuilderModal';
import { CircuitCanvas } from './components/CircuitCanvas';
import { PaletteDragGhost } from './components/PaletteDragGhost';
import { usePrefs } from './hooks/usePrefs';
import { useTrace } from './hooks/useTrace';
import { useCircuitEngine } from './hooks/useCircuitEngine';
import { useHistory } from './hooks/useHistory';
import { useAutosave } from './hooks/useAutosave';
import { useViewport } from './hooks/useViewport';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import type {
  Circuit,
  CircuitComponent,
  Port,
  Selection,
  Tab,
  TabsState,
  Wire,
} from './domain/types';
import type { Exercise } from './domain/exercise';
import type { SaveAsCompState } from './components/SaveAsComponentModal';
import type { ExerciseResult, ExerciseRow } from './components/ExercisePanel';
import type { ComponentPatch } from './components/PropertiesPanel';

// ============================================================
// TYPES LOCAUX (état transitoire de l'orchestrateur)
// ============================================================
type Updater = Circuit | ((c: Circuit) => Circuit);
type WireEnd = { componentId: string; port: string };
type WireStartState = { componentId: string; port: string; x: number; y: number };
type EditModeState = { definitionName: string; backupCircuit: Circuit };
type DragOffsetState = { dx: number; dy: number; ids: Set<string> };
type PaletteDragState = { type: string; mouseX: number; mouseY: number; didMove: boolean };
type ClipboardState = { components: CircuitComponent[]; wires: Wire[] };
type WireWidthMismatchState = { wFrom: number; wTo: number; t: number };
type RectSelectState = {
  startX: number;
  startY: number;
  x: number;
  y: number;
  w: number;
  h: number;
  didMove: boolean;
  additive: boolean;
  initialSelection: Selection;
};
type DragState = {
  startX: number;
  startY: number;
  origPositions: Map<string, { x: number; y: number }>;
  idsSet: Set<string>;
  snapshot: Circuit;
  hasMoved: boolean;
};

// ============================================================
// HELPERS
// ============================================================
const snap = (v: number) => Math.round(v / GRID) * GRID;
const uid = (prefix: string) =>
  `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

// ============================================================
// EXPORT / IMPORT JSON
// ============================================================
// Wrappers locaux : passent le prédicat `isKnownType` (basé sur GATES) et le
// générateur `uid` à serialize/deserialize. Le code applicatif appelle ces
// wrappers comme avant ; la logique pure vit dans ./lib/persist.
const isKnownType = (t: string) => !!GATES[t];
const serializeAll = (tabsState: TabsState) => serializeAllCore(tabsState);
const deserializeAll = (data: unknown) => deserializeAllCore(data, { isKnownType, uid });

// ============================================================
// COMPOSANT PRINCIPAL
// ============================================================
// Crée un onglet vide
function makeEmptyTab(name = 'Nouveau circuit'): Tab {
  return {
    id: uid('tab'),
    name,
    components: [],
    wires: [],
  };
}

export default function CircuitSimulator() {
  // -------- CONTEXTE D'URL --------
  // Lu une seule fois au montage : exercice encodé (?ex=), mode embed (&embed=1),
  // et la clé d'autosave qui en découle. Voir lib/url-params.
  const urlCtx = useMemo(() => readUrlContext(), []);
  const embed = urlCtx.embed;
  // L'exercice courant, s'il y en a un. Il vient uniquement de l'URL et ne
  // change jamais pendant la session (pas de catalogue, pas de routeur).
  const exercise = urlCtx.exercise;
  // Circuit verrouillé : l'élève ne peut pas modifier la structure (démo). Il
  // peut toujours interagir (basculer entrées, ticker horloges).
  const locked = !!exercise?.locked;

  // -------- ÉTAT --------
  // Plusieurs onglets ("zones de travail") : on garde un tableau de tabs et un
  // activeTabId. Les composants personnalisés (customDefinitions) sont partagés
  // entre tous les onglets, donc stockés à part.
  //
  // `circuit` (calculé plus bas) est l'onglet actif augmenté de customDefinitions.
  // Toute la suite du code peut continuer à utiliser `circuit` et `setCircuit`
  // comme avant.
  const [tabsState, setTabsState] = useState<TabsState>(() => {
    // Un exercice peut fournir un circuit préchargé (démo, point de départ). On
    // le sème dans l'état INITIAL : l'autosave ne l'écrase qu'aux visites
    // suivantes (quand une sauvegarde existe), donc le travail de l'élève prime
    // tout en gardant le circuit fourni à la première ouverture.
    if (urlCtx.exercise?.preset) {
      try {
        return deserializeAll(urlCtx.exercise.preset);
      } catch {
        // preset corrompu : on démarre vide
      }
    }
    const first = makeEmptyTab();
    return {
      tabs: [first],
      activeTabId: first.id,
      customDefinitions: {},
    };
  });

  // Reconstruit l'objet `circuit` perçu par tout le code existant.
  const circuit = useMemo<Circuit>(() => {
    const active = tabsState.tabs.find((t) => t.id === tabsState.activeTabId) ?? tabsState.tabs[0];
    return {
      name: active?.name ?? 'Nouveau circuit',
      components: active?.components ?? [],
      wires: active?.wires ?? [],
      customDefinitions: tabsState.customDefinitions,
    };
  }, [tabsState]);

  // Wrapper qui projette une mutation sur le `circuit` virtuel vers l'onglet actif
  // et `customDefinitions`. Préserve la signature historique : updater fonction ou objet.
  const setCircuit = useCallback((updater: Updater) => {
    setTabsState((prev) => {
      const idx = prev.tabs.findIndex((t) => t.id === prev.activeTabId);
      if (idx < 0) return prev;
      const active = prev.tabs[idx];
      const currentVirtual = {
        name: active.name,
        components: active.components,
        wires: active.wires,
        customDefinitions: prev.customDefinitions,
      };
      const next = typeof updater === 'function' ? updater(currentVirtual) : updater;
      if (next === currentVirtual) return prev;
      const newTab = {
        ...active,
        name: next.name ?? active.name,
        components: next.components ?? active.components,
        wires: next.wires ?? active.wires,
      };
      const newTabs = prev.tabs.slice();
      newTabs[idx] = newTab;
      return {
        ...prev,
        tabs: newTabs,
        customDefinitions: next.customDefinitions ?? prev.customDefinitions,
      };
    });
  }, []);
  const [selection, setSelection] = useState<Selection>({ components: [], wires: [] });
  const [placeType, setPlaceType] = useState<string | null>(null);
  const [paletteDrag, setPaletteDrag] = useState<PaletteDragState | null>(null);
  const [wireStart, setWireStart] = useState<WireStartState | null>(null);
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null);
  const [clipboard, setClipboard] = useState<ClipboardState | null>(null);
  // null = panneau replié. Sinon 'properties' | 'truthtable' | 'chronogram' | 'preferences'.
  const [rightPanelMode, setRightPanelMode] = useState<string | null>(null);

  // ---- Phase 3 : composants personnalisés ----
  const [saveAsCompState, setSaveAsCompState] = useState<SaveAsCompState | null>(null);
  // editMode : null en mode normal, sinon { definitionName, backupCircuit }.
  // En mode édition, `circuit` contient le sous-circuit de la définition.
  const [editMode, setEditMode] = useState<EditModeState | null>(null);
  // Confirmation simple pour la suppression de définition.
  const [deletePromptName, setDeletePromptName] = useState<string | null>(null);

  // ---- Exercice ----
  // Verdict de la dernière vérification (null tant que l'élève n'a pas cliqué).
  const [exerciseResult, setExerciseResult] = useState<ExerciseResult | null>(null);
  // Modale de création d'exercice partageable (générateur d'URL).
  const [builderOpen, setBuilderOpen] = useState(false);

  // ---- Préférences d'apparence (chargement/sauvegarde gérés par le hook) ----
  const [prefs, setPrefs] = usePrefs();

  // ---- Sélection rectangulaire ----
  const [rectSelect, setRectSelect] = useState<RectSelectState | null>(null);

  // Notification éphémère quand on essaie de connecter deux ports de largeurs incompatibles
  const [wireWidthMismatch, setWireWidthMismatch] = useState<WireWidthMismatchState | null>(null);

  // Auto-effacement de la notification après 2.5 s
  useEffect(() => {
    if (!wireWidthMismatch) return;
    const tid = setTimeout(() => setWireWidthMismatch(null), 2500);
    return () => clearTimeout(tid);
  }, [wireWidthMismatch]);

  // Historique par onglet (undo/redo + commit). Voir hooks/useHistory.
  const { history, commit, undo, redo, resetHistory, dropTabHistory } = useHistory(
    tabsState.activeTabId,
    setCircuit,
    setSelection,
  );
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const justDraggedRef = useRef(false); // true between mouseUp-with-move and the click that follows
  const wireMovedRef = useRef(false); // true si on a bougé la souris depuis le clic du fil
  // Pendant un drag, on garde l'offset (dx, dy) dans un state séparé pour ne
  // PAS invalider `circuit` à chaque mouvement de souris. Le rendu de chaque
  // composant applique cet offset s'il est dans la sélection draggée.
  // Au mouseUp, on écrit la position finale dans `circuit` en un seul commit.
  const [dragOffset, setDragOffset] = useState<DragOffsetState | null>(null);

  // -------- ZOOM ET PAN (voir hooks/useViewport) --------
  const {
    svgRef,
    viewBox,
    viewBoxBaseRef,
    panRef,
    getSvgPoint,
    resetView,
    handleCanvasWheel,
    handleCanvasMouseDownPan,
    handleCanvasMouseMovePan,
    handleCanvasMouseUpPan,
  } = useViewport();

  // -------- AUTO-SAUVEGARDE du circuit --------
  useAutosave(tabsState, setTabsState, editMode, serializeAll, deserializeAll, urlCtx.storageKey);

  // -------- PANNEAU DROIT : ouverture/fermeture auto --------
  // Sélectionner un composant ouvre « Propriétés » ; cliquer à côté (désélection)
  // referme le panneau. Les vues Table/Chrono/Apparence, ouvertes à la demande
  // depuis la barre du haut, ne sont pas refermées par la désélection.
  // Un exercice peut désactiver cette ouverture automatique (par défaut il la
  // désactive) : l'enseignant choisit si l'élève voit ce panneau sans y être
  // invité par la barre d'outils.
  const autoOpenProperties = !exercise || exercise.autoOpenProperties;
  const selectionSig =
    selection.components.length === 0
      ? null
      : selection.components.length === 1
        ? selection.components[0]
        : `multi:${selection.components.length}`;
  useEffect(() => {
    if (selectionSig) {
      if (autoOpenProperties) setRightPanelMode('properties');
    } else {
      setRightPanelMode((m) => (m === 'properties' ? null : m));
    }
  }, [selectionSig, autoOpenProperties]);

  // -------- SIMULATION --------
  const sim = useMemo(() => simulate(circuit), [circuit]);

  // -------- MOTEUR (séquentiel + horloge auto + animation) --------
  useCircuitEngine(circuit, sim, setCircuit);

  // -------- CHRONOGRAMME --------
  const {
    trace,
    enabled: traceEnabled,
    setEnabled: setTraceEnabled,
    clear: clearTrace,
  } = useTrace(circuit, sim, editMode);

  // -------- ACTIONS --------
  const placeComponent = (type: string, x: number, y: number) => {
    if (locked) return;
    const def = getDef(type, circuit.customDefinitions);
    if (!def) return;
    const newComp: CircuitComponent = {
      id: uid('c'),
      type,
      x: snap(x),
      y: snap(y),
      state: def.defaultState ? { ...def.defaultState } : undefined,
      label: '',
    };
    commit((c) => ({ ...c, components: [...c.components, newComp] }));
  };

  const updateComponent = (id: string, patch: ComponentPatch) => {
    const dropMismatched = patch._dropMismatchedWires;
    const realPatch = { ...patch };
    delete realPatch._dropMismatchedWires;

    commit((c) => {
      const newComponents = c.components.map((x) => (x.id === id ? { ...x, ...realPatch } : x));
      let newWires = c.wires;
      if (dropMismatched) {
        // On retire :
        //  - les fils dont les composants n'existent plus
        //  - les fils dont les ports ont disparu (changement de width sur SPLITTER/MERGER)
        //  - les fils dont les largeurs source/cible ne correspondent plus
        newWires = c.wires.filter((w) => {
          const fromC = newComponents.find((cc) => cc.id === w.from.componentId);
          const toC = newComponents.find((cc) => cc.id === w.to.componentId);
          if (!fromC || !toC) return false;
          const fromDef = getDef(fromC.type, c.customDefinitions, fromC);
          const toDef = getDef(toC.type, c.customDefinitions, toC);
          if (!fromDef || !toDef) return false;
          const fromPort = fromDef.outputs.find((p) => p.name === w.from.port);
          const toPort = toDef.inputs.find((p) => p.name === w.to.port);
          if (!fromPort || !toPort) return false;
          return (fromPort.width ?? 1) === (toPort.width ?? 1);
        });
      }
      return { ...c, components: newComponents, wires: newWires };
    });
  };

  // -------- EXERCICE --------
  // La logique de vérification (pure) vit dans lib/exercise-verify ; ici on ne
  // fait que déléguer et ranger le verdict.
  const runVerify = () => {
    if (!exercise) return;
    const res = verifyExercise(circuit, exercise, getDef);
    setExerciseResult({
      success: res.success,
      error: res.error ?? null,
      table: res.table ?? null,
    });
  };

  // Générateur d'exercices : simule le circuit de l'onglet courant sur toutes les
  // lignes du brouillon et renvoie les sorties obtenues, pour pré-remplir la
  // table attendue. `stopOnFirstFailure: false` → on veut TOUTES les lignes.
  const computeExerciseOutputs = (draft: Exercise): { rows: number[][] } | { error: string } => {
    const res = verifyExercise(circuit, draft, getDef, { stopOnFirstFailure: false });
    if (!res.table) return { error: res.error ?? 'Simulation impossible' };
    return { rows: res.table.map((r: ExerciseRow) => r.actualOutVals) };
  };

  const toggleInput = (id: string) => {
    // Bascule 0↔1 sans passer par l'historique (feel naturel).
    // En mode bus (width > 1), pas de toggle : la valeur s'édite via le panneau Propriétés.
    setCircuit((c) => ({
      ...c,
      components: c.components.map((x) => {
        if (x.id !== id || x.type !== 'INPUT') return x;
        const width = x.state?.width ?? 1;
        if (width > 1) return x;
        const cur = asInt(x.state?.value);
        return { ...x, state: { ...(x.state ?? {}), value: cur ? 0 : 1 } };
      }),
    }));
  };

  // Bascule le bit `bitIdx` d'une Entrée bus. Hors historique pour ne pas saturer l'undo.
  const toggleInputBit = (id: string, bitIdx: number) => {
    setCircuit((c) => ({
      ...c,
      components: c.components.map((x) => {
        if (x.id !== id || x.type !== 'INPUT') return x;
        const width = x.state?.width ?? 1;
        if (width <= 1) return x;
        if (bitIdx < 0 || bitIdx >= width) return x;
        const cur = asInt(x.state?.value);
        const next = maskTo(width, cur ^ (1 << bitIdx));
        return { ...x, state: { ...(x.state ?? {}), value: next } };
      }),
    }));
  };

  // Bascule la valeur d'une horloge manuelle (clic sur le composant).
  // Si elle est en mode auto-running, on ne fait rien (la pause se règle dans Propriétés).
  const toggleClock = (id: string) => {
    setCircuit((c) => ({
      ...c,
      components: c.components.map((x) => {
        if (x.id !== id || x.type !== 'CLOCK') return x;
        if (x.state?.running) return x;
        const cur = asInt(x.state?.value);
        return { ...x, state: { ...(x.state ?? {}), value: cur ? 0 : 1 } };
      }),
    }));
  };

  // Bouton « Tick » global : bascule toutes les CLOCK en mode manuel.
  // Un appui = une transition (montante OU descendante), donc deux appuis = un cycle.
  const tickClocks = () => {
    setCircuit((c) => {
      let touched = false;
      const newComps = c.components.map((x) => {
        if (x.type !== 'CLOCK') return x;
        if (x.state?.running) return x;
        touched = true;
        const cur = asInt(x.state?.value);
        return { ...x, state: { ...(x.state ?? {}), value: cur ? 0 : 1 } };
      });
      return touched ? { ...c, components: newComps } : c;
    });
  };

  const addWire = (from: WireEnd, to: WireEnd) => {
    if (locked) return;
    // Refuse self-connection
    if (from.componentId === to.componentId) return;
    // Vérifie la compatibilité des largeurs
    const fromComp = circuit.components.find((c) => c.id === from.componentId);
    const toComp = circuit.components.find((c) => c.id === to.componentId);
    if (!fromComp || !toComp) return;
    const wFrom = getPortWidth(fromComp, from.port, 'output', circuit.customDefinitions);
    const wTo = getPortWidth(toComp, to.port, 'input', circuit.customDefinitions);
    if (wFrom !== wTo) {
      // Notification non-bloquante : flash rouge dans la status bar
      setWireWidthMismatch({ wFrom, wTo, t: Date.now() });
      return;
    }
    // Remplace tout fil existant qui pointait sur ce port d'entrée
    commit((c) => {
      const filtered = c.wires.filter(
        (w) => !(w.to.componentId === to.componentId && w.to.port === to.port),
      );
      return {
        ...c,
        wires: [...filtered, { id: uid('w'), from, to }],
      };
    });
  };

  const deleteSelection = () => {
    if (locked) return;
    if (selection.components.length === 0 && selection.wires.length === 0) return;
    const compIds = new Set(selection.components);
    const wireIds = new Set(selection.wires);
    commit((c) => ({
      ...c,
      components: c.components.filter((x) => !compIds.has(x.id)),
      wires: c.wires.filter(
        (w) =>
          !wireIds.has(w.id) && !compIds.has(w.from.componentId) && !compIds.has(w.to.componentId),
      ),
    }));
    setSelection({ components: [], wires: [] });
  };

  const copySelection = () => {
    if (selection.components.length === 0) return;
    const compIds = new Set(selection.components);
    const comps = circuit.components.filter((c) => compIds.has(c.id));
    const wires = circuit.wires.filter(
      (w) => compIds.has(w.from.componentId) && compIds.has(w.to.componentId),
    );
    setClipboard({ components: comps, wires });
  };

  const pasteClipboard = () => {
    if (locked) return;
    if (!clipboard) return;
    const idMap = new Map<string, string>();
    const newComps = clipboard.components.map((c) => {
      const newId = uid('c');
      idMap.set(c.id, newId);
      return { ...c, id: newId, x: c.x + GRID, y: c.y + GRID };
    });
    const newWires: Wire[] = clipboard.wires.map((w) => ({
      id: uid('w'),
      from: { componentId: idMap.get(w.from.componentId) ?? w.from.componentId, port: w.from.port },
      to: { componentId: idMap.get(w.to.componentId) ?? w.to.componentId, port: w.to.port },
    }));
    commit((c) => ({
      ...c,
      components: [...c.components, ...newComps],
      wires: [...c.wires, ...newWires],
    }));
    setSelection({ components: newComps.map((c) => c.id), wires: [] });
  };

  // -------- ENREGISTREMENT JSON --------
  const saveToFile = () => {
    // Le fichier de sauvegarde contient :
    //  - tous les onglets (tabs[]) + l'onglet actif
    //  - toutes les définitions personnalisées (customDefinitions, partagées)
    //  - la version du format (pour de futures migrations)
    // L'apparence (couleurs, épaisseurs, fond) n'est PAS incluse : c'est une
    // préférence locale au navigateur, indépendante du circuit.
    const data = serializeAll(tabsState);
    // Nom de fichier : si un seul onglet on prend son nom, sinon "circuits".
    // Plus honnête qu'utiliser le nom de l'onglet actif quand le fichier en contient plusieurs.
    const baseName = tabsState.tabs.length === 1 ? tabsState.tabs[0].name || 'circuit' : 'circuits';
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${baseName.replace(/\s+/g, '_')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const loadFromFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result as string);
        const loaded = deserializeAll(data);
        // Import remplace l'ensemble des onglets. L'historique repart à zéro
        // (cohérent avec l'ancien comportement qui jetait l'historique).
        resetHistory();
        setTabsState(loaded);
        setSelection({ components: [], wires: [] });
      } catch (err) {
        alert('Erreur de chargement : ' + (err instanceof Error ? err.message : String(err)));
      }
    };
    reader.readAsText(file);
  };

  // -------- COMPOSANTS PERSONNALISÉS (Phase 3) --------

  // Vérifie si la sélection actuelle peut être encapsulée :
  // au moins une Entrée, une Sortie, et une porte logique (ou un composant custom).
  // En mode édition, le bouton est toujours actif (il sert à valider l'édition).
  const canEncapsulate = useMemo(() => {
    if (editMode) return true;
    if (locked) return false;
    if (selection.components.length === 0) return false;
    const sel = circuit.components.filter((c) => selection.components.includes(c.id));
    const hasInput = sel.some((c) => c.type === 'INPUT');
    const hasOutput = sel.some((c) => c.type === 'OUTPUT');
    const hasGate = sel.some((c) => c.type !== 'INPUT' && c.type !== 'OUTPUT');
    return hasInput && hasOutput && hasGate;
  }, [editMode, locked, selection.components, circuit.components]);

  // Ouvre la modale "Sauver comme composant" en pré-remplissant les ports
  // à partir des INPUT/OUTPUT sélectionnés (ou du circuit complet en mode édition).
  const openSaveAsComp = () => {
    // En édition : on travaille sur tout le canevas (qui EST la définition).
    // En mode normal : on travaille sur la sélection.
    const pool = editMode
      ? circuit.components
      : circuit.components.filter((c) => selection.components.includes(c.id));

    const inputs = pool
      .filter((c) => c.type === 'INPUT')
      .sort((a, b) => a.y - b.y || a.x - b.x)
      .map((c, i) => ({ id: c.id, label: c.label || '', name: c.label || `in${i}` }));
    const outputs = pool
      .filter((c) => c.type === 'OUTPUT')
      .sort((a, b) => a.y - b.y || a.x - b.x)
      .map((c, i) => ({ id: c.id, label: c.label || '', name: c.label || `out${i}` }));

    setSaveAsCompState({
      name: editMode?.definitionName || '',
      inputs,
      outputs,
    });
  };

  // Valide et enregistre la définition.
  // - En mode normal : construit la définition à partir de la sélection,
  //   supprime les composants sélectionnés du canevas, et insère une instance
  //   du nouveau composant à la place. Les fils traversant la frontière sont supprimés.
  // - En mode édition : enregistre la définition modifiée et restaure le circuit principal.
  const confirmSaveAsComp = () => {
    if (!saveAsCompState) return;
    const { name, inputs, outputs } = saveAsCompState;
    const trimmed = name.trim();
    if (!trimmed) {
      alert('Donnez un nom au composant.');
      return;
    }
    if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(trimmed)) {
      alert('Nom invalide : utilisez lettres, chiffres et _ (commence par une lettre).');
      return;
    }
    if (GATES[trimmed]) {
      alert(`Le nom "${trimmed}" est réservé.`);
      return;
    }
    const portNames = (list: { name: string }[]) => list.map((p) => p.name.trim());
    const inNames = portNames(inputs);
    const outNames = portNames(outputs);
    if (inNames.some((n) => !n) || outNames.some((n) => !n)) {
      alert('Tous les ports doivent avoir un nom.');
      return;
    }
    if (new Set(inNames).size !== inNames.length || new Set(outNames).size !== outNames.length) {
      alert('Les noms de ports doivent être uniques.');
      return;
    }

    // Identifie les composants qui constitueront la définition :
    //  - mode normal : la sélection
    //  - mode édition : tous les composants du canevas (qui sont la définition)
    const sourceIds = editMode
      ? new Set(circuit.components.map((c) => c.id))
      : new Set(selection.components);
    const sourceComps = circuit.components.filter((c) => sourceIds.has(c.id));
    // Fils entièrement à l'intérieur de la définition
    const internalWires = circuit.wires.filter(
      (w) => sourceIds.has(w.from.componentId) && sourceIds.has(w.to.componentId),
    );
    // Fils qui traversaient la frontière (un seul bout dans la sélection) — seront perdus
    const boundaryWires = editMode
      ? []
      : circuit.wires.filter(
          (w) => sourceIds.has(w.from.componentId) !== sourceIds.has(w.to.componentId),
        );

    // Bloque les auto-références
    if (editMode?.definitionName !== trimmed) {
      const tempDefs = { ...circuit.customDefinitions } as Record<string, CustomDefData>;
      for (const c of sourceComps) {
        if (typeReferences(c.type, tempDefs, trimmed)) {
          alert(
            `Auto-référence détectée : "${c.type}" contient (directement ou indirectement) un "${trimmed}".`,
          );
          return;
        }
      }
    }

    // Construit la donnée de définition (pure) : ports valides, largeurs, clones.
    const newDef = buildCustomDefData(trimmed, inputs, outputs, sourceComps, internalWires);

    if (editMode) {
      // === MODE ÉDITION ===
      // On enregistre la définition modifiée et on revient au circuit principal.
      const newDefs = { ...editMode.backupCircuit.customDefinitions, [trimmed]: newDef };
      const oldName = editMode.definitionName;
      let backupComps = editMode.backupCircuit.components;
      let backupWires = editMode.backupCircuit.wires;
      if (oldName !== trimmed) {
        delete newDefs[oldName];
        backupComps = backupComps.map((c) => (c.type === oldName ? { ...c, type: trimmed } : c));
      }
      // Nettoyage des fils orphelins (ports qui ont disparu).
      // On regarde les ports réellement présents sur chaque composant individuel
      // (la géométrie dépend de l'état pour SPLITTER/MERGER/INPUT/OUTPUT en mode bus).
      backupWires = backupWires.filter((w) => {
        const fromComp = backupComps.find((c) => c.id === w.from.componentId);
        const toComp = backupComps.find((c) => c.id === w.to.componentId);
        if (!fromComp || !toComp) return false;
        const fromDef = getDef(fromComp.type, newDefs, fromComp);
        const toDef = getDef(toComp.type, newDefs, toComp);
        if (!fromDef || !toDef) return false;
        return (
          fromDef.outputs.some((p) => p.name === w.from.port) &&
          toDef.inputs.some((p) => p.name === w.to.port)
        );
      });
      commit({
        ...editMode.backupCircuit,
        components: backupComps,
        wires: backupWires,
        customDefinitions: newDefs,
      });
      setEditMode(null);
    } else {
      // === MODE NORMAL : encapsule la sélection sur place ===
      // Position de l'instance : centroïde de la bounding box des composants sélectionnés
      let minX = Infinity,
        minY = Infinity,
        maxX = -Infinity,
        maxY = -Infinity;
      for (const c of sourceComps) {
        const def = getDef(c.type, circuit.customDefinitions, c);
        if (!def) continue;
        if (c.x < minX) minX = c.x;
        if (c.y < minY) minY = c.y;
        if (c.x + def.w > maxX) maxX = c.x + def.w;
        if (c.y + def.h > maxY) maxY = c.y + def.h;
      }
      const centerX = (minX + maxX) / 2;
      const centerY = (minY + maxY) / 2;

      const tempDefs = { ...circuit.customDefinitions, [trimmed]: newDef };
      const newCustomDef = getDef(trimmed, tempDefs); // calcule w/h pour le rendu
      if (!newCustomDef) return;
      const instanceX = snap(centerX - newCustomDef.w / 2);
      const instanceY = snap(centerY - newCustomDef.h / 2);
      const newInstance: CircuitComponent = {
        id: uid('c'),
        type: trimmed,
        x: instanceX,
        y: instanceY,
        state: undefined,
        label: '',
      };

      // Construit le nouveau circuit : composants externes + nouvelle instance
      const newComponents = circuit.components
        .filter((c) => !sourceIds.has(c.id))
        .concat(newInstance);
      // Fils externes : ceux qui n'avaient aucun bout dans la sélection
      const newWires = circuit.wires.filter(
        (w) => !sourceIds.has(w.from.componentId) && !sourceIds.has(w.to.componentId),
      );

      commit({
        ...circuit,
        components: newComponents,
        wires: newWires,
        customDefinitions: tempDefs,
      });
      setSelection({ components: [newInstance.id], wires: [] });

      if (boundaryWires.length > 0) {
        // Notification non-bloquante via timeout (l'utilisateur la voit après que la modale se ferme)
        setTimeout(() => {
          alert(
            `${boundaryWires.length} fil(s) traversaient la frontière de la sélection et ont été supprimés. ` +
              `Reliez vos signaux externes aux ports du nouveau composant "${trimmed}".`,
          );
        }, 50);
      }
    }
    setSaveAsCompState(null);
  };

  // Entre en mode édition : sauve le circuit courant, charge la définition.
  const editDefinition = (name: string) => {
    if (editMode) return; // sécurité : déjà en édition
    const def = circuit.customDefinitions?.[name] as CustomDefData | undefined;
    if (!def) return;
    setEditMode({
      definitionName: name,
      backupCircuit: circuit,
    });
    commit({
      name: `Édition : ${name}`,
      components: def.circuit.components.map((c) => ({ ...c })),
      wires: def.circuit.wires.map((w) => ({ ...w, from: { ...w.from }, to: { ...w.to } })),
      customDefinitions: circuit.customDefinitions,
    });
    setSelection({ components: [], wires: [] });
  };

  // Quitte le mode édition sans sauver.
  const cancelEdit = () => {
    if (!editMode) return;
    commit(editMode.backupCircuit);
    setEditMode(null);
    setSelection({ components: [], wires: [] });
  };

  // Supprime une définition (seulement si elle n'est pas utilisée).
  const deleteDefinition = (name: string) => {
    // Vérifier l'usage : ni dans le circuit principal, ni dans une autre définition
    const usedHere = circuit.components.some((c) => c.type === name);
    let usedElsewhere = false;
    for (const [k, d] of Object.entries(circuit.customDefinitions ?? {})) {
      if (k === name) continue;
      if ((d as CustomDefData).circuit.components.some((c) => c.type === name)) {
        usedElsewhere = true;
        break;
      }
    }
    if (usedHere || usedElsewhere) {
      alert(
        `Impossible : "${name}" est utilisé ${usedHere ? 'dans le circuit' : ''}` +
          `${usedHere && usedElsewhere ? ' et ' : ''}` +
          `${usedElsewhere ? 'par une autre définition' : ''}.`,
      );
      setDeletePromptName(null);
      return;
    }
    commit((c) => {
      const newDefs = { ...c.customDefinitions };
      delete newDefs[name];
      return { ...c, customDefinitions: newDefs };
    });
    setDeletePromptName(null);
  };

  // -------- ÉVÉNEMENTS CANEVAS --------
  const handleCanvasMouseDown = (e: ReactMouseEvent) => {
    // Bouton du milieu = pan. Intercepté avant tout le reste, marche partout dans le SVG.
    if (handleCanvasMouseDownPan(e)) return;

    const target = e.target as HTMLElement;
    if (target !== e.currentTarget && !target.closest('[data-canvas-bg]')) return;
    const p = getSvgPoint(e);

    if (placeType) {
      placeComponent(placeType, p.x, p.y);
      setPlaceType(null);
      return;
    }
    if (wireStart) {
      wireMovedRef.current = false;
      setWireStart(null);
      return;
    }
    // Démarre une sélection rectangulaire. Si l'utilisateur ne bouge pas,
    // ce sera un simple clic qui efface la sélection au mouseUp.
    setRectSelect({
      startX: p.x,
      startY: p.y,
      x: p.x,
      y: p.y,
      w: 0,
      h: 0,
      didMove: false,
      additive: e.shiftKey,
      initialSelection: selection,
    });
  };

  const handleCanvasMouseMove = (e: ReactMouseEvent) => {
    // Si on est en train de pan, on intercepte avant tout
    if (handleCanvasMouseMovePan(e)) return;

    const p = getSvgPoint(e);
    // Pour les fils, checker si on a bougé de > 5px
    if (wireStart && !wireMovedRef.current) {
      if (Math.abs(p.x - wireStart.x) > 5 || Math.abs(p.y - wireStart.y) > 5) {
        wireMovedRef.current = true;
      }
    }
    // Ne mettre à jour mousePos que si on en a besoin pour le rendu (drag de
    // fil, sélection rectangulaire, placement). Sinon on évite un re-render.
    if (wireStart || rectSelect || placeType) {
      setMousePos(p);
    }

    if (dragRef.current) {
      const drag = dragRef.current;
      const dx = snap(p.x - drag.startX);
      const dy = snap(p.y - drag.startY);
      if (dx !== 0 || dy !== 0) drag.hasMoved = true;
      // On stocke l'offset dans un state séparé : pas de mutation de `circuit`,
      // donc pas de re-simulation, pas de re-render de la palette, etc.
      setDragOffset((prev) => {
        if (prev && prev.dx === dx && prev.dy === dy) return prev;
        return { dx, dy, ids: drag.idsSet };
      });
    } else if (rectSelect) {
      const x = Math.min(rectSelect.startX, p.x);
      const y = Math.min(rectSelect.startY, p.y);
      const w = Math.abs(p.x - rectSelect.startX);
      const h = Math.abs(p.y - rectSelect.startY);
      const didMove = rectSelect.didMove || w > 3 || h > 3;
      setRectSelect({ ...rectSelect, x, y, w, h, didMove });
    }
  };

  const handleCanvasMouseUp = () => {
    if (handleCanvasMouseUpPan()) return;

    if (dragRef.current) {
      const drag = dragRef.current;
      if (drag.hasMoved && dragOffset && (dragOffset.dx !== 0 || dragOffset.dy !== 0)) {
        // Commit la position finale en une seule fois dans `circuit`.
        const { dx, dy } = dragOffset;
        history.current.past.push(drag.snapshot);
        history.current.future = [];
        justDraggedRef.current = true;
        setCircuit((c) => ({
          ...c,
          components: c.components.map((comp) => {
            const orig = drag.origPositions.get(comp.id);
            if (!orig) return comp;
            return { ...comp, x: orig.x + dx, y: orig.y + dy };
          }),
        }));
      }
      dragRef.current = null;
      setDragOffset(null);
    }
    if (rectSelect) {
      if (rectSelect.didMove) {
        // Trouve les composants dont la bounding box croise le cadre
        const inRect = circuit.components
          .filter((comp) => {
            const def = getDef(comp.type, circuit.customDefinitions, comp);
            if (!def) return false;
            const cx2 = comp.x + def.w;
            const cy2 = comp.y + def.h;
            return !(
              cx2 < rectSelect.x ||
              comp.x > rectSelect.x + rectSelect.w ||
              cy2 < rectSelect.y ||
              comp.y > rectSelect.y + rectSelect.h
            );
          })
          .map((c) => c.id);

        if (rectSelect.additive) {
          // Shift+drag : on ajoute à la sélection préalable
          const set = new Set([...rectSelect.initialSelection.components, ...inRect]);
          setSelection({ components: [...set], wires: rectSelect.initialSelection.wires });
        } else {
          setSelection({ components: inRect, wires: [] });
        }
      } else {
        // Pas de drag : c'était un simple clic
        if (!rectSelect.additive) {
          // Sans Shift : on efface la sélection
          setSelection({ components: [], wires: [] });
        }
        // Avec Shift : on préserve la sélection en cours
      }
      setRectSelect(null);
    }
  };

  const handleComponentMouseDown = (e: ReactMouseEvent, comp: CircuitComponent) => {
    e.stopPropagation();
    if (placeType || wireStart) return;
    justDraggedRef.current = false;

    const isSelected = selection.components.includes(comp.id);
    let newSel: Selection;
    if (e.shiftKey) {
      newSel = isSelected
        ? { ...selection, components: selection.components.filter((id) => id !== comp.id) }
        : { ...selection, components: [...selection.components, comp.id] };
    } else if (!isSelected) {
      newSel = { components: [comp.id], wires: [] };
    } else {
      newSel = selection;
    }
    setSelection(newSel);

    // Circuit verrouillé : on garde la sélection (pour voir les Propriétés et
    // basculer une entrée au clic) mais on ne démarre AUCUN déplacement.
    if (locked) return;

    // Start drag tracking
    const p = getSvgPoint(e);
    const ids = new Set(newSel.components);
    const origPositions = new Map<string, { x: number; y: number }>();
    circuit.components.forEach((c) => {
      if (ids.has(c.id)) origPositions.set(c.id, { x: c.x, y: c.y });
    });
    dragRef.current = {
      startX: p.x,
      startY: p.y,
      origPositions,
      idsSet: ids,
      snapshot: circuit,
      hasMoved: false,
    };
  };

  const handleComponentClick = (e: ReactMouseEvent, comp: CircuitComponent) => {
    e.stopPropagation();
    const wasDragged = justDraggedRef.current;
    justDraggedRef.current = false;
    if (wasDragged) return;
    if (comp.type === 'CLOCK') {
      toggleClock(comp.id);
      return;
    }
    if (comp.type !== 'INPUT') return;
    const width = comp.state?.width ?? 1;
    if (width === 1) {
      toggleInput(comp.id);
      return;
    }
    // Bus : on détermine quel bit a été cliqué en fonction de la position locale.
    const svg = svgRef.current;
    if (!svg) return;
    const ctm = svg.getScreenCTM();
    if (!ctm) return;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const p = pt.matrixTransform(ctm.inverse());
    const localX = p.x - comp.x;
    const localY = p.y - comp.y;
    // La rangée de cellules occupe x ∈ [0, width*cellSize] et y ∈ [12, 46]
    // (geom : h=52, cellY=12, cellH=34)
    const cellSize = INPUT_BUS_CELL_SIZE;
    if (localY < 12 || localY > 46) return;
    if (localX < 0 || localX >= width * cellSize) return;
    const visualIdx = Math.floor(localX / cellSize);
    const bitIdx = width - 1 - visualIdx; // MSB à gauche
    toggleInputBit(comp.id, bitIdx);
  };

  const handlePortMouseDown = (
    e: ReactMouseEvent,
    comp: CircuitComponent,
    port: Port,
    kind: 'input' | 'output',
  ) => {
    e.stopPropagation();
    if (placeType || locked) return;
    if (kind === 'output') {
      // Start a new wire
      wireMovedRef.current = false;
      const pos = getPortPosition(comp, port.name, kind, circuit.customDefinitions);
      if (!pos) return;
      setWireStart({ componentId: comp.id, port: port.name, x: pos.x, y: pos.y });
    } else if (kind === 'input' && wireStart) {
      addWire(
        { componentId: wireStart.componentId, port: wireStart.port },
        { componentId: comp.id, port: port.name },
      );
      wireMovedRef.current = false;
      setWireStart(null);
    }
  };

  const handleWireClick = (e: ReactMouseEvent, wire: Wire) => {
    e.stopPropagation();
    if (e.shiftKey) {
      setSelection((s) => ({
        ...s,
        wires: s.wires.includes(wire.id)
          ? s.wires.filter((id) => id !== wire.id)
          : [...s.wires, wire.id],
      }));
    } else {
      setSelection({ components: [], wires: [wire.id] });
    }
  };

  // -------- DRAG-AND-DROP DEPUIS LA PALETTE --------
  // mouseDown sur un item de palette : on suit le curseur via window-level listeners.
  // - Si le pointeur bouge (au-delà du seuil), c'est un vrai drag : on dépose au mouseUp
  //   sur le canevas, on annule si on est ailleurs.
  // - Si le pointeur ne bouge pas, c'est un clic simple : on active le mode click-to-place
  //   (le prochain clic sur le canevas placera le composant). Garde un fallback pour les
  //   utilisateurs qui ne veulent pas glisser.
  const handlePaletteMouseDown = (e: ReactMouseEvent, type: string) => {
    e.preventDefault();
    const startX = e.clientX;
    const startY = e.clientY;
    let current: PaletteDragState = { type, mouseX: startX, mouseY: startY, didMove: false };
    setPaletteDrag(current);
    setPlaceType(null); // annule un éventuel mode "click-to-place" en cours
    setWireStart(null);

    const onMove = (ev: MouseEvent) => {
      const dx = Math.abs(ev.clientX - startX);
      const dy = Math.abs(ev.clientY - startY);
      const didMove = current.didMove || dx > 4 || dy > 4;
      current = { ...current, mouseX: ev.clientX, mouseY: ev.clientY, didMove };
      setPaletteDrag(current);
    };

    const onUp = (ev: MouseEvent) => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);

      if (current.didMove) {
        // Drop : on vérifie que la souris est au-dessus du canevas SVG
        const svg = svgRef.current;
        const ctm = svg?.getScreenCTM();
        if (svg && ctm) {
          const r = svg.getBoundingClientRect();
          if (
            ev.clientX >= r.left &&
            ev.clientX <= r.right &&
            ev.clientY >= r.top &&
            ev.clientY <= r.bottom
          ) {
            const pt = svg.createSVGPoint();
            pt.x = ev.clientX;
            pt.y = ev.clientY;
            const p = pt.matrixTransform(ctm.inverse());
            // Centre le composant sur la position du curseur (pour matcher le ghost)
            const def = getDef(current.type, circuit.customDefinitions);
            if (def) placeComponent(current.type, p.x - def.w / 2, p.y - def.h / 2);
          }
          // sinon : drop hors canevas → on annule sans rien faire
        }
      } else {
        // Clic sans drag → on entre en mode click-to-place
        setPlaceType(current.type);
      }
      setPaletteDrag(null);
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  // -------- RACCOURCIS CLAVIER (voir hooks/useKeyboardShortcuts) --------
  useKeyboardShortcuts({
    saveAsCompState,
    deletePromptName,
    setSaveAsCompState,
    setDeletePromptName,
    setPlaceType,
    setWireStart,
    setSelection,
    deleteSelection,
    undo,
    redo,
    copySelection,
    pasteClipboard,
    saveToFile,
  });

  // -------- ONGLETS (zones de travail) --------
  const MAX_TABS = 10;
  const switchTab = useCallback(
    (tabId: string) => {
      if (editMode) return; // sécurité : on ne quitte pas une édition en cours via les onglets
      setTabsState((prev) => {
        if (!prev.tabs.some((t) => t.id === tabId)) return prev;
        if (prev.activeTabId === tabId) return prev;
        return { ...prev, activeTabId: tabId };
      });
      setSelection({ components: [], wires: [] });
      setPlaceType(null);
      setWireStart(null);
    },
    [editMode],
  );

  const addTab = useCallback(() => {
    if (editMode) return;
    setTabsState((prev) => {
      if (prev.tabs.length >= MAX_TABS) return prev;
      // Nom par défaut : "Onglet 2", "Onglet 3"... en évitant les collisions
      let n = prev.tabs.length + 1;
      const used = new Set(prev.tabs.map((t) => t.name));
      while (used.has(`Onglet ${n}`)) n += 1;
      const tab = makeEmptyTab(`Onglet ${n}`);
      return { ...prev, tabs: [...prev.tabs, tab], activeTabId: tab.id };
    });
    setSelection({ components: [], wires: [] });
    setPlaceType(null);
    setWireStart(null);
  }, [editMode]);

  const closeTab = useCallback(
    (tabId: string) => {
      if (editMode) return;
      // Confirmation si l'onglet contient du travail (composants ou fils).
      // L'historique de l'onglet est jeté à la fermeture donc on prévient.
      const tab = tabsState.tabs.find((t) => t.id === tabId);
      if (!tab) return;
      const isEmpty = tab.components.length === 0 && tab.wires.length === 0;
      if (!isEmpty) {
        const ok = window.confirm(
          `Fermer l'onglet « ${tab.name} » ? Son contenu et son historique seront perdus.`,
        );
        if (!ok) return;
      }
      setTabsState((prev) => {
        if (prev.tabs.length <= 1) return prev; // toujours au moins un onglet
        const idx = prev.tabs.findIndex((t) => t.id === tabId);
        if (idx < 0) return prev;
        const newTabs = prev.tabs.slice(0, idx).concat(prev.tabs.slice(idx + 1));
        const newActive =
          prev.activeTabId === tabId
            ? newTabs[Math.min(idx, newTabs.length - 1)].id
            : prev.activeTabId;
        return { ...prev, tabs: newTabs, activeTabId: newActive };
      });
      // L'historique de l'onglet fermé est jeté.
      dropTabHistory(tabId);
      setSelection({ components: [], wires: [] });
    },
    [editMode, tabsState.tabs, dropTabHistory],
  );

  const renameTab = useCallback((tabId: string, name: string) => {
    setTabsState((prev) => {
      const idx = prev.tabs.findIndex((t) => t.id === tabId);
      if (idx < 0) return prev;
      const newTabs = prev.tabs.slice();
      newTabs[idx] = { ...newTabs[idx], name };
      return { ...prev, tabs: newTabs };
    });
  }, []);

  // -------- RENDU --------
  return (
    <div
      className="w-full h-screen flex flex-col bg-stone-50 overflow-hidden"
      style={{ fontFamily: "'IBM Plex Sans', sans-serif" }}
    >
      {/* Google Fonts */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500;600&display=swap');
      `}</style>

      {/* ===== BARRE D'OUTILS ===== */}
      <Toolbar
        onSave={saveToFile}
        fileInputRef={fileInputRef}
        onLoadFile={loadFromFile}
        onUndo={undo}
        canUndo={history.current.past.length > 0}
        onRedo={redo}
        canRedo={history.current.future.length > 0}
        onCopy={copySelection}
        canCopy={selection.components.length > 0}
        onPaste={pasteClipboard}
        canPaste={!locked && !!clipboard}
        onDelete={deleteSelection}
        canDelete={!locked && (selection.components.length > 0 || selection.wires.length > 0)}
        onEncapsulate={openSaveAsComp}
        canEncapsulate={canEncapsulate}
        editMode={!!editMode}
        onCancelEdit={cancelEdit}
        embed={embed}
        viewBox={viewBox}
        viewBoxBase={viewBoxBaseRef.current}
        onResetView={resetView}
        onOpenBuilder={() => setBuilderOpen(true)}
        preferencesOpen={rightPanelMode === 'preferences'}
        onTogglePreferences={() =>
          setRightPanelMode((m) => (m === 'preferences' ? null : 'preferences'))
        }
        hasManualClock={circuit.components.some((c) => c.type === 'CLOCK' && !c.state?.running)}
        onTick={tickClocks}
        hasCycle={sim.hasCycle}
        wireWidthMismatch={wireWidthMismatch}
      />

      {/* ===== BARRE D'ONGLETS ===== (masquée en mode embed : une seule zone de travail) */}
      {!embed && (
        <TabsBar
          tabs={tabsState.tabs}
          activeTabId={tabsState.activeTabId}
          editMode={!!editMode}
          maxTabs={MAX_TABS}
          onSwitch={switchTab}
          onRename={renameTab}
          onClose={closeTab}
          onAdd={addTab}
        />
      )}

      {/* ===== ZONE PRINCIPALE ===== */}
      <div className="flex-1 flex overflow-hidden">
        {/* PANNEAU GAUCHE : CONSIGNE DE L'EXERCICE (si ?ex=…) OU PALETTE */}
        {exercise ? (
          <ExercisePanel
            exercise={exercise}
            result={exerciseResult}
            embed={embed}
            locked={locked}
            onVerify={runVerify}
            onRetry={() => setExerciseResult(null)}
            onPaletteMouseDown={handlePaletteMouseDown}
            placeType={placeType}
            customDefs={circuit.customDefinitions}
          />
        ) : (
          <PalettePanel
            onPaletteMouseDown={handlePaletteMouseDown}
            placeType={placeType}
            customDefs={circuit.customDefinitions}
            editMode={editMode}
            onEditDefinition={editDefinition}
            onDeleteDefinition={setDeletePromptName}
            onCancelPlace={() => setPlaceType(null)}
          />
        )}

        {/* CANEVAS */}
        <div className="flex-1 relative overflow-hidden bg-stone-100">
          {editMode && (
            <div className="absolute top-0 left-0 right-0 z-20 bg-amber-100 border-b border-amber-300 px-4 py-2 flex items-center gap-3 shadow-sm">
              <Package size={16} className="text-amber-700" />
              <span className="text-sm text-stone-800">
                Édition de la définition :{' '}
                <strong className="font-mono">{editMode.definitionName}</strong>
              </span>
              <span className="text-xs text-stone-500">
                — Modifiez le sous-circuit puis cliquez sur "Terminer" pour enregistrer.
              </span>
            </div>
          )}

          {/* La consigne de l'exercice vit entièrement dans le panneau de gauche :
              le canevas reste libre de toute superposition. */}
          <CircuitCanvas
            svgRef={svgRef}
            viewBox={viewBox}
            prefs={prefs}
            circuit={circuit}
            sim={sim}
            selection={selection}
            dragOffset={dragOffset}
            wireStart={wireStart}
            mousePos={mousePos}
            wireMovedRef={wireMovedRef}
            rectSelect={rectSelect}
            placeType={placeType}
            paletteDrag={paletteDrag}
            panRef={panRef}
            onCanvasMouseDown={handleCanvasMouseDown}
            onCanvasMouseMove={handleCanvasMouseMove}
            onCanvasMouseUp={handleCanvasMouseUp}
            onCanvasWheel={handleCanvasWheel}
            onWireClick={handleWireClick}
            onComponentMouseDown={handleComponentMouseDown}
            onComponentClick={handleComponentClick}
            onPortMouseDown={handlePortMouseDown}
          />

          {/* Empty-state hint */}
          {circuit.components.length === 0 && !locked && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="text-stone-400 text-center max-w-sm">
                <div className="text-sm font-medium mb-2">Zone de travail vide</div>
                <div className="text-xs">
                  Sélectionnez un composant dans la palette à gauche, puis cliquez sur la grille
                  pour le placer.
                </div>
              </div>
            </div>
          )}

          {/* PANNEAU DROIT — overlay contextuel (voir components/RightPanel) */}
          <RightPanel
            mode={rightPanelMode}
            circuit={circuit}
            selection={selection}
            sim={sim}
            onUpdate={updateComponent}
            trace={trace}
            traceEnabled={traceEnabled}
            onToggleTrace={() => setTraceEnabled((v) => !v)}
            onClearTrace={clearTrace}
            prefs={prefs}
            onChangePrefs={setPrefs}
            onSetMode={setRightPanelMode}
          />
        </div>
      </div>

      {/* Ghost qui suit le curseur pendant le drag depuis la palette */}
      <PaletteDragGhost paletteDrag={paletteDrag} customDefs={circuit.customDefinitions} />

      {/* === MODALE SAUVER COMME COMPOSANT === */}
      {saveAsCompState && (
        <SaveAsComponentModal
          state={saveAsCompState}
          setState={setSaveAsCompState}
          editMode={!!editMode}
          nameExists={!editMode && !!circuit.customDefinitions?.[saveAsCompState.name.trim()]}
          onClose={() => setSaveAsCompState(null)}
          onConfirm={confirmSaveAsComp}
        />
      )}

      {/* === MODALE CRÉATION D'EXERCICE PARTAGEABLE === */}
      {builderOpen && (
        <ExerciseBuilderModal
          circuit={circuit}
          computeOutputs={computeExerciseOutputs}
          onClose={() => setBuilderOpen(false)}
        />
      )}

      {/* === CONFIRMATION DE SUPPRESSION === */}
      {deletePromptName && (
        <DeleteDefinitionModal
          name={deletePromptName}
          onCancel={() => setDeletePromptName(null)}
          onConfirm={() => deleteDefinition(deletePromptName)}
        />
      )}
    </div>
  );
}
