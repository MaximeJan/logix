// Définitions de composants — catégorie « bus ». Agrégées dans ./index.
import { asInt, maskTo } from '../lib/sim';
import { UprightText } from './UprightText';
import type { GateDef } from './types';

const NO_SEL = { userSelect: 'none' as const, pointerEvents: 'none' as const };

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
    w: 78,
    h: 52,
    inputs: [],
    outputs: [],
    // Extrait le champ de bits [hi..lo] d'un bus `in` de `width` bits.
    // out = (in >> lo) sur (hi-lo+1) bits. Idéal pour décoder une instruction
    // (opcode = [7..4], Rd = [3..2], Rs = [1..0]).
    defaultState: { width: 8, hi: 3, lo: 0 },
    getDynamicGeometry: (comp) => {
      const { width, n } = sliceRange(comp?.state);
      const W = 78;
      const H = 52;
      return {
        w: W,
        h: H,
        inputs: [{ name: 'in', x: 0, y: H / 2, width }],
        outputs: [{ name: 'out', x: W, y: H / 2, width: n }],
      };
    },
    shape: (comp, outputValue, _i, _ibn, angle) => {
      const { lo, hi, n } = sliceRange(comp?.state);
      const W = 78;
      const H = 52;
      const outVal = maskTo(n, asInt(outputValue));
      return (
        <>
          <line x1="0" y1={H / 2} x2="10" y2={H / 2} strokeWidth="1.2" />
          <line x1={W - 10} y1={H / 2} x2={W} y2={H / 2} strokeWidth="1.2" />
          <rect
            x="10"
            y="8"
            width={W - 20}
            height={H - 16}
            rx="2"
            fill="white"
            stroke="#0f172a"
            strokeWidth="2"
          />
          <g stroke="none">
            <UprightText
              angle={angle}
              x={W / 2}
              y={H / 2 - 1}
              textAnchor="middle"
              fontSize="13"
              fontWeight="700"
              fontFamily="'IBM Plex Mono', monospace"
              fill="#1f2937"
              style={NO_SEL}
            >
              [{hi}:{lo}]
            </UprightText>
            <UprightText
              angle={angle}
              x={W / 2}
              y={H / 2 + 12}
              textAnchor="middle"
              fontSize="10"
              fontWeight="700"
              fontFamily="'IBM Plex Mono', monospace"
              fill={outVal ? '#1f2937' : '#94a3b8'}
              style={NO_SEL}
            >
              {outVal}
            </UprightText>
            <UprightText
              angle={angle}
              x={W / 2}
              y="6"
              textAnchor="middle"
              fontSize="8"
              fontFamily="'IBM Plex Sans', sans-serif"
              fill="#94a3b8"
              style={NO_SEL}
            >
              tranche
            </UprightText>
          </g>
        </>
      );
    },
  },
  BUS: {
    label: 'Bus',
    category: 'Bus',
    w: 104,
    h: 100,
    inputs: [],
    outputs: [],
    // Bus « un seul émetteur à la fois » : N sources, chacune = une donnée
    // `in{k}` (largeur du bus) + une activation `en{k}` (1 bit). La sortie `bus`
    // porte la valeur de la source active ; ≥2 activations = conflit (rouge).
    // width = largeur du bus ; sources = nombre d'émetteurs (2..8).
    defaultState: { width: 8, sources: 2 },
    getDynamicGeometry: (comp) => {
      const width = comp?.state?.width ?? 8;
      const sources = Math.max(2, Math.min(8, comp?.state?.sources ?? 2));
      const W = 104;
      const slotH = 40;
      const topPad = 30;
      const h = Math.max(94, sources * slotH + 20);
      const inputs = [];
      for (let k = 0; k < sources; k++) {
        const y = topPad + k * slotH;
        inputs.push({ name: `in${k}`, x: 0, y, width });
        inputs.push({ name: `en${k}`, x: 0, y: y + 18, width: 1 });
      }
      return { w: W, h, inputs, outputs: [{ name: 'bus', x: W, y: h / 2, width }] };
    },
    shape: (comp, outputValue, _i, inputsByName, angle) => {
      const width = comp?.state?.width ?? 8;
      const sources = Math.max(2, Math.min(8, comp?.state?.sources ?? 2));
      const W = 104;
      const slotH = 40;
      const topPad = 30;
      const h = Math.max(94, sources * slotH + 20);
      const accent = 'var(--lcd-text, #fbbf24)';
      const red = '#dc2626';
      const enables: number[] = [];
      for (let k = 0; k < sources; k++) enables.push(asInt(inputsByName?.[`en${k}`] ?? 0) & 1);
      const activeCount = enables.reduce((s, e) => s + e, 0);
      const conflict = activeCount > 1;
      const frame = conflict ? red : '#0f172a';
      const outVal = maskTo(width, asInt(outputValue));

      const stubs = [];
      for (let k = 0; k < sources; k++) {
        const dataY = topPad + k * slotH;
        const enY = dataY + 18;
        const on = enables[k] === 1;
        stubs.push(
          <line key={`d${k}`} x1="0" y1={dataY} x2="14" y2={dataY} strokeWidth="1.2" />,
          <line key={`e${k}`} x1="0" y1={enY} x2="14" y2={enY} strokeWidth="1.2" />,
          <circle
            key={`ec${k}`}
            cx="2.5"
            cy={enY}
            r="2.5"
            fill={on ? (conflict ? red : accent) : 'white'}
            strokeWidth="1.2"
          />,
        );
      }
      return (
        <>
          {stubs}
          <line x1={W - 14} y1={h / 2} x2={W} y2={h / 2} strokeWidth="1.2" />
          <rect
            x="14"
            y="8"
            width={W - 28}
            height={h - 16}
            fill="white"
            stroke={frame}
            strokeWidth="2"
          />
          <g stroke="none">
            {enables.map((on, k) => {
              const dataY = topPad + k * slotH;
              const enY = dataY + 18;
              return (
                <g key={`g${k}`}>
                  {on === 1 && (
                    <rect
                      x="16"
                      y={dataY - 9}
                      width={W - 32}
                      height="30"
                      rx="2"
                      fill={conflict ? red : accent}
                      opacity={conflict ? 0.18 : 0.28}
                    />
                  )}
                  <UprightText
                    angle={angle}
                    x="22"
                    y={dataY + 4}
                    fontSize="12"
                    fontWeight={on === 1 ? '700' : '600'}
                    fontFamily="'IBM Plex Mono', monospace"
                    fill={on === 1 ? '#1f2937' : '#475569'}
                    style={NO_SEL}
                  >
                    s{k}
                  </UprightText>
                  <UprightText
                    angle={angle}
                    x="22"
                    y={enY + 4}
                    fontSize="9"
                    fontFamily="'IBM Plex Mono', monospace"
                    fill="#94a3b8"
                    style={NO_SEL}
                  >
                    en
                  </UprightText>
                </g>
              );
            })}
            <UprightText
              angle={angle}
              x={W / 2}
              y="21"
              textAnchor="middle"
              fontSize="11"
              fontWeight="700"
              fontFamily="'IBM Plex Sans', sans-serif"
              fill={conflict ? red : '#475569'}
              style={NO_SEL}
            >
              {conflict ? 'CONFLIT' : 'BUS'}
            </UprightText>
            <UprightText
              angle={angle}
              x={W - 20}
              y={h / 2 - 6}
              textAnchor="end"
              fontSize="10"
              fontWeight="700"
              fontFamily="'IBM Plex Mono', monospace"
              fill="#475569"
              style={NO_SEL}
            >
              bus
            </UprightText>
            <UprightText
              angle={angle}
              x={W - 20}
              y={h / 2 + 13}
              textAnchor="end"
              fontSize="12"
              fontWeight="700"
              fontFamily="'IBM Plex Mono', monospace"
              fill={activeCount >= 1 ? '#1f2937' : '#94a3b8'}
              style={NO_SEL}
            >
              {outVal}
            </UprightText>
          </g>
        </>
      );
    },
  },
  MUX: {
    label: 'Multiplexeur',
    category: 'Bus',
    w: 80,
    h: 94,
    inputs: [],
    outputs: [],
    // selectWidth = nombre de bits de sélection (1, 2, 3 → 2, 4, 8 voies)
    // dataWidth   = largeur de chaque voie (1, 2, 4, 8, 16)
    defaultState: { selectWidth: 1, dataWidth: 1 },
    getDynamicGeometry: (comp) => {
      const sw = comp?.state?.selectWidth ?? 1;
      const dw = comp?.state?.dataWidth ?? 1;
      const n = 1 << sw;
      const h = Math.max(94, n * 24 + 40);
      const inputs = [];
      for (let i = 0; i < n; i++) {
        inputs.push({ name: `in${i}`, x: 0, y: 32 + i * 24, width: dw });
      }
      // Sélecteur en bas (port bus de largeur sw)
      inputs.push({ name: 'sel', x: 40, y: h, width: sw });
      return {
        w: 80,
        h,
        inputs,
        outputs: [{ name: 'out', x: 80, y: h / 2, width: dw }],
      };
    },
    shape: (comp, _o, _i, inputsByName, angle) => {
      const sw = comp?.state?.selectWidth ?? 1;
      const n = 1 << sw;
      const w = 80;
      const h = Math.max(94, n * 24 + 40);
      const selVal = maskTo(sw, asInt(inputsByName?.sel ?? 0));
      const activeIdx = selVal < n ? selVal : -1;
      const accent = 'var(--lcd-text, #fbbf24)';
      const stubs = [];
      const labels = [];
      for (let i = 0; i < n; i++) {
        const y = 32 + i * 24;
        const isActive = i === activeIdx;
        stubs.push(<line key={`il${i}`} x1="0" y1={y} x2="14" y2={y} strokeWidth="1.2" />);
        stubs.push(
          <circle
            key={`ic${i}`}
            cx="2.5"
            cy={y}
            r="2.5"
            fill={isActive ? accent : 'white'}
            strokeWidth="1.2"
          />,
        );
        labels.push({ i, y, isActive });
      }
      const outActive = activeIdx >= 0;
      return (
        <>
          {stubs}
          <line x1={w - 14} y1={h / 2} x2={w} y2={h / 2} strokeWidth="1.2" />
          <circle
            cx={w}
            cy={h / 2}
            r="3"
            fill={outActive ? accent : '#1f2937'}
            stroke="#1f2937"
            strokeWidth="1"
          />
          <line x1="40" y1={h} x2="40" y2={h - 14} strokeWidth="1.2" />
          <circle cx="40" cy={h - 2.5} r="2.5" fill="white" strokeWidth="1.2" />
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
              y={32 + activeIdx * 24 - 8}
              width="16"
              height="16"
              rx="2"
              fill={accent}
              opacity="0.35"
              stroke="none"
            />
          )}
          <g stroke="none">
            {labels.map(({ i, y, isActive }) => (
              <UprightText
                angle={angle}
                key={`it${i}`}
                x="20"
                y={y + 4}
                fontSize="12"
                fontWeight={isActive ? '700' : '600'}
                fontFamily="'IBM Plex Mono', monospace"
                fill={isActive ? '#1f2937' : '#475569'}
                style={{ userSelect: 'none', pointerEvents: 'none' }}
              >
                {i}
              </UprightText>
            ))}
            <UprightText
              angle={angle}
              x={w - 20}
              y={h / 2 + 4}
              textAnchor="end"
              fontSize="11"
              fontWeight="700"
              fontFamily="'IBM Plex Sans', sans-serif"
              fill="#475569"
              style={{ userSelect: 'none', pointerEvents: 'none' }}
            >
              MUX
            </UprightText>
            <UprightText
              angle={angle}
              x="46"
              y={h - 4}
              fontSize="10"
              fontWeight="700"
              fontFamily="'IBM Plex Mono', monospace"
              fill="#1f2937"
              style={{ userSelect: 'none', pointerEvents: 'none' }}
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
    h: 94,
    inputs: [],
    outputs: [],
    defaultState: { selectWidth: 1, dataWidth: 1 },
    getDynamicGeometry: (comp) => {
      const sw = comp?.state?.selectWidth ?? 1;
      const dw = comp?.state?.dataWidth ?? 1;
      const n = 1 << sw;
      const h = Math.max(94, n * 24 + 40);
      const outputs = [];
      for (let i = 0; i < n; i++) {
        outputs.push({ name: `out${i}`, x: 80, y: 32 + i * 24, width: dw });
      }
      return {
        w: 80,
        h,
        inputs: [
          { name: 'in', x: 0, y: h / 2, width: dw },
          { name: 'sel', x: 40, y: h, width: sw },
        ],
        outputs,
      };
    },
    shape: (comp, _o, _i, inputsByName, angle) => {
      const sw = comp?.state?.selectWidth ?? 1;
      const n = 1 << sw;
      const w = 80;
      const h = Math.max(94, n * 24 + 40);
      const selVal = maskTo(sw, asInt(inputsByName?.sel ?? 0));
      const activeIdx = selVal < n ? selVal : -1;
      const accent = 'var(--lcd-text, #fbbf24)';
      const inVal = asInt(inputsByName?.in ?? 0);
      const stubs = [];
      const labels = [];
      for (let i = 0; i < n; i++) {
        const y = 32 + i * 24;
        const isActive = i === activeIdx;
        // La sortie active porte la valeur d'entrée, les autres sont à 0
        const outDot = isActive && inVal !== 0 ? accent : '#1f2937';
        stubs.push(<line key={`ol${i}`} x1={w - 14} y1={y} x2={w} y2={y} strokeWidth="1.2" />);
        stubs.push(
          <circle
            key={`oc${i}`}
            cx={w}
            cy={y}
            r="3"
            fill={outDot}
            stroke="#1f2937"
            strokeWidth="1"
          />,
        );
        labels.push({ i, y, isActive });
      }
      return (
        <>
          {stubs}
          {/* Entrée gauche : stub + cercle */}
          <line x1="0" y1={h / 2} x2="14" y2={h / 2} strokeWidth="1.2" />
          <circle cx="2.5" cy={h / 2} r="2.5" fill="white" strokeWidth="1.2" />
          {/* sel : stub + cercle */}
          <line x1="40" y1={h} x2="40" y2={h - 14} strokeWidth="1.2" />
          <circle cx="40" cy={h - 2.5} r="2.5" fill="white" strokeWidth="1.2" />
          {/* Boîtier trapézoïdal (étroit à gauche, large à droite) */}
          <path
            d={`M 14 22 L ${w - 14} 10 L ${w - 14} ${h - 10} L 14 ${h - 22} Z`}
            fill="white"
            stroke="#0f172a"
            strokeWidth="2"
            strokeLinejoin="round"
          />
          {/* Fond surligné sous l'étiquette de la voie active */}
          {activeIdx >= 0 && (
            <rect
              x={w - 33}
              y={32 + activeIdx * 24 - 8}
              width="16"
              height="16"
              rx="2"
              fill={accent}
              opacity="0.35"
              stroke="none"
            />
          )}
          <g stroke="none">
            {labels.map(({ i, y, isActive }) => (
              <UprightText
                angle={angle}
                key={`ot${i}`}
                x={w - 20}
                y={y + 4}
                fontSize="12"
                textAnchor="end"
                fontWeight={isActive ? '700' : '600'}
                fontFamily="'IBM Plex Mono', monospace"
                fill={isActive ? '#1f2937' : '#475569'}
                style={{ userSelect: 'none', pointerEvents: 'none' }}
              >
                {i}
              </UprightText>
            ))}
            <UprightText
              angle={angle}
              x="20"
              y={h / 2 + 4}
              fontSize="11"
              fontWeight="700"
              fontFamily="'IBM Plex Sans', sans-serif"
              fill="#475569"
              style={{ userSelect: 'none', pointerEvents: 'none' }}
            >
              DMX
            </UprightText>
            <UprightText
              angle={angle}
              x="46"
              y={h - 4}
              fontSize="10"
              fontWeight="700"
              fontFamily="'IBM Plex Mono', monospace"
              fill="#1f2937"
              style={{ userSelect: 'none', pointerEvents: 'none' }}
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
    w: 80,
    h: 124,
    inputs: [],
    outputs: [],
    // width = nombre de bits d'entrée ; produit 2^width sorties 1-bit
    defaultState: { width: 2 },
    getDynamicGeometry: (comp) => {
      const bw = comp?.state?.width ?? 2;
      const n = 1 << bw;
      const h = Math.max(94, n * 24 + 28);
      const outputs = [];
      for (let i = 0; i < n; i++) {
        outputs.push({ name: `out${i}`, x: 80, y: 22 + i * 24, width: 1 });
      }
      return {
        w: 80,
        h,
        inputs: [{ name: 'in', x: 0, y: h / 2, width: bw }],
        outputs,
      };
    },
    shape: (comp, _o, _i, inputsByName, angle) => {
      const bw = comp?.state?.width ?? 2;
      const n = 1 << bw;
      const W = 80;
      const h = Math.max(94, n * 24 + 28);
      const inVal = maskTo(bw, asInt(inputsByName?.in ?? 0));
      const activeIdx = inVal < n ? inVal : -1;
      const accent = 'var(--lcd-text, #fbbf24)';
      const stubs = [];
      const labels = [];
      for (let i = 0; i < n; i++) {
        const y = 22 + i * 24;
        const isActive = i === activeIdx;
        stubs.push(<line key={`ol${i}`} x1={W - 14} y1={y} x2={W} y2={y} strokeWidth="1.2" />);
        stubs.push(
          <circle
            key={`op${i}`}
            cx={W}
            cy={y}
            r="3"
            fill={isActive ? accent : '#1f2937'}
            stroke="#1f2937"
            strokeWidth="1"
          />,
        );
        labels.push({ i, y, isActive });
      }
      return (
        <>
          {stubs}
          {/* Entrée gauche : stub + cercle vide */}
          <line x1="0" y1={h / 2} x2="14" y2={h / 2} strokeWidth="1.2" />
          <circle cx="2.5" cy={h / 2} r="2.5" fill="white" strokeWidth="1.2" />
          {/* Boîtier */}
          <rect
            x="14"
            y="10"
            width={W - 28}
            height={h - 20}
            fill="white"
            stroke="#0f172a"
            strokeWidth="2"
          />
          <g stroke="none">
            {labels.map(({ i, y, isActive }) => (
              <UprightText
                angle={angle}
                key={`ot${i}`}
                x={W - 20}
                y={y + 4}
                fontSize="12"
                textAnchor="end"
                fontWeight={isActive ? '700' : '600'}
                fontFamily="'IBM Plex Mono', monospace"
                fill={isActive ? '#1f2937' : '#475569'}
                style={{ userSelect: 'none', pointerEvents: 'none' }}
              >
                {i}
              </UprightText>
            ))}
            <UprightText
              angle={angle}
              x="20"
              y={h / 2 + 1}
              fontSize="11"
              fontWeight="700"
              fontFamily="'IBM Plex Mono', monospace"
              fill="#1f2937"
              style={{ userSelect: 'none', pointerEvents: 'none' }}
            >
              in
            </UprightText>
            <UprightText
              angle={angle}
              x={W / 2 - 4}
              y={h - 16}
              textAnchor="middle"
              fontSize="9"
              fontFamily="'IBM Plex Mono', monospace"
              fill="#94a3b8"
              style={{ userSelect: 'none', pointerEvents: 'none' }}
            >
              {bw}→{n}
            </UprightText>
          </g>
        </>
      );
    },
  },
  SPLITTER: {
    label: 'Séparateur',
    category: 'Bus',
    w: 80,
    h: 124,
    inputs: [],
    outputs: [],
    // width = largeur du bus d'entrée ; produit `width` sorties 1-bit.
    // b0 = bit de poids faible (LSB), affiché en bas ; MSB en haut (extérieur).
    defaultState: { width: 4 },
    getDynamicGeometry: (comp) => {
      const n = comp?.state?.width ?? 4;
      const h = Math.max(76, n * 24 + 28);
      const outputs = [];
      for (let i = 0; i < n; i++) {
        const bit = n - 1 - i; // haut = MSB
        outputs.push({ name: `b${bit}`, x: 80, y: 22 + i * 24, width: 1 });
      }
      return {
        w: 80,
        h,
        inputs: [{ name: 'in', x: 0, y: h / 2, width: n }],
        outputs,
      };
    },
    shape: (comp, _o, inputValue, _ibn, angle) => {
      const n = comp?.state?.width ?? 4;
      const W = 80;
      const h = Math.max(76, n * 24 + 28);
      const busVal = maskTo(n, asInt(inputValue));
      const accent = 'var(--lcd-text, #fbbf24)';
      const stubs = [];
      const labels = [];
      for (let i = 0; i < n; i++) {
        const bit = n - 1 - i;
        const y = 22 + i * 24;
        const on = (busVal >> bit) & 1;
        stubs.push(<line key={`ol${i}`} x1={W - 14} y1={y} x2={W} y2={y} strokeWidth="1.2" />);
        stubs.push(
          <circle
            key={`op${i}`}
            cx={W}
            cy={y}
            r="3"
            fill={on ? accent : '#1f2937'}
            stroke="#1f2937"
            strokeWidth="1"
          />,
        );
        labels.push({ bit, y, on });
      }
      return (
        <>
          {stubs}
          <line x1="0" y1={h / 2} x2="14" y2={h / 2} strokeWidth="1.2" />
          <circle cx="2.5" cy={h / 2} r="2.5" fill="white" strokeWidth="1.2" />
          <rect
            x="14"
            y="10"
            width={W - 28}
            height={h - 20}
            fill="white"
            stroke="#0f172a"
            strokeWidth="2"
          />
          <g stroke="none">
            {labels.map(({ bit, y, on }) => (
              <UprightText
                angle={angle}
                key={`ot${bit}`}
                x={W - 20}
                y={y + 4}
                fontSize="12"
                textAnchor="end"
                fontWeight={on ? '700' : '600'}
                fontFamily="'IBM Plex Mono', monospace"
                fill={on ? '#1f2937' : '#475569'}
                style={{ userSelect: 'none', pointerEvents: 'none' }}
              >
                {bit}
              </UprightText>
            ))}
            <UprightText
              angle={angle}
              x="20"
              y={h / 2 + 1}
              fontSize="11"
              fontWeight="700"
              fontFamily="'IBM Plex Mono', monospace"
              fill="#1f2937"
              style={{ userSelect: 'none', pointerEvents: 'none' }}
            >
              in
            </UprightText>
          </g>
        </>
      );
    },
  },
  MERGER: {
    label: 'Fusionneur',
    category: 'Bus',
    w: 80,
    h: 124,
    inputs: [],
    outputs: [],
    // width = largeur du bus de sortie ; agrège `width` entrées 1-bit.
    // b0 = LSB (en bas), MSB en haut (extérieur).
    defaultState: { width: 4 },
    getDynamicGeometry: (comp) => {
      const n = comp?.state?.width ?? 4;
      const h = Math.max(76, n * 24 + 28);
      const inputs = [];
      for (let i = 0; i < n; i++) {
        const bit = n - 1 - i;
        inputs.push({ name: `b${bit}`, x: 0, y: 22 + i * 24, width: 1 });
      }
      return {
        w: 80,
        h,
        inputs,
        outputs: [{ name: 'out', x: 80, y: h / 2, width: n }],
      };
    },
    shape: (comp, outputValue, _i, inputsByName, angle) => {
      const n = comp?.state?.width ?? 4;
      const W = 80;
      const h = Math.max(76, n * 24 + 28);
      const outVal = maskTo(n, asInt(outputValue));
      const accent = 'var(--lcd-text, #fbbf24)';
      const stubs = [];
      const labels = [];
      for (let i = 0; i < n; i++) {
        const bit = n - 1 - i;
        const y = 22 + i * 24;
        const on = asInt(inputsByName?.[`b${bit}`] ?? 0) & 1;
        stubs.push(<line key={`il${i}`} x1="0" y1={y} x2="14" y2={y} strokeWidth="1.2" />);
        stubs.push(
          <circle
            key={`ic${i}`}
            cx="2.5"
            cy={y}
            r="2.5"
            fill={on ? accent : 'white'}
            strokeWidth="1.2"
          />,
        );
        labels.push({ bit, y, on });
      }
      return (
        <>
          {stubs}
          <line x1={W - 14} y1={h / 2} x2={W} y2={h / 2} strokeWidth="1.2" />
          <circle
            cx={W}
            cy={h / 2}
            r="3"
            fill={outVal ? accent : '#1f2937'}
            stroke="#1f2937"
            strokeWidth="1"
          />
          <rect
            x="14"
            y="10"
            width={W - 28}
            height={h - 20}
            fill="white"
            stroke="#0f172a"
            strokeWidth="2"
          />
          <g stroke="none">
            {labels.map(({ bit, y, on }) => (
              <UprightText
                angle={angle}
                key={`it${bit}`}
                x="20"
                y={y + 4}
                fontSize="12"
                fontWeight={on ? '700' : '600'}
                fontFamily="'IBM Plex Mono', monospace"
                fill={on ? '#1f2937' : '#475569'}
                style={{ userSelect: 'none', pointerEvents: 'none' }}
              >
                {bit}
              </UprightText>
            ))}
            <UprightText
              angle={angle}
              x={W - 20}
              y={h / 2 + 1}
              textAnchor="end"
              fontSize="11"
              fontWeight="700"
              fontFamily="'IBM Plex Mono', monospace"
              fill="#1f2937"
              style={{ userSelect: 'none', pointerEvents: 'none' }}
            >
              out
            </UprightText>
          </g>
        </>
      );
    },
  },
};
