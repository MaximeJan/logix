// Définitions de composants — catégorie « bus ». Agrégées dans ./index.
import { asInt, maskTo } from '../lib/sim';
import { UprightText } from './UprightText';
import { busNodeLayout } from './busLayout';
import { rectLayout, type RectPort } from './rectLayout';
import { RectShape } from './RectShape';
import type { GateDef } from './types';
import type { CircuitComponent } from '../domain/types';

const NO_SEL = { userSelect: 'none' as const, pointerEvents: 'none' as const };
const MONO = "'IBM Plex Mono', monospace";

const orientationOf = (comp?: CircuitComponent) => comp?.state?.orientation;
const busSources = (state?: { sources?: number }) =>
  Math.max(2, Math.min(8, Math.floor(state?.sources ?? 2)));

// Ports des boîtes « bus » : tous les 20 px, dimensions arrondies à la grille,
// pour que deux composants alignés se relient par un fil droit.
const ON_GRID = { spacing: 20, grid: 20 } as const;

// Fond coloré derrière l'étiquette d'un port (bit à 1, sortie active…).
function labelHighlight(p: RectPort, key: string) {
  const w = p.label.length * 7.2 + 6;
  const x = p.anchor === 'start' ? p.lx - 3 : p.anchor === 'end' ? p.lx - w + 3 : p.lx - w / 2;
  return (
    <rect
      key={key}
      x={x}
      y={p.ly - 11}
      width={w}
      height={15}
      rx="2"
      fill="var(--lcd-text, #fbbf24)"
      opacity="0.4"
    />
  );
}

const sliceLayout = (comp?: CircuitComponent) => {
  const { width, n } = sliceRange(comp?.state);
  return rectLayout({
    orientation: orientationOf(comp),
    inputs: [{ name: 'in', width, label: '' }],
    outputs: [{ name: 'out', width: n, label: '' }],
    contentW: 50,
    contentH: 36,
    inMargin: 4,
    outMargin: 4,
    ...ON_GRID,
  });
};

// Bits d'un séparateur/fusionneur, MSB en premier (convention : MSB à l'extérieur).
const bitSpecs = (n: number) =>
  Array.from({ length: n }, (_, i) => {
    const bit = n - 1 - i;
    return { name: `b${bit}`, width: 1, label: String(bit) };
  });

const splitterLayout = (comp?: CircuitComponent) => {
  const n = comp?.state?.width ?? 4;
  return rectLayout({
    orientation: orientationOf(comp),
    inputs: [{ name: 'in', width: n, label: 'in' }],
    outputs: bitSpecs(n),
    contentW: 0,
    contentH: 0,
    inMargin: 22,
    outMargin: 22,
    ...ON_GRID,
  });
};

const mergerLayout = (comp?: CircuitComponent) => {
  const n = comp?.state?.width ?? 4;
  return rectLayout({
    orientation: orientationOf(comp),
    inputs: bitSpecs(n),
    outputs: [{ name: 'out', width: n, label: 'out' }],
    contentW: 0,
    contentH: 0,
    inMargin: 22,
    outMargin: 28,
    ...ON_GRID,
  });
};

const decoderLayout = (comp?: CircuitComponent) => {
  const bw = comp?.state?.width ?? 2;
  const n = 1 << bw;
  return rectLayout({
    orientation: orientationOf(comp),
    inputs: [{ name: 'in', width: bw, label: 'in' }],
    outputs: Array.from({ length: n }, (_, i) => ({ name: `out${i}`, width: 1, label: String(i) })),
    contentW: 26,
    contentH: 12,
    inMargin: 22,
    outMargin: 22,
    ...ON_GRID,
  });
};

// MUX / DEMUX : voies tous les 20 px (y = 30, 50, …), sélecteur au milieu du bas.
const MUX_W = 80;
const laneY = (i: number) => 30 + 20 * i;
const muxGeom = (sw: number) => {
  const n = 1 << sw;
  return { n, h: 20 * n + 40 };
};

const clampInt = (v: number, min: number, max: number) =>
  Math.max(min, Math.min(max, Math.floor(v)));

// Bornes normalisées d'une tranche : largeur 1..32, 0 ≤ lo ≤ hi ≤ largeur-1.
function sliceRange(state?: { width?: number; hi?: number; lo?: number }) {
  const width = clampInt(state?.width ?? 8, 1, 32);
  const lo = clampInt(state?.lo ?? 0, 0, width - 1);
  const hi = clampInt(state?.hi ?? width - 1, lo, width - 1);
  return { width, lo, hi, n: hi - lo + 1 };
}

export const busGates: Record<string, GateDef> = {
  SLICE: {
    label: 'Tranche',
    category: 'Bus',
    w: 100,
    h: 80,
    inputs: [],
    outputs: [],
    // Extrait le champ de bits [hi..lo] d'un bus `in` de `width` bits.
    // out = (in >> lo) sur (hi-lo+1) bits. Idéal pour décoder une instruction
    // (opcode = [7..4], Rd = [3..2], Rs = [1..0]). Dessin fixe.
    fixedDisplay: true,
    defaultState: { width: 8, hi: 3, lo: 0 },
    getDynamicGeometry: (comp) => {
      const L = sliceLayout(comp);
      return { w: L.w, h: L.h, inputs: L.inputs, outputs: L.outputs };
    },
    shape: (comp, outputValue) => {
      const { lo, hi, n } = sliceRange(comp?.state);
      const L = sliceLayout(comp);
      const outVal = maskTo(n, asInt(outputValue)) >>> 0;
      const c = L.content;
      const cx = c.x + c.w / 2;
      return (
        <RectShape layout={L}>
          <text x={cx} y={c.y + 8} textAnchor="middle" fontSize="8" fill="#94a3b8" style={NO_SEL}>
            tranche
          </text>
          <text
            x={cx}
            y={c.y + 22}
            textAnchor="middle"
            fontSize="12"
            fontWeight="700"
            fontFamily={MONO}
            fill="#1f2937"
            style={NO_SEL}
          >
            [{hi}:{lo}]
          </text>
          <text
            x={cx}
            y={c.y + 34}
            textAnchor="middle"
            fontSize="10"
            fontWeight="700"
            fontFamily={MONO}
            fill={outVal ? '#1f2937' : '#94a3b8'}
            style={NO_SEL}
          >
            {outVal}
          </text>
        </RectShape>
      );
    },
  },
  BUS: {
    label: 'Bus',
    category: 'Bus',
    w: 120,
    h: 120,
    inputs: [],
    outputs: [],
    // Bus « un seul émetteur à la fois » : N sources, chacune = une donnée
    // `in{k}` (largeur du bus) + une activation `en{k}` (1 bit). La sortie `bus`
    // porte la valeur de la source active ; ≥2 activations = conflit (rouge).
    // width = largeur du bus ; sources = nombre d'émetteurs (2..8).
    // Dessin fixe (texte toujours droit) : l'orientation place les couples
    // (donnée, activation) sur un bord et la sortie sur le bord opposé.
    fixedDisplay: true,
    defaultState: { width: 8, sources: 2 },
    getDynamicGeometry: (comp) => {
      const L = busNodeLayout(
        busSources(comp?.state),
        comp?.state?.width ?? 8,
        orientationOf(comp),
      );
      return { w: L.w, h: L.h, inputs: L.inputs, outputs: L.outputs };
    },
    shape: (comp, outputValue, _i, inputsByName) => {
      const width = comp?.state?.width ?? 8;
      const sources = busSources(comp?.state);
      const L = busNodeLayout(sources, width, orientationOf(comp));
      const accent = 'var(--lcd-text, #fbbf24)';
      const red = '#dc2626';
      const enables: number[] = [];
      for (let k = 0; k < sources; k++) enables.push(asInt(inputsByName?.[`en${k}`] ?? 0) & 1);
      const activeCount = enables.reduce((s, e) => s + e, 0);
      const conflict = activeCount > 1;
      const outVal = maskTo(width, asInt(outputValue)) >>> 0;
      const { box } = L;
      return (
        <>
          {L.stubs.map((st) => (
            <line
              key={st.name}
              x1={st.x1}
              y1={st.y1}
              x2={st.x2}
              y2={st.y2}
              strokeWidth={st.name.startsWith('en') ? 1.2 : 1.6}
            />
          ))}
          <rect
            x={box.x}
            y={box.y}
            width={box.w}
            height={box.h}
            rx="3"
            fill="white"
            stroke={conflict ? red : '#0f172a'}
            strokeWidth="2"
          />
          <g stroke="none" fontFamily={MONO} style={NO_SEL}>
            {L.slots.map((sl) => {
              const on = enables[sl.k] === 1;
              const tint = conflict ? red : accent;
              return (
                <g key={sl.k}>
                  {/* Couple (donnée, activation) d'une même source, surligné si active */}
                  <rect
                    x={sl.rect.x}
                    y={sl.rect.y}
                    width={sl.rect.w}
                    height={sl.rect.h}
                    rx="3"
                    fill={on ? tint : 'none'}
                    fillOpacity={on ? (conflict ? 0.18 : 0.3) : 0}
                    stroke={on ? tint : '#cbd5e1'}
                    strokeWidth="1"
                  />
                  <text
                    x={sl.data.x}
                    y={sl.data.y}
                    textAnchor={sl.data.anchor}
                    fontSize="12"
                    fontWeight="700"
                    fill={on ? '#1f2937' : '#475569'}
                  >
                    s{sl.k}
                  </text>
                  <text
                    x={sl.en.x}
                    y={sl.en.y}
                    textAnchor={sl.en.anchor}
                    fontSize="9"
                    fontWeight={on ? '700' : '400'}
                    fill={on ? '#1f2937' : '#94a3b8'}
                  >
                    en
                  </text>
                </g>
              );
            })}
            <text
              x={L.title.x}
              y={L.title.y}
              textAnchor="middle"
              fontSize="11"
              fontWeight="700"
              fontFamily="'IBM Plex Sans', sans-serif"
              letterSpacing="0.5"
              fill={conflict ? red : '#475569'}
            >
              {conflict ? 'CONFLIT' : 'BUS'}
            </text>
            <text
              x={L.busLabel.x}
              y={L.busLabel.y}
              textAnchor={L.busLabel.anchor}
              fontSize="9"
              fill="#94a3b8"
            >
              bus
            </text>
            <text
              x={L.value.x}
              y={L.value.y}
              textAnchor={L.value.anchor}
              fontSize="12"
              fontWeight="700"
              fill={activeCount >= 1 ? '#1f2937' : '#94a3b8'}
            >
              {outVal}
            </text>
          </g>
        </>
      );
    },
  },
  MUX: {
    label: 'Multiplexeur',
    category: 'Bus',
    w: 80,
    h: 80,
    inputs: [],
    outputs: [],
    // selectWidth = nombre de bits de sélection (1, 2, 3 → 2, 4, 8 voies)
    // dataWidth   = largeur de chaque voie (1, 2, 4, 8, 16)
    // Ports tous les 20 px, sur la grille : des fils droits depuis des composants alignés.
    defaultState: { selectWidth: 1, dataWidth: 1 },
    getDynamicGeometry: (comp) => {
      const sw = comp?.state?.selectWidth ?? 1;
      const dw = comp?.state?.dataWidth ?? 1;
      const { n, h } = muxGeom(sw);
      const inputs = [];
      for (let i = 0; i < n; i++) inputs.push({ name: `in${i}`, x: 0, y: laneY(i), width: dw });
      inputs.push({ name: 'sel', x: MUX_W / 2, y: h, width: sw });
      return { w: MUX_W, h, inputs, outputs: [{ name: 'out', x: MUX_W, y: h / 2, width: dw }] };
    },
    shape: (comp, _o, _i, inputsByName, angle) => {
      const sw = comp?.state?.selectWidth ?? 1;
      const { n, h } = muxGeom(sw);
      const w = MUX_W;
      const selVal = maskTo(sw, asInt(inputsByName?.sel ?? 0));
      const activeIdx = selVal < n ? selVal : -1;
      const accent = 'var(--lcd-text, #fbbf24)';
      const lanes = Array.from({ length: n }, (_, i) => i);
      // Pivoté d'un quart de tour, « sel » s'écarte du bord biseauté (sinon il le touche).
      const vertical = angle === 90 || angle === 270;
      return (
        <>
          {lanes.map((i) => (
            <line key={`il${i}`} x1="0" y1={laneY(i)} x2="14" y2={laneY(i)} strokeWidth="1.2" />
          ))}
          <line x1={w - 14} y1={h / 2} x2={w} y2={h / 2} strokeWidth="1.2" />
          <line x1={w / 2} y1={h} x2={w / 2} y2={h - 16} strokeWidth="1.2" />
          <path
            d={`M 14 10 L ${w - 14} 22 L ${w - 14} ${h - 22} L 14 ${h - 10} Z`}
            fill="white"
            stroke="#0f172a"
            strokeWidth="2"
            strokeLinejoin="round"
          />
          {activeIdx >= 0 && (
            <rect
              x="17"
              y={laneY(activeIdx) - 8}
              width="14"
              height="16"
              rx="2"
              fill={accent}
              opacity="0.35"
              stroke="none"
            />
          )}
          <g stroke="none">
            {lanes.map((i) => (
              <UprightText
                angle={angle}
                key={`it${i}`}
                x="20"
                y={laneY(i) + 4}
                fontSize="12"
                fontWeight={i === activeIdx ? '700' : '600'}
                fontFamily={MONO}
                fill={i === activeIdx ? '#1f2937' : '#475569'}
                style={NO_SEL}
              >
                {i}
              </UprightText>
            ))}
            <UprightText
              angle={angle}
              x={w / 2 + 6}
              y={h / 2 + 4}
              textAnchor="middle"
              fontSize="11"
              fontWeight="700"
              fontFamily="'IBM Plex Sans', sans-serif"
              fill="#475569"
              style={NO_SEL}
            >
              MUX
            </UprightText>
            <UprightText
              angle={angle}
              x={w / 2 + 4}
              y={h - (vertical ? 24 : 19)}
              textAnchor="middle"
              fontSize="9"
              fontWeight="700"
              fontFamily={MONO}
              fill="#1f2937"
              style={NO_SEL}
            >
              sel
            </UprightText>
          </g>
        </>
      );
    },
  },
  DEMUX: {
    label: 'Démultiplexeur',
    category: 'Bus',
    w: 80,
    h: 80,
    inputs: [],
    outputs: [],
    defaultState: { selectWidth: 1, dataWidth: 1 },
    getDynamicGeometry: (comp) => {
      const sw = comp?.state?.selectWidth ?? 1;
      const dw = comp?.state?.dataWidth ?? 1;
      const { n, h } = muxGeom(sw);
      const outputs = [];
      for (let i = 0; i < n; i++)
        outputs.push({ name: `out${i}`, x: MUX_W, y: laneY(i), width: dw });
      return {
        w: MUX_W,
        h,
        inputs: [
          { name: 'in', x: 0, y: h / 2, width: dw },
          { name: 'sel', x: MUX_W / 2, y: h, width: sw },
        ],
        outputs,
      };
    },
    shape: (comp, _o, _i, inputsByName, angle) => {
      const sw = comp?.state?.selectWidth ?? 1;
      const { n, h } = muxGeom(sw);
      const w = MUX_W;
      const selVal = maskTo(sw, asInt(inputsByName?.sel ?? 0));
      const activeIdx = selVal < n ? selVal : -1;
      const accent = 'var(--lcd-text, #fbbf24)';
      const lanes = Array.from({ length: n }, (_, i) => i);
      // Pivoté d'un quart de tour, « sel » s'écarte du bord biseauté (sinon il le touche).
      const vertical = angle === 90 || angle === 270;
      return (
        <>
          {lanes.map((i) => (
            <line key={`ol${i}`} x1={w - 14} y1={laneY(i)} x2={w} y2={laneY(i)} strokeWidth="1.2" />
          ))}
          <line x1="0" y1={h / 2} x2="14" y2={h / 2} strokeWidth="1.2" />
          <line x1={w / 2} y1={h} x2={w / 2} y2={h - 16} strokeWidth="1.2" />
          {/* Boîtier trapézoïdal (étroit à gauche, large à droite) */}
          <path
            d={`M 14 22 L ${w - 14} 10 L ${w - 14} ${h - 10} L 14 ${h - 22} Z`}
            fill="white"
            stroke="#0f172a"
            strokeWidth="2"
            strokeLinejoin="round"
          />
          {activeIdx >= 0 && (
            <rect
              x={w - 31}
              y={laneY(activeIdx) - 8}
              width="14"
              height="16"
              rx="2"
              fill={accent}
              opacity="0.35"
              stroke="none"
            />
          )}
          <g stroke="none">
            {lanes.map((i) => (
              <UprightText
                angle={angle}
                key={`ot${i}`}
                x={w - 20}
                y={laneY(i) + 4}
                fontSize="12"
                textAnchor="end"
                fontWeight={i === activeIdx ? '700' : '600'}
                fontFamily={MONO}
                fill={i === activeIdx ? '#1f2937' : '#475569'}
                style={NO_SEL}
              >
                {i}
              </UprightText>
            ))}
            <UprightText
              angle={angle}
              x={w / 2 - 6}
              y={h / 2 + 4}
              textAnchor="middle"
              fontSize="11"
              fontWeight="700"
              fontFamily="'IBM Plex Sans', sans-serif"
              fill="#475569"
              style={NO_SEL}
            >
              DMX
            </UprightText>
            <UprightText
              angle={angle}
              x={w / 2 + (vertical ? 6 : -4)}
              y={h - (vertical ? 24 : 19)}
              textAnchor="middle"
              fontSize="9"
              fontWeight="700"
              fontFamily={MONO}
              fill="#1f2937"
              style={NO_SEL}
            >
              sel
            </UprightText>
          </g>
        </>
      );
    },
  },
  DECODER: {
    label: 'Décodeur',
    category: 'Bus',
    w: 100,
    h: 120,
    inputs: [],
    outputs: [],
    // width = nombre de bits d'entrée ; produit 2^width sorties 1-bit. Dessin fixe.
    fixedDisplay: true,
    defaultState: { width: 2 },
    getDynamicGeometry: (comp) => {
      const L = decoderLayout(comp);
      return { w: L.w, h: L.h, inputs: L.inputs, outputs: L.outputs };
    },
    shape: (comp, _o, _i, inputsByName) => {
      const bw = comp?.state?.width ?? 2;
      const n = 1 << bw;
      const L = decoderLayout(comp);
      const inVal = maskTo(bw, asInt(inputsByName?.in ?? 0));
      const active = L.ports.find((p) => p.name === `out${inVal}`);
      const c = L.content;
      return (
        <RectShape layout={L}>
          {active && labelHighlight(active, 'hl')}
          <text
            x={c.x + c.w / 2}
            y={c.y + c.h / 2 + 3}
            textAnchor="middle"
            fontSize="9"
            fontFamily={MONO}
            fill="#94a3b8"
            style={NO_SEL}
          >
            {bw}→{n}
          </text>
        </RectShape>
      );
    },
  },
  SPLITTER: {
    label: 'Séparateur',
    category: 'Bus',
    w: 80,
    h: 120,
    inputs: [],
    outputs: [],
    // width = largeur du bus d'entrée ; produit `width` sorties 1-bit.
    // MSB en premier (en haut, ou à gauche si les sorties sont en bas/haut). Dessin fixe.
    fixedDisplay: true,
    defaultState: { width: 4 },
    getDynamicGeometry: (comp) => {
      const L = splitterLayout(comp);
      return { w: L.w, h: L.h, inputs: L.inputs, outputs: L.outputs };
    },
    shape: (comp, _o, inputValue) => {
      const n = comp?.state?.width ?? 4;
      const L = splitterLayout(comp);
      const busVal = maskTo(n, asInt(inputValue));
      return (
        <RectShape layout={L}>
          {L.ports
            .filter((p) => p.name !== 'in' && (busVal >> Number(p.name.slice(1))) & 1)
            .map((p) => labelHighlight(p, `hl${p.name}`))}
        </RectShape>
      );
    },
  },
  MERGER: {
    label: 'Fusionneur',
    category: 'Bus',
    w: 80,
    h: 120,
    inputs: [],
    outputs: [],
    // width = largeur du bus de sortie ; agrège `width` entrées 1-bit.
    // MSB en premier (en haut, ou à gauche). Dessin fixe.
    fixedDisplay: true,
    defaultState: { width: 4 },
    getDynamicGeometry: (comp) => {
      const L = mergerLayout(comp);
      return { w: L.w, h: L.h, inputs: L.inputs, outputs: L.outputs };
    },
    shape: (comp, _o, _i, inputsByName) => {
      const L = mergerLayout(comp);
      return (
        <RectShape layout={L}>
          {L.ports
            .filter((p) => p.name !== 'out' && asInt(inputsByName?.[p.name] ?? 0) & 1)
            .map((p) => labelHighlight(p, `hl${p.name}`))}
        </RectShape>
      );
    },
  },
};
