import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Save, Upload, Undo2, Redo2, Trash2, Copy, ClipboardPaste, Table2, Power, Package, Check, X, Plus, Activity, Zap, GitBranch, Timer, Cpu, Trophy } from 'lucide-react';
import {
  asInt,
  maskTo,
  portKey,
  SEG7_HEX_TABLE,
  applyOrientation,
  simulate as simulateCore,
  stepSequential as stepSequentialCore,
} from './sim.js';
import {
  FORMAT_VERSION,
  serialize as serializeCore,
  deserialize as deserializeCore,
  serializeAll as serializeAllCore,
  deserializeAll as deserializeAllCore,
} from './persist.js';
import { CHAPTERS, getLevel, getAllLevels } from './challenges.js';

// ============================================================
// CONSTANTES
// ============================================================
const GRID = 20;
const PORT_R = 3.5;
// FORMAT_VERSION est désormais exporté depuis ./persist.js (réimporté en haut)
const STORAGE_KEY = 'circuit:autosave';
const PREFS_STORAGE_KEY = 'circuit:prefs';

// Adaptateur de stockage : utilise window.storage (Tauri/Electron) si disponible,
// sinon localStorage standard (navigateur web / GitHub Pages).
const storage = window.storage ?? {
  get: (key) => Promise.resolve({ value: localStorage.getItem(key) }),
  set: (key, value) => { localStorage.setItem(key, value); },
};

// Préférences d'apparence par défaut (couleurs, épaisseurs, fond du canevas)
const DEFAULT_PREFS = {
  wireOnColor: '#65a30d',
  wireOffColor: '#78716c',
  wireWidth: 2,
  inputOnColor: '#84cc16',
  outputOnColor: '#f97316',
  canvasBg: '#faf8f3',
  gridStyle: 'dots', // 'dots' | 'lines' | 'off'
  // Apparence des bus : chaque bus est dessiné comme N pistes parallèles.
  // busBitStroke = épaisseur d'une piste (1 bit) ; busBitGap = espace entre pistes.
  busBitStroke: 2.5,
  busBitGap: 1.2,
  busOffColor: '#0f172a',
  // Afficheur 7 segments
  seg7OnColor: '#ef4444',
  seg7OffColor: '#1f2937',
  // « Afficheur LCD » : encadre la valeur actuelle des composants à mémoire
  // (DFF, REG, COUNTER, RAM, SR) et des composants à valeur dynamique.
  // Style « afficheur LED » : fond sombre, texte clair contrasté.
  lcdBorderColor: '#0f172a', // bord du cadre (presque noir)
  lcdFillColor: '#0f172a',   // intérieur du cadre (sombre)
  lcdTextColor: '#fbbf24',   // texte ambre vif (style LED)
};

// ============================================================
// HELPERS BUS — formatage des valeurs et utilitaires d'affichage
// ============================================================
const BIT_OFF_COLOR = '#0f172a'; // couleur d'un bit 0 sur un bus (noir-bleuté)

// Taille d'une cellule cliquable d'une Entrée bus (en px). Constant pour
// rester lisible quel que soit le nombre de bits.
const INPUT_BUS_CELL_SIZE = 22;

function formatValue(v, width, base) {
  const n = maskTo(width, asInt(v));
  if (base === 'bin') return n.toString(2).padStart(width, '0');
  if (base === 'hex') {
    const hexDigits = Math.ceil(width / 4);
    return n.toString(16).toUpperCase().padStart(hexDigits, '0');
  }
  return n.toString(10);
}

// Rotation : renvoie la string `transform` pour qu'un élément reste droit
// quand le shape parent est tourné de `angle` degrés. On contre-rotate autour
// de la position (x, y) — c'est l'« ancre » du texte qui reste en place.
// Renvoie undefined si pas de rotation (à passer tel quel à un attribut `transform`).
function uprightTransform(angle, x, y) {
  if (!angle) return undefined;
  return `rotate(${-angle} ${x} ${y})`;
}

// Formate la valeur `v` masquée à `width` bits en une chaîne binaire avec un
// espace tous les 4 bits, MSB à gauche. Ex : width=8, v=0xA5 → "1010 0101".
function formatBitsGrouped(v, width) {
  const bin = maskTo(width, asInt(v)).toString(2).padStart(width, '0');
  const groups = [];
  // Découpe depuis la droite (LSB) pour grouper proprement, puis on inverse
  for (let i = bin.length; i > 0; i -= 4) {
    groups.unshift(bin.slice(Math.max(0, i - 4), i));
  }
  return groups.join(' ');
}

// Calcule la largeur minimale d'un composant à mémoire (DFF / REG / COUNTER) en
// fonction de la largeur du bus stocké. La formule tient compte :
//  - de la marge boîtier (2 × portMargin px de chaque côté)
//  - de la largeur du cadre LED nécessaire pour afficher la valeur binaire groupée
//    en fontSize 14 (≈ 9 px par caractère monospace)
//  - du minimum visuel (`minW`) imposé par les labels de ports (D/LD/CLK/RST/Q…)
function widthForBits(bitWidth, { minW, portMargin }) {
  if (bitWidth <= 1) return minW;
  const text = formatBitsGrouped(0, bitWidth); // ex: "1010 0101"
  // Largeur visuelle d'un caractère mono à fontSize 14 ≈ 8.5 px ; on prend 9.5
  // pour avoir un peu d'air et tenir compte du sub-pixel. + 20 px de padding
  // interne dans le LED (au lieu de 12).
  const lcdInner = Math.ceil(text.length * 9.5 + 20);
  const lcdMargin = 10; // gap entre le cadre LED et la zone des labels port
  return Math.max(minW, lcdInner + 2 * (portMargin + lcdMargin));
}

// Nombre de bits nécessaires pour adresser `n` cases (au moins 1, même pour n=1).
function addrBitsFor(n) {
  if (n <= 1) return 1;
  return Math.max(1, Math.ceil(Math.log2(n)));
}

// Trace un rectangle dont seuls certains coins sont arrondis (les autres carrés).
// Sert aux cellules de bus : les coins externes de la rangée sont arrondis, mais
// les séparations internes entre bits restent carrées.
function roundedRectPath(x, y, w, h, r, { tl, tr, br, bl }) {
  const rtl = tl ? r : 0, rtr = tr ? r : 0, rbr = br ? r : 0, rbl = bl ? r : 0;
  return [
    `M ${x + rtl},${y}`,
    `L ${x + w - rtr},${y}`,
    rtr ? `A ${rtr},${rtr} 0 0 1 ${x + w},${y + rtr}` : '',
    `L ${x + w},${y + h - rbr}`,
    rbr ? `A ${rbr},${rbr} 0 0 1 ${x + w - rbr},${y + h}` : '',
    `L ${x + rbl},${y + h}`,
    rbl ? `A ${rbl},${rbl} 0 0 1 ${x},${y + h - rbl}` : '',
    `L ${x},${y + rtl}`,
    rtl ? `A ${rtl},${rtl} 0 0 1 ${x + rtl},${y}` : '',
    'Z',
  ].join(' ');
}

// ============================================================
// DÉFINITIONS DES COMPOSANTS
// Chaque port a une `width` (largeur en bits). 1 = signal classique, >1 = bus.
// Les portes logiques restent 1-bit. Les composants Entrée/Sortie peuvent
// passer en mode bus (largeur configurable via state.width).
// ============================================================
const GATES = {
  AND: {
    label: 'AND',
    category: 'Portes',
    w: 60, h: 40,
    inputs: [
      { name: 'in0', x: 0, y: 10, width: 1 },
      { name: 'in1', x: 0, y: 30, width: 1 },
    ],
    outputs: [{ name: 'out', x: 60, y: 20, width: 1 }],
    fn: (ins) => [(asInt(ins[0]) & asInt(ins[1])) & 1],
    shape: () => (
      <>
        <line x1="0" y1="10" x2="5" y2="10" />
        <line x1="0" y1="30" x2="5" y2="30" />
        <line x1="45" y1="20" x2="60" y2="20" />
        <path d="M 5 5 L 30 5 A 15 15 0 0 1 30 35 L 5 35 Z" fill="white" />
      </>
    ),
  },
  OR: {
    label: 'OR',
    category: 'Portes',
    w: 60, h: 40,
    inputs: [
      { name: 'in0', x: 0, y: 10, width: 1 },
      { name: 'in1', x: 0, y: 30, width: 1 },
    ],
    outputs: [{ name: 'out', x: 60, y: 20, width: 1 }],
    fn: (ins) => [(asInt(ins[0]) | asInt(ins[1])) & 1],
    shape: () => (
      <>
        <line x1="0" y1="10" x2="13" y2="10" />
        <line x1="0" y1="30" x2="13" y2="30" />
        <line x1="55" y1="20" x2="60" y2="20" />
        <path d="M 8 5 Q 24 20 8 35 Q 30 35 55 20 Q 30 5 8 5 Z" fill="white" />
      </>
    ),
  },
  NOT: {
    label: 'NOT',
    category: 'Portes',
    w: 60, h: 40,
    inputs: [{ name: 'in0', x: 0, y: 20, width: 1 }],
    outputs: [{ name: 'out', x: 60, y: 20, width: 1 }],
    fn: (ins) => [(~asInt(ins[0])) & 1],
    shape: () => (
      <>
        <line x1="0" y1="20" x2="5" y2="20" />
        <line x1="55" y1="20" x2="60" y2="20" />
        <path d="M 5 5 L 45 20 L 5 35 Z" fill="white" />
        <circle cx="50" cy="20" r="4" fill="white" />
      </>
    ),
  },
  NAND: {
    label: 'NAND',
    category: 'Portes',
    w: 60, h: 40,
    inputs: [
      { name: 'in0', x: 0, y: 10, width: 1 },
      { name: 'in1', x: 0, y: 30, width: 1 },
    ],
    outputs: [{ name: 'out', x: 60, y: 20, width: 1 }],
    fn: (ins) => [(~(asInt(ins[0]) & asInt(ins[1]))) & 1],
    shape: () => (
      <>
        <line x1="0" y1="10" x2="5" y2="10" />
        <line x1="0" y1="30" x2="5" y2="30" />
        <line x1="47" y1="20" x2="60" y2="20" />
        <path d="M 5 5 L 26 5 A 13 15 0 0 1 26 35 L 5 35 Z" fill="white" />
        <circle cx="43" cy="20" r="4" fill="white" />
      </>
    ),
  },
  NOR: {
    label: 'NOR',
    category: 'Portes',
    w: 60, h: 40,
    inputs: [
      { name: 'in0', x: 0, y: 10, width: 1 },
      { name: 'in1', x: 0, y: 30, width: 1 },
    ],
    outputs: [{ name: 'out', x: 60, y: 20, width: 1 }],
    fn: (ins) => [(~(asInt(ins[0]) | asInt(ins[1]))) & 1],
    shape: () => (
      <>
        <line x1="0" y1="10" x2="10" y2="10" />
        <line x1="0" y1="30" x2="10" y2="30" />
        <line x1="57" y1="20" x2="60" y2="20" />
        <path d="M 8 5 Q 22 20 8 35 Q 28 35 50 20 Q 28 5 8 5 Z" fill="white" />
        <circle cx="53" cy="20" r="4" fill="white" />
      </>
    ),
  },
  XOR: {
    label: 'XOR',
    category: 'Portes',
    w: 60, h: 40,
    inputs: [
      { name: 'in0', x: 0, y: 10, width: 1 },
      { name: 'in1', x: 0, y: 30, width: 1 },
    ],
    outputs: [{ name: 'out', x: 60, y: 20, width: 1 }],
    fn: (ins) => [(asInt(ins[0]) ^ asInt(ins[1])) & 1],
    shape: () => (
      <>
        <line x1="0" y1="10" x2="14" y2="10" />
        <line x1="0" y1="30" x2="14" y2="30" />
        <line x1="55" y1="20" x2="60" y2="20" />
        <path d="M 9 5 Q 25 20 9 35 Q 31 35 55 20 Q 31 5 9 5 Z" fill="white" />
        <path d="M 4 5 Q 20 20 4 35" fill="none" />
      </>
    ),
  },
  INPUT: {
    label: 'Entrée',
    category: 'E/S',
    w: 40, h: 40,
    inputs: [],
    outputs: [{ name: 'out', x: 40, y: 20, width: 1 }],
    isToggle: true,
    defaultState: { value: 0, width: 1, label: '' },
    // Géométrie dynamique : taille et port out adaptés à la largeur.
    // En mode bus, le composant s'allonge horizontalement pour faire de la place
    // aux N cellules cliquables, une par bit.
    getDynamicGeometry: (comp) => {
      const width = comp?.state?.width ?? 1;
      if (width === 1) {
        return { w: 36, h: 40, inputs: [], outputs: [{ name: 'out', x: 36, y: 20, width: 1 }] };
      }
      const cellSize = INPUT_BUS_CELL_SIZE;
      const w = width * cellSize + 8;
      const h = 52;
      return { w, h, inputs: [], outputs: [{ name: 'out', x: w, y: h / 2, width }] };
    },
    shape: (comp, outputValue, _i, _ibn, angle) => {
      const width = comp?.state?.width ?? 1;
      const raw = outputValue ?? comp?.state?.value;
      const v = maskTo(width, asInt(raw));
      if (width === 1) {
        return (
          <>
            <rect x="3" y="7" width="26" height="26" rx="2"
                  fill={v ? 'var(--input-on, #84cc16)' : 'white'} />
            <text x="16" y="25" textAnchor="middle"
                  fontSize="16" fontWeight="700"
                  fontFamily="'IBM Plex Mono', monospace"
                  fill={v ? '#1a2e05' : '#94a3b8'}
                  transform={uprightTransform(angle, 16, 20)}
                  style={{ userSelect: 'none', pointerEvents: 'none' }}>
              {v ? '1' : '0'}
            </text>
            <line x1="29" y1="20" x2="36" y2="20" />
          </>
        );
      }
      // Mode bus : une rangée de N cellules cliquables.
      const cellSize = INPUT_BUS_CELL_SIZE;
      const totalW = width * cellSize;
      const h = 52;
      const cellY = 12;
      const cellH = h - 18;
      const cells = [];
      for (let i = 0; i < width; i++) {
        const bitIdx = width - 1 - i;
        const bit = (v >> bitIdx) & 1;
        const cx = i * cellSize + cellSize / 2;
        const cy = cellY + cellH / 2;
        cells.push(
          <path key={`r${i}`}
                d={roundedRectPath(i * cellSize, cellY, cellSize, cellH, 3, {
                  tl: i === 0, bl: i === 0,
                  tr: i === width - 1, br: i === width - 1,
                })}
                fill={bit ? 'var(--input-on, #84cc16)' : 'white'}
                stroke="#1f2937" strokeWidth={0.8} />
        );
        cells.push(
          <text key={`t${i}`}
                x={cx} y={cy + 5}
                textAnchor="middle"
                fontSize={cellSize >= 18 ? 14 : 11}
                fontWeight="700"
                fontFamily="'IBM Plex Mono', monospace"
                fill={bit ? '#1a2e05' : '#94a3b8'}
                transform={uprightTransform(angle, cx, cy)}
                style={{ userSelect: 'none', pointerEvents: 'none' }}>
            {bit}
          </text>
        );
      }
      return (
        <>
          {cells}
          <text x={totalW / 2} y={8} textAnchor="middle"
                fontSize="9" fontWeight="600"
                fontFamily="'IBM Plex Mono', monospace" fill="#475569"
                transform={uprightTransform(angle, totalW / 2, 8)}
                style={{ userSelect: 'none', pointerEvents: 'none' }}>
            MSB ··· LSB · /{width}
          </text>
          <line x1={totalW} y1={h / 2} x2={totalW + 8} y2={h / 2} />
        </>
      );
    },
  },
  OUTPUT: {
    label: 'Sortie',
    category: 'E/S',
    w: 40, h: 40,
    inputs: [{ name: 'in0', x: 0, y: 20, width: 1 }],
    outputs: [],
    defaultState: { width: 1, base: 'dec', label: '' },
    getDynamicGeometry: (comp) => {
      const width = comp?.state?.width ?? 1;
      if (width === 1) {
        return { w: 36, h: 40, inputs: [{ name: 'in0', x: 0, y: 20, width: 1 }], outputs: [] };
      }
      // Mode bus : rangée de N cellules (visuel identique à l'entrée), port à gauche.
      const cellSize = INPUT_BUS_CELL_SIZE;
      const w = width * cellSize + 8;
      const h = 52;
      return { w, h, inputs: [{ name: 'in0', x: 0, y: h / 2, width }], outputs: [] };
    },
    shape: (comp, _outputValue, inputValue, _ibn, angle) => {
      const width = comp?.state?.width ?? 1;
      const v = maskTo(width, asInt(inputValue));
      if (width === 1) {
        const isOn = !!v;
        return (
          <>
            <line x1="0" y1="20" x2="9" y2="20" />
            <rect x="9" y="7" width="26" height="26" rx="2"
                  fill={isOn ? 'var(--output-on, #f97316)' : 'white'} />
            <text x="22" y="25" textAnchor="middle"
                  fontSize="16" fontWeight="700"
                  fontFamily="'IBM Plex Mono', monospace"
                  fill={isOn ? '#1a2e05' : '#94a3b8'}
                  transform={uprightTransform(angle, 22, 20)}
                  style={{ userSelect: 'none', pointerEvents: 'none' }}>
              {isOn ? '1' : '0'}
            </text>
          </>
        );
      }
      // Mode bus : une rangée de N cellules en lecture seule (un bit par cellule),
      // visuel identique à l'entrée mais en couleur de sortie. Pas de dec/hex/bin.
      const cellSize = INPUT_BUS_CELL_SIZE;
      const totalW = width * cellSize;
      const h = 52;
      const cellY = 12;
      const cellH = h - 18;
      const offX = 8; // décalage pour le stub d'entrée à gauche
      const cells = [];
      for (let i = 0; i < width; i++) {
        const bitIdx = width - 1 - i; // MSB à gauche
        const bit = (v >> bitIdx) & 1;
        const x0 = offX + i * cellSize;
        const cx = x0 + cellSize / 2;
        const cy = cellY + cellH / 2;
        cells.push(
          <path key={`r${i}`}
                d={roundedRectPath(x0, cellY, cellSize, cellH, 3, {
                  tl: i === 0, bl: i === 0,
                  tr: i === width - 1, br: i === width - 1,
                })}
                fill={bit ? 'var(--output-on, #f97316)' : 'white'}
                stroke="#1f2937" strokeWidth={0.8} />
        );
        cells.push(
          <text key={`t${i}`}
                x={cx} y={cy + 5}
                textAnchor="middle"
                fontSize={cellSize >= 18 ? 14 : 11}
                fontWeight="700"
                fontFamily="'IBM Plex Mono', monospace"
                fill={bit ? '#1a2e05' : '#94a3b8'}
                transform={uprightTransform(angle, cx, cy)}
                style={{ userSelect: 'none', pointerEvents: 'none' }}>
            {bit}
          </text>
        );
      }
      return (
        <>
          {cells}
          <text x={offX + totalW / 2} y={8} textAnchor="middle"
                fontSize="9" fontWeight="600"
                fontFamily="'IBM Plex Mono', monospace" fill="#475569"
                transform={uprightTransform(angle, offX + totalW / 2, 8)}
                style={{ userSelect: 'none', pointerEvents: 'none' }}>
            MSB ··· LSB · /{width}
          </text>
          <line x1="0" y1={h / 2} x2={offX} y2={h / 2} />
        </>
      );
    },
  },
  MUX: {
    label: 'Multiplexeur',
    category: 'Bus',
    w: 80, h: 94,
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
        w: 80, h,
        inputs,
        outputs: [{ name: 'out', x: 80, y: h / 2, width: dw }],
      };
    },
    shape: (comp, _o, _i, inputsByName, angle) => {
      const sw = comp?.state?.selectWidth ?? 1;
      const dw = comp?.state?.dataWidth ?? 1;
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
          <circle key={`ic${i}`} cx="2.5" cy={y} r="2.5"
                  fill={isActive ? accent : 'white'}
                  strokeWidth="1.2" />
        );
        labels.push({ i, y, isActive });
      }
      const outActive = activeIdx >= 0;
      return (
        <>
          {stubs}
          <line x1={w - 14} y1={h / 2} x2={w} y2={h / 2} strokeWidth="1.2" />
          <circle cx={w} cy={h / 2} r="3"
                  fill={outActive ? accent : '#1f2937'}
                  stroke="#1f2937" strokeWidth="1" />
          <line x1="40" y1={h} x2="40" y2={h - 14} strokeWidth="1.2" />
          <circle cx="40" cy={h - 2.5} r="2.5" fill="white" strokeWidth="1.2" />
          <path d={`M 14 10 L ${w - 14} 22 L ${w - 14} ${h - 22} L 14 ${h - 10} Z`}
                fill="white" stroke="#0f172a" strokeWidth="2" strokeLinejoin="round" />
          {activeIdx >= 0 && (
            <rect x="17" y={32 + activeIdx * 24 - 8}
                  width="16" height="16" rx="2"
                  fill={accent} opacity="0.35" stroke="none" />
          )}
          <g stroke="none">
            {labels.map(({ i, y, isActive }) => (
              <text key={`it${i}`} x="20" y={y + 4} fontSize="12"
                    fontWeight={isActive ? '700' : '600'}
                    fontFamily="'IBM Plex Mono', monospace"
                    fill={isActive ? '#1f2937' : '#475569'}
                    transform={uprightTransform(angle, 24, y)}
                    style={{ userSelect: 'none', pointerEvents: 'none' }}>
                {i}
              </text>
            ))}
            <text x={w - 20} y={h / 2 + 4} textAnchor="end" fontSize="11" fontWeight="700"
                  fontFamily="'IBM Plex Sans', sans-serif" fill="#475569"
                  transform={uprightTransform(angle, w - 20, h / 2)}
                  style={{ userSelect: 'none', pointerEvents: 'none' }}>
              MUX
            </text>
            <text x="46" y={h - 4} fontSize="10" fontWeight="700"
                  fontFamily="'IBM Plex Mono', monospace" fill="#1f2937"
                  transform={uprightTransform(angle, 46, h - 8)}
                  style={{ userSelect: 'none', pointerEvents: 'none' }}>
              sel
            </text>
          </g>
        </>
      );
    },
  },
  DEMUX: {
    label: 'Démultiplexeur',
    category: 'Bus',
    w: 80, h: 94,
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
        w: 80, h,
        inputs: [
          { name: 'in', x: 0, y: h / 2, width: dw },
          { name: 'sel', x: 40, y: h, width: sw },
        ],
        outputs,
      };
    },
    shape: (comp, _o, _i, inputsByName, angle) => {
      const sw = comp?.state?.selectWidth ?? 1;
      const dw = comp?.state?.dataWidth ?? 1;
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
          <circle key={`oc${i}`} cx={w} cy={y} r="3"
                  fill={outDot} stroke="#1f2937" strokeWidth="1" />
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
          <path d={`M 14 22 L ${w - 14} 10 L ${w - 14} ${h - 10} L 14 ${h - 22} Z`}
                fill="white" stroke="#0f172a" strokeWidth="2" strokeLinejoin="round" />
          {/* Fond surligné sous l'étiquette de la voie active */}
          {activeIdx >= 0 && (
            <rect x={w - 33} y={32 + activeIdx * 24 - 8}
                  width="16" height="16" rx="2"
                  fill={accent} opacity="0.35" stroke="none" />
          )}
          <g stroke="none">
            {labels.map(({ i, y, isActive }) => (
              <text key={`ot${i}`} x={w - 20} y={y + 4} fontSize="12" textAnchor="end"
                    fontWeight={isActive ? '700' : '600'}
                    fontFamily="'IBM Plex Mono', monospace"
                    fill={isActive ? '#1f2937' : '#475569'}
                    transform={uprightTransform(angle, w - 24, y)}
                    style={{ userSelect: 'none', pointerEvents: 'none' }}>
                {i}
              </text>
            ))}
            <text x="20" y={h / 2 + 4} fontSize="11" fontWeight="700"
                  fontFamily="'IBM Plex Sans', sans-serif" fill="#475569"
                  transform={uprightTransform(angle, 20, h / 2)}
                  style={{ userSelect: 'none', pointerEvents: 'none' }}>
              DMX
            </text>
            <text x="46" y={h - 4} fontSize="10" fontWeight="700"
                  fontFamily="'IBM Plex Mono', monospace" fill="#1f2937"
                  transform={uprightTransform(angle, 46, h - 8)}
                  style={{ userSelect: 'none', pointerEvents: 'none' }}>
              sel
            </text>
          </g>
        </>
      );
    },
  },
  DECODER: {
    label: 'Décodeur',
    category: 'Bus',
    w: 80, h: 124,
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
        w: 80, h,
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
          <circle key={`op${i}`} cx={W} cy={y} r="3"
                  fill={isActive ? accent : '#1f2937'}
                  stroke="#1f2937" strokeWidth="1" />
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
          <rect x="14" y="10" width={W - 28} height={h - 20}
                fill="white" stroke="#0f172a" strokeWidth="2" />
          <g stroke="none">
            {labels.map(({ i, y, isActive }) => (
              <text key={`ot${i}`} x={W - 20} y={y + 4} fontSize="12" textAnchor="end"
                    fontWeight={isActive ? '700' : '600'}
                    fontFamily="'IBM Plex Mono', monospace"
                    fill={isActive ? '#1f2937' : '#475569'}
                    transform={uprightTransform(angle, W - 24, y)}
                    style={{ userSelect: 'none', pointerEvents: 'none' }}>
                {i}
              </text>
            ))}
            <text x="20" y={h / 2 + 1} fontSize="11" fontWeight="700"
                  fontFamily="'IBM Plex Mono', monospace" fill="#1f2937"
                  transform={uprightTransform(angle, 24, h / 2)}
                  style={{ userSelect: 'none', pointerEvents: 'none' }}>
              in
            </text>
            <text x={W / 2 - 4} y={h - 16} textAnchor="middle" fontSize="9"
                  fontFamily="'IBM Plex Mono', monospace" fill="#94a3b8"
                  transform={uprightTransform(angle, W / 2 - 4, h - 18)}
                  style={{ userSelect: 'none', pointerEvents: 'none' }}>
              {bw}→{n}
            </text>
          </g>
        </>
      );
    },
  },
  SPLITTER: {
    label: 'Séparateur',
    category: 'Bus',
    w: 80, h: 124,
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
        const bit = n - 1 - i;            // haut = MSB
        outputs.push({ name: `b${bit}`, x: 80, y: 22 + i * 24, width: 1 });
      }
      return {
        w: 80, h,
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
        stubs.push(<circle key={`op${i}`} cx={W} cy={y} r="3" fill={on ? accent : '#1f2937'} stroke="#1f2937" strokeWidth="1" />);
        labels.push({ bit, y, on });
      }
      return (
        <>
          {stubs}
          <line x1="0" y1={h / 2} x2="14" y2={h / 2} strokeWidth="1.2" />
          <circle cx="2.5" cy={h / 2} r="2.5" fill="white" strokeWidth="1.2" />
          <rect x="14" y="10" width={W - 28} height={h - 20} fill="white" stroke="#0f172a" strokeWidth="2" />
          <g stroke="none">
            {labels.map(({ bit, y, on }) => (
              <text key={`ot${bit}`} x={W - 20} y={y + 4} fontSize="12" textAnchor="end"
                    fontWeight={on ? '700' : '600'} fontFamily="'IBM Plex Mono', monospace"
                    fill={on ? '#1f2937' : '#475569'}
                    transform={uprightTransform(angle, W - 24, y)}
                    style={{ userSelect: 'none', pointerEvents: 'none' }}>{bit}</text>
            ))}
            <text x="20" y={h / 2 + 1} fontSize="11" fontWeight="700"
                  fontFamily="'IBM Plex Mono', monospace" fill="#1f2937"
                  transform={uprightTransform(angle, 24, h / 2)}
                  style={{ userSelect: 'none', pointerEvents: 'none' }}>in</text>
          </g>
        </>
      );
    },
  },
  MERGER: {
    label: 'Fusionneur',
    category: 'Bus',
    w: 80, h: 124,
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
        w: 80, h,
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
        stubs.push(<circle key={`ic${i}`} cx="2.5" cy={y} r="2.5" fill={on ? accent : 'white'} strokeWidth="1.2" />);
        labels.push({ bit, y, on });
      }
      return (
        <>
          {stubs}
          <line x1={W - 14} y1={h / 2} x2={W} y2={h / 2} strokeWidth="1.2" />
          <circle cx={W} cy={h / 2} r="3" fill={outVal ? accent : '#1f2937'} stroke="#1f2937" strokeWidth="1" />
          <rect x="14" y="10" width={W - 28} height={h - 20} fill="white" stroke="#0f172a" strokeWidth="2" />
          <g stroke="none">
            {labels.map(({ bit, y, on }) => (
              <text key={`it${bit}`} x="20" y={y + 4} fontSize="12"
                    fontWeight={on ? '700' : '600'} fontFamily="'IBM Plex Mono', monospace"
                    fill={on ? '#1f2937' : '#475569'}
                    transform={uprightTransform(angle, 24, y)}
                    style={{ userSelect: 'none', pointerEvents: 'none' }}>{bit}</text>
            ))}
            <text x={W - 20} y={h / 2 + 1} textAnchor="end" fontSize="11" fontWeight="700"
                  fontFamily="'IBM Plex Mono', monospace" fill="#1f2937"
                  transform={uprightTransform(angle, W - 24, h / 2)}
                  style={{ userSelect: 'none', pointerEvents: 'none' }}>out</text>
          </g>
        </>
      );
    },
  },
  SRLATCH: {
    label: 'Latch SR',
    category: 'Séquentiel',
    w: 96, h: 76,
    inputs: [
      { name: 'S', x: 0, y: 28, width: 1 },
      { name: 'R', x: 0, y: 52, width: 1 },
    ],
    outputs: [{ name: 'Q', x: 96, y: 40, width: 1 }],
    // q : valeur stockée (0 ou 1). Pas de CLK : sortie suit S/R en continu.
    defaultState: { q: 0 },
    shape: (comp, _o, _i, _ibn, angle) => {
      const q = asInt(comp?.state?.q) & 1;
      const w = 96, h = 76;
      const lcdH = h - 40;
      const lcdY = (h - lcdH) / 2;
      const lcdX = 36, lcdW = w - 72;
      return (
        <>
          {/* Stubs des ports */}
          <line x1="0" y1="28" x2="14" y2="28" strokeWidth="1.2" />
          <line x1="0" y1="52" x2="14" y2="52" strokeWidth="1.2" />
          <line x1={w - 14} y1="40" x2={w} y2="40" strokeWidth="1.2" />
          {/* Cercles vides aux entrées */}
          <circle cx="2.5" cy="28" r="2.5" fill="white" strokeWidth="1.2" />
          <circle cx="2.5" cy="52" r="2.5" fill="white" strokeWidth="1.2" />
          {/* Disque plein à la sortie */}
          <circle cx={w - 2.5} cy="40" r="3"
                  fill={q ? 'var(--lcd-text, #fbbf24)' : '#1f2937'}
                  stroke="#1f2937" strokeWidth="1" />
          {/* Boîtier */}
          <rect x="14" y="10" width={w - 28} height={h - 20}
                fill="white" stroke="#0f172a" strokeWidth="2" />
          {/* Afficheur LED */}
          <rect x={lcdX} y={lcdY} width={lcdW} height={lcdH} rx="2"
                fill="var(--lcd-fill, #0f172a)" stroke="var(--lcd-border, #0f172a)" strokeWidth="1" />
          <g stroke="none">
            <text x="20" y="33" fontSize="14" fontWeight="700"
                  fontFamily="'IBM Plex Mono', monospace" fill="#1f2937"
                  transform={uprightTransform(angle, 20, 28)}
                  style={{ userSelect: 'none', pointerEvents: 'none' }}>S</text>
            <text x="20" y="57" fontSize="14" fontWeight="700"
                  fontFamily="'IBM Plex Mono', monospace" fill="#1f2937"
                  transform={uprightTransform(angle, 20, 52)}
                  style={{ userSelect: 'none', pointerEvents: 'none' }}>R</text>
            <text x={w - 20} y="45" textAnchor="end" fontSize="14" fontWeight="700"
                  fontFamily="'IBM Plex Mono', monospace" fill="#1f2937"
                  transform={uprightTransform(angle, w - 20, 40)}
                  style={{ userSelect: 'none', pointerEvents: 'none' }}>Q</text>
            <text x={lcdX + lcdW / 2} y={lcdY + lcdH / 2 + 6} textAnchor="middle"
                  fontSize="18" fontWeight="700"
                  fontFamily="'IBM Plex Mono', monospace"
                  fill="var(--lcd-text, #fbbf24)"
                  transform={uprightTransform(angle, lcdX + lcdW / 2, lcdY + lcdH / 2)}
                  style={{ userSelect: 'none', pointerEvents: 'none' }}>
              {q}
            </text>
          </g>
        </>
      );
    },
  },
  DFF: {
    label: 'Bascule D',
    category: 'Séquentiel',
    w: 104, h: 88,
    inputs: [],
    outputs: [],
    // q     : valeur stockée (entier, masquée à `width` bits)
    // lastClk : valeur CLK observée au tick précédent (pour détecter front montant)
    // lastTriggerAt : timestamp du dernier front capturé (pour le halo visuel)
    // width : largeur (1 = bascule classique, >1 = registre N-bit)
    defaultState: { q: 0, lastClk: 0, lastTriggerAt: 0, width: 1 },
    getDynamicGeometry: (comp) => {
      const width = comp?.state?.width ?? 1;
      const w = widthForBits(width, { minW: 134, portMargin: 32 });
      const h = 88;
      return {
        w, h,
        inputs: [
          { name: 'D', x: 0, y: 24, width },
          { name: 'CLK', x: 0, y: 48, width: 1 },
          { name: 'RST', x: 0, y: 70, width: 1 },
        ],
        outputs: [{ name: 'Q', x: w, y: 44, width }],
      };
    },
    shape: (comp, _o, _i, _ibn, angle) => {
      const width = comp?.state?.width ?? 1;
      const q = maskTo(width, asInt(comp?.state?.q));
      const w = widthForBits(width, { minW: 134, portMargin: 32 });
      const h = 88;
      const now = Date.now();
      const since = now - (comp?.state?.lastTriggerAt ?? 0);
      const triggered = since >= 0 && since < 300;
      const lcdH = h - 44;
      const lcdY = (h - lcdH) / 2;
      // LED décalé à droite pour laisser la place à « CLK » + triangle (~60px)
      const lcdX = 62, lcdW = w - 98;
      return (
        <>
          {/* Stubs */}
          <line x1="0" y1="24" x2="14" y2="24" strokeWidth="1.2" />
          <line x1="0" y1="48" x2="14" y2="48" strokeWidth="1.2" />
          <line x1="0" y1="70" x2="14" y2="70" strokeWidth="1.2" />
          <line x1={w - 14} y1="44" x2={w} y2="44" strokeWidth="1.2" />
          {/* Cercles aux entrées */}
          <circle cx="2.5" cy="24" r="2.5" fill="white" strokeWidth="1.2" />
          <circle cx="2.5" cy="48" r="2.5" fill="white" strokeWidth="1.2" />
          <circle cx="2.5" cy="70" r="2.5" fill="white" strokeWidth="1.2" />
          {/* Disque plein à la sortie */}
          <circle cx={w - 2.5} cy="44" r="3"
                  fill={q ? 'var(--lcd-text, #fbbf24)' : '#1f2937'}
                  stroke="#1f2937" strokeWidth="1" />
          {/* Halo lime au moment du front montant */}
          {triggered && (
            <rect x="12" y="8" width={w - 24} height={h - 16} rx="2"
                  fill="none" stroke="#84cc16" strokeWidth="3"
                  opacity={Math.max(0, 1 - since / 300)} />
          )}
          {/* Boîtier */}
          <rect x="14" y="10" width={w - 28} height={h - 20}
                fill="white" stroke="#0f172a" strokeWidth="2" />
          {/* Cadre LED */}
          <rect x={lcdX} y={lcdY} width={lcdW} height={lcdH} rx="2"
                fill="var(--lcd-fill, #0f172a)" stroke="var(--lcd-border, #0f172a)" strokeWidth="1" />
          <g stroke="none">
            <text x="20" y="29" fontSize="14" fontWeight="700"
                  fontFamily="'IBM Plex Mono', monospace" fill="#1f2937"
                  transform={uprightTransform(angle, 20, 24)}
                  style={{ userSelect: 'none', pointerEvents: 'none' }}>D</text>
            {/* Triangle ▷ collé au bord gauche, puis label « CLK » à droite */}
            <path d={`M 14 40 L 22 44 L 14 48 Z`} fill="#1f2937"
                  transform={uprightTransform(angle, 18, 44)} />
            <text x="26" y="49" fontSize="14" fontWeight="700"
                  fontFamily="'IBM Plex Mono', monospace" fill="#1f2937"
                  transform={uprightTransform(angle, 26, 44)}
                  style={{ userSelect: 'none', pointerEvents: 'none' }}>CLK</text>
            <text x="20" y="75" fontSize="14" fontWeight="700"
                  fontFamily="'IBM Plex Mono', monospace" fill="#1f2937"
                  transform={uprightTransform(angle, 20, 70)}
                  style={{ userSelect: 'none', pointerEvents: 'none' }}>R</text>
            <text x={w - 20} y="49" textAnchor="end" fontSize="14" fontWeight="700"
                  fontFamily="'IBM Plex Mono', monospace" fill="#1f2937"
                  transform={uprightTransform(angle, w - 20, 44)}
                  style={{ userSelect: 'none', pointerEvents: 'none' }}>Q</text>
            <text x={lcdX + lcdW / 2} y={lcdY + lcdH / 2 + 5} textAnchor="middle"
                  fontSize={width === 1 ? 20 : 14} fontWeight="700"
                  fontFamily="'IBM Plex Mono', monospace"
                  fill="var(--lcd-text, #fbbf24)"
                  transform={uprightTransform(angle, lcdX + lcdW / 2, lcdY + lcdH / 2)}
                  style={{ userSelect: 'none', pointerEvents: 'none' }}>
              {width === 1 ? String(q) : formatBitsGrouped(q, width)}
            </text>
          </g>
        </>
      );
    },
  },
  REG: {
    label: 'Registre',
    category: 'Séquentiel',
    w: 112, h: 88,  // recalculé dynamiquement
    inputs: [],
    outputs: [],
    // q       : valeur stockée (entier, masqué à width bits)
    // width   : largeur 1..32
    // lastClk : valeur CLK observée au tick précédent (front montant)
    defaultState: { q: 0, lastClk: 0, width: 4 },
    getDynamicGeometry: (comp) => {
      const width = comp?.state?.width ?? 4;
      const w = widthForBits(width, { minW: 132, portMargin: 33 });
      const h = 88;
      return {
        w, h,
        inputs: [
          { name: 'D',   x: 0, y: 24, width },
          { name: 'LD',  x: 0, y: 48, width: 1 },
          { name: 'CLK', x: 0, y: 70, width: 1 },
        ],
        outputs: [{ name: 'Q', x: w, y: 44, width }],
      };
    },
    shape: (comp, _o, _i, _ibn, angle) => {
      const width = comp?.state?.width ?? 4;
      const q = maskTo(width, asInt(comp?.state?.q));
      const w = widthForBits(width, { minW: 132, portMargin: 33 });
      const h = 88;
      const lcdH = h - 44;
      const lcdY = (h - lcdH) / 2;
      // LED décalé à droite pour laisser la place à « CLK » + triangle (~66px)
      const lcdX = 66, lcdW = w - 102;
      return (
        <>
          {/* Stubs */}
          <line x1="0" y1="24" x2="14" y2="24" strokeWidth="1.2" />
          <line x1="0" y1="48" x2="14" y2="48" strokeWidth="1.2" />
          <line x1="0" y1="70" x2="14" y2="70" strokeWidth="1.2" />
          <line x1={w - 14} y1="44" x2={w} y2="44" strokeWidth="1.2" />
          {/* Cercles aux entrées */}
          <circle cx="2.5" cy="24" r="2.5" fill="white" strokeWidth="1.2" />
          <circle cx="2.5" cy="48" r="2.5" fill="white" strokeWidth="1.2" />
          <circle cx="2.5" cy="70" r="2.5" fill="white" strokeWidth="1.2" />
          {/* Disque plein à la sortie */}
          <circle cx={w - 2.5} cy="44" r="3"
                  fill={q ? 'var(--lcd-text, #fbbf24)' : '#1f2937'}
                  stroke="#1f2937" strokeWidth="1" />
          {/* Boîtier */}
          <rect x="14" y="10" width={w - 28} height={h - 20}
                fill="white" stroke="#0f172a" strokeWidth="2" />
          {/* Cadre LED */}
          <rect x={lcdX} y={lcdY} width={lcdW} height={lcdH} rx="2"
                fill="var(--lcd-fill, #0f172a)" stroke="var(--lcd-border, #0f172a)" strokeWidth="1" />
          <g stroke="none">
            <text x="20" y="29" fontSize="14" fontWeight="700"
                  fontFamily="'IBM Plex Mono', monospace" fill="#1f2937"
                  transform={uprightTransform(angle, 20, 24)}
                  style={{ userSelect: 'none', pointerEvents: 'none' }}>D</text>
            <text x="20" y="53" fontSize="14" fontWeight="700"
                  fontFamily="'IBM Plex Mono', monospace" fill="#1f2937"
                  transform={uprightTransform(angle, 20, 48)}
                  style={{ userSelect: 'none', pointerEvents: 'none' }}>LD</text>
            {/* Triangle ▷ collé au bord gauche, puis label « CLK » à droite */}
            <path d={`M 14 66 L 22 70 L 14 74 Z`} fill="#1f2937"
                  transform={uprightTransform(angle, 18, 70)} />
            <text x="26" y="75" fontSize="14" fontWeight="700"
                  fontFamily="'IBM Plex Mono', monospace" fill="#1f2937"
                  transform={uprightTransform(angle, 26, 70)}
                  style={{ userSelect: 'none', pointerEvents: 'none' }}>CLK</text>
            <text x={w - 20} y="49" textAnchor="end" fontSize="14" fontWeight="700"
                  fontFamily="'IBM Plex Mono', monospace" fill="#1f2937"
                  transform={uprightTransform(angle, w - 20, 44)}
                  style={{ userSelect: 'none', pointerEvents: 'none' }}>Q</text>
            <text x={lcdX + lcdW / 2} y={lcdY + lcdH / 2 + 5} textAnchor="middle"
                  fontSize={width === 1 ? 20 : 14} fontWeight="700"
                  fontFamily="'IBM Plex Mono', monospace"
                  fill="var(--lcd-text, #fbbf24)"
                  transform={uprightTransform(angle, lcdX + lcdW / 2, lcdY + lcdH / 2)}
                  style={{ userSelect: 'none', pointerEvents: 'none' }}>
              {width === 1 ? String(q) : formatBitsGrouped(q, width)}
            </text>
          </g>
        </>
      );
    },
  },
  COUNTER: {
    label: 'Compteur',
    category: 'Séquentiel',
    w: 112, h: 88,
    inputs: [],
    outputs: [],
    // q       : valeur courante (masquée à width bits)
    // width   : largeur 1..32
    // lastClk : valeur CLK observée au tick précédent (front montant)
    defaultState: { q: 0, lastClk: 0, width: 4 },
    getDynamicGeometry: (comp) => {
      const width = comp?.state?.width ?? 4;
      const w = widthForBits(width, { minW: 132, portMargin: 33 });
      const h = 88;
      return {
        w, h,
        inputs: [
          { name: 'EN',  x: 0, y: 24, width: 1 },
          { name: 'CLK', x: 0, y: 48, width: 1 },
          { name: 'RST', x: 0, y: 70, width: 1 },
        ],
        outputs: [{ name: 'Q', x: w, y: 44, width }],
      };
    },
    shape: (comp, _o, _i, _ibn, angle) => {
      const width = comp?.state?.width ?? 4;
      const q = maskTo(width, asInt(comp?.state?.q));
      const w = widthForBits(width, { minW: 132, portMargin: 33 });
      const h = 88;
      const lcdH = h - 44;
      const lcdY = (h - lcdH) / 2;
      // LED décalé à droite pour laisser la place à « CLK » + triangle (~66px)
      const lcdX = 66, lcdW = w - 102;
      return (
        <>
          {/* Stubs */}
          <line x1="0" y1="24" x2="14" y2="24" strokeWidth="1.2" />
          <line x1="0" y1="48" x2="14" y2="48" strokeWidth="1.2" />
          <line x1="0" y1="70" x2="14" y2="70" strokeWidth="1.2" />
          <line x1={w - 14} y1="44" x2={w} y2="44" strokeWidth="1.2" />
          {/* Cercles aux entrées */}
          <circle cx="2.5" cy="24" r="2.5" fill="white" strokeWidth="1.2" />
          <circle cx="2.5" cy="48" r="2.5" fill="white" strokeWidth="1.2" />
          <circle cx="2.5" cy="70" r="2.5" fill="white" strokeWidth="1.2" />
          {/* Disque plein à la sortie */}
          <circle cx={w - 2.5} cy="44" r="3"
                  fill={q ? 'var(--lcd-text, #fbbf24)' : '#1f2937'}
                  stroke="#1f2937" strokeWidth="1" />
          {/* Boîtier */}
          <rect x="14" y="10" width={w - 28} height={h - 20}
                fill="white" stroke="#0f172a" strokeWidth="2" />
          {/* Cadre LED */}
          <rect x={lcdX} y={lcdY} width={lcdW} height={lcdH} rx="2"
                fill="var(--lcd-fill, #0f172a)" stroke="var(--lcd-border, #0f172a)" strokeWidth="1" />
          <g stroke="none">
            <text x="20" y="29" fontSize="14" fontWeight="700"
                  fontFamily="'IBM Plex Mono', monospace" fill="#1f2937"
                  transform={uprightTransform(angle, 20, 24)}
                  style={{ userSelect: 'none', pointerEvents: 'none' }}>EN</text>
            {/* Triangle ▷ collé au bord gauche, puis label « CLK » à droite */}
            <path d={`M 14 44 L 22 48 L 14 52 Z`} fill="#1f2937"
                  transform={uprightTransform(angle, 18, 48)} />
            <text x="26" y="53" fontSize="14" fontWeight="700"
                  fontFamily="'IBM Plex Mono', monospace" fill="#1f2937"
                  transform={uprightTransform(angle, 26, 48)}
                  style={{ userSelect: 'none', pointerEvents: 'none' }}>CLK</text>
            <text x="20" y="75" fontSize="14" fontWeight="700"
                  fontFamily="'IBM Plex Mono', monospace" fill="#1f2937"
                  transform={uprightTransform(angle, 20, 70)}
                  style={{ userSelect: 'none', pointerEvents: 'none' }}>R</text>
            <text x={w - 20} y="49" textAnchor="end" fontSize="14" fontWeight="700"
                  fontFamily="'IBM Plex Mono', monospace" fill="#1f2937"
                  transform={uprightTransform(angle, w - 20, 44)}
                  style={{ userSelect: 'none', pointerEvents: 'none' }}>Q</text>
            <text x={lcdX + lcdW / 2} y={lcdY + lcdH / 2 + 5} textAnchor="middle"
                  fontSize={width === 1 ? 20 : 14} fontWeight="700"
                  fontFamily="'IBM Plex Mono', monospace"
                  fill="var(--lcd-text, #fbbf24)"
                  transform={uprightTransform(angle, lcdX + lcdW / 2, lcdY + lcdH / 2)}
                  style={{ userSelect: 'none', pointerEvents: 'none' }}>
              {width === 1 ? String(q) : formatBitsGrouped(q, width)}
            </text>
          </g>
        </>
      );
    },
  },
  ADDER: {
    label: 'Additionneur',
    category: 'Arithmétique',
    w: 140, h: 92,  // recalculé dynamiquement
    inputs: [],
    outputs: [],
    // width : largeur 1..32. Composant purement combinatoire :
    // S = (A + B + Cin) mod 2^width, Cout = retenue sortante.
    defaultState: { width: 4 },
    getDynamicGeometry: (comp) => {
      const width = comp?.state?.width ?? 4;
      const w = widthForBits(width, { minW: 168, portMargin: 36 });
      const h = 92;
      return {
        w, h,
        inputs: [
          { name: 'A',   x: 0, y: 24, width },
          { name: 'B',   x: 0, y: 46, width },
          { name: 'Cin', x: 0, y: 68, width: 1 },
        ],
        outputs: [
          { name: 'S',    x: w, y: 34, width },
          { name: 'Cout', x: w, y: 64, width: 1 },
        ],
      };
    },
    shape: (comp, outputValue, _i, _ibn, angle) => {
      const width = comp?.state?.width ?? 4;
      const s = maskTo(width, asInt(outputValue));
      const w = widthForBits(width, { minW: 168, portMargin: 36 });
      const h = 92;
      const valText = width === 1 ? String(s) : formatBitsGrouped(s, width);
      const midX = w / 2;
      const lcdW = Math.max(30, valText.length * 9 + 14);
      const lcdH = 22;
      const lcdX = midX - lcdW / 2;
      const lcdY = 46;
      return (
        <>
          {/* Stubs entrées */}
          <line x1="0" y1="24" x2="14" y2="24" strokeWidth="1.2" />
          <line x1="0" y1="46" x2="14" y2="46" strokeWidth="1.2" />
          <line x1="0" y1="68" x2="14" y2="68" strokeWidth="1.2" />
          {/* Stubs sorties */}
          <line x1={w - 14} y1="34" x2={w} y2="34" strokeWidth="1.2" />
          <line x1={w - 14} y1="64" x2={w} y2="64" strokeWidth="1.2" />
          {/* Cercles aux entrées */}
          <circle cx="2.5" cy="24" r="2.5" fill="white" strokeWidth="1.2" />
          <circle cx="2.5" cy="46" r="2.5" fill="white" strokeWidth="1.2" />
          <circle cx="2.5" cy="68" r="2.5" fill="white" strokeWidth="1.2" />
          {/* Disques aux sorties */}
          <circle cx={w - 2.5} cy="34" r="3"
                  fill={s ? 'var(--lcd-text, #fbbf24)' : '#1f2937'}
                  stroke="#1f2937" strokeWidth="1" />
          <circle cx={w - 2.5} cy="64" r="3" fill="#1f2937" stroke="#1f2937" strokeWidth="1" />
          {/* Boîtier */}
          <rect x="14" y="10" width={w - 28} height={h - 20}
                fill="white" stroke="#0f172a" strokeWidth="2" />
          {/* Cadre LED (centré, sous le « + ») */}
          <rect x={lcdX} y={lcdY} width={lcdW} height={lcdH} rx="2"
                fill="var(--lcd-fill, #0f172a)" stroke="var(--lcd-border, #0f172a)" strokeWidth="1" />
          <g stroke="none">
            {/* Labels des entrées (gauche) */}
            <text x="20" y="29" fontSize="14" fontWeight="700"
                  fontFamily="'IBM Plex Mono', monospace" fill="#1f2937"
                  transform={uprightTransform(angle, 20, 24)}
                  style={{ userSelect: 'none', pointerEvents: 'none' }}>A</text>
            <text x="20" y="51" fontSize="14" fontWeight="700"
                  fontFamily="'IBM Plex Mono', monospace" fill="#1f2937"
                  transform={uprightTransform(angle, 20, 46)}
                  style={{ userSelect: 'none', pointerEvents: 'none' }}>B</text>
            <text x="20" y="72" fontSize="11" fontWeight="700"
                  fontFamily="'IBM Plex Mono', monospace" fill="#1f2937"
                  transform={uprightTransform(angle, 20, 68)}
                  style={{ userSelect: 'none', pointerEvents: 'none' }}>Cin</text>
            {/* Labels des sorties (droite, collés au bord, hors du LCD) */}
            <text x={w - 16} y="39" textAnchor="end" fontSize="14" fontWeight="700"
                  fontFamily="'IBM Plex Mono', monospace" fill="#1f2937"
                  transform={uprightTransform(angle, w - 16, 34)}
                  style={{ userSelect: 'none', pointerEvents: 'none' }}>S</text>
            <text x={w - 16} y="69" textAnchor="end" fontSize="11" fontWeight="700"
                  fontFamily="'IBM Plex Mono', monospace" fill="#1f2937"
                  transform={uprightTransform(angle, w - 16, 64)}
                  style={{ userSelect: 'none', pointerEvents: 'none' }}>Cout</text>
            {/* Symbole « + » au-dessus du contenu */}
            <text x={midX} y="33" textAnchor="middle" fontSize="17" fontWeight="700"
                  fontFamily="'IBM Plex Mono', monospace" fill="#1f2937"
                  transform={uprightTransform(angle, midX, 28)}
                  style={{ userSelect: 'none', pointerEvents: 'none' }}>+</text>
            {/* Valeur de la somme dans le LCD */}
            <text x={midX} y={lcdY + lcdH / 2 + 5} textAnchor="middle"
                  fontSize={width === 1 ? 16 : 13} fontWeight="700"
                  fontFamily="'IBM Plex Mono', monospace"
                  fill="var(--lcd-text, #fbbf24)"
                  transform={uprightTransform(angle, midX, lcdY + lcdH / 2)}
                  style={{ userSelect: 'none', pointerEvents: 'none' }}>
              {valText}
            </text>
          </g>
        </>
      );
    },
  },
  RAM: {
    label: 'RAM',
    category: 'Séquentiel',
    w: 140, h: 112,
    inputs: [],
    outputs: [],
    // addrWidth : largeur du port ADDR (1..8) → 2^addrWidth cases mémoire
    // dataWidth : largeur des mots (1..16)
    // mem       : tableau d'entiers, longueur 2^addrWidth, chaque entrée masquée à dataWidth bits
    // lastClk   : valeur CLK observée au tick précédent (pour détecter le front montant)
    defaultState: { addrWidth: 3, dataWidth: 4, mem: [0,0,0,0,0,0,0,0], lastClk: 0 },
    getDynamicGeometry: (comp) => {
      const aw = comp?.state?.addrWidth ?? 3;
      const dw = comp?.state?.dataWidth ?? 4;
      const w = widthForBits(dw, { minW: 150, portMargin: 32 });
      const h = 112;
      return {
        w, h,
        inputs: [
          { name: 'ADDR',    x: 0, y: 26, width: aw },
          { name: 'DATA_IN', x: 0, y: 50, width: dw },
          { name: 'WE',      x: 0, y: 74, width: 1 },
          { name: 'CLK',     x: 0, y: 92, width: 1 },
        ],
        outputs: [{ name: 'DATA_OUT', x: w, y: 56, width: dw }],
      };
    },
    shape: (comp, _outputValue, _inputValue, inputsByName, angle) => {
      const aw = comp?.state?.addrWidth ?? 3;
      const dw = comp?.state?.dataWidth ?? 4;
      const mem = Array.isArray(comp?.state?.mem) ? comp.state.mem : [];
      const w = widthForBits(dw, { minW: 150, portMargin: 32 });
      const h = 112;
      const depth = 1 << aw;
      const liveAddr = maskTo(aw, asInt(inputsByName?.ADDR ?? 0));
      const liveValue = maskTo(dw, asInt(mem[liveAddr] ?? 0));
      // LED centré verticalement sur le boîtier (h=112 → centre 56)
      const lcdH = h - 56;
      const lcdY = (h - lcdH) / 2;
      // LED décalé pour laisser passer « CLK » + triangle (~60px) sur le port CLK
      const lcdX = 62, lcdW = w - 98;
      return (
        <>
          {/* Stubs */}
          <line x1="0" y1="26" x2="14" y2="26" strokeWidth="1.2" />
          <line x1="0" y1="50" x2="14" y2="50" strokeWidth="1.2" />
          <line x1="0" y1="74" x2="14" y2="74" strokeWidth="1.2" />
          <line x1="0" y1="92" x2="14" y2="92" strokeWidth="1.2" />
          <line x1={w - 14} y1="56" x2={w} y2="56" strokeWidth="1.2" />
          {/* Cercles aux entrées */}
          <circle cx="2.5" cy="26" r="2.5" fill="white" strokeWidth="1.2" />
          <circle cx="2.5" cy="50" r="2.5" fill="white" strokeWidth="1.2" />
          <circle cx="2.5" cy="74" r="2.5" fill="white" strokeWidth="1.2" />
          <circle cx="2.5" cy="92" r="2.5" fill="white" strokeWidth="1.2" />
          {/* Disque plein à la sortie */}
          <circle cx={w - 2.5} cy="56" r="3"
                  fill={liveValue ? 'var(--lcd-text, #fbbf24)' : '#1f2937'}
                  stroke="#1f2937" strokeWidth="1" />
          {/* Boîtier */}
          <rect x="14" y="10" width={w - 28} height={h - 20}
                fill="white" stroke="#0f172a" strokeWidth="2" />
          {/* Cadre LED */}
          <rect x={lcdX} y={lcdY} width={lcdW} height={lcdH} rx="2"
                fill="var(--lcd-fill, #0f172a)" stroke="var(--lcd-border, #0f172a)" strokeWidth="1" />
          <g stroke="none">
            <text x={w / 2} y={22} textAnchor="middle"
                  fontSize="12" fontWeight="700"
                  fontFamily="'IBM Plex Sans', sans-serif" fill="#1f2937"
                  transform={uprightTransform(angle, w / 2, 18)}
                  style={{ userSelect: 'none', pointerEvents: 'none' }}>
              RAM {depth}×{dw}
            </text>
            <text x="20" y="31" fontSize="12" fontWeight="700"
                  fontFamily="'IBM Plex Mono', monospace" fill="#1f2937"
                  transform={uprightTransform(angle, 20, 26)}
                  style={{ userSelect: 'none', pointerEvents: 'none' }}>A</text>
            <text x="20" y="55" fontSize="12" fontWeight="700"
                  fontFamily="'IBM Plex Mono', monospace" fill="#1f2937"
                  transform={uprightTransform(angle, 20, 50)}
                  style={{ userSelect: 'none', pointerEvents: 'none' }}>D</text>
            <text x="20" y="79" fontSize="12" fontWeight="700"
                  fontFamily="'IBM Plex Mono', monospace" fill="#1f2937"
                  transform={uprightTransform(angle, 20, 74)}
                  style={{ userSelect: 'none', pointerEvents: 'none' }}>WE</text>
            {/* Triangle ▷ collé au bord gauche, puis label « CLK » à droite */}
            <path d={`M 14 88 L 22 92 L 14 96 Z`} fill="#1f2937"
                  transform={uprightTransform(angle, 18, 92)} />
            <text x="26" y="97" fontSize="12" fontWeight="700"
                  fontFamily="'IBM Plex Mono', monospace" fill="#1f2937"
                  transform={uprightTransform(angle, 26, 92)}
                  style={{ userSelect: 'none', pointerEvents: 'none' }}>CLK</text>
            <text x={w - 20} y="61" textAnchor="end" fontSize="12" fontWeight="700"
                  fontFamily="'IBM Plex Mono', monospace" fill="#1f2937"
                  transform={uprightTransform(angle, w - 20, 56)}
                  style={{ userSelect: 'none', pointerEvents: 'none' }}>Q</text>
            <text x={lcdX + lcdW / 2} y={lcdY + lcdH / 2 + 5} textAnchor="middle"
                  fontSize={dw === 1 ? 20 : 14} fontWeight="700"
                  fontFamily="'IBM Plex Mono', monospace" fill="var(--lcd-text, #fbbf24)"
                  transform={uprightTransform(angle, lcdX + lcdW / 2, lcdY + lcdH / 2)}
                  style={{ userSelect: 'none', pointerEvents: 'none' }}>
              {dw === 1 ? String(liveValue) : formatBitsGrouped(liveValue, dw)}
            </text>
          </g>
        </>
      );
    },
  },
  CLOCK: {
    label: 'Horloge',
    category: 'Séquentiel',
    w: 44, h: 40,
    inputs: [],
    outputs: [{ name: 'CLK', x: 44, y: 20, width: 1 }],
    isToggle: true,
    // value     : valeur courante 0/1 (sortie sur CLK)
    // running   : true = bascule automatiquement à `freq` Hz (cycles/s)
    // freq      : fréquence en Hz (cycles par seconde, donc 2·freq transitions/s)
    // lastToggleAt : timestamp ms de la dernière bascule auto
    defaultState: { value: 0, running: false, freq: 1, lastToggleAt: 0 },
    shape: (comp, _o, _i, _ibn, angle) => {
      const v = asInt(comp?.state?.value);
      const running = !!comp?.state?.running;
      return (
        <>
          <rect x="0" y="0" width="40" height="40" rx="5"
                fill={v ? 'var(--input-on, #84cc16)' : 'white'}
                stroke={running ? '#dc2626' : '#1f2937'} strokeWidth={running ? 1.2 : 1} />
          {/* Mini onde carrée stylisée */}
          <path d="M 6 12 L 10 12 L 10 7 L 18 7 L 18 12 L 26 12 L 26 7 L 32 7"
                fill="none" stroke="#475569" strokeWidth="0.8"
                opacity="0.6"
                transform={uprightTransform(angle, 20, 10)} />
          {/* Valeur 0/1 */}
          <text x="20" y="32" textAnchor="middle"
                fontSize="14" fontWeight="700"
                fontFamily="'IBM Plex Mono', monospace"
                fill={v ? '#1a2e05' : '#475569'}
                transform={uprightTransform(angle, 20, 26)}
                style={{ userSelect: 'none', pointerEvents: 'none' }}>
            {v ? '1' : '0'}
          </text>
          {running && (
            <circle cx="35" cy="6" r="2.5" fill="#dc2626">
              <animate attributeName="opacity" values="1;0.3;1" dur="0.8s" repeatCount="indefinite" />
            </circle>
          )}
          <line x1="40" y1="20" x2="44" y2="20" />
        </>
      );
    },
  },
  SEG7: {
    label: '7 segments',
    category: 'E/S',
    w: 56, h: 88,
    inputs: [],
    outputs: [],
    // mode : 'hex' (1 port bus 4 bits, décodage interne 0..F)
    //        'raw' (7 ports 1-bit a..g, l'élève cable chaque segment)
    defaultState: { mode: 'hex' },
    getDynamicGeometry: (comp) => {
      const mode = comp?.state?.mode ?? 'hex';
      if (mode === 'hex') {
        const h = 88;
        return {
          w: 56, h,
          inputs: [{ name: 'D', x: 0, y: h / 2, width: 4 }],
          outputs: [],
        };
      }
      // raw : composant élargi pour avoir une colonne d'étiquettes externe.
      // Hauteur augmentée pour laisser la place aux lettres au-dessus de chaque stub.
      const w = 76, h = 104;
      const names = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];
      const step = (h - 24) / 6;
      return {
        w, h,
        inputs: names.map((n, i) => ({ name: n, x: 0, y: 16 + i * step, width: 1 })),
        outputs: [],
      };
    },
    shape: (comp, _outputValue, inputValue, inputsByName, angle) => {
      const mode = comp?.state?.mode ?? 'hex';
      const h = mode === 'hex' ? 88 : 104;
      const w = mode === 'hex' ? 56 : 76;
      const boxX = mode === 'hex' ? 6 : 26;
      const boxW = mode === 'hex' ? w - 12 : w - 32;
      // Calcule l'état des 7 segments (bit i = segment a..g)
      let segs = 0;
      if (mode === 'hex') {
        const d = maskTo(4, asInt(inputsByName?.D ?? inputValue ?? 0));
        segs = SEG7_HEX_TABLE[d] | 0;
      } else {
        ['a','b','c','d','e','f','g'].forEach((name, i) => {
          if (asInt(inputsByName?.[name] ?? 0) & 1) segs |= 1 << i;
        });
      }
      const seg = (i) => (segs >> i) & 1;
      const on = 'var(--seg7-on, #ef4444)';
      const off = 'var(--seg7-off, #1f2937)';
      const t = 4;
      // Bords gauche/droite des segments, calés sur le cadre noir
      const x1 = boxX + 6, x2 = boxX + boxW - 6;
      // Segments centrés verticalement dans le cadre noir
      const yMid = h / 2;
      const yTop = yMid - 30, yBot = yMid + 30;
      const horiz = (xa, xb, y) => `${xa + t},${y - t} ${xb - t},${y - t} ${xb},${y} ${xb - t},${y + t} ${xa + t},${y + t} ${xa},${y}`;
      const vert  = (x, ya, yb) => `${x - t},${ya + t} ${x},${ya} ${x + t},${ya + t} ${x + t},${yb - t} ${x},${yb} ${x - t},${yb - t}`;
      // Positions des ports a..g en mode raw (mêmes valeurs que getDynamicGeometry)
      const rawStep = mode === 'raw' ? (h - 24) / 6 : 0;
      const portY = (i) => 16 + i * rawStep;
      return (
        <>
          {/* Stubs sur les ports */}
          {mode === 'hex' ? (
            <line x1="0" y1={h / 2} x2="6" y2={h / 2} />
          ) : (
            ['a', 'b', 'c', 'd', 'e', 'f', 'g'].map((_, i) => {
              const yy = portY(i);
              return <line key={i} x1="0" y1={yy} x2={boxX} y2={yy} />;
            })
          )}
          {/* Étiquettes a..g au-DESSUS de chaque stub, dans la marge gauche (mode raw) */}
          {mode === 'raw' && (
            <g stroke="none">
              {['a','b','c','d','e','f','g'].map((name, i) => {
                const yy = portY(i);
                const lit = (segs >> i) & 1;
                // La lettre est posée juste au-dessus du fil. baseline = yy - 3
                // → la lettre s'étend approximativement de yy-12 à yy-3.
                return (
                  <text key={name} x="10" y={yy - 3} fontSize="11" fontWeight="700"
                        textAnchor="middle"
                        fontFamily="'IBM Plex Mono', monospace"
                        fill={lit ? 'var(--seg7-on, #ef4444)' : '#475569'}
                        transform={uprightTransform(angle, 10, yy - 7)}
                        style={{ userSelect: 'none', pointerEvents: 'none' }}>
                    {name}
                  </text>
                );
              })}
            </g>
          )}
          {/* Cadre noir mat */}
          <rect x={boxX} y="6" width={boxW} height={h - 12} rx="3"
                fill="#0f172a" stroke="#1f2937" strokeWidth="1" />
          {/* Segments : on contra-rotate uniquement le bloc des segments pour
              que l'afficheur reste lisible quelle que soit l'orientation. */}
          <g transform={angle ? `rotate(${-angle} ${boxX + boxW / 2} ${h / 2})` : undefined}>
            <g stroke="none" strokeLinejoin="miter">
              <polygon points={horiz(x1, x2, yTop)} fill={seg(0) ? on : off} />
              <polygon points={vert(x2, yTop, yMid)} fill={seg(1) ? on : off} />
              <polygon points={vert(x2, yMid, yBot)} fill={seg(2) ? on : off} />
              <polygon points={horiz(x1, x2, yBot)} fill={seg(3) ? on : off} />
              <polygon points={vert(x1, yMid, yBot)} fill={seg(4) ? on : off} />
              <polygon points={vert(x1, yTop, yMid)} fill={seg(5) ? on : off} />
              <polygon points={horiz(x1, x2, yMid)} fill={seg(6) ? on : off} />
            </g>
          </g>
        </>
      );
    },
  },
  LEDMATRIX: {
    label: 'Matrice LED',
    category: 'E/S',
    w: 120, h: 120,
    inputs: [],
    outputs: [],
    // cols, rows : dimensions (1-16 chacune)
    // pixels    : Array(cols*rows) d'entiers 0/1 (un par pixel)
    // lastClk   : valeur CLK observée au tick précédent (front montant)
    defaultState: {
      cols: 8, rows: 8,
      pixels: new Array(64).fill(0),
      lastClk: 0,
    },
    getDynamicGeometry: (comp) => {
      const cols = comp?.state?.cols ?? 8;
      const rows = comp?.state?.rows ?? 8;
      const xWidth = addrBitsFor(cols);
      const yWidth = addrBitsFor(rows);
      // Largeur calculée exactement : zone des ports à gauche + grille + petit espace droit.
      // Le composant rétrécit pour les petites matrices et grandit pour les grandes.
      const pixelSize = cols * rows > 100 ? 10 : 12;
      const gridW = cols * pixelSize;
      const gridH = rows * pixelSize;
      const portsAreaW = 60;     // largeur fixe : stubs + label « CLK » + triangle ▷
      // gridMarginR = 14 (épaisseur du bord du boîtier) + 20 (espace visuel souhaité)
      // pour avoir une marge identique à celle des LED des bascules.
      const gridMarginR = 32;
      const w = portsAreaW + gridW + gridMarginR;
      // Hauteur : 6 ports espacés de 18 px + marges 24+24 = 6*18 + 48 = 156 minimum
      // Mais il faut aussi que la grille rentre verticalement.
      const minPortsH = 24 + 5 * 18 + 24; // 5 intervalles entre 6 ports
      const h = Math.max(minPortsH, gridH + 32);
      const portSlots = [
        { name: 'X',   width: xWidth },
        { name: 'Y',   width: yWidth },
        { name: 'D',   width: 1 },
        { name: 'WE',  width: 1 },
        { name: 'CLK', width: 1 },
        { name: 'RST', width: 1 },
      ];
      const portTop = 24;
      const portBottom = h - 24;
      const slotStep = (portBottom - portTop) / (portSlots.length - 1);
      return {
        w, h,
        inputs: portSlots.map((p, i) => ({
          name: p.name,
          x: 0,
          y: Math.round(portTop + i * slotStep),
          width: p.width,
        })),
        outputs: [],
      };
    },
    shape: (comp, _o, _i, inputsByName, angle) => {
      const cols = comp?.state?.cols ?? 8;
      const rows = comp?.state?.rows ?? 8;
      const pixels = Array.isArray(comp?.state?.pixels) ? comp.state.pixels : [];
      const pixelSize = cols * rows > 100 ? 10 : 12;
      const gridW = cols * pixelSize;
      const gridH = rows * pixelSize;
      const portsAreaW = 60;
      const gridMarginR = 32;  // doit rester en phase avec getDynamicGeometry
      const w = portsAreaW + gridW + gridMarginR;
      const minPortsH = 24 + 5 * 18 + 24;
      const h = Math.max(minPortsH, gridH + 32);
      const portSlots = ['X', 'Y', 'D', 'WE', 'CLK', 'RST'];
      const portTop = 24;
      const portBottom = h - 24;
      const slotStep = (portBottom - portTop) / (portSlots.length - 1);
      // Grille collée juste après la zone des ports (pas d'espace mort à gauche)
      const gridX = portsAreaW;
      const gridY = (h - gridH) / 2;
      const on = 'var(--input-on, #84cc16)';
      const off = '#1f2937';
      return (
        <>
          {/* Stubs et cercles aux entrées */}
          {portSlots.map((name, i) => {
            const yy = Math.round(portTop + i * slotStep);
            return (
              <g key={name}>
                <line x1="0" y1={yy} x2="14" y2={yy} strokeWidth="1.2" />
                <circle cx="2.5" cy={yy} r="2.5" fill="white" strokeWidth="1.2" />
              </g>
            );
          })}
          {/* Boîtier */}
          <rect x="14" y="10" width={w - 28} height={h - 20}
                fill="white" stroke="#0f172a" strokeWidth="2" />
          {/* Labels ports + triangle ▷ collé au bord pour CLK (5e port = index 4) */}
          <g stroke="none">
            {portSlots.map((name, i) => {
              const yy = Math.round(portTop + i * slotStep);
              // Pour CLK : on dessine le triangle à gauche puis le label à droite
              if (name === 'CLK') {
                return (
                  <g key={name}>
                    <path d={`M 14 ${yy - 4} L 22 ${yy} L 14 ${yy + 4} Z`}
                          fill="#1f2937"
                          transform={uprightTransform(angle, 18, yy)} />
                    <text x="26" y={yy + 4} fontSize="11" fontWeight="700"
                          fontFamily="'IBM Plex Mono', monospace" fill="#1f2937"
                          transform={uprightTransform(angle, 26, yy)}
                          style={{ userSelect: 'none', pointerEvents: 'none' }}>
                      CLK
                    </text>
                  </g>
                );
              }
              return (
                <text key={name} x="19" y={yy + 4} fontSize="11" fontWeight="700"
                      fontFamily="'IBM Plex Mono', monospace" fill="#1f2937"
                      transform={uprightTransform(angle, 19, yy)}
                      style={{ userSelect: 'none', pointerEvents: 'none' }}>
                  {name}
                </text>
              );
            })}
          </g>
          {/* Grille de pixels — contra-rotée pour rester lisible */}
          <g transform={angle ? `rotate(${-angle} ${gridX + gridW / 2} ${gridY + gridH / 2})` : undefined}>
            {/* Fond noir mat strictement aligné sur la grille (pas de stroke pour éviter le débordement). */}
            <rect x={gridX} y={gridY} width={gridW} height={gridH}
                  fill="#0f172a" stroke="none" />
            {Array.from({ length: rows }).map((_, r) =>
              Array.from({ length: cols }).map((__, c) => {
                const v = pixels[r * cols + c] ? 1 : 0;
                return (
                  <rect key={`${r}-${c}`}
                        x={gridX + c * pixelSize + 1}
                        y={gridY + r * pixelSize + 1}
                        width={pixelSize - 2}
                        height={pixelSize - 2}
                        fill={v ? on : off}
                        stroke="none" />
                );
              })
            )}
          </g>
        </>
      );
    },
  },
};

const PALETTE_ORDER = ['INPUT', 'OUTPUT', 'SEG7', 'LEDMATRIX', 'AND', 'OR', 'NOT', 'NAND', 'NOR', 'XOR', 'MUX', 'DEMUX', 'DECODER', 'SPLITTER', 'MERGER', 'ADDER', 'SRLATCH', 'DFF', 'REG', 'COUNTER', 'RAM', 'CLOCK'];

// ============================================================
// HELPERS
// ============================================================
const snap = (v) => Math.round(v / GRID) * GRID;
const uid = (prefix) => `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

// ============================================================
// DÉFINITIONS PERSONNALISÉES
// ----
// Une définition custom a la forme :
//   { name, inputs: [{name, internalId}], outputs: [{name, internalId}],
//     circuit: { components, wires } }
// Où internalId pointe vers un composant INPUT (côté entrées) ou OUTPUT (sorties)
// dans le sous-circuit. À l'évaluation, on injecte les valeurs reçues dans les
// INPUT internes, on simule récursivement, et on lit les sorties au pied des
// OUTPUT internes.
// ============================================================

// Construit un "def" type-gate à partir d'une définition stockée.
// Le résultat est compatible avec le reste du code (positions des ports, shape SVG…).
function buildCustomDef(name, data) {
  const nIn = data.inputs.length;
  const nOut = data.outputs.length;
  const maxPorts = Math.max(nIn, nOut, 1);
  // Hauteur : 20px de marge en haut, 20px par port, 20px en bas
  const h = Math.max(50, maxPorts * 20 + 20);
  // Largeur calibrée sur la longueur du nom
  const w = Math.max(80, Math.ceil((name.length * 7 + 30) / 20) * 20);

  const portY = (i, n) => {
    if (n === 1) return Math.round(h / 2 / 10) * 10;
    const span = (n - 1) * 20;
    const top = Math.round((h - span) / 2 / 10) * 10;
    return top + i * 20;
  };

  const inputs = data.inputs.map((p, i) => ({
    name: p.name,
    internalId: p.internalId,
    x: 0,
    y: portY(i, nIn),
    width: p.width ?? 1,
  }));
  const outputs = data.outputs.map((p, i) => ({
    name: p.name,
    internalId: p.internalId,
    x: w,
    y: portY(i, nOut),
    width: p.width ?? 1,
  }));

  return {
    label: name,
    category: 'Custom',
    w,
    h,
    inputs,
    outputs,
    isCustom: true,
    customName: name,
    customCircuit: data.circuit,
    shape: (_comp, _o, _i, _ibn, angle) => (
      <>
        <rect x="0" y="0" width={w} height={h} rx="4" fill="#fefdf8" />
        <text
          x={w / 2}
          y={14}
          textAnchor="middle"
          fontSize="11"
          fontWeight="600"
          fontFamily="'IBM Plex Sans', sans-serif"
          fill="#1f2937"
          transform={uprightTransform(angle, w / 2, 10)}
          style={{ userSelect: 'none' }}
        >
          {name}
        </text>
        {/* Étiquettes des ports d'entrée */}
        {inputs.map((p) => (
          <text
            key={'li' + p.name}
            x={7}
            y={p.y + 3}
            fontSize="9"
            fontFamily="'IBM Plex Mono', monospace"
            fill="#64748b"
            transform={uprightTransform(angle, 7, p.y)}
            style={{ userSelect: 'none' }}
          >
            {p.name}
          </text>
        ))}
        {/* Étiquettes des ports de sortie */}
        {outputs.map((p) => (
          <text
            key={'lo' + p.name}
            x={w - 7}
            y={p.y + 3}
            textAnchor="end"
            fontSize="9"
            fontFamily="'IBM Plex Mono', monospace"
            fill="#64748b"
            transform={uprightTransform(angle, w - 7, p.y)}
            style={{ userSelect: 'none' }}
          >
            {p.name}
          </text>
        ))}
      </>
    ),
  };
}

// Cache pour éviter de reconstruire les defs custom à chaque accès.
// La clé inclut un hash de la définition pour invalider quand elle change.
const customDefCache = new WeakMap();

// Renvoie la définition d'un type. Pour les composants dont la géométrie
// dépend de l'état (INPUT/OUTPUT en mode bus, SPLITTER/MERGER), on fusionne
// la def statique avec les valeurs renvoyées par `getDynamicGeometry(comp)`.
function getDef(type, customDefs, comp) {
  const baseDef = GATES[type];
  if (baseDef) {
    let def;
    if (baseDef.getDynamicGeometry) {
      const fakeComp = comp ?? { state: baseDef.defaultState };
      const dyn = baseDef.getDynamicGeometry(fakeComp);
      def = { ...baseDef, ...dyn };
    } else {
      def = baseDef;
    }
    return applyOrientation(def, comp?.state?.orientation);
  }
  if (!customDefs) return null;
  const data = customDefs[type];
  if (!data) return null;
  let cached = customDefCache.get(data);
  if (!cached) {
    cached = buildCustomDef(type, data);
    customDefCache.set(data, cached);
  }
  return applyOrientation(cached, comp?.state?.orientation);
}

// Vérifie si un type fait référence (transitivement) à `target` à travers customDefs.
// Utilisé pour bloquer les auto-références au moment de sauver une définition.
function typeReferences(type, customDefs, target, visited = new Set()) {
  if (type === target) return true;
  if (visited.has(type)) return false;
  visited.add(type);
  const data = customDefs?.[type];
  if (!data) return false;
  for (const c of data.circuit.components) {
    if (typeReferences(c.type, customDefs, target, visited)) return true;
  }
  return false;
}

function getPortPosition(comp, portName, kind, customDefs) {
  const def = getDef(comp.type, customDefs, comp);
  if (!def) return null;
  const ports = kind === 'input' ? def.inputs : def.outputs;
  const port = ports.find((p) => p.name === portName);
  if (!port) return null;
  return { x: comp.x + port.x, y: comp.y + port.y };
}

// Renvoie la largeur (en bits) d'un port donné. 1 = signal classique, >1 = bus.
function getPortWidth(comp, portName, kind, customDefs) {
  const def = getDef(comp.type, customDefs, comp);
  if (!def) return 1;
  const ports = kind === 'input' ? def.inputs : def.outputs;
  const port = ports.find((p) => p.name === portName);
  return port?.width ?? 1;
}

// ============================================================
// SIMULATION
// Wrapper local autour de `simulateCore` (importé depuis src/sim.js)
// qui fixe `getDef` au getDef local (avec shape JSX). C'est ce
// `simulate(circuit)` que tout le reste du fichier utilise.
// ============================================================
function simulate(circuit, customDefs = null, recursionStack = new Set()) {
  return simulateCore(circuit, getDef, customDefs, recursionStack);
}

// ============================================================
// ROUTAGE DES FILS — manhattan simple
// ============================================================
// Renvoie un tableau de points [x, y] formant la polyline du fil.
function routeWire(from, to) {
  const dx = to.x - from.x;
  if (dx >= 20) {
    const mx = from.x + Math.max(20, dx / 2);
    return [[from.x, from.y], [mx, from.y], [mx, to.y], [to.x, to.y]];
  } else {
    const stub = 16;
    const ay = from.y < to.y ? from.y - 30 : from.y + 30;
    return [
      [from.x, from.y],
      [from.x + stub, from.y],
      [from.x + stub, ay],
      [to.x - stub, ay],
      [to.x - stub, to.y],
      [to.x, to.y],
    ];
  }
}

function pointsToStr(pts) {
  return pts.map((p) => `${p[0]},${p[1]}`).join(' ');
}

// Décale une polyline manhattan (segments H/V uniquement) de `offset` pixels
// perpendiculairement à son tracé. Premier et dernier sommets restent à leur
// place : la piste converge naturellement vers le port en fan-in/fan-out.
function offsetManhattan(points, offset) {
  if (points.length < 2 || offset === 0) return points.map((p) => p.slice());

  // Directions unitaires pour chaque segment
  const dirs = [];
  for (let i = 0; i < points.length - 1; i++) {
    const dx = points[i + 1][0] - points[i][0];
    const dy = points[i + 1][1] - points[i][1];
    const len = Math.hypot(dx, dy);
    if (len === 0) {
      // Segment dégénéré : on reprend la direction précédente ou (1,0)
      dirs.push(dirs[dirs.length - 1] ?? [1, 0]);
    } else {
      dirs.push([dx / len, dy / len]);
    }
  }
  // Perpendiculaire « à gauche » de la direction : rotation 90° CCW
  const perp = (d) => [-d[1], d[0]];

  const result = [points[0].slice()];

  for (let i = 1; i < points.length - 1; i++) {
    const dPrev = dirs[i - 1];
    const dNext = dirs[i];
    const pP = perp(dPrev);
    const pN = perp(dNext);
    const Ax = points[i][0] + offset * pP[0];
    const Ay = points[i][1] + offset * pP[1];
    const Bx = points[i][0] + offset * pN[0];
    const By = points[i][1] + offset * pN[1];
    // Pour un tracé manhattan, dPrev et dNext sont axiaux et perpendiculaires.
    // Si le segment précédent est horizontal (dy≈0), son y reste Ay.
    // Le suivant est vertical (dx≈0), son x reste Bx → intersection (Bx, Ay).
    // Sinon (prev vertical, next horizontal) → intersection (Ax, By).
    let cx, cy;
    if (Math.abs(dPrev[1]) < 0.01) {
      cx = Bx; cy = Ay;
    } else {
      cx = Ax; cy = By;
    }
    result.push([cx, cy]);
  }

  result.push(points[points.length - 1].slice());
  return result;
}

// Génère N polylines parallèles pour un fil de bus. Espacement = `pitch` (centre à centre).
// Les pistes sont centrées sur le tracé : pour N pair, symétrie autour de l'axe ;
// pour N impair, la piste centrale est sur l'axe.
function makeBusTracks(points, n, pitch) {
  if (n <= 1) return [points];
  const tracks = [];
  for (let k = 0; k < n; k++) {
    const offset = (k - (n - 1) / 2) * pitch;
    tracks.push(offsetManhattan(points, offset));
  }
  return tracks;
}

// ============================================================
// EXPORT / IMPORT JSON
// ============================================================
// Wrappers locaux : passent le prédicat `isKnownType` (basé sur GATES) et le
// générateur `uid` à serialize/deserialize. Le code applicatif appelle ces
// wrappers comme avant ; la logique pure vit dans ./persist.js.
const isKnownType = (t) => !!GATES[t];
const serialize = (circuit) => serializeCore(circuit);
const deserialize = (data) => deserializeCore(data, { isKnownType, uid });
const serializeAll = (tabsState) => serializeAllCore(tabsState);
const deserializeAll = (data) => deserializeAllCore(data, { isKnownType, uid });

// ============================================================
// SOUS-COMPOSANTS UI
// ============================================================

function ChronogramPanel({ trace, enabled, onToggle, onClear }) {
  // Reconstruit la liste des signaux à partir du dernier échantillon (l'ordre est stable
  // tant que la structure du circuit ne change pas).
  const lastSample = trace[trace.length - 1];
  const signalsMeta = lastSample?.signals ?? [];

  if (signalsMeta.length === 0) {
    return (
      <div className="space-y-3 text-sm">
        <div className="flex gap-1">
          <button
            onClick={onToggle}
            className={`flex-1 px-2 py-1 text-xs rounded border ${
              enabled
                ? 'bg-stone-800 text-white border-stone-800'
                : 'bg-white text-stone-700 border-stone-300 hover:bg-stone-50'
            }`}
          >
            {enabled ? '⏸ Pause' : '⏵ Reprendre'}
          </button>
          <button
            onClick={onClear}
            className="px-2 py-1 text-xs rounded border border-stone-300 bg-white text-stone-700 hover:bg-stone-50"
          >
            Effacer
          </button>
        </div>
        <p className="text-xs text-stone-500 italic leading-snug">
          Le chronogramme se remplit automatiquement à chaque transition d'horloge.
          Ajoute une CLOCK au circuit et tique-la (manuellement ou en auto) pour voir
          les signaux s'enregistrer ici.
        </p>
      </div>
    );
  }

  // Géométrie
  const sampleWidth = 24;        // largeur d'un échantillon en px
  const rowHeight = 28;          // hauteur d'une piste
  const labelWidth = 80;         // colonne des labels à gauche
  const padTop = 4;
  const padRight = 8;
  const n = trace.length;
  const svgWidth = labelWidth + n * sampleWidth + padRight;
  const svgHeight = padTop + signalsMeta.length * rowHeight + 4;

  // Helpers de rendu
  const formatValue = (s) => {
    if (s.width === 1) return String(s.value & 1);
    // Pour les bus : hex compact si large, sinon décimal
    if (s.width > 4) return '0x' + (s.value >>> 0).toString(16).toUpperCase();
    return String(s.value);
  };

  // Trace une piste 1-bit : ligne haute/basse
  const render1Bit = (sigIdx, rowY) => {
    const path = [];
    for (let i = 0; i < n; i++) {
      const v = trace[i].signals.find((x) => x.key === signalsMeta[sigIdx].key)?.value ?? 0;
      const x0 = labelWidth + i * sampleWidth;
      const x1 = labelWidth + (i + 1) * sampleWidth;
      const y = rowY + (v ? 4 : rowHeight - 8);
      if (i === 0) {
        path.push(`M ${x0} ${y}`);
      } else {
        // transition verticale si v change
        const prev = trace[i - 1].signals.find((x) => x.key === signalsMeta[sigIdx].key)?.value ?? 0;
        if (prev !== v) {
          path.push(`L ${x0} ${rowY + (prev ? 4 : rowHeight - 8)}`);
          path.push(`L ${x0} ${y}`);
        } else {
          path.push(`L ${x0} ${y}`);
        }
      }
      path.push(`L ${x1} ${y}`);
    }
    return (
      <path key={signalsMeta[sigIdx].key + '-trace'} d={path.join(' ')}
            fill="none" stroke="#65a30d" strokeWidth="1.5" />
    );
  };

  // Trace une piste bus : bandes étiquetées par valeur
  const renderBus = (sigIdx, rowY) => {
    const elements = [];
    let segStart = 0;
    let segValue = trace[0].signals.find((x) => x.key === signalsMeta[sigIdx].key)?.value ?? 0;
    const pushSeg = (start, end, value) => {
      const x = labelWidth + start * sampleWidth;
      const width = (end - start) * sampleWidth;
      elements.push(
        <g key={`${signalsMeta[sigIdx].key}-${start}`}>
          <rect x={x} y={rowY + 4} width={width} height={rowHeight - 12}
                fill="#fef3c7" stroke="#f59e0b" strokeWidth="0.5" />
          {width > 18 && (
            <text x={x + width / 2} y={rowY + rowHeight / 2 + 1}
                  textAnchor="middle" fontSize="9"
                  fontFamily="'IBM Plex Mono', monospace"
                  fill="#78350f"
                  style={{ userSelect: 'none', pointerEvents: 'none' }}>
              {formatValue({ width: signalsMeta[sigIdx].width, value })}
            </text>
          )}
        </g>
      );
    };
    for (let i = 1; i < n; i++) {
      const v = trace[i].signals.find((x) => x.key === signalsMeta[sigIdx].key)?.value ?? 0;
      if (v !== segValue) {
        pushSeg(segStart, i, segValue);
        segStart = i;
        segValue = v;
      }
    }
    pushSeg(segStart, n, segValue);
    return <g key={signalsMeta[sigIdx].key + '-bus'}>{elements}</g>;
  };

  return (
    <div className="space-y-3 text-sm">
      <div className="flex gap-1">
        <button
          onClick={onToggle}
          className={`flex-1 px-2 py-1 text-xs rounded border ${
            enabled
              ? 'bg-stone-800 text-white border-stone-800'
              : 'bg-white text-stone-700 border-stone-300 hover:bg-stone-50'
          }`}
        >
          {enabled ? '⏸ Pause' : '⏵ Reprendre'}
        </button>
        <button
          onClick={onClear}
          className="px-2 py-1 text-xs rounded border border-stone-300 bg-white text-stone-700 hover:bg-stone-50"
        >
          Effacer
        </button>
      </div>
      <div className="text-[11px] text-stone-500">
        {n} échantillon{n > 1 ? 's' : ''} (max {100}). 1 échantillon = 1 transition de CLK.
      </div>
      <div className="overflow-x-auto border border-stone-200 rounded bg-white">
        <svg width={svgWidth} height={svgHeight}
             style={{ minWidth: '100%' }}
             fontFamily="'IBM Plex Mono', monospace">
          {/* Labels + pistes */}
          {signalsMeta.map((sig, sigIdx) => {
            const rowY = padTop + sigIdx * rowHeight;
            return (
              <g key={sig.key}>
                {/* Fond zébré */}
                {sigIdx % 2 === 1 && (
                  <rect x="0" y={rowY} width={svgWidth} height={rowHeight}
                        fill="#fafafa" />
                )}
                {/* Label */}
                <text x="6" y={rowY + rowHeight / 2 + 3}
                      fontSize="9.5" fill="#475569"
                      style={{ userSelect: 'none', pointerEvents: 'none' }}>
                  {sig.label.slice(0, 11)}
                </text>
                <text x={labelWidth - 4} y={rowY + rowHeight / 2 + 3}
                      textAnchor="end" fontSize="8" fill="#94a3b8"
                      style={{ userSelect: 'none', pointerEvents: 'none' }}>
                  /{sig.width}
                </text>
                {/* Ligne de base */}
                <line x1={labelWidth} y1={rowY + rowHeight - 4}
                      x2={svgWidth - padRight} y2={rowY + rowHeight - 4}
                      stroke="#e5e7eb" strokeWidth="0.5" />
                {/* Piste */}
                {sig.width === 1 ? render1Bit(sigIdx, rowY) : renderBus(sigIdx, rowY)}
              </g>
            );
          })}
          {/* Repères verticaux toutes les 5 transitions */}
          {Array.from({ length: Math.floor(n / 5) + 1 }).map((_, i) => {
            const x = labelWidth + i * 5 * sampleWidth;
            return (
              <line key={`grid-${i}`} x1={x} y1={padTop}
                    x2={x} y2={svgHeight - 4}
                    stroke="#e5e7eb" strokeWidth="0.5" strokeDasharray="2,2" />
            );
          })}
        </svg>
      </div>
      <p className="text-[10px] text-stone-400 leading-snug">
        Pistes vertes = 1 bit (ligne haute/basse). Bandes ambrées = bus (valeur affichée).
      </p>
    </div>
  );
}

function TabButton({ tab, active, disabled, canClose, onActivate, onRename, onClose }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(tab.name);
  // Si le nom change depuis l'extérieur (autre source) on resync
  useEffect(() => { if (!editing) setDraft(tab.name); }, [tab.name, editing]);

  const commitName = () => {
    const trimmed = draft.trim() || tab.name;
    onRename(trimmed);
    setEditing(false);
  };

  return (
    <div
      className={`group flex items-center gap-1.5 px-2.5 self-end h-[30px] rounded-t border border-b-0 cursor-pointer transition
        ${active
          ? 'bg-white border-stone-300 text-stone-900'
          : 'bg-stone-200/60 border-transparent text-stone-600 hover:bg-stone-200'}
        ${disabled && !active ? 'opacity-40 cursor-not-allowed' : ''}`}
      onClick={() => { if (!editing) onActivate(); }}
      onDoubleClick={(e) => { e.stopPropagation(); if (active) setEditing(true); }}
      title={editing ? '' : (active ? 'Double-cliquer pour renommer' : tab.name)}
      style={{ minWidth: '90px', maxWidth: '180px' }}
    >
      {editing ? (
        <input
          type="text"
          value={draft}
          autoFocus
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commitName}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { commitName(); }
            else if (e.key === 'Escape') { setDraft(tab.name); setEditing(false); }
            e.stopPropagation();
          }}
          onClick={(e) => e.stopPropagation()}
          className="flex-1 min-w-0 bg-transparent border-b border-stone-400 focus:outline-none text-sm px-1"
          maxLength={32}
        />
      ) : (
        <span className="flex-1 truncate text-sm">{tab.name}</span>
      )}
      {canClose && !disabled && (
        <button
          onClick={(e) => { e.stopPropagation(); onClose(); }}
          className="opacity-0 group-hover:opacity-100 text-stone-400 hover:text-rose-600 transition"
          title="Fermer cet onglet"
        >
          <X size={13} />
        </button>
      )}
    </div>
  );
}

// Tooltip qui apparaît après un délai au hover. Avec `onlyIfTruncated`, ne s'affiche
// que si l'élément `[data-truncate]` à l'intérieur est réellement tronqué (texte coupé).
function HoverTooltip({ text, children, onlyIfTruncated = false }) {
  const [show, setShow] = useState(false);
  const timerRef = useRef(null);
  const wrapRef = useRef(null);
  const onEnter = () => {
    timerRef.current = setTimeout(() => {
      if (onlyIfTruncated && wrapRef.current) {
        const el = wrapRef.current.querySelector('[data-truncate]');
        if (!el || el.scrollWidth <= el.clientWidth) return;
      }
      setShow(true);
    }, 500);
  };
  const onLeave = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setShow(false);
  };
  return (
    <div ref={wrapRef} className="relative" onMouseEnter={onEnter} onMouseLeave={onLeave}>
      {children}
      {show && (
        <div className="absolute z-50 left-1/2 -translate-x-1/2 top-full mt-1 px-2 py-1 rounded bg-stone-800 text-white text-xs whitespace-nowrap shadow-lg pointer-events-none">
          {text}
        </div>
      )}
    </div>
  );
}

function PaletteItem({ type, onMouseDown, picked, customDefs, onEdit, onDelete }) {
  const def = getDef(type, customDefs);
  if (!def) return null;
  const isCustom = !!def.isCustom;
  // ViewBox adapté à la taille réelle du composant (utile pour SPLITTER/MERGER
  // dont la hauteur dépasse 40 px, et pour les composants custom).
  const needsDynamic = isCustom || def.w > 60 || def.h > 40;
  const viewBox = needsDynamic
    ? `-3 -3 ${def.w + 6} ${def.h + 6}`
    : '-3 -2 70 44';
  // Hauteur de l'aperçu : on plafonne pour ne pas faire exploser la palette
  const previewMaxH = 56;
  const svgH = needsDynamic
    ? Math.min(previewMaxH, def.h + 6)
    : 44;
  const svgW = needsDynamic
    ? Math.round((def.w + 6) * (svgH / (def.h + 6)))
    : 66;
  return (
    <div className="relative group">
      <HoverTooltip text={def.label} onlyIfTruncated>
        <button
          onMouseDown={(e) => onMouseDown(e, type)}
          className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg border transition select-none
            ${picked
              ? 'border-amber-500 bg-amber-50'
              : 'border-stone-200 bg-white hover:border-stone-400 hover:bg-stone-50'}`}
          style={{ fontFamily: "'IBM Plex Sans', sans-serif", cursor: 'grab' }}
        >
          <svg width={svgW} height={svgH} viewBox={viewBox} className="shrink-0 pointer-events-none">
            <g stroke="#1f2937" strokeWidth={1.5} fill="none" strokeLinecap="round" strokeLinejoin="round">
              {def.shape({ state: def.defaultState }, 0, 0)}
            </g>
          </svg>
          <span data-truncate className="text-sm font-medium text-stone-700 truncate min-w-0">{def.label}</span>
        </button>
      </HoverTooltip>
      {/* Boutons Édit/Suppr pour les composants custom */}
      {isCustom && (onEdit || onDelete) && (
        <div className="absolute right-1 top-1/2 -translate-y-1/2 flex gap-0.5 opacity-0 group-hover:opacity-100 transition pointer-events-none group-hover:pointer-events-auto">
          {onEdit && (
            <button
              onMouseDown={(e) => { e.stopPropagation(); e.preventDefault(); }}
              onClick={(e) => { e.stopPropagation(); onEdit(type); }}
              className="w-6 h-6 flex items-center justify-center bg-white rounded shadow-sm border border-stone-200 hover:bg-amber-50"
              title="Éditer la définition"
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </button>
          )}
          {onDelete && (
            <button
              onMouseDown={(e) => { e.stopPropagation(); e.preventDefault(); }}
              onClick={(e) => { e.stopPropagation(); onDelete(type); }}
              className="w-6 h-6 flex items-center justify-center bg-white rounded shadow-sm border border-stone-200 hover:bg-rose-50 text-rose-600"
              title="Supprimer la définition"
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6"/></svg>
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function TruthTablePanel({ circuit }) {
  // On ne considère que les entrées/sorties 1-bit ; les bus sont signalés à part.
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
          : "Ajoutez au moins une entrée et une sortie 1-bit pour générer la table de vérité."}
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

  const rows = [];
  const n = inputs.length;
  for (let i = 0; i < (1 << n); i++) {
    const overlay = { ...circuit };
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
                <td key={idx} className={`px-2 py-1 text-center ${b ? 'text-lime-700 font-semibold' : 'text-stone-400'}`}>
                  {b}
                </td>
              ))}
              <td className="border-l border-stone-300"></td>
              {r.outputs.map((b, idx) => (
                <td key={idx} className={`px-2 py-1 text-center ${b ? 'text-orange-700 font-semibold' : 'text-stone-400'}`}>
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

function PropertiesPanel({ circuit, selection, onUpdate, sim }) {
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

    const isBusCapable = comp.type === 'INPUT' || comp.type === 'OUTPUT'
      || comp.type === 'DFF' || comp.type === 'REG' || comp.type === 'COUNTER'
      || comp.type === 'ADDER' || comp.type === 'SPLITTER' || comp.type === 'MERGER';
    const isMuxLike = comp.type === 'MUX' || comp.type === 'DEMUX';
    const isDecoder = comp.type === 'DECODER';
    const isDFF = comp.type === 'DFF';
    const isSRLatch = comp.type === 'SRLATCH';
    const isREG = comp.type === 'REG';
    const isCounter = comp.type === 'COUNTER';
    const isRAM = comp.type === 'RAM';
    const isSeg7 = comp.type === 'SEG7';
    const isLedMatrix = comp.type === 'LEDMATRIX';
    const isClock = comp.type === 'CLOCK';
    const currentWidth = comp.state?.width ?? (def.defaultState?.width ?? 1);

    const orientation = comp.state?.orientation ?? 'right';
    const ORIENTATIONS = [
      { key: 'right', label: '→', title: 'Sortie à droite (par défaut)' },
      { key: 'down',  label: '↓', title: 'Sortie en bas' },
      { key: 'left',  label: '←', title: 'Sortie à gauche' },
      { key: 'up',    label: '↑', title: 'Sortie en haut' },
    ];

    return (
      <div className="space-y-3 text-sm">
        <div>
          <div className="text-stone-500 mb-1">Type</div>
          <div className="font-medium" style={{ fontFamily: "'IBM Plex Sans', sans-serif" }}>{def.label}</div>
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
                onClick={() => onUpdate(id, {
                  state: { ...(comp.state ?? {}), orientation: o.key },
                  _dropMismatchedWires: true,
                })}
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
                  onClick={() => onUpdate(id, {
                    state: { ...(comp.state ?? {}), mode: 'hex' },
                    _dropMismatchedWires: true,
                  })}
                  className={`flex-1 px-2 py-1 text-xs rounded border ${
                    (comp.state?.mode ?? 'hex') === 'hex'
                      ? 'bg-stone-800 text-white border-stone-800'
                      : 'bg-white text-stone-700 border-stone-300 hover:bg-stone-50'
                  }`}
                >
                  Hex (4 bits)
                </button>
                <button
                  onClick={() => onUpdate(id, {
                    state: { ...(comp.state ?? {}), mode: 'raw' },
                    _dropMismatchedWires: true,
                  })}
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
            {currentWidth > 1 && (
              <p className="text-[11px] text-stone-500 mt-1 leading-snug">
                {comp.type === 'INPUT'
                  ? `${currentWidth} cellules cliquables sur le composant — cliquer un bit pour le basculer.`
                  : comp.type === 'DFF'
                  ? `Registre ${currentWidth} bits : Q stocke un entier sur ${currentWidth} bits, capturé en bloc au front montant.`
                  : comp.type === 'REG'
                  ? `Registre ${currentWidth} bits : Q ← D au front montant uniquement si LD = 1.`
                  : comp.type === 'COUNTER'
                  ? `Compteur ${currentWidth} bits : Q ← Q+1 au front montant si EN = 1. Boucle à 0 après ${currentWidth >= 32 ? '2³²-1' : (1 << currentWidth) - 1}.`
                  : comp.type === 'ADDER'
                  ? `Additionneur ${currentWidth} bits : S = A + B + Cin, Cout = retenue. Combinatoire (pas d'horloge).`
                  : comp.type === 'SPLITTER'
                  ? `Séparateur : éclate un bus de ${currentWidth} bits en ${currentWidth} fils 1-bit (b0 = poids faible).`
                  : comp.type === 'MERGER'
                  ? `Fusionneur : regroupe ${currentWidth} fils 1-bit en un bus de ${currentWidth} bits (b0 = poids faible).`
                  : `Bus de ${currentWidth} bits dessiné en ${currentWidth} pistes parallèles.`}
              </p>
            )}
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
                <option key={w} value={w}>{w} bit{w > 1 ? 's' : ''} → {1 << w} sorties</option>
              ))}
            </select>
            <p className="text-[11px] text-stone-500 mt-1 leading-snug">
              Seule la sortie correspondant à la valeur d'entrée vaut 1, les autres 0.
            </p>
          </div>
        )}

        {isSRLatch && (
          <div className="pt-2 border-t border-stone-200 space-y-2">
            <div className="text-[11px] text-stone-500 leading-snug">
              Latch SR : mémoire <strong>asynchrone</strong>.
              S = 1 met Q à 1, R = 1 met Q à 0, S = R = 0 conserve Q.
              Si S et R valent 1 simultanément, R l'emporte (Q = 0).
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
              Bascule D déclenchée sur <strong>front montant</strong> de CLK.
              RST = 1 force Q à 0 immédiatement (asynchrone).
              {currentWidth > 1 && ' Avec une largeur > 1 bit, cette bascule se comporte comme un registre.'}
            </div>
            <div className="flex items-center justify-between">
              <span className="text-stone-500 text-xs">État Q actuel</span>
              <code className="text-xs font-mono px-2 py-0.5 bg-stone-100 rounded">
                {currentWidth === 1
                  ? String(asInt(comp.state?.q) & 1)
                  : maskTo(currentWidth, asInt(comp.state?.q)).toString(2).padStart(currentWidth, '0')}
              </code>
            </div>
            <button
              onClick={() => onUpdate(id, { state: { ...(comp.state ?? {}), q: 0, lastTriggerAt: Date.now() } })}
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
                  : maskTo(currentWidth, asInt(comp.state?.q)).toString(2).padStart(currentWidth, '0')}
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
              Compteur {currentWidth}-bit. Sur <strong>front montant</strong> de CLK,
              Q est incrémenté de 1 si <strong>EN = 1</strong>, sinon conservé.
              Le compteur boucle naturellement de {currentWidth >= 32 ? '2³²-1' : (1 << currentWidth) - 1} à 0.
              RST = 1 force Q à 0 (asynchrone).
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

        {isLedMatrix && (() => {
          const cols = comp.state?.cols ?? 8;
          const rows = comp.state?.rows ?? 8;
          const xWidth = addrBitsFor(cols);
          const yWidth = addrBitsFor(rows);
          const total = cols * rows;

          // Redimensionne pixels en préservant la zone commune (origine en haut-gauche)
          const resizePixels = (newCols, newRows) => {
            const newTotal = newCols * newRows;
            const next = new Array(newTotal).fill(0);
            const cur = Array.isArray(comp.state?.pixels) ? comp.state.pixels : [];
            const commonRows = Math.min(rows, newRows);
            const commonCols = Math.min(cols, newCols);
            for (let r = 0; r < commonRows; r++) {
              for (let c = 0; c < commonCols; c++) {
                next[r * newCols + c] = asInt(cur[r * cols + c] ?? 0);
              }
            }
            return next;
          };

          const clearMatrix = () => {
            onUpdate(id, { state: { ...(comp.state ?? {}), pixels: new Array(total).fill(0) } });
          };

          return (
            <div className="pt-2 border-t border-stone-200 space-y-2">
              <div className="text-[11px] text-stone-500 leading-snug">
                Matrice <strong>{cols}×{rows}</strong>{' '}
                ({total} pixels, X sur {xWidth} bit{xWidth > 1 ? 's' : ''}, Y sur {yWidth} bit{yWidth > 1 ? 's' : ''}).
                Écriture sur <strong>front montant</strong> de CLK si WE = 1 :
                pixel à la position (X, Y) ← D. RST = 1 efface toute la matrice.
              </div>
              <div>
                <label className="text-stone-500 block mb-1">Colonnes (1-16)</label>
                <BusWidthControl
                  value={cols}
                  min={1}
                  max={16}
                  onChange={(newCols) => {
                    onUpdate(id, {
                      state: {
                        ...(comp.state ?? {}),
                        cols: newCols,
                        pixels: resizePixels(newCols, rows),
                      },
                      _dropMismatchedWires: true,
                    });
                  }}
                />
              </div>
              <div>
                <label className="text-stone-500 block mb-1">Lignes (1-16)</label>
                <BusWidthControl
                  value={rows}
                  min={1}
                  max={16}
                  onChange={(newRows) => {
                    onUpdate(id, {
                      state: {
                        ...(comp.state ?? {}),
                        rows: newRows,
                        pixels: resizePixels(cols, newRows),
                      },
                      _dropMismatchedWires: true,
                    });
                  }}
                />
              </div>
              <button
                onClick={clearMatrix}
                className="w-full text-xs px-2 py-1 rounded border border-stone-300 bg-white text-stone-700 hover:bg-stone-50"
              >
                Effacer la matrice
              </button>
              <p className="text-[10px] text-stone-400 leading-snug">
                Couleur du pixel allumé reprend la couleur des entrées (Apparence → Entrée active).
              </p>
            </div>
          );
        })()}

        {isRAM && (() => {
          const aw = comp.state?.addrWidth ?? 3;
          const dw = comp.state?.dataWidth ?? 4;
          const depth = 1 << aw;
          const mem = Array.isArray(comp.state?.mem) ? comp.state.mem : [];
          const memArr = [];
          for (let i = 0; i < depth; i++) memArr.push(maskTo(dw, asInt(mem[i] ?? 0)));
          const addrHexLen = Math.max(1, Math.ceil(aw / 4));
          // Adresse courante lue par la RAM (peut être indéfinie si ADDR non câblé : alors 0)
          const liveAddr = maskTo(aw, asInt(sim?.inputValues?.get(portKey(comp.id, 'ADDR')) ?? 0));

          const resizeMem = (newAw, newDw) => {
            const newDepth = 1 << newAw;
            const next = new Array(newDepth);
            for (let i = 0; i < newDepth; i++) next[i] = maskTo(newDw, asInt(memArr[i] ?? 0));
            return next;
          };

          const setBit = (addr, bitIdx) => {
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
                Mémoire <strong>{depth}×{dw} bits</strong>.
                Lecture continue : DATA_OUT suit mem[ADDR].
                Écriture sur <strong>front montant</strong> de CLK si WE = 1 :
                mem[ADDR] ← DATA_IN.
              </div>
              <div>
                <label className="text-stone-500 block mb-1">Bits d'adresse</label>
                <select
                  value={aw}
                  onChange={(e) => {
                    const newAw = Number(e.target.value);
                    onUpdate(id, {
                      state: { ...(comp.state ?? {}), addrWidth: newAw, mem: resizeMem(newAw, dw) },
                      _dropMismatchedWires: true,
                    });
                  }}
                  className="w-full px-2 py-1 border border-stone-300 rounded font-mono text-sm bg-white"
                >
                  {[1, 2, 3, 4, 5, 6, 7, 8].map((a) => (
                    <option key={a} value={a}>{a} bit{a > 1 ? 's' : ''} → {1 << a} cases</option>
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
                      state: { ...(comp.state ?? {}), dataWidth: newDw, mem: resizeMem(aw, newDw) },
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
                <div className="text-stone-500 text-xs mb-1">Contenu (clic = bascule du bit, MSB à gauche)</div>
                <div className="border border-stone-200 rounded bg-stone-50 max-h-64 overflow-y-auto">
                  <table className="w-full text-[11px] font-mono">
                    <tbody>
                      {memArr.map((word, addr) => {
                        const isLive = addr === liveAddr;
                        return (
                          <tr key={addr} className={isLive ? 'bg-amber-100' : ''}>
                            <td className="px-1 py-0.5 text-stone-500 text-right align-middle"
                                style={{ width: '3em' }}>
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
                                      onClick={(e) => { e.stopPropagation(); setBit(addr, bitIdx); }}
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
                            <td className="px-1 py-0.5 text-stone-500 text-right align-middle"
                                style={{ width: '4em' }}>
                              0x{word.toString(16).toUpperCase().padStart(Math.max(1, Math.ceil(dw / 4)), '0')}
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
        })()}

        {isClock && (
          <div className="pt-2 border-t border-stone-200 space-y-2">
            <div>
              <label className="text-stone-500 block mb-1">Mode</label>
              <div className="flex gap-1">
                <button
                  onClick={() => onUpdate(id, {
                    state: { ...(comp.state ?? {}), running: false },
                  })}
                  className={`flex-1 px-2 py-1 text-xs rounded border ${
                    !comp.state?.running
                      ? 'bg-stone-800 text-white border-stone-800'
                      : 'bg-white text-stone-700 border-stone-300 hover:bg-stone-50'
                  }`}
                >
                  Manuel (clic ou Tick)
                </button>
                <button
                  onClick={() => onUpdate(id, {
                    state: { ...(comp.state ?? {}), running: true, lastToggleAt: Date.now() },
                  })}
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
                  onChange={(e) => onUpdate(id, {
                    state: { ...(comp.state ?? {}), freq: Number(e.target.value), lastToggleAt: Date.now() },
                  })}
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
          Position : ({comp.x}, {comp.y})<br/>
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

// Contrôle d'édition d'une largeur de bus : champ numérique 1–32 + boutons +/-.
// Largeur libre, non restreinte aux puissances de 2.
function BusWidthControl({ value, min = 1, max = 32, onChange }) {
  const [text, setText] = useState(String(value));
  useEffect(() => { setText(String(value)); }, [value]);

  const clamp = (n) => Math.max(min, Math.min(max, Math.floor(n)));

  const commit = (raw) => {
    const n = parseInt(raw, 10);
    if (!Number.isFinite(n) || isNaN(n)) {
      setText(String(value));
      return;
    }
    const c = clamp(n);
    setText(String(c));
    if (c !== value) onChange(c);
  };

  return (
    <div className="flex items-stretch gap-1">
      <button
        onClick={() => { const c = clamp(value - 1); if (c !== value) onChange(c); }}
        disabled={value <= min}
        className="px-2 py-1 border border-stone-300 rounded bg-white text-stone-700 hover:bg-stone-50 disabled:opacity-40 disabled:cursor-not-allowed text-sm font-mono"
        title="Diminuer"
      >−</button>
      <input
        type="number"
        min={min}
        max={max}
        step={1}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={(e) => commit(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { commit(e.target.value); e.currentTarget.blur(); }
        }}
        className="flex-1 min-w-0 px-2 py-1 border border-stone-300 rounded font-mono text-sm text-center"
      />
      <button
        onClick={() => { const c = clamp(value + 1); if (c !== value) onChange(c); }}
        disabled={value >= max}
        className="px-2 py-1 border border-stone-300 rounded bg-white text-stone-700 hover:bg-stone-50 disabled:opacity-40 disabled:cursor-not-allowed text-sm font-mono"
        title="Augmenter"
      >+</button>
    </div>
  );
}

// ============================================================
// PANNEAU PRÉFÉRENCES
// Couleurs, épaisseurs, fond du canevas, style de grille.
// ============================================================
function PreferencesPanel({ prefs, onChange }) {
  const update = (k, v) => onChange({ ...prefs, [k]: v });
  const reset = () => onChange({ ...DEFAULT_PREFS });
  return (
    <div className="space-y-4 text-sm">
      <div>
        <div className="text-xs font-semibold text-stone-500 uppercase tracking-wider mb-2">
          Fils
        </div>
        <div className="space-y-2">
          <ColorRow label="Actif (1)" value={prefs.wireOnColor} onChange={(v) => update('wireOnColor', v)} />
          <ColorRow label="Inactif (0)" value={prefs.wireOffColor} onChange={(v) => update('wireOffColor', v)} />
          <div className="flex items-center justify-between">
            <span className="text-xs text-stone-600">Épaisseur</span>
            <select
              value={prefs.wireWidth}
              onChange={(e) => update('wireWidth', Number(e.target.value))}
              className="text-xs px-2 py-1 border border-stone-300 rounded bg-white"
            >
              <option value={1.5}>Fin</option>
              <option value={2}>Normal</option>
              <option value={2.5}>Épais</option>
              <option value={3}>Très épais</option>
            </select>
          </div>
        </div>
      </div>

      <div>
        <div className="text-xs font-semibold text-stone-500 uppercase tracking-wider mb-2">
          Bus (nappes)
        </div>
        <div className="space-y-2">
          <ColorRow
            label="Bit éteint (0)"
            value={prefs.busOffColor ?? '#0f172a'}
            onChange={(v) => update('busOffColor', v)}
          />
          <div className="flex items-center justify-between">
            <span className="text-xs text-stone-600">Épaisseur d'un bit</span>
            <select
              value={prefs.busBitStroke ?? 2.5}
              onChange={(e) => update('busBitStroke', Number(e.target.value))}
              className="text-xs px-2 py-1 border border-stone-300 rounded bg-white"
            >
              <option value={1.5}>Fine</option>
              <option value={2}>Moyenne</option>
              <option value={2.5}>Épaisse</option>
              <option value={3.5}>Très épaisse</option>
            </select>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-stone-600">Espacement</span>
            <select
              value={prefs.busBitGap ?? 1.2}
              onChange={(e) => update('busBitGap', Number(e.target.value))}
              className="text-xs px-2 py-1 border border-stone-300 rounded bg-white"
            >
              <option value={0.4}>Serré</option>
              <option value={0.8}>Normal</option>
              <option value={1.2}>Aéré</option>
              <option value={2}>Large</option>
            </select>
          </div>
          <p className="text-[11px] text-stone-500 leading-snug">
            Un bus de N bits est dessiné avec N pistes parallèles côte à côte.
            Le bit le plus significatif (MSB) est à l'extérieur.
          </p>
        </div>
      </div>

      <div>
        <div className="text-xs font-semibold text-stone-500 uppercase tracking-wider mb-2">
          Entrées / Sorties
        </div>
        <div className="space-y-2">
          <ColorRow label="Entrée active" value={prefs.inputOnColor} onChange={(v) => update('inputOnColor', v)} />
          <ColorRow label="Sortie active" value={prefs.outputOnColor} onChange={(v) => update('outputOnColor', v)} />
        </div>
      </div>

      <div>
        <div className="text-xs font-semibold text-stone-500 uppercase tracking-wider mb-2">
          Afficheur 7 segments
        </div>
        <div className="space-y-2">
          <ColorRow label="Segment allumé" value={prefs.seg7OnColor ?? '#ef4444'} onChange={(v) => update('seg7OnColor', v)} />
          <ColorRow label="Segment éteint" value={prefs.seg7OffColor ?? '#1f2937'} onChange={(v) => update('seg7OffColor', v)} />
        </div>
      </div>

      <div>
        <div className="text-xs font-semibold text-stone-500 uppercase tracking-wider mb-2">
          Cadre valeur (LCD)
        </div>
        <div className="space-y-2">
          <ColorRow label="Bordure" value={prefs.lcdBorderColor ?? '#f59e0b'} onChange={(v) => update('lcdBorderColor', v)} />
          <ColorRow label="Fond"    value={prefs.lcdFillColor   ?? '#fffbeb'} onChange={(v) => update('lcdFillColor', v)} />
          <ColorRow label="Texte"   value={prefs.lcdTextColor   ?? '#78350f'} onChange={(v) => update('lcdTextColor', v)} />
          <p className="text-[11px] text-stone-500 leading-snug">
            Encadre la valeur affichée par les bascules, registres, compteurs, RAM et autres composants à mémoire.
          </p>
        </div>
      </div>

      <div>
        <div className="text-xs font-semibold text-stone-500 uppercase tracking-wider mb-2">
          Canevas
        </div>
        <div className="space-y-2">
          <ColorRow label="Fond" value={prefs.canvasBg} onChange={(v) => update('canvasBg', v)} />
          <div className="flex items-center justify-between">
            <span className="text-xs text-stone-600">Grille</span>
            <div className="flex gap-1">
              {[
                { v: 'dots', label: 'Points' },
                { v: 'lines', label: 'Lignes' },
                { v: 'off', label: 'Aucune' },
              ].map((o) => (
                <button
                  key={o.v}
                  onClick={() => update('gridStyle', o.v)}
                  className={`px-2 py-1 text-xs rounded border transition ${
                    prefs.gridStyle === o.v
                      ? 'bg-stone-800 border-stone-800 text-white'
                      : 'border-stone-300 text-stone-600 hover:border-stone-400'
                  }`}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="pt-2 border-t border-stone-200">
        <button
          onClick={reset}
          className="w-full px-3 py-1.5 text-xs text-stone-600 border border-stone-300 rounded hover:bg-stone-50"
        >
          Réinitialiser les défauts
        </button>
        <p className="text-[11px] text-stone-500 mt-2 leading-relaxed">
          Les préférences sont enregistrées dans le navigateur et incluses
          dans les fichiers JSON exportés.
        </p>
      </div>
    </div>
  );
}

function ColorRow({ label, value, onChange }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-xs text-stone-600 flex-1 truncate">{label}</span>
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-9 h-7 rounded border border-stone-300 cursor-pointer bg-white p-0.5"
      />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-20 px-1.5 py-1 border border-stone-300 rounded text-[11px] font-mono"
      />
    </div>
  );
}

function SettingsIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
         strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

// ============================================================
// COMPOSANT PRINCIPAL
// ============================================================
// Crée un onglet vide
function makeEmptyTab(name = 'Nouveau circuit') {
  return {
    id: uid('tab'),
    name,
    components: [],
    wires: [],
  };
}

export default function CircuitSimulator() {
  // -------- ÉTAT --------
  // Plusieurs onglets ("zones de travail") : on garde un tableau de tabs et un
  // activeTabId. Les composants personnalisés (customDefinitions) sont partagés
  // entre tous les onglets, donc stockés à part.
  //
  // `circuit` (calculé plus bas) est l'onglet actif augmenté de customDefinitions.
  // Toute la suite du code peut continuer à utiliser `circuit` et `setCircuit`
  // comme avant.
  const [tabsState, setTabsState] = useState(() => {
    const first = makeEmptyTab();
    return {
      tabs: [first],
      activeTabId: first.id,
      customDefinitions: {},
    };
  });

  // Reconstruit l'objet `circuit` perçu par tout le code existant.
  const circuit = useMemo(() => {
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
  const setCircuit = useCallback((updater) => {
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
  const [selection, setSelection] = useState({ components: [], wires: [] });
  const [placeType, setPlaceType] = useState(null);
  const [paletteDrag, setPaletteDrag] = useState(null); // {type, mouseX, mouseY, didMove}
  const [wireStart, setWireStart] = useState(null); // {componentId, port, x, y}
  const [mousePos, setMousePos] = useState(null);
  const [hoveredPort, setHoveredPort] = useState(null);
  const [clipboard, setClipboard] = useState(null);
  const [rightPanelMode, setRightPanelMode] = useState('properties'); // 'properties' | 'truthtable' | 'chronogram' | 'preferences'
  const [showAbout, setShowAbout] = useState(false);

  // ---- Phase 3 : composants personnalisés ----
  // saveAsCompState : null hors modale, sinon { name, inputs:[{id,label,name}], outputs:[...] }
  const [saveAsCompState, setSaveAsCompState] = useState(null);
  // editMode : null en mode normal, sinon { definitionName, backupCircuit }
  // En mode édition, `circuit` contient le sous-circuit de la définition.
  const [editMode, setEditMode] = useState(null);
  // Confirmation simple pour la suppression de définition.
  const [deletePromptName, setDeletePromptName] = useState(null);

  // ---- Mode Challenge ----
  // challengeMode: null hors challenge, sinon { chapterId, levelId, result: null | 'success' | 'fail', error: string, table: rows }
  const [challengeMode, setChallengeMode] = useState(null);
  // leftPanelMode: 'palette' | 'challenges'
  const [leftPanelMode, setLeftPanelMode] = useState('palette');

  // ---- Préférences d'apparence ----
  const [prefs, setPrefs] = useState(DEFAULT_PREFS);

  // ---- Sélection rectangulaire ----
  // rectSelect = { startX, startY, x, y, w, h } pendant le drag, null sinon
  const [rectSelect, setRectSelect] = useState(null);

  // Notification éphémère quand on essaie de connecter deux ports de largeurs incompatibles
  const [wireWidthMismatch, setWireWidthMismatch] = useState(null);

  // Auto-effacement de la notification après 2.5 s
  useEffect(() => {
    if (!wireWidthMismatch) return;
    const tid = setTimeout(() => setWireWidthMismatch(null), 2500);
    return () => clearTimeout(tid);
  }, [wireWidthMismatch]);

  // Historique par onglet : { [tabId]: { past: [], future: [] } }.
  // Le ref activeTabIdRef est tenu à jour pour que `history.current` (lu via getter)
  // pointe toujours sur l'historique de l'onglet actuellement actif, même depuis
  // des callbacks créés au premier render (commit, undo, redo).
  const historyByTab = useRef({});
  const activeTabIdRef = useRef(tabsState.activeTabId);
  activeTabIdRef.current = tabsState.activeTabId;
  const historyRef = useRef({
    get current() {
      const id = activeTabIdRef.current;
      if (!historyByTab.current[id]) historyByTab.current[id] = { past: [], future: [] };
      return historyByTab.current[id];
    },
  });
  const history = historyRef.current;
  const fileInputRef = useRef(null);
  const svgRef = useRef(null);
  const dragRef = useRef(null);           // {startX, startY, origPositions, snapshot, hasMoved}
  const justDraggedRef = useRef(false);   // true between mouseUp-with-move and the click that follows
  const wireMovedRef = useRef(false);     // true si on a bougé la souris depuis le clic du fil
  // Pendant un drag, on garde l'offset (dx, dy) dans un state séparé pour ne
  // PAS invalider `circuit` à chaque mouvement de souris. Le rendu de chaque
  // composant applique cet offset s'il est dans la sélection draggée.
  // Au mouseUp, on écrit la position finale dans `circuit` en un seul commit.
  const [dragOffset, setDragOffset] = useState(null); // null | { dx, dy, ids: Set<string> }

  // -------- ZOOM ET PAN --------
  // viewBox = null avant la première mesure ; sinon { x, y, w, h } en unités SVG.
  // Le SVG du canvas applique ce viewBox ; les clics restent alignés grâce à
  // getScreenCTM().inverse() qui gère automatiquement le viewBox.
  const [viewBox, setViewBox] = useState(null);
  const viewBoxBaseRef = useRef(null); // {w, h} mesurés au mount = vue par défaut
  const panRef = useRef(null); // pendant pan: {startClientX, startClientY, vbStartX, vbStartY}

  // -------- AUTO-SAUVEGARDE --------
  useEffect(() => {
    // Charge au montage
    (async () => {
      try {
        const r = await storage.get(STORAGE_KEY);
        if (r?.value) {
          const data = JSON.parse(r.value);
          const loaded = deserializeAll(data);
          setTabsState(loaded);
        }
        const rp = await storage.get(PREFS_STORAGE_KEY);
        if (rp?.value) {
          try {
            const p = JSON.parse(rp.value);
            setPrefs((prev) => ({ ...DEFAULT_PREFS, ...prev, ...p }));
          } catch {}
        }
      } catch (e) {
        // Pas grave : on démarre vide
      }
    })();
  }, []);

  useEffect(() => {
    // Sauvegarde des préférences à part (persistance navigateur, indépendante du fichier)
    const t = setTimeout(() => {
      try {
        storage.set(PREFS_STORAGE_KEY, JSON.stringify(prefs));
      } catch {}
    }, 200);
    return () => clearTimeout(t);
  }, [prefs]);

  useEffect(() => {
    // Sauvegarde dès qu'un changement a lieu (debounce léger).
    // En mode édition on ne touche pas au stockage : sinon un rechargement
    // ferait perdre le circuit principal (sauvegardé dans editMode.backupCircuit).
    if (editMode) return;
    const t = setTimeout(() => {
      try {
        const data = serializeAll(tabsState);
        storage.set(STORAGE_KEY, JSON.stringify(data));
      } catch {}
    }, 300);
    return () => clearTimeout(t);
  }, [tabsState, editMode, prefs]);

  // -------- SIMULATION --------
  const sim = useMemo(() => simulate(circuit), [circuit]);

  // -------- LOGIQUE SÉQUENTIELLE --------
  // Délègue la mise à jour atomique (DFF, REG, COUNTER, RAM, SRLATCH) à
  // `stepSequentialCore` (src/sim.js). On ajoute ensuite le `lastTriggerAt`
  // qui n'est pertinent que côté UI (halo lime du D-FF, 300 ms après capture).
  useEffect(() => {
    const next = stepSequentialCore(circuit, getDef);
    let changed = next !== circuit && next.components !== circuit.components;
    // Marque le timestamp pour le halo DFF si Q vient de changer suite à un front
    let components = next.components;
    if (changed) {
      components = components.map((comp, idx) => {
        if (comp.type !== 'DFF') return comp;
        const old = circuit.components[idx];
        if (!old) return comp;
        const captured = (old.state?.lastClk ?? 0) === 0
                      && (comp.state?.lastClk ?? 0) === 1;
        if (captured) {
          return { ...comp, state: { ...comp.state, lastTriggerAt: Date.now() } };
        }
        return comp;
      });
    }
    if (changed) {
      setCircuit((c) => ({ ...c, components }));
    }
  }, [circuit, sim]);

  // Intervalle d'auto-tick pour les CLOCK en mode auto-running.
  // Une seule timer pour tout l'app, économe et déterministe.
  useEffect(() => {
    const id = setInterval(() => {
      const now = Date.now();
      setCircuit((c) => {
        let changed = false;
        const newComps = c.components.map((comp) => {
          if (comp.type !== 'CLOCK') return comp;
          if (!comp.state?.running) return comp;
          const freq = comp.state?.freq ?? 1;
          // Période d'une demi-onde (en ms) : 1 cycle = 2 transitions
          const halfPeriod = 500 / Math.max(0.1, freq);
          const lastT = comp.state?.lastToggleAt ?? 0;
          if (now - lastT >= halfPeriod) {
            changed = true;
            return {
              ...comp,
              state: {
                ...comp.state,
                value: asInt(comp.state?.value) ? 0 : 1,
                lastToggleAt: now,
              },
            };
          }
          return comp;
        });
        return changed ? { ...c, components: newComps } : c;
      });
    }, 30);
    return () => clearInterval(id);
  }, []);

  // Re-render périodique pour rafraîchir le halo lime du D-FF (animation 300 ms)
  // et la pastille rouge clignotante de la CLOCK auto. Sans cela, le DFF qui vient
  // de capturer ne « pulsait » pas visuellement si l'utilisateur ne touchait à rien.
  const [, forceTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => forceTick((n) => (n + 1) % 1000), 60);
    return () => clearInterval(id);
  }, []);

  // -------- CHRONOGRAMME (échantillonnage des signaux) --------
  // Capture un instantané des valeurs intéressantes (INPUT/OUTPUT/Q des composants
  // à mémoire) à chaque transition d'horloge (front montant ou descendant).
  // Stocké dans un état React pour déclencher le rendu du panneau Chrono.
  const TRACE_MAX_LEN = 100;
  const [trace, setTrace] = useState([]);
  const [traceEnabled, setTraceEnabled] = useState(true);
  // Mémorise l'état précédent des CLOCK pour détecter les transitions.
  const prevClocksRef = useRef(new Map());
  // Compteur de ticks (pour étiqueter chaque échantillon).
  const tickCounterRef = useRef(0);

  useEffect(() => {
    if (!traceEnabled) return;
    if (editMode) return; // pas d'échantillonnage en mode édition de composant custom
    // Détecte si une CLOCK a transité depuis la dernière capture
    const currentClocks = new Map();
    let transitioned = false;
    for (const comp of circuit.components) {
      if (comp.type !== 'CLOCK') continue;
      const v = asInt(comp.state?.value) & 1;
      currentClocks.set(comp.id, v);
      const prev = prevClocksRef.current.get(comp.id);
      if (prev === undefined || prev !== v) transitioned = true;
    }
    // Détecte aussi la disparition d'une CLOCK
    for (const id of prevClocksRef.current.keys()) {
      if (!currentClocks.has(id)) transitioned = true;
    }
    prevClocksRef.current = currentClocks;
    if (!transitioned) return;
    if (currentClocks.size === 0) return; // pas d'horloge, rien à échantillonner

    // Construit l'échantillon : pour chaque INPUT/OUTPUT, chaque CLOCK,
    // chaque composant à mémoire (DFF, REG, SR, COUNTER), on capture la valeur.
    // Pour la RAM, on capture DATA_OUT (lecture asynchrone).
    const signals = [];
    for (const comp of circuit.components) {
      const def = getDef(comp.type, circuit.customDefinitions, comp);
      if (!def) continue;
      if (comp.type === 'INPUT') {
        const width = comp.state?.width ?? 1;
        const value = maskTo(width, asInt(comp.state?.value));
        signals.push({
          key: `${comp.id}:in`,
          label: comp.label || 'In',
          kind: 'input',
          width,
          value,
        });
      } else if (comp.type === 'OUTPUT') {
        const width = comp.state?.width ?? 1;
        const value = asInt(sim.inputValues.get(portKey(comp.id, 'in0')) ?? 0);
        signals.push({
          key: `${comp.id}:out`,
          label: comp.label || 'Out',
          kind: 'output',
          width,
          value: maskTo(width, value),
        });
      } else if (comp.type === 'CLOCK') {
        signals.push({
          key: `${comp.id}:clk`,
          label: 'CLK',
          kind: 'clock',
          width: 1,
          value: asInt(comp.state?.value) & 1,
        });
      } else if (comp.type === 'DFF' || comp.type === 'REG' || comp.type === 'COUNTER') {
        const width = comp.state?.width ?? 1;
        signals.push({
          key: `${comp.id}:Q`,
          label: `${def.label} Q`,
          kind: 'q',
          width,
          value: maskTo(width, asInt(comp.state?.q)),
        });
      } else if (comp.type === 'SRLATCH') {
        signals.push({
          key: `${comp.id}:Q`,
          label: 'SR Q',
          kind: 'q',
          width: 1,
          value: asInt(comp.state?.q) & 1,
        });
      }
    }
    tickCounterRef.current += 1;
    setTrace((old) => {
      const next = old.concat([{ tick: tickCounterRef.current, signals }]);
      if (next.length > TRACE_MAX_LEN) next.splice(0, next.length - TRACE_MAX_LEN);
      return next;
    });
  }, [circuit, sim, traceEnabled, editMode]);

  const clearTrace = useCallback(() => {
    setTrace([]);
    tickCounterRef.current = 0;
    prevClocksRef.current = new Map();
  }, []);

  // -------- HELPERS HISTORIQUE --------
  const commit = useCallback((updater) => {
    setCircuit((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      history.current.past.push(prev);
      if (history.current.past.length > 100) history.current.past.shift();
      history.current.future = [];
      return next;
    });
  }, []);

  const undo = useCallback(() => {
    if (history.current.past.length === 0) return;
    setCircuit((prev) => {
      history.current.future.unshift(prev);
      return history.current.past.pop();
    });
    setSelection({ components: [], wires: [] });
  }, []);

  const redo = useCallback(() => {
    if (history.current.future.length === 0) return;
    setCircuit((prev) => {
      history.current.past.push(prev);
      return history.current.future.shift();
    });
    setSelection({ components: [], wires: [] });
  }, []);

  // -------- ACTIONS --------
  const placeComponent = (type, x, y) => {
    const def = getDef(type, circuit.customDefinitions);
    if (!def) return;
    const newComp = {
      id: uid('c'),
      type,
      x: snap(x),
      y: snap(y),
      state: def.defaultState ? { ...def.defaultState } : undefined,
      label: '',
    };
    commit((c) => ({ ...c, components: [...c.components, newComp] }));
  };

  const updateComponent = (id, patch) => {
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

  // -------- CHALLENGES --------
  const verifyChallenge = () => {
    if (!challengeMode) return { success: false, error: 'Pas en challenge' };
    const level = getLevel(challengeMode.chapterId, challengeMode.levelId);
    if (!level) return { success: false, error: 'Niveau non trouvé' };

    // Récupère les INPUT/OUTPUT du circuit courant par ordre (ignore les labels)
    const inputComps = circuit.components.filter((c) => c.type === 'INPUT');
    const outputComps = circuit.components.filter((c) => c.type === 'OUTPUT');

    // Vérifie que le nombre d'entrées/sorties correspond
    if (inputComps.length < level.inputs.length) {
      return { success: false, error: `Il faut ${level.inputs.length} entrée(s), trouvées ${inputComps.length}` };
    }
    if (outputComps.length < level.outputs.length) {
      return { success: false, error: `Il faut ${level.outputs.length} sortie(s), trouvées ${outputComps.length}` };
    }

    // Utilise les N premiers INPUT et OUTPUT (ordre de création)
    const inputIds = inputComps.slice(0, level.inputs.length).map((c) => c.id);
    const outputIds = outputComps.slice(0, level.outputs.length).map((c) => c.id);

    // Teste selon le type de vérification
    if (level.verify.type === 'truthtable') {
      const allRows = [];
      for (let rowIdx = 0; rowIdx < level.truthTable.length; rowIdx++) {
        const [inVals, expectedOutVals] = level.truthTable[rowIdx];

        // Injecte les valeurs sur les INPUT
        let testCircuit = { ...circuit };
        testCircuit.components = testCircuit.components.map((c) => {
          const inputIdx = inputIds.indexOf(c.id);
          if (inputIdx >= 0) {
            return { ...c, state: { ...(c.state ?? {}), value: inVals[inputIdx] } };
          }
          return c;
        });

        // Simule
        const sim2 = simulate(testCircuit);

        // Lit les outputs
        const actualOutVals = [];
        for (const outId of outputIds) {
          const val = sim2.inputValues.get(portKey(outId, 'in0')) ?? 0;
          actualOutVals.push(val);
        }

        // Enregistre la ligne pour afficher la table complète
        const match = expectedOutVals.every((exp, i) => (actualOutVals[i] ?? 0) === exp);
        allRows.push({
          rowIdx,
          inVals,
          expectedOutVals,
          actualOutVals,
          match,
        });

        if (!match) {
          return { success: false, error: 'Table échouée', table: allRows };
        }
      }
      return { success: true, table: allRows };
    }

    if (level.verify.type === 'sequence') {
      let testCircuit = { ...circuit };
      // Reset DFF
      testCircuit.components = testCircuit.components.map((c) => {
        if (c.type === 'DFF') return { ...c, state: { ...(c.state ?? {}), q: 0 } };
        return c;
      });

      const allSteps = [];
      for (let stepIdx = 0; stepIdx < level.verify.steps.length; stepIdx++) {
        const [inVals, expectedOutVals] = level.verify.steps[stepIdx];

        // Inject inputs
        testCircuit.components = testCircuit.components.map((c) => {
          const inputIdx = inputIds.indexOf(c.id);
          if (inputIdx >= 0) {
            return { ...c, state: { ...(c.state ?? {}), value: inVals[inputIdx] } };
          }
          return c;
        });

        // Step
        testCircuit = stepSequentialCore(testCircuit, getDef);

        // Check outputs
        const sim2 = simulate(testCircuit);
        const actualOutVals = [];
        for (const outId of outputIds) {
          const val = sim2.inputValues.get(portKey(outId, 'in0')) ?? 0;
          actualOutVals.push(val);
        }

        const match = expectedOutVals.every((exp, i) => (actualOutVals[i] ?? 0) === exp);
        allSteps.push({
          stepIdx,
          inVals,
          expectedOutVals,
          actualOutVals,
          match,
        });

        if (!match) {
          return { success: false, error: 'Séquence échouée', table: allSteps };
        }
      }
      return { success: true, table: allSteps };
    }

    return { success: false, error: 'Type de vérification inconnu' };
  };

  const toggleInput = (id) => {
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
  const toggleInputBit = (id, bitIdx) => {
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
  const toggleClock = (id) => {
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

  // Réinitialise manuellement la valeur stockée d'un D-FF (utile pour repartir
  // d'un état connu sans avoir besoin de câbler RST).
  const resetDFF = (id) => {
    setCircuit((c) => ({
      ...c,
      components: c.components.map((x) => {
        if (x.id !== id || x.type !== 'DFF') return x;
        return { ...x, state: { ...(x.state ?? {}), q: 0, lastTriggerAt: Date.now() } };
      }),
    }));
  };

  const addWire = (from, to) => {
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
        (w) => !(w.to.componentId === to.componentId && w.to.port === to.port)
      );
      return {
        ...c,
        wires: [...filtered, { id: uid('w'), from, to }],
      };
    });
  };

  const deleteSelection = () => {
    if (selection.components.length === 0 && selection.wires.length === 0) return;
    const compIds = new Set(selection.components);
    const wireIds = new Set(selection.wires);
    commit((c) => ({
      ...c,
      components: c.components.filter((x) => !compIds.has(x.id)),
      wires: c.wires.filter(
        (w) =>
          !wireIds.has(w.id) &&
          !compIds.has(w.from.componentId) &&
          !compIds.has(w.to.componentId)
      ),
    }));
    setSelection({ components: [], wires: [] });
  };

  const copySelection = () => {
    if (selection.components.length === 0) return;
    const compIds = new Set(selection.components);
    const comps = circuit.components.filter((c) => compIds.has(c.id));
    const wires = circuit.wires.filter(
      (w) => compIds.has(w.from.componentId) && compIds.has(w.to.componentId)
    );
    setClipboard({ components: comps, wires });
  };

  const pasteClipboard = () => {
    if (!clipboard) return;
    const idMap = new Map();
    const newComps = clipboard.components.map((c) => {
      const newId = uid('c');
      idMap.set(c.id, newId);
      return { ...c, id: newId, x: c.x + GRID, y: c.y + GRID };
    });
    const newWires = clipboard.wires.map((w) => ({
      id: uid('w'),
      from: { componentId: idMap.get(w.from.componentId), port: w.from.port },
      to: { componentId: idMap.get(w.to.componentId), port: w.to.port },
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
    const baseName = tabsState.tabs.length === 1
      ? (tabsState.tabs[0].name || 'circuit')
      : 'circuits';
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${baseName.replace(/\s+/g, '_')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const loadFromFile = (file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        const loaded = deserializeAll(data);
        // Import remplace l'ensemble des onglets. L'historique repart à zéro
        // (cohérent avec l'ancien comportement qui jetait l'historique).
        historyByTab.current = {};
        setTabsState(loaded);
        setSelection({ components: [], wires: [] });
      } catch (err) {
        alert('Erreur de chargement : ' + err.message);
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
    if (selection.components.length === 0) return false;
    const sel = circuit.components.filter((c) => selection.components.includes(c.id));
    const hasInput = sel.some((c) => c.type === 'INPUT');
    const hasOutput = sel.some((c) => c.type === 'OUTPUT');
    const hasGate = sel.some((c) => c.type !== 'INPUT' && c.type !== 'OUTPUT');
    return hasInput && hasOutput && hasGate;
  }, [editMode, selection.components, circuit.components]);

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
    const { name, inputs, outputs } = saveAsCompState;
    const trimmed = name.trim();
    if (!trimmed) { alert('Donnez un nom au composant.'); return; }
    if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(trimmed)) {
      alert('Nom invalide : utilisez lettres, chiffres et _ (commence par une lettre).');
      return;
    }
    if (GATES[trimmed]) { alert(`Le nom "${trimmed}" est réservé.`); return; }
    const portNames = (list) => list.map((p) => p.name.trim());
    const inNames = portNames(inputs);
    const outNames = portNames(outputs);
    if (inNames.some((n) => !n) || outNames.some((n) => !n)) {
      alert('Tous les ports doivent avoir un nom.'); return;
    }
    if (new Set(inNames).size !== inNames.length || new Set(outNames).size !== outNames.length) {
      alert('Les noms de ports doivent être uniques.'); return;
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
      (w) => sourceIds.has(w.from.componentId) && sourceIds.has(w.to.componentId)
    );
    // Fils qui traversaient la frontière (un seul bout dans la sélection) — seront perdus
    const boundaryWires = editMode ? [] : circuit.wires.filter(
      (w) => sourceIds.has(w.from.componentId) !== sourceIds.has(w.to.componentId)
    );

    // Bloque les auto-références
    if (editMode?.definitionName !== trimmed) {
      const tempDefs = { ...circuit.customDefinitions };
      for (const c of sourceComps) {
        if (typeReferences(c.type, tempDefs, trimmed)) {
          alert(`Auto-référence détectée : "${c.type}" contient (directement ou indirectement) un "${trimmed}".`);
          return;
        }
      }
    }

    // Sécurité : vérifier que les internalId des ports pointent toujours vers des composants présents
    const validInputs = inputs.filter((p) => sourceComps.some((c) => c.id === p.id));
    const validOutputs = outputs.filter((p) => sourceComps.some((c) => c.id === p.id));

    // La largeur de chaque port externe est celle du composant INPUT/OUTPUT interne associé
    const portWidthFor = (id) => {
      const internal = sourceComps.find((c) => c.id === id);
      return internal?.state?.width ?? 1;
    };

    const newDef = {
      name: trimmed,
      inputs: validInputs.map((p) => ({
        name: p.name.trim(),
        internalId: p.id,
        width: portWidthFor(p.id),
      })),
      outputs: validOutputs.map((p) => ({
        name: p.name.trim(),
        internalId: p.id,
        width: portWidthFor(p.id),
      })),
      circuit: {
        components: sourceComps.map((c) => ({ ...c })),
        wires: internalWires.map((w) => ({ ...w, from: { ...w.from }, to: { ...w.to } })),
      },
    };

    if (editMode) {
      // === MODE ÉDITION ===
      // On enregistre la définition modifiée et on revient au circuit principal.
      const newDefs = { ...editMode.backupCircuit.customDefinitions, [trimmed]: newDef };
      const oldName = editMode.definitionName;
      let backupComps = editMode.backupCircuit.components;
      let backupWires = editMode.backupCircuit.wires;
      if (oldName !== trimmed) {
        delete newDefs[oldName];
        backupComps = backupComps.map((c) =>
          c.type === oldName ? { ...c, type: trimmed } : c
        );
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
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
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
      const instanceX = snap(centerX - newCustomDef.w / 2);
      const instanceY = snap(centerY - newCustomDef.h / 2);
      const newInstance = {
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
        (w) => !sourceIds.has(w.from.componentId) && !sourceIds.has(w.to.componentId)
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
            `Reliez vos signaux externes aux ports du nouveau composant "${trimmed}".`
          );
        }, 50);
      }
    }
    setSaveAsCompState(null);
  };

  // Entre en mode édition : sauve le circuit courant, charge la définition.
  const editDefinition = (name) => {
    if (editMode) return; // sécurité : déjà en édition
    const def = circuit.customDefinitions?.[name];
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
  const deleteDefinition = (name) => {
    // Vérifier l'usage : ni dans le circuit principal, ni dans une autre définition
    const usedHere = circuit.components.some((c) => c.type === name);
    let usedElsewhere = false;
    for (const [k, d] of Object.entries(circuit.customDefinitions ?? {})) {
      if (k === name) continue;
      if (d.circuit.components.some((c) => c.type === name)) {
        usedElsewhere = true;
        break;
      }
    }
    if (usedHere || usedElsewhere) {
      alert(
        `Impossible : "${name}" est utilisé ${usedHere ? 'dans le circuit' : ''}` +
        `${usedHere && usedElsewhere ? ' et ' : ''}` +
        `${usedElsewhere ? 'par une autre définition' : ''}.`
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
  const getSvgPoint = (e) => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const ctm = svg.getScreenCTM().inverse();
    const p = pt.matrixTransform(ctm);
    return { x: p.x, y: p.y };
  };

  // Mesure la taille initiale du SVG canvas au mount (pour le reset zoom).
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      const base = { w: rect.width, h: rect.height };
      viewBoxBaseRef.current = base;
      // Initialise le viewBox seulement s'il n'a pas déjà été modifié
      setViewBox((vb) => vb ?? { x: 0, y: 0, w: base.w, h: base.h });
    }
  }, []);

  const resetView = () => {
    const base = viewBoxBaseRef.current;
    if (base) setViewBox({ x: 0, y: 0, w: base.w, h: base.h });
  };

  // Zoom centré sur la position de la souris : molette (sans modificateur)
  const handleCanvasWheel = (e) => {
    e.preventDefault();
    const vb = viewBox;
    if (!vb) return;
    // Point de la souris en coords SVG (avant zoom)
    const p = getSvgPoint(e);
    // Facteur : molette vers le bas = dézoom (viewBox plus grand)
    const factor = e.deltaY > 0 ? 1.15 : 1 / 1.15;
    const base = viewBoxBaseRef.current;
    const minW = base ? base.w / 8 : 100; // max zoom in 8x
    const maxW = base ? base.w * 4 : 8000; // max zoom out 4x
    const newW = Math.max(minW, Math.min(maxW, vb.w * factor));
    const newH = newW * (vb.h / vb.w);
    // Recentrage : on garde le curseur sur le même point SVG après zoom
    const newX = p.x - (p.x - vb.x) * (newW / vb.w);
    const newY = p.y - (p.y - vb.y) * (newH / vb.h);
    setViewBox({ x: newX, y: newY, w: newW, h: newH });
  };

  // Pan avec bouton du milieu (button === 1). Géré séparément du mouseDown principal.
  const handleCanvasMouseDownPan = (e) => {
    if (e.button !== 1) return false; // pas le bouton du milieu
    if (!viewBox) return false;
    e.preventDefault();
    panRef.current = {
      startClientX: e.clientX,
      startClientY: e.clientY,
      vbStartX: viewBox.x,
      vbStartY: viewBox.y,
    };
    return true;
  };

  const handleCanvasMouseMovePan = (e) => {
    if (!panRef.current) return false;
    const svg = svgRef.current;
    if (!svg) return false;
    // Convertit le déplacement écran → unités SVG via le ratio viewBox/écran
    const rect = svg.getBoundingClientRect();
    const dxScreen = e.clientX - panRef.current.startClientX;
    const dyScreen = e.clientY - panRef.current.startClientY;
    const dxSvg = dxScreen * (viewBox.w / rect.width);
    const dySvg = dyScreen * (viewBox.h / rect.height);
    setViewBox({
      ...viewBox,
      x: panRef.current.vbStartX - dxSvg,
      y: panRef.current.vbStartY - dySvg,
    });
    return true;
  };

  const handleCanvasMouseUpPan = () => {
    if (panRef.current) {
      panRef.current = null;
      return true;
    }
    return false;
  };

  const handleCanvasMouseDown = (e) => {
    // Bouton du milieu = pan. Intercepté avant tout le reste, marche partout dans le SVG.
    if (handleCanvasMouseDownPan(e)) return;

    if (e.target !== e.currentTarget && !e.target.closest('[data-canvas-bg]')) return;
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

  const handleCanvasMouseMove = (e) => {
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
        const inRect = circuit.components.filter((comp) => {
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
        }).map((c) => c.id);

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

  const handleComponentMouseDown = (e, comp) => {
    e.stopPropagation();
    if (placeType || wireStart) return;
    justDraggedRef.current = false;

    const isSelected = selection.components.includes(comp.id);
    let newSel;
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

    // Start drag tracking
    const p = getSvgPoint(e);
    const ids = new Set(newSel.components);
    const origPositions = new Map();
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

  const handleComponentClick = (e, comp) => {
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
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const p = pt.matrixTransform(svg.getScreenCTM().inverse());
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

  const handlePortMouseDown = (e, comp, port, kind) => {
    e.stopPropagation();
    if (placeType) return;
    if (kind === 'output') {
      // Start a new wire
      wireMovedRef.current = false;
      const pos = getPortPosition(comp, port.name, kind, circuit.customDefinitions);
      setWireStart({ componentId: comp.id, port: port.name, x: pos.x, y: pos.y });
    } else if (kind === 'input' && wireStart) {
      addWire(
        { componentId: wireStart.componentId, port: wireStart.port },
        { componentId: comp.id, port: port.name }
      );
      wireMovedRef.current = false;
      setWireStart(null);
    }
  };

  const handleWireClick = (e, wire) => {
    e.stopPropagation();
    if (e.shiftKey) {
      setSelection((s) => ({
        ...s,
        wires: s.wires.includes(wire.id) ? s.wires.filter((id) => id !== wire.id) : [...s.wires, wire.id],
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
  const handlePaletteMouseDown = (e, type) => {
    e.preventDefault();
    const startX = e.clientX;
    const startY = e.clientY;
    let current = { type, mouseX: startX, mouseY: startY, didMove: false };
    setPaletteDrag(current);
    setPlaceType(null); // annule un éventuel mode "click-to-place" en cours
    setWireStart(null);

    const onMove = (ev) => {
      const dx = Math.abs(ev.clientX - startX);
      const dy = Math.abs(ev.clientY - startY);
      const didMove = current.didMove || dx > 4 || dy > 4;
      current = { ...current, mouseX: ev.clientX, mouseY: ev.clientY, didMove };
      setPaletteDrag(current);
    };

    const onUp = (ev) => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);

      if (current.didMove) {
        // Drop : on vérifie que la souris est au-dessus du canevas SVG
        const svg = svgRef.current;
        if (svg) {
          const r = svg.getBoundingClientRect();
          if (
            ev.clientX >= r.left && ev.clientX <= r.right &&
            ev.clientY >= r.top && ev.clientY <= r.bottom
          ) {
            const pt = svg.createSVGPoint();
            pt.x = ev.clientX;
            pt.y = ev.clientY;
            const p = pt.matrixTransform(svg.getScreenCTM().inverse());
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

  // -------- RACCOURCIS CLAVIER --------
  useEffect(() => {
    const onKey = (e) => {
      // L'utilisateur tape dans un champ : on ne capture rien (sauf Échap géré ci-dessous).
      const isTyping = e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA';
      const mod = e.ctrlKey || e.metaKey;
      if (e.key === 'Escape') {
        // Échap ferme en priorité les modales, puis annule placement/câblage/sélection.
        if (saveAsCompState) { setSaveAsCompState(null); return; }
        if (deletePromptName) { setDeletePromptName(null); return; }
        if (showAbout) { setShowAbout(false); return; }
        if (isTyping) return;
        setPlaceType(null);
        setWireStart(null);
        setSelection({ components: [], wires: [] });
        return;
      }
      if (isTyping) return;
      if ((e.key === 'Delete' || e.key === 'Backspace') && !mod) {
        e.preventDefault();
        deleteSelection();
      } else if (mod && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if (mod && (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey))) {
        e.preventDefault();
        redo();
      } else if (mod && e.key.toLowerCase() === 'c') {
        e.preventDefault();
        copySelection();
      } else if (mod && e.key.toLowerCase() === 'v') {
        e.preventDefault();
        pasteClipboard();
      } else if (mod && e.key.toLowerCase() === 's') {
        e.preventDefault();
        saveToFile();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  // -------- ONGLETS (zones de travail) --------
  const MAX_TABS = 10;
  const switchTab = useCallback((tabId) => {
    if (editMode) return; // sécurité : on ne quitte pas une édition en cours via les onglets
    setTabsState((prev) => {
      if (!prev.tabs.some((t) => t.id === tabId)) return prev;
      if (prev.activeTabId === tabId) return prev;
      return { ...prev, activeTabId: tabId };
    });
    setSelection({ components: [], wires: [] });
    setPlaceType(null);
    setWireStart(null);
  }, [editMode]);

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

  const closeTab = useCallback((tabId) => {
    if (editMode) return;
    // Confirmation si l'onglet contient du travail (composants ou fils).
    // L'historique de l'onglet est jeté à la fermeture donc on prévient.
    const tab = tabsState.tabs.find((t) => t.id === tabId);
    if (!tab) return;
    const isEmpty = tab.components.length === 0 && tab.wires.length === 0;
    if (!isEmpty) {
      const ok = window.confirm(`Fermer l'onglet « ${tab.name} » ? Son contenu et son historique seront perdus.`);
      if (!ok) return;
    }
    setTabsState((prev) => {
      if (prev.tabs.length <= 1) return prev; // toujours au moins un onglet
      const idx = prev.tabs.findIndex((t) => t.id === tabId);
      if (idx < 0) return prev;
      const newTabs = prev.tabs.slice(0, idx).concat(prev.tabs.slice(idx + 1));
      const newActive = prev.activeTabId === tabId
        ? newTabs[Math.min(idx, newTabs.length - 1)].id
        : prev.activeTabId;
      return { ...prev, tabs: newTabs, activeTabId: newActive };
    });
    // L'historique de l'onglet fermé est jeté.
    delete historyByTab.current[tabId];
    setSelection({ components: [], wires: [] });
  }, [editMode, tabsState.tabs]);

  const renameTab = useCallback((tabId, name) => {
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
    <div className="w-full h-screen flex flex-col bg-stone-50 overflow-hidden"
         style={{ fontFamily: "'IBM Plex Sans', sans-serif" }}>
      {/* Google Fonts */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500;600&display=swap');
      `}</style>

      {/* ===== BARRE D'OUTILS ===== */}
      <div className="flex items-center gap-1 px-3 py-2 bg-white border-b border-stone-200 shadow-sm">
        <div className="flex items-center gap-2 pr-3 mr-2 border-r border-stone-200">
          <div className="w-7 h-7 rounded bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-sm">
            <Power size={16} className="text-white" />
          </div>
          <div className="text-sm font-medium text-stone-700 select-none">
            Logix
          </div>
        </div>

        <ToolbarButton onClick={saveToFile} title="Enregistrer en JSON (Ctrl+S)">
          <Save size={16} />
        </ToolbarButton>
        <ToolbarButton onClick={() => fileInputRef.current?.click()} title="Charger un JSON">
          <Upload size={16} />
        </ToolbarButton>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json,application/json"
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.[0]) {
              loadFromFile(e.target.files[0]);
              e.target.value = '';
            }
          }}
        />

        <Separator />

        <ToolbarButton onClick={undo} title="Annuler (Ctrl+Z)" disabled={history.current.past.length === 0}>
          <Undo2 size={16} />
        </ToolbarButton>
        <ToolbarButton onClick={redo} title="Refaire (Ctrl+Y)" disabled={history.current.future.length === 0}>
          <Redo2 size={16} />
        </ToolbarButton>

        <Separator />

        <ToolbarButton onClick={copySelection} title="Copier (Ctrl+C)" disabled={selection.components.length === 0}>
          <Copy size={16} />
        </ToolbarButton>
        <ToolbarButton onClick={pasteClipboard} title="Coller (Ctrl+V)" disabled={!clipboard}>
          <ClipboardPaste size={16} />
        </ToolbarButton>
        <ToolbarButton onClick={deleteSelection} title="Supprimer (Suppr)" disabled={selection.components.length === 0 && selection.wires.length === 0}>
          <Trash2 size={16} />
        </ToolbarButton>

        <Separator />

        <button
          onClick={openSaveAsComp}
          disabled={!canEncapsulate}
          className={`px-2.5 h-8 flex items-center gap-1.5 rounded text-sm font-medium transition
            ${canEncapsulate
              ? 'text-stone-700 hover:bg-stone-100 active:bg-stone-200'
              : 'text-stone-300 cursor-not-allowed'}`}
          title={
            editMode
              ? 'Enregistrer les modifications de la définition'
              : canEncapsulate
                ? 'Encapsuler la sélection en un composant réutilisable'
                : 'Sélectionnez ≥1 entrée + ≥1 sortie + ≥1 porte pour activer'
          }
        >
          <Package size={15} />
          {editMode ? 'Terminer' : 'Encapsuler la sélection'}
        </button>
        {editMode && (
          <button
            onClick={cancelEdit}
            className="px-2.5 h-8 flex items-center gap-1.5 rounded text-sm font-medium text-rose-700 hover:bg-rose-50"
            title="Annuler les modifications et revenir au circuit principal"
          >
            <X size={15} />
            Annuler l'édition
          </button>
        )}

        <div className="flex-1" />

        {/* Reset vue (zoom/pan) — visible seulement si la vue a été modifiée */}
        {viewBox && viewBoxBaseRef.current && (viewBox.w !== viewBoxBaseRef.current.w || viewBox.x !== 0 || viewBox.y !== 0) && (
          <button
            onClick={resetView}
            className="px-2.5 h-8 flex items-center gap-1.5 rounded text-sm font-medium text-stone-700 hover:bg-stone-100"
            title="Réinitialiser le zoom et la position"
          >
            <span className="font-mono text-xs">
              {Math.round((viewBoxBaseRef.current.w / viewBox.w) * 100)}%
            </span>
            Reset vue
          </button>
        )}

        {/* Bouton Challenges (ouvre/ferme le panneau) */}
        <button
          onClick={() => setLeftPanelMode(leftPanelMode === 'challenges' ? 'palette' : 'challenges')}
          className={`px-2.5 h-8 flex items-center gap-1.5 rounded text-sm font-medium transition ${
            leftPanelMode === 'challenges'
              ? 'bg-amber-500 text-white hover:bg-amber-600'
              : 'text-stone-700 hover:bg-stone-100'
          }`}
          title="Niveaux de challenge (apprentissage progressif)"
        >
          <Trophy size={14} /> Challenges
        </button>

        {/* Bouton Apparence (déplacé depuis le panneau de droite) */}
        <button
          onClick={() => setRightPanelMode(rightPanelMode === 'preferences' ? 'properties' : 'preferences')}
          className={`px-2.5 h-8 flex items-center gap-1.5 rounded text-sm font-medium transition ${
            rightPanelMode === 'preferences'
              ? 'bg-stone-200 text-stone-800'
              : 'text-stone-700 hover:bg-stone-100'
          }`}
          title="Réglages d'apparence (couleurs, épaisseurs, fond)"
        >
          <SettingsIcon /> Apparence
        </button>

        {/* Bouton Tick : ne s'affiche que si au moins une CLOCK manuelle est présente */}
        {circuit.components.some((c) => c.type === 'CLOCK' && !c.state?.running) && (
          <button
            onClick={tickClocks}
            className="text-xs px-3 py-1.5 rounded border border-stone-300 bg-white text-stone-700 hover:bg-stone-50 hover:border-stone-400 transition flex items-center gap-1.5 font-mono"
            title="Bascule toutes les horloges manuelles (un appui = une transition)"
          >
            <span className="text-base leading-none">⏵</span>
            Tick
          </button>
        )}

        {sim.hasCycle && (
          <div className="text-xs text-rose-600 px-2 py-1 bg-rose-50 rounded border border-rose-200">
            ⚠ Cycle détecté
          </div>
        )}
        {wireWidthMismatch && (
          <div className="text-xs text-rose-700 px-2 py-1 bg-rose-50 rounded border border-rose-300 font-mono"
               style={{ fontFamily: "'IBM Plex Mono', monospace" }}>
            ⚠ Largeurs incompatibles : /{wireWidthMismatch.wFrom} → /{wireWidthMismatch.wTo}
          </div>
        )}
        <button
          onClick={() => setShowAbout((v) => !v)}
          className="text-xs text-stone-500 hover:text-stone-700 px-2"
        >
          Aide
        </button>
      </div>

      {/* ===== BARRE D'ONGLETS ===== */}
      {/* Masquée pendant l'édition d'un composant custom : l'onglet actif y est
          temporairement squatté par le sous-circuit, afficher les autres onglets
          serait trompeur. Le banner ambré dédié à l'édition reste affiché. */}
      {!editMode && (
      <div className="flex items-stretch bg-stone-100 border-b border-stone-200 px-2 select-none"
           style={{ minHeight: '34px' }}>
        <div className="flex items-stretch gap-0.5 overflow-x-auto" style={{ scrollbarWidth: 'thin' }}>
          {tabsState.tabs.map((tab) => {
            const active = tab.id === tabsState.activeTabId;
            return (
              <TabButton
                key={tab.id}
                tab={tab}
                active={active}
                disabled={!!editMode}
                canClose={tabsState.tabs.length > 1}
                onActivate={() => switchTab(tab.id)}
                onRename={(name) => renameTab(tab.id, name)}
                onClose={() => closeTab(tab.id)}
              />
            );
          })}
        </div>
        <button
          onClick={addTab}
          disabled={!!editMode || tabsState.tabs.length >= MAX_TABS}
          className="ml-1 flex items-center justify-center w-7 h-7 self-center rounded text-stone-600 hover:bg-stone-200 disabled:opacity-30 disabled:cursor-not-allowed"
          title={
            editMode
              ? 'Indisponible pendant l\'édition d\'un composant personnalisé'
              : tabsState.tabs.length >= MAX_TABS
                ? `Maximum ${MAX_TABS} onglets`
                : 'Nouvel onglet'
          }
        >
          <Plus size={16} />
        </button>
        <div className="flex-1" />
        <div className="self-center text-[11px] text-stone-400 pr-2">
          {tabsState.tabs.length} / {MAX_TABS}
        </div>
      </div>
      )}

      {/* ===== ZONE PRINCIPALE ===== */}
      <div className="flex-1 flex overflow-hidden">
        {/* PANNEAU GAUCHE : PALETTE OU CHALLENGES */}
        {leftPanelMode === 'challenges' ? (
          // ===== PANNEAU CHALLENGES =====
          <div className="w-52 bg-white border-r border-stone-200 p-3 overflow-y-auto flex flex-col">
            {challengeMode ? (
              // En cours d'un challenge
              (() => {
                const level = getLevel(challengeMode.chapterId, challengeMode.levelId);
                if (!level) return null;
                return (
                  <div className="space-y-3 flex-1">
                    <button
                      onClick={() => setChallengeMode(null)}
                      className="text-xs text-stone-600 hover:text-stone-900"
                    >
                      ← Retour
                    </button>
                    <div>
                      <h3 className="font-bold text-sm mb-1">{level.title}</h3>
                      <p className="text-xs text-stone-600">{level.description}</p>
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-stone-500 uppercase tracking-wider mb-2">Composants</div>
                      <div className="space-y-1.5">
                        {level.allowedTypes.map((t) => (
                          <PaletteItem
                            key={t}
                            type={t}
                            onMouseDown={handlePaletteMouseDown}
                            picked={placeType === t}
                            customDefs={circuit.customDefinitions}
                          />
                        ))}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-stone-500 mb-1">Ports requis:</div>
                      <div className="text-xs text-stone-600">
                        <strong>Entrées:</strong> {level.inputs.map((inp) => `${inp.name} (${inp.width}b)`).join(', ')}
                      </div>
                      <div className="text-xs text-stone-600">
                        <strong>Sorties:</strong> {level.outputs.map((out) => `${out.name} (${out.width}b)`).join(', ')}
                      </div>
                    </div>
                    {!challengeMode.result ? (
                      <button
                        onClick={() => {
                          const result = verifyChallenge();
                          setChallengeMode({
                            ...challengeMode,
                            result: result.success ? 'success' : 'fail',
                            error: result.error,
                            table: result.table,
                          });
                        }}
                        className="w-full px-3 py-1.5 rounded bg-blue-600 text-white text-xs font-medium hover:bg-blue-700"
                      >
                        Vérifier
                      </button>
                    ) : challengeMode.result === 'success' ? (
                      <div className="space-y-2">
                        <div className="p-2 rounded text-xs bg-green-100 text-green-800 font-bold">✓ Réussi !</div>
                        {(() => {
                          const allLevels = getAllLevels();
                          const currentIdx = allLevels.findIndex((l) => l.id === challengeMode.levelId && l.chapterId === challengeMode.chapterId);
                          const nextLevel = currentIdx + 1 < allLevels.length ? allLevels[currentIdx + 1] : null;
                          return nextLevel ? (
                            <button
                              onClick={() => {
                                setCircuit({ components: [], wires: [], customDefinitions: circuit.customDefinitions || {} });
                                setChallengeMode({ chapterId: nextLevel.chapterId, levelId: nextLevel.id, result: null, error: null, table: null });
                              }}
                              className="w-full px-3 py-1.5 rounded bg-amber-600 text-white text-xs font-medium hover:bg-amber-700"
                            >
                              Niveau suivant →
                            </button>
                          ) : (
                            <div className="p-2 rounded text-xs bg-purple-100 text-purple-800">🎉 Tous les niveaux complétés !</div>
                          );
                        })()}
                      </div>
                    ) : (
                      <div className="space-y-2 flex-1 flex flex-col">
                        <div className="p-2 rounded text-xs bg-red-100 text-red-800 font-bold">✗ Échoué</div>
                        {challengeMode.table && (
                          <div className="text-xs overflow-y-auto flex-1 border rounded bg-stone-50">
                            <table className="w-full border-collapse">
                              <thead className="bg-stone-200 sticky top-0">
                                <tr>
                                  <th className="border px-1 py-1 text-left">Entrée(s)</th>
                                  <th className="border px-1 py-1 text-left">Attendu</th>
                                  <th className="border px-1 py-1 text-left">Obtenu</th>
                                </tr>
                              </thead>
                              <tbody>
                                {challengeMode.table.map((row, i) => (
                                  <tr key={i} className={row.match ? 'bg-green-100' : 'bg-red-200'}>
                                    <td className="border px-1 py-0.5 font-mono">{row.inVals.join(',')}</td>
                                    <td className="border px-1 py-0.5 font-mono font-bold">{row.expectedOutVals.join(',')}</td>
                                    <td className="border px-1 py-0.5 font-mono font-bold">{row.actualOutVals.join(',')}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                        <button
                          onClick={() => {
                            setChallengeMode({ ...challengeMode, result: null, error: null, table: null });
                          }}
                          className="w-full px-3 py-1.5 rounded bg-blue-600 text-white text-xs font-medium hover:bg-blue-700"
                        >
                          Réessayer
                        </button>
                      </div>
                    )}
                  </div>
                );
              })()
            ) : (
              // Sélection des niveaux
              <div className="space-y-2 flex-1 overflow-y-auto">
                {(() => {
                  const CHAPTER_ICONS = {
                    portes:       <Zap size={11} />,
                    arithmetique: <Plus size={11} />,
                    sequentiel:   <Timer size={11} />,
                    processeur:   <Cpu size={11} />,
                    'plus-loin':  <GitBranch size={11} />,
                  };
                  const CHAPTER_LABELS = {
                    portes:       'Portes logiques',
                    arithmetique: 'Arithmétique',
                    sequentiel:   'Circuits séquentiels',
                    processeur:   'Vers le processeur',
                    'plus-loin':  'Pour aller plus loin',
                  };
                  const allLevels = getAllLevels();
                  let currentChapter = null;
                  return allLevels.map((level) => {
                    const showChapterHeader = level.chapterId !== currentChapter;
                    currentChapter = level.chapterId;
                    return (
                      <div key={level.id}>
                        {showChapterHeader && (
                          <h3 className="font-semibold text-xs text-stone-700 mb-1 mt-2 flex items-center gap-1">
                            {CHAPTER_ICONS[level.chapterId]}
                            {CHAPTER_LABELS[level.chapterId] ?? level.chapterId}
                          </h3>
                        )}
                        <button
                          onClick={() => {
                            setCircuit({ components: [], wires: [], customDefinitions: circuit.customDefinitions || {} });
                            setChallengeMode({ chapterId: level.chapterId, levelId: level.id, result: null, error: null, table: null });
                          }}
                          className="block w-full text-left px-2 py-1.5 rounded text-xs font-medium transition bg-blue-50 text-blue-900 hover:bg-blue-100"
                        >
                          {level.title}
                        </button>
                      </div>
                    );
                  });
                })()}
              </div>
            )}
          </div>
        ) : (
          // ===== PALETTE NORMALE =====
          <div className="w-52 bg-white border-r border-stone-200 p-3 overflow-y-auto">
          <div className="text-xs font-semibold text-stone-500 uppercase tracking-wider mb-2">
            E/S
          </div>
          <div className="space-y-1.5 mb-4">
            {PALETTE_ORDER.filter((t) => GATES[t].category === 'E/S').map((t) => (
              <PaletteItem
                key={t}
                type={t}
                onMouseDown={handlePaletteMouseDown}
                picked={placeType === t}
                customDefs={circuit.customDefinitions}
              />
            ))}
          </div>
          <div className="text-xs font-semibold text-stone-500 uppercase tracking-wider mb-2">
            Portes logiques
          </div>
          <div className="space-y-1.5">
            {PALETTE_ORDER.filter((t) => GATES[t].category === 'Portes').map((t) => (
              <PaletteItem
                key={t}
                type={t}
                onMouseDown={handlePaletteMouseDown}
                picked={placeType === t}
                customDefs={circuit.customDefinitions}
              />
            ))}
          </div>

          <div className="mt-4 text-xs font-semibold text-stone-500 uppercase tracking-wider mb-2">
            Bus
          </div>
          <div className="space-y-1.5">
            {PALETTE_ORDER.filter((t) => GATES[t].category === 'Bus').map((t) => (
              <PaletteItem
                key={t}
                type={t}
                onMouseDown={handlePaletteMouseDown}
                picked={placeType === t}
                customDefs={circuit.customDefinitions}
              />
            ))}
          </div>

          <div className="mt-4 text-xs font-semibold text-stone-500 uppercase tracking-wider mb-2">
            Arithmétique
          </div>
          <div className="space-y-1.5">
            {PALETTE_ORDER.filter((t) => GATES[t].category === 'Arithmétique').map((t) => (
              <PaletteItem
                key={t}
                type={t}
                onMouseDown={handlePaletteMouseDown}
                picked={placeType === t}
                customDefs={circuit.customDefinitions}
              />
            ))}
          </div>

          <div className="mt-4 text-xs font-semibold text-stone-500 uppercase tracking-wider mb-2">
            Séquentiel
          </div>
          <div className="space-y-1.5">
            {PALETTE_ORDER.filter((t) => GATES[t].category === 'Séquentiel').map((t) => (
              <PaletteItem
                key={t}
                type={t}
                onMouseDown={handlePaletteMouseDown}
                picked={placeType === t}
                customDefs={circuit.customDefinitions}
              />
            ))}
          </div>

          {/* SECTION COMPOSANTS PERSONNALISÉS */}
          {(() => {
            const customNames = Object.keys(circuit.customDefinitions ?? {}).sort();
            // En mode édition : on cache les définitions qui seraient récursives
            // (si on les ajoutait, on créerait une boucle).
            const filtered = customNames.filter((n) => {
              if (!editMode) return true;
              return !typeReferences(n, circuit.customDefinitions, editMode.definitionName);
            });
            if (filtered.length === 0) return null;
            return (
              <>
                <div className="mt-4 text-xs font-semibold text-stone-500 uppercase tracking-wider mb-2">
                  Composants personnalisés
                </div>
                <div className="space-y-1.5">
                  {filtered.map((name) => (
                    <PaletteItem
                      key={name}
                      type={name}
                      onMouseDown={handlePaletteMouseDown}
                      picked={placeType === name}
                      customDefs={circuit.customDefinitions}
                      onEdit={editMode ? undefined : editDefinition}
                      onDelete={editMode ? undefined : setDeletePromptName}
                    />
                  ))}
                </div>
              </>
            );
          })()}

          <div className="mt-4 text-[11px] text-stone-500 leading-relaxed">
            <strong>Glisser-déposer</strong> un composant sur la grille, ou cliquer puis placer.
          </div>

          {placeType && (() => {
            const def = getDef(placeType, circuit.customDefinitions);
            return (
              <div className="mt-3 p-2 text-xs bg-amber-50 border border-amber-200 rounded">
                Cliquez sur la zone de travail pour placer <strong>{def?.label ?? placeType}</strong>.
                <button onClick={() => setPlaceType(null)} className="block mt-1 text-amber-700 hover:underline">
                  Annuler (Esc)
                </button>
              </div>
            );
          })()}
          </div>
        )}

        {/* CANEVAS */}
        <div className="flex-1 relative overflow-hidden bg-stone-100">
          {editMode && (
            <div className="absolute top-0 left-0 right-0 z-20 bg-amber-100 border-b border-amber-300 px-4 py-2 flex items-center gap-3 shadow-sm">
              <Package size={16} className="text-amber-700" />
              <span className="text-sm text-stone-800">
                Édition de la définition : <strong className="font-mono">{editMode.definitionName}</strong>
              </span>
              <span className="text-xs text-stone-500">
                — Modifiez le sous-circuit puis cliquez sur "Terminer" pour enregistrer.
              </span>
            </div>
          )}
          <svg
            ref={svgRef}
            width="100%"
            height="100%"
            viewBox={viewBox ? `${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}` : undefined}
            preserveAspectRatio="xMidYMid meet"
            onMouseDown={handleCanvasMouseDown}
            onMouseMove={handleCanvasMouseMove}
            onMouseUp={handleCanvasMouseUp}
            onMouseLeave={handleCanvasMouseUp}
            onWheel={handleCanvasWheel}
            onContextMenu={(e) => e.preventDefault()}
            style={{
              cursor: panRef.current ? 'grabbing' : paletteDrag?.didMove ? 'copy' : placeType ? 'crosshair' : wireStart ? 'crosshair' : 'default',
              background: prefs.canvasBg,
              // Variables CSS lues par les `shape()` des composants (input/output ON colors)
              '--input-on': prefs.inputOnColor,
              '--output-on': prefs.outputOnColor,
              '--seg7-on': prefs.seg7OnColor,
              '--seg7-off': prefs.seg7OffColor,
              '--lcd-border': prefs.lcdBorderColor,
              '--lcd-fill': prefs.lcdFillColor,
              '--lcd-text': prefs.lcdTextColor,
            }}
          >
            <defs>
              <pattern id="grid" width={GRID} height={GRID} patternUnits="userSpaceOnUse">
                {prefs.gridStyle === 'dots' && (
                  <circle cx="1" cy="1" r="0.7" fill="#d6d3d1" />
                )}
                {prefs.gridStyle === 'lines' && (
                  <>
                    <path d={`M ${GRID} 0 L 0 0 0 ${GRID}`} fill="none" stroke="#e7e5e4" strokeWidth="0.5" />
                  </>
                )}
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill={prefs.gridStyle === 'off' ? 'transparent' : 'url(#grid)'} data-canvas-bg="true" />

            {/* FILS */}
            {circuit.wires.map((w) => {
              const fromComp = circuit.components.find((c) => c.id === w.from.componentId);
              const toComp = circuit.components.find((c) => c.id === w.to.componentId);
              if (!fromComp || !toComp) return null;
              let from = getPortPosition(fromComp, w.from.port, 'output', circuit.customDefinitions);
              let to = getPortPosition(toComp, w.to.port, 'input', circuit.customDefinitions);
              if (!from || !to) return null;
              // Décale en temps réel si l'extrémité est dans un composant en cours de drag
              if (dragOffset) {
                if (dragOffset.ids.has(fromComp.id)) from = { x: from.x + dragOffset.dx, y: from.y + dragOffset.dy };
                if (dragOffset.ids.has(toComp.id))   to   = { x: to.x   + dragOffset.dx, y: to.y   + dragOffset.dy };
              }
              const wireWidth = getPortWidth(fromComp, w.from.port, 'output', circuit.customDefinitions);
              const value = asInt(sim.wireValues.get(w.id) ?? 0);
              const isSelected = selection.wires.includes(w.id);
              const points = routeWire(from, to);
              const pointsStr = pointsToStr(points);

              if (wireWidth === 1) {
                // Fil classique 1-bit (comportement antérieur)
                const active = !!value;
                return (
                  <g key={w.id} onClick={(e) => handleWireClick(e, w)} style={{ cursor: 'pointer' }}>
                    <polyline
                      points={pointsStr}
                      fill="none"
                      stroke="transparent"
                      strokeWidth={10}
                    />
                    <polyline
                      points={pointsStr}
                      fill="none"
                      stroke={isSelected ? '#0284c7' : active ? prefs.wireOnColor : prefs.wireOffColor}
                      strokeWidth={isSelected ? prefs.wireWidth + 1 : active ? prefs.wireWidth + 0.5 : prefs.wireWidth}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </g>
                );
              }

              // Bus : on dessine N polylines parallèles (vraie nappe).
              // - MSB sur le bord « du haut » (k=0), LSB sur le bord opposé.
              // - Épaisseur et espacement réglables dans Apparence.
              const strokeBit = prefs.busBitStroke ?? 2.5;
              const gap = prefs.busBitGap ?? 1.2;
              const offColor = prefs.busOffColor ?? '#0f172a';
              const pitch = strokeBit + gap;
              const halfThick = (wireWidth - 1) * pitch / 2;
              const tracks = makeBusTracks(points, wireWidth, pitch);
              const totalThick = wireWidth * pitch + 4;
              return (
                <g key={w.id} onClick={(e) => handleWireClick(e, w)} style={{ cursor: 'pointer' }}>
                  {/* Hit area large pour faciliter la sélection */}
                  <polyline
                    points={pointsStr}
                    fill="none"
                    stroke="transparent"
                    strokeWidth={Math.max(12, totalThick + 4)}
                  />
                  {/* Halo de sélection : bande plus large derrière les pistes */}
                  {isSelected && (
                    <polyline
                      points={pointsStr}
                      fill="none"
                      stroke="#0284c7"
                      strokeWidth={totalThick + 3}
                      strokeOpacity={0.22}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  )}
                  {/* Les N pistes parallèles, chacune colorée selon son bit */}
                  {tracks.map((trackPoints, k) => {
                    // k=0 (extérieur d'un côté) = MSB, k=N-1 (extérieur opposé) = LSB
                    const bitIdx = wireWidth - 1 - k;
                    const bit = (value >> bitIdx) & 1;
                    const color = bit ? prefs.wireOnColor : offColor;
                    return (
                      <polyline
                        key={k}
                        points={pointsToStr(trackPoints)}
                        fill="none"
                        stroke={color}
                        strokeWidth={strokeBit}
                        strokeLinecap="butt"
                        strokeLinejoin="miter"
                      />
                    );
                  })}
                  {/* Étiquette /N décalée pour ne pas chevaucher la nappe */}
                  <text
                    x={from.x + 12}
                    y={from.y - halfThick - 4}
                    fontSize="9"
                    fontFamily="'IBM Plex Mono', monospace"
                    fill="#475569"
                    style={{ userSelect: 'none', pointerEvents: 'none' }}
                  >
                    /{wireWidth}
                  </text>
                </g>
              );
            })}

            {/* FIL EN COURS DE CRÉATION */}
            {wireStart && mousePos && wireMovedRef.current && (
              <polyline
                points={pointsToStr(routeWire(wireStart, mousePos))}
                fill="none"
                stroke="#0ea5e9"
                strokeWidth={2}
                strokeDasharray="5,3"
                pointerEvents="none"
              />
            )}

            {/* CADRE DE SÉLECTION RECTANGULAIRE */}
            {rectSelect?.didMove && (
              <rect
                x={rectSelect.x}
                y={rectSelect.y}
                width={rectSelect.w}
                height={rectSelect.h}
                fill="rgba(14, 165, 233, 0.08)"
                stroke="#0ea5e9"
                strokeWidth={1}
                strokeDasharray="4,3"
                pointerEvents="none"
              />
            )}

            {/* COMPOSANTS */}
            {circuit.components.map((comp) => {
              const def = getDef(comp.type, circuit.customDefinitions, comp);
              if (!def) return null;
              const isSelected = selection.components.includes(comp.id);
              const outputValue = def.outputs[0]
                ? sim.outValues.get(portKey(comp.id, def.outputs[0].name))
                : 0;
              const inputValue = def.inputs[0]
                ? sim.inputValues.get(portKey(comp.id, def.inputs[0].name))
                : 0;
              // Dictionnaire {nom_port: valeur} pour les composants qui ont besoin de tous
              // leurs ports dans `shape()` (ex. afficheur 7 segments en mode raw).
              const inputsByName = {};
              for (const p of def.inputs) {
                inputsByName[p.name] = sim.inputValues.get(portKey(comp.id, p.name)) ?? 0;
              }
              // Pendant un drag, on applique l'offset visuel sans toucher à `circuit`
              const isDragging = dragOffset && dragOffset.ids.has(comp.id);
              const rx = isDragging ? comp.x + dragOffset.dx : comp.x;
              const ry = isDragging ? comp.y + dragOffset.dy : comp.y;
              return (
                <g
                  key={comp.id}
                  transform={`translate(${rx},${ry})`}
                  onMouseDown={(e) => handleComponentMouseDown(e, comp)}
                  onClick={(e) => handleComponentClick(e, comp)}
                  style={{
                    cursor: (comp.type === 'INPUT'
                            || (comp.type === 'CLOCK' && !comp.state?.running))
                            ? 'pointer'
                            : 'move',
                  }}
                >
                  {/* Selection halo */}
                  {isSelected && (
                    <rect
                      x={-4} y={-4}
                      width={def.w + 8}
                      height={def.h + 8}
                      rx={6}
                      fill="rgba(14, 165, 233, 0.08)"
                      stroke="#0ea5e9"
                      strokeWidth={1}
                      strokeDasharray="3,2"
                    />
                  )}
                  {/* Gate shape : on dessine dans le repère natif puis on tourne
                      autour du centre du composant rendu. */}
                  {(() => {
                    const nativeW = def.nativeW ?? def.w;
                    const nativeH = def.nativeH ?? def.h;
                    const orientation = def.orientation ?? 'right';
                    const angle = orientation === 'down' ? 90
                                : orientation === 'left' ? 180
                                : orientation === 'up' ? 270 : 0;
                    const cx = def.w / 2;
                    const cy = def.h / 2;
                    const innerTransform = angle === 0
                      ? undefined
                      : `translate(${cx} ${cy}) rotate(${angle}) translate(${-nativeW / 2} ${-nativeH / 2})`;
                    return (
                      <g
                        stroke="#1f2937"
                        strokeWidth={1.5}
                        fill="none"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        transform={innerTransform}
                      >
                        {def.shape(comp, outputValue, inputValue, inputsByName, angle)}
                      </g>
                    );
                  })()}
                  {/* Label (entrée/sortie) */}
                  {(comp.type === 'INPUT' || comp.type === 'OUTPUT') && comp.label && (
                    <text
                      x={comp.type === 'INPUT' ? -4 : def.w + 4}
                      y={def.h / 2 + 4}
                      textAnchor={comp.type === 'INPUT' ? 'end' : 'start'}
                      fontSize="12"
                      fontFamily="'IBM Plex Mono', monospace"
                      fill="#475569"
                    >
                      {comp.label}
                    </text>
                  )}
                  {/* Ports */}
                  {def.inputs.map((p) => {
                    const v = sim.inputValues.get(portKey(comp.id, p.name));
                    const portWidth = p.width ?? 1;
                    const isBus = portWidth > 1;
                    const r = isBus ? PORT_R + 1.5 : PORT_R;
                    let canConnect = !!wireStart;
                    let widthOk = true;
                    if (canConnect && wireStart) {
                      const startComp = circuit.components.find((c) => c.id === wireStart.componentId);
                      const startWidth = startComp ? getPortWidth(startComp, wireStart.port, 'output', circuit.customDefinitions) : 1;
                      widthOk = startWidth === portWidth;
                    }
                    const fill = canConnect
                      ? (widthOk ? '#fef3c7' : '#fee2e2')
                      : 'white';
                    const stroke = canConnect && !widthOk
                      ? '#dc2626'
                      : (v ? '#65a30d' : '#1f2937');
                    return (
                      <g key={p.name}>
                        {isBus && (
                          <rect
                            x={p.x - r - 1.5} y={p.y - r - 1.5}
                            width={(r + 1.5) * 2} height={(r + 1.5) * 2}
                            fill="none" stroke={stroke} strokeWidth={0.8}
                            strokeDasharray="2,1.5"
                            pointerEvents="none"
                          />
                        )}
                        <circle
                          cx={p.x} cy={p.y} r={12}
                          fill="none"
                          pointerEvents="all"
                          style={{ cursor: canConnect ? 'crosshair' : 'default' }}
                          onMouseDown={(e) => handlePortMouseDown(e, comp, p, 'input')}
                          onClick={(e) => e.stopPropagation()}
                        />
                        <circle
                          cx={p.x} cy={p.y} r={r}
                          fill={fill}
                          stroke={stroke}
                          strokeWidth={isBus ? 2 : 1.5}
                          pointerEvents="none"
                        />
                      </g>
                    );
                  })}
                  {def.outputs.map((p) => {
                    const v = sim.outValues.get(portKey(comp.id, p.name));
                    const portWidth = p.width ?? 1;
                    const isBus = portWidth > 1;
                    const r = isBus ? PORT_R + 1.5 : PORT_R;
                    return (
                      <g key={p.name}>
                        {isBus && (
                          <rect
                            x={p.x - r - 1.5} y={p.y - r - 1.5}
                            width={(r + 1.5) * 2} height={(r + 1.5) * 2}
                            fill="none" stroke={v ? '#65a30d' : '#1f2937'} strokeWidth={0.8}
                            strokeDasharray="2,1.5"
                            pointerEvents="none"
                          />
                        )}
                        <circle
                          cx={p.x} cy={p.y} r={12}
                          fill="none"
                          pointerEvents="all"
                          style={{ cursor: 'crosshair' }}
                          onMouseDown={(e) => handlePortMouseDown(e, comp, p, 'output')}
                          onClick={(e) => e.stopPropagation()}
                        />
                        <circle
                          cx={p.x} cy={p.y} r={r}
                          fill="white"
                          stroke={v ? '#65a30d' : '#1f2937'}
                          strokeWidth={isBus ? 2 : 1.5}
                          pointerEvents="none"
                        />
                      </g>
                    );
                  })}
                </g>
              );
            })}
          </svg>

          {/* Empty-state hint */}
          {circuit.components.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="text-stone-400 text-center max-w-sm">
                <div className="text-sm font-medium mb-2">Zone de travail vide</div>
                <div className="text-xs">
                  Sélectionnez un composant dans la palette à gauche,
                  puis cliquez sur la grille pour le placer.
                </div>
              </div>
            </div>
          )}
        </div>

        {/* PANNEAU DROIT */}
        <div className="w-72 bg-white border-l border-stone-200 flex flex-col">
          <div className="flex border-b border-stone-200">
            <button
              onClick={() => setRightPanelMode('properties')}
              className={`flex-1 px-1 py-2 text-xs font-medium border-b-2 min-w-0 ${
                rightPanelMode === 'properties'
                  ? 'border-amber-500 text-stone-800'
                  : 'border-transparent text-stone-500 hover:text-stone-700'
              }`}
            >
              Propriétés
            </button>
            <button
              onClick={() => setRightPanelMode('truthtable')}
              className={`flex-1 px-1 py-2 text-xs font-medium border-b-2 flex items-center justify-center gap-1 min-w-0 ${
                rightPanelMode === 'truthtable'
                  ? 'border-amber-500 text-stone-800'
                  : 'border-transparent text-stone-500 hover:text-stone-700'
              }`}
            >
              <Table2 size={13} />
              Table
            </button>
            <button
              onClick={() => setRightPanelMode('chronogram')}
              className={`flex-1 px-1 py-2 text-xs font-medium border-b-2 flex items-center justify-center gap-1 min-w-0 ${
                rightPanelMode === 'chronogram'
                  ? 'border-amber-500 text-stone-800'
                  : 'border-transparent text-stone-500 hover:text-stone-700'
              }`}
            >
              <Activity size={13} />
              Chrono
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-3">
            {rightPanelMode === 'properties' && (
              <PropertiesPanel circuit={circuit} selection={selection} onUpdate={updateComponent} sim={sim} />
            )}
            {rightPanelMode === 'truthtable' && (
              <TruthTablePanel circuit={circuit} />
            )}
            {rightPanelMode === 'chronogram' && (
              <ChronogramPanel
                trace={trace}
                enabled={traceEnabled}
                onToggle={() => setTraceEnabled((v) => !v)}
                onClear={clearTrace}
              />
            )}
            {rightPanelMode === 'preferences' && (
              <PreferencesPanel prefs={prefs} onChange={setPrefs} />
            )}
          </div>

          {/* Statistiques */}
          <div className="p-2 border-t border-stone-200 text-[11px] text-stone-500 flex justify-between"
               style={{ fontFamily: "'IBM Plex Mono', monospace" }}>
            <span>{circuit.components.length} comp.</span>
            <span>{circuit.wires.length} fils</span>
            <span>{selection.components.length + selection.wires.length} sél.</span>
          </div>
        </div>
      </div>

      {/* Ghost qui suit le curseur pendant le drag depuis la palette */}
      {paletteDrag?.didMove && (() => {
        const ghostDef = getDef(paletteDrag.type, circuit.customDefinitions);
        if (!ghostDef) return null;
        const isCustom = !!ghostDef.isCustom;
        // Pour les composants à géométrie dynamique (SPLITTER, MERGER, bus),
        // on adapte la fenêtre au gabarit réel.
        const adapt = isCustom || ghostDef.w > 60 || ghostDef.h > 40;
        const vb = adapt
          ? `-5 -5 ${ghostDef.w + 10} ${ghostDef.h + 10}`
          : '-5 -8 80 56';
        return (
          <div
            style={{
              position: 'fixed',
              left: paletteDrag.mouseX,
              top: paletteDrag.mouseY,
              transform: 'translate(-50%, -50%)',
              pointerEvents: 'none',
              zIndex: 1000,
              opacity: 0.75,
              filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.15))',
            }}
          >
            <svg
              width={adapt ? ghostDef.w + 10 : 80}
              height={adapt ? ghostDef.h + 10 : 56}
              viewBox={vb}
              style={{ overflow: 'visible' }}
            >
              <g stroke="#1f2937" strokeWidth={1.5} fill="none" strokeLinecap="round" strokeLinejoin="round">
                {ghostDef.shape(
                  { state: ghostDef.defaultState },
                  0,
                  0
                )}
              </g>
            </svg>
          </div>
        );
      })()}

      {/* === MODALE SAUVER COMME COMPOSANT === */}
      {saveAsCompState && (
        <div
          className="absolute inset-0 bg-black/40 flex items-center justify-center z-50"
          onClick={() => setSaveAsCompState(null)}
        >
          <div
            className="bg-white rounded-lg shadow-xl w-[480px] max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b border-stone-200 flex items-center gap-2">
              <Package size={18} className="text-amber-600" />
              <h2 className="text-base font-medium">
                {editMode ? 'Terminer l\'édition' : 'Sauver comme composant'}
              </h2>
            </div>
            <div className="px-5 py-4 space-y-4">
              <div>
                <label className="block text-xs font-medium text-stone-500 mb-1">
                  Nom du composant
                </label>
                <input
                  type="text"
                  value={saveAsCompState.name}
                  onChange={(e) => setSaveAsCompState({ ...saveAsCompState, name: e.target.value })}
                  placeholder="ex. HalfAdder"
                  autoFocus
                  className="w-full px-3 py-1.5 border border-stone-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-amber-300"
                  style={{ fontFamily: "'IBM Plex Mono', monospace" }}
                />
                {circuit.customDefinitions?.[saveAsCompState.name.trim()] && !editMode && (
                  <div className="mt-1 text-xs text-amber-700">
                    ⚠ Un composant nommé "{saveAsCompState.name.trim()}" existe déjà — il sera écrasé.
                  </div>
                )}
              </div>

              {/* PORTS D'ENTRÉE */}
              {saveAsCompState.inputs.length > 0 && (
                <div>
                  <div className="text-xs font-medium text-stone-500 mb-2">
                    Ports d'entrée ({saveAsCompState.inputs.length})
                  </div>
                  <div className="space-y-1.5">
                    {saveAsCompState.inputs.map((p, i) => (
                      <div key={p.id} className="flex items-center gap-2">
                        <span className="text-xs text-stone-400 w-6 text-right">{i + 1}.</span>
                        <span className="text-xs text-stone-500 w-24 truncate">
                          {p.label ? `"${p.label}"` : <em>sans étiquette</em>}
                        </span>
                        <input
                          type="text"
                          value={p.name}
                          onChange={(e) => {
                            const newInputs = [...saveAsCompState.inputs];
                            newInputs[i] = { ...p, name: e.target.value };
                            setSaveAsCompState({ ...saveAsCompState, inputs: newInputs });
                          }}
                          className="flex-1 px-2 py-1 border border-stone-300 rounded text-sm"
                          style={{ fontFamily: "'IBM Plex Mono', monospace" }}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* PORTS DE SORTIE */}
              {saveAsCompState.outputs.length > 0 && (
                <div>
                  <div className="text-xs font-medium text-stone-500 mb-2">
                    Ports de sortie ({saveAsCompState.outputs.length})
                  </div>
                  <div className="space-y-1.5">
                    {saveAsCompState.outputs.map((p, i) => (
                      <div key={p.id} className="flex items-center gap-2">
                        <span className="text-xs text-stone-400 w-6 text-right">{i + 1}.</span>
                        <span className="text-xs text-stone-500 w-24 truncate">
                          {p.label ? `"${p.label}"` : <em>sans étiquette</em>}
                        </span>
                        <input
                          type="text"
                          value={p.name}
                          onChange={(e) => {
                            const newOutputs = [...saveAsCompState.outputs];
                            newOutputs[i] = { ...p, name: e.target.value };
                            setSaveAsCompState({ ...saveAsCompState, outputs: newOutputs });
                          }}
                          className="flex-1 px-2 py-1 border border-stone-300 rounded text-sm"
                          style={{ fontFamily: "'IBM Plex Mono', monospace" }}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="text-xs text-stone-500 pt-2 border-t border-stone-200">
                Le sous-circuit complet (composants + fils) sera enregistré comme définition.
                Les composants <code>Entrée</code> et <code>Sortie</code> deviennent les ports externes.
              </div>
            </div>

            <div className="px-5 py-3 border-t border-stone-200 flex justify-end gap-2">
              <button
                onClick={() => setSaveAsCompState(null)}
                className="px-3 py-1.5 text-sm text-stone-600 hover:bg-stone-100 rounded"
              >
                Annuler
              </button>
              <button
                onClick={confirmSaveAsComp}
                className="px-3 py-1.5 text-sm font-medium bg-amber-600 text-white rounded hover:bg-amber-700 flex items-center gap-1.5"
              >
                <Check size={14} />
                {editMode ? 'Enregistrer les modifications' : 'Créer le composant'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* === CONFIRMATION DE SUPPRESSION === */}
      {deletePromptName && (
        <div
          className="absolute inset-0 bg-black/40 flex items-center justify-center z-50"
          onClick={() => setDeletePromptName(null)}
        >
          <div
            className="bg-white rounded-lg shadow-xl w-96"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4">
              <h2 className="text-base font-medium mb-2">Supprimer la définition ?</h2>
              <p className="text-sm text-stone-600">
                Voulez-vous vraiment supprimer le composant{' '}
                <strong className="font-mono">{deletePromptName}</strong> ?
              </p>
              <p className="text-xs text-stone-500 mt-2">
                Cette action est annulable via Ctrl+Z.
              </p>
            </div>
            <div className="px-5 py-3 border-t border-stone-200 flex justify-end gap-2">
              <button
                onClick={() => setDeletePromptName(null)}
                className="px-3 py-1.5 text-sm text-stone-600 hover:bg-stone-100 rounded"
              >
                Annuler
              </button>
              <button
                onClick={() => deleteDefinition(deletePromptName)}
                className="px-3 py-1.5 text-sm font-medium bg-rose-600 text-white rounded hover:bg-rose-700"
              >
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Aide modal */}
      {showAbout && (
        <div
          className="absolute inset-0 bg-black/40 flex items-center justify-center z-50"
          onClick={() => setShowAbout(false)}
        >
          <div
            className="bg-white rounded-lg p-6 max-w-md shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-medium mb-3">Aide rapide</h2>
            <div className="text-sm text-stone-600 space-y-2">
              <div><strong>Placer</strong> : clic sur la palette → clic sur la zone.</div>
              <div><strong>Câbler</strong> : clic sur un port de sortie → clic sur un port d'entrée.</div>
              <div><strong>Basculer</strong> : clic sur une entrée pour passer de 0 à 1.</div>
              <div><strong>Déplacer</strong> : glisser-déposer un composant.</div>
              <div><strong>Sélectionner plusieurs</strong> : Shift+clic.</div>
              <div><strong>Onglets</strong> : bouton + pour en créer, double-clic pour renommer, maximum 10. Les composants personnalisés sont partagés entre onglets.</div>
              <div className="pt-2 border-t border-stone-200">
                <strong>Raccourcis</strong> : Suppr, Ctrl+Z/Y, Ctrl+C/V, Ctrl+S, Esc.
              </div>
            </div>
            <button
              onClick={() => setShowAbout(false)}
              className="mt-4 px-4 py-1.5 bg-stone-800 text-white text-sm rounded hover:bg-stone-700"
            >
              Fermer
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// PETITS COMPOSANTS UI
// ============================================================
function ToolbarButton({ onClick, title, disabled, children }) {
  return (
    <button
      onClick={onClick}
      title={title}
      disabled={disabled}
      className={`w-8 h-8 flex items-center justify-center rounded transition
        ${disabled ? 'text-stone-300 cursor-not-allowed' : 'text-stone-700 hover:bg-stone-100 active:bg-stone-200'}`}
    >
      {children}
    </button>
  );
}

function Separator() {
  return <div className="w-px h-5 bg-stone-200 mx-1" />;
}
