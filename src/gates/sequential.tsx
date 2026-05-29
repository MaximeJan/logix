// Définitions de composants — catégorie « sequential ». Agrégées dans ./index.
import { asInt, maskTo } from '../lib/sim';
import { formatBitsGrouped } from '../lib/bits';
import { widthForBits, uprightTransform } from '../lib/geometry';
import { UprightText } from './UprightText';
import type { GateDef } from './types';

export const sequentialGates: Record<string, GateDef> = {
  SRLATCH: {
    label: 'Latch SR',
    category: 'Séquentiel',
    w: 96,
    h: 76,
    inputs: [
      { name: 'S', x: 0, y: 28, width: 1 },
      { name: 'R', x: 0, y: 52, width: 1 },
    ],
    outputs: [{ name: 'Q', x: 96, y: 40, width: 1 }],
    // q : valeur stockée (0 ou 1). Pas de CLK : sortie suit S/R en continu.
    defaultState: { q: 0 },
    shape: (comp, _o, _i, _ibn, angle) => {
      const q = asInt(comp?.state?.q) & 1;
      const w = 96,
        h = 76;
      const lcdH = h - 40;
      const lcdY = (h - lcdH) / 2;
      const lcdX = 36,
        lcdW = w - 72;
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
          <circle
            cx={w - 2.5}
            cy="40"
            r="3"
            fill={q ? 'var(--lcd-text, #fbbf24)' : '#1f2937'}
            stroke="#1f2937"
            strokeWidth="1"
          />
          {/* Boîtier */}
          <rect
            x="14"
            y="10"
            width={w - 28}
            height={h - 20}
            fill="white"
            stroke="#0f172a"
            strokeWidth="2"
          />
          {/* Afficheur LED */}
          <rect
            x={lcdX}
            y={lcdY}
            width={lcdW}
            height={lcdH}
            rx="2"
            fill="var(--lcd-fill, #0f172a)"
            stroke="var(--lcd-border, #0f172a)"
            strokeWidth="1"
          />
          <g stroke="none">
            <UprightText
              angle={angle}
              x="20"
              y="33"
              fontSize="14"
              fontWeight="700"
              fontFamily="'IBM Plex Mono', monospace"
              fill="#1f2937"
              style={{ userSelect: 'none', pointerEvents: 'none' }}
            >
              S
            </UprightText>
            <UprightText
              angle={angle}
              x="20"
              y="57"
              fontSize="14"
              fontWeight="700"
              fontFamily="'IBM Plex Mono', monospace"
              fill="#1f2937"
              style={{ userSelect: 'none', pointerEvents: 'none' }}
            >
              R
            </UprightText>
            <UprightText
              angle={angle}
              x={w - 20}
              y="45"
              textAnchor="end"
              fontSize="14"
              fontWeight="700"
              fontFamily="'IBM Plex Mono', monospace"
              fill="#1f2937"
              style={{ userSelect: 'none', pointerEvents: 'none' }}
            >
              Q
            </UprightText>
            <UprightText
              angle={angle}
              x={lcdX + lcdW / 2}
              y={lcdY + lcdH / 2 + 6}
              textAnchor="middle"
              fontSize="18"
              fontWeight="700"
              fontFamily="'IBM Plex Mono', monospace"
              fill="var(--lcd-text, #fbbf24)"
              style={{ userSelect: 'none', pointerEvents: 'none' }}
            >
              {q}
            </UprightText>
          </g>
        </>
      );
    },
  },
  DFF: {
    label: 'Bascule D',
    category: 'Séquentiel',
    w: 104,
    h: 88,
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
        w,
        h,
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
      const lcdX = 62,
        lcdW = w - 98;
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
          <circle
            cx={w - 2.5}
            cy="44"
            r="3"
            fill={q ? 'var(--lcd-text, #fbbf24)' : '#1f2937'}
            stroke="#1f2937"
            strokeWidth="1"
          />
          {/* Halo lime au moment du front montant */}
          {triggered && (
            <rect
              x="12"
              y="8"
              width={w - 24}
              height={h - 16}
              rx="2"
              fill="none"
              stroke="#84cc16"
              strokeWidth="3"
              opacity={Math.max(0, 1 - since / 300)}
            />
          )}
          {/* Boîtier */}
          <rect
            x="14"
            y="10"
            width={w - 28}
            height={h - 20}
            fill="white"
            stroke="#0f172a"
            strokeWidth="2"
          />
          {/* Cadre LED */}
          <rect
            x={lcdX}
            y={lcdY}
            width={lcdW}
            height={lcdH}
            rx="2"
            fill="var(--lcd-fill, #0f172a)"
            stroke="var(--lcd-border, #0f172a)"
            strokeWidth="1"
          />
          <g stroke="none">
            <UprightText
              angle={angle}
              x="20"
              y="29"
              fontSize="14"
              fontWeight="700"
              fontFamily="'IBM Plex Mono', monospace"
              fill="#1f2937"
              style={{ userSelect: 'none', pointerEvents: 'none' }}
            >
              D
            </UprightText>
            {/* Triangle ▷ collé au bord gauche, puis label « CLK » à droite */}
            <path
              d={`M 14 40 L 22 44 L 14 48 Z`}
              fill="#1f2937"
              transform={uprightTransform(angle, 18, 44)}
            />
            <UprightText
              angle={angle}
              x="26"
              y="49"
              fontSize="14"
              fontWeight="700"
              fontFamily="'IBM Plex Mono', monospace"
              fill="#1f2937"
              style={{ userSelect: 'none', pointerEvents: 'none' }}
            >
              CLK
            </UprightText>
            <UprightText
              angle={angle}
              x="20"
              y="75"
              fontSize="14"
              fontWeight="700"
              fontFamily="'IBM Plex Mono', monospace"
              fill="#1f2937"
              style={{ userSelect: 'none', pointerEvents: 'none' }}
            >
              R
            </UprightText>
            <UprightText
              angle={angle}
              x={w - 20}
              y="49"
              textAnchor="end"
              fontSize="14"
              fontWeight="700"
              fontFamily="'IBM Plex Mono', monospace"
              fill="#1f2937"
              style={{ userSelect: 'none', pointerEvents: 'none' }}
            >
              Q
            </UprightText>
            <UprightText
              angle={angle}
              x={lcdX + lcdW / 2}
              y={lcdY + lcdH / 2 + 5}
              textAnchor="middle"
              fontSize={width === 1 ? 20 : 14}
              fontWeight="700"
              fontFamily="'IBM Plex Mono', monospace"
              fill="var(--lcd-text, #fbbf24)"
              style={{ userSelect: 'none', pointerEvents: 'none' }}
            >
              {width === 1 ? String(q) : formatBitsGrouped(q, width)}
            </UprightText>
          </g>
        </>
      );
    },
  },
  REG: {
    label: 'Registre',
    category: 'Séquentiel',
    w: 112,
    h: 88, // recalculé dynamiquement
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
        w,
        h,
        inputs: [
          { name: 'D', x: 0, y: 24, width },
          { name: 'LD', x: 0, y: 48, width: 1 },
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
      const lcdX = 66,
        lcdW = w - 102;
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
          <circle
            cx={w - 2.5}
            cy="44"
            r="3"
            fill={q ? 'var(--lcd-text, #fbbf24)' : '#1f2937'}
            stroke="#1f2937"
            strokeWidth="1"
          />
          {/* Boîtier */}
          <rect
            x="14"
            y="10"
            width={w - 28}
            height={h - 20}
            fill="white"
            stroke="#0f172a"
            strokeWidth="2"
          />
          {/* Cadre LED */}
          <rect
            x={lcdX}
            y={lcdY}
            width={lcdW}
            height={lcdH}
            rx="2"
            fill="var(--lcd-fill, #0f172a)"
            stroke="var(--lcd-border, #0f172a)"
            strokeWidth="1"
          />
          <g stroke="none">
            <UprightText
              angle={angle}
              x="20"
              y="29"
              fontSize="14"
              fontWeight="700"
              fontFamily="'IBM Plex Mono', monospace"
              fill="#1f2937"
              style={{ userSelect: 'none', pointerEvents: 'none' }}
            >
              D
            </UprightText>
            <UprightText
              angle={angle}
              x="20"
              y="53"
              fontSize="14"
              fontWeight="700"
              fontFamily="'IBM Plex Mono', monospace"
              fill="#1f2937"
              style={{ userSelect: 'none', pointerEvents: 'none' }}
            >
              LD
            </UprightText>
            {/* Triangle ▷ collé au bord gauche, puis label « CLK » à droite */}
            <path
              d={`M 14 66 L 22 70 L 14 74 Z`}
              fill="#1f2937"
              transform={uprightTransform(angle, 18, 70)}
            />
            <UprightText
              angle={angle}
              x="26"
              y="75"
              fontSize="14"
              fontWeight="700"
              fontFamily="'IBM Plex Mono', monospace"
              fill="#1f2937"
              style={{ userSelect: 'none', pointerEvents: 'none' }}
            >
              CLK
            </UprightText>
            <UprightText
              angle={angle}
              x={w - 20}
              y="49"
              textAnchor="end"
              fontSize="14"
              fontWeight="700"
              fontFamily="'IBM Plex Mono', monospace"
              fill="#1f2937"
              style={{ userSelect: 'none', pointerEvents: 'none' }}
            >
              Q
            </UprightText>
            <UprightText
              angle={angle}
              x={lcdX + lcdW / 2}
              y={lcdY + lcdH / 2 + 5}
              textAnchor="middle"
              fontSize={width === 1 ? 20 : 14}
              fontWeight="700"
              fontFamily="'IBM Plex Mono', monospace"
              fill="var(--lcd-text, #fbbf24)"
              style={{ userSelect: 'none', pointerEvents: 'none' }}
            >
              {width === 1 ? String(q) : formatBitsGrouped(q, width)}
            </UprightText>
          </g>
        </>
      );
    },
  },
  COUNTER: {
    label: 'Compteur',
    category: 'Séquentiel',
    w: 112,
    h: 88,
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
        w,
        h,
        inputs: [
          { name: 'EN', x: 0, y: 24, width: 1 },
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
      const lcdX = 66,
        lcdW = w - 102;
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
          <circle
            cx={w - 2.5}
            cy="44"
            r="3"
            fill={q ? 'var(--lcd-text, #fbbf24)' : '#1f2937'}
            stroke="#1f2937"
            strokeWidth="1"
          />
          {/* Boîtier */}
          <rect
            x="14"
            y="10"
            width={w - 28}
            height={h - 20}
            fill="white"
            stroke="#0f172a"
            strokeWidth="2"
          />
          {/* Cadre LED */}
          <rect
            x={lcdX}
            y={lcdY}
            width={lcdW}
            height={lcdH}
            rx="2"
            fill="var(--lcd-fill, #0f172a)"
            stroke="var(--lcd-border, #0f172a)"
            strokeWidth="1"
          />
          <g stroke="none">
            <UprightText
              angle={angle}
              x="20"
              y="29"
              fontSize="14"
              fontWeight="700"
              fontFamily="'IBM Plex Mono', monospace"
              fill="#1f2937"
              style={{ userSelect: 'none', pointerEvents: 'none' }}
            >
              EN
            </UprightText>
            {/* Triangle ▷ collé au bord gauche, puis label « CLK » à droite */}
            <path
              d={`M 14 44 L 22 48 L 14 52 Z`}
              fill="#1f2937"
              transform={uprightTransform(angle, 18, 48)}
            />
            <UprightText
              angle={angle}
              x="26"
              y="53"
              fontSize="14"
              fontWeight="700"
              fontFamily="'IBM Plex Mono', monospace"
              fill="#1f2937"
              style={{ userSelect: 'none', pointerEvents: 'none' }}
            >
              CLK
            </UprightText>
            <UprightText
              angle={angle}
              x="20"
              y="75"
              fontSize="14"
              fontWeight="700"
              fontFamily="'IBM Plex Mono', monospace"
              fill="#1f2937"
              style={{ userSelect: 'none', pointerEvents: 'none' }}
            >
              R
            </UprightText>
            <UprightText
              angle={angle}
              x={w - 20}
              y="49"
              textAnchor="end"
              fontSize="14"
              fontWeight="700"
              fontFamily="'IBM Plex Mono', monospace"
              fill="#1f2937"
              style={{ userSelect: 'none', pointerEvents: 'none' }}
            >
              Q
            </UprightText>
            <UprightText
              angle={angle}
              x={lcdX + lcdW / 2}
              y={lcdY + lcdH / 2 + 5}
              textAnchor="middle"
              fontSize={width === 1 ? 20 : 14}
              fontWeight="700"
              fontFamily="'IBM Plex Mono', monospace"
              fill="var(--lcd-text, #fbbf24)"
              style={{ userSelect: 'none', pointerEvents: 'none' }}
            >
              {width === 1 ? String(q) : formatBitsGrouped(q, width)}
            </UprightText>
          </g>
        </>
      );
    },
  },
  RAM: {
    label: 'RAM',
    category: 'Séquentiel',
    w: 140,
    h: 112,
    inputs: [],
    outputs: [],
    // addrWidth : largeur du port ADDR (1..8) → 2^addrWidth cases mémoire
    // dataWidth : largeur des mots (1..16)
    // mem       : tableau d'entiers, longueur 2^addrWidth, chaque entrée masquée à dataWidth bits
    // lastClk   : valeur CLK observée au tick précédent (pour détecter le front montant)
    defaultState: { addrWidth: 3, dataWidth: 4, mem: [0, 0, 0, 0, 0, 0, 0, 0], lastClk: 0 },
    getDynamicGeometry: (comp) => {
      const aw = comp?.state?.addrWidth ?? 3;
      const dw = comp?.state?.dataWidth ?? 4;
      const w = widthForBits(dw, { minW: 150, portMargin: 32 });
      const h = 112;
      return {
        w,
        h,
        inputs: [
          { name: 'ADDR', x: 0, y: 26, width: aw },
          { name: 'DATA_IN', x: 0, y: 50, width: dw },
          { name: 'WE', x: 0, y: 74, width: 1 },
          { name: 'CLK', x: 0, y: 92, width: 1 },
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
      const lcdX = 62,
        lcdW = w - 98;
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
          <circle
            cx={w - 2.5}
            cy="56"
            r="3"
            fill={liveValue ? 'var(--lcd-text, #fbbf24)' : '#1f2937'}
            stroke="#1f2937"
            strokeWidth="1"
          />
          {/* Boîtier */}
          <rect
            x="14"
            y="10"
            width={w - 28}
            height={h - 20}
            fill="white"
            stroke="#0f172a"
            strokeWidth="2"
          />
          {/* Cadre LED */}
          <rect
            x={lcdX}
            y={lcdY}
            width={lcdW}
            height={lcdH}
            rx="2"
            fill="var(--lcd-fill, #0f172a)"
            stroke="var(--lcd-border, #0f172a)"
            strokeWidth="1"
          />
          <g stroke="none">
            <UprightText
              angle={angle}
              x={w / 2}
              y={22}
              textAnchor="middle"
              fontSize="12"
              fontWeight="700"
              fontFamily="'IBM Plex Sans', sans-serif"
              fill="#1f2937"
              style={{ userSelect: 'none', pointerEvents: 'none' }}
            >
              RAM {depth}×{dw}
            </UprightText>
            <UprightText
              angle={angle}
              x="20"
              y="31"
              fontSize="12"
              fontWeight="700"
              fontFamily="'IBM Plex Mono', monospace"
              fill="#1f2937"
              style={{ userSelect: 'none', pointerEvents: 'none' }}
            >
              A
            </UprightText>
            <UprightText
              angle={angle}
              x="20"
              y="55"
              fontSize="12"
              fontWeight="700"
              fontFamily="'IBM Plex Mono', monospace"
              fill="#1f2937"
              style={{ userSelect: 'none', pointerEvents: 'none' }}
            >
              D
            </UprightText>
            <UprightText
              angle={angle}
              x="20"
              y="79"
              fontSize="12"
              fontWeight="700"
              fontFamily="'IBM Plex Mono', monospace"
              fill="#1f2937"
              style={{ userSelect: 'none', pointerEvents: 'none' }}
            >
              WE
            </UprightText>
            {/* Triangle ▷ collé au bord gauche, puis label « CLK » à droite */}
            <path
              d={`M 14 88 L 22 92 L 14 96 Z`}
              fill="#1f2937"
              transform={uprightTransform(angle, 18, 92)}
            />
            <UprightText
              angle={angle}
              x="26"
              y="97"
              fontSize="12"
              fontWeight="700"
              fontFamily="'IBM Plex Mono', monospace"
              fill="#1f2937"
              style={{ userSelect: 'none', pointerEvents: 'none' }}
            >
              CLK
            </UprightText>
            <UprightText
              angle={angle}
              x={w - 20}
              y="61"
              textAnchor="end"
              fontSize="12"
              fontWeight="700"
              fontFamily="'IBM Plex Mono', monospace"
              fill="#1f2937"
              style={{ userSelect: 'none', pointerEvents: 'none' }}
            >
              Q
            </UprightText>
            <UprightText
              angle={angle}
              x={lcdX + lcdW / 2}
              y={lcdY + lcdH / 2 + 5}
              textAnchor="middle"
              fontSize={dw === 1 ? 20 : 14}
              fontWeight="700"
              fontFamily="'IBM Plex Mono', monospace"
              fill="var(--lcd-text, #fbbf24)"
              style={{ userSelect: 'none', pointerEvents: 'none' }}
            >
              {dw === 1 ? String(liveValue) : formatBitsGrouped(liveValue, dw)}
            </UprightText>
          </g>
        </>
      );
    },
  },
};
