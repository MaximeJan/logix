// Définitions de composants — catégorie « display ». Agrégées dans ./index.
import { asInt, maskTo, SEG7_HEX_TABLE } from '../lib/sim';
import { addrBitsFor, uprightTransform } from '../lib/geometry';
import { seg7Layout } from './shared';
import { UprightText } from './UprightText';
import type { GateDef } from './types';

export const displayGates: Record<string, GateDef> = {
  SEG7: {
    label: '7 segments',
    category: 'E/S',
    w: 56,
    h: 88,
    inputs: [],
    outputs: [],
    // mode : 'hex' (1 port bus 4 bits, décodage interne 0..F)
    //        'raw' (7 ports 1-bit a..g, l'élève cable chaque segment)
    defaultState: { mode: 'hex' },
    // Dessin fixe : on ne tourne jamais l'afficheur, on déplace seulement les ports.
    fixedDisplay: true,
    getDynamicGeometry: (comp) => {
      const { w, h, items } = seg7Layout(comp);
      return {
        w,
        h,
        inputs: items.map((it) => ({ name: it.name, x: it.px, y: it.py, width: it.width })),
        outputs: [],
      };
    },
    shape: (comp, _outputValue, inputValue, inputsByName) => {
      const mode = comp?.state?.mode ?? 'hex';
      const { h, boxX, boxW, boxY, boxH, items } = seg7Layout(comp);
      // Calcule l'état des 7 segments (bit i = segment a..g)
      let segs = 0;
      if (mode === 'hex') {
        const d = maskTo(4, asInt(inputsByName?.D ?? inputValue ?? 0));
        segs = SEG7_HEX_TABLE[d] | 0;
      } else {
        ['a', 'b', 'c', 'd', 'e', 'f', 'g'].forEach((name, i) => {
          if (asInt(inputsByName?.[name] ?? 0) & 1) segs |= 1 << i;
        });
      }
      const seg = (i: number) => (segs >> i) & 1;
      const on = 'var(--seg7-on, #ef4444)';
      const off = 'var(--seg7-off, #1f2937)';
      const t = 4;
      // Bords gauche/droite des segments, calés sur le cadre noir (toujours droit)
      const x1 = boxX + 6,
        x2 = boxX + boxW - 6;
      const yMid = h / 2;
      const yTop = yMid - 30,
        yBot = yMid + 30;
      const horiz = (xa: number, xb: number, y: number) =>
        `${xa + t},${y - t} ${xb - t},${y - t} ${xb},${y} ${xb - t},${y + t} ${xa + t},${y + t} ${xa},${y}`;
      const vert = (x: number, ya: number, yb: number) =>
        `${x - t},${ya + t} ${x},${ya} ${x + t},${ya + t} ${x + t},${yb - t} ${x},${yb} ${x - t},${yb - t}`;
      return (
        <>
          {/* Stubs : du port jusqu'au cadre, selon le bord d'accroche courant */}
          {items.map((it) => (
            <line key={`s${it.name}`} x1={it.px} y1={it.py} x2={it.sx} y2={it.sy} />
          ))}
          {/* Étiquettes a..g près de leur port (mode raw uniquement) */}
          {mode === 'raw' && (
            <g stroke="none">
              {items.map((it, i) => (
                <text
                  key={it.name}
                  x={it.lx}
                  y={it.ly}
                  fontSize="11"
                  fontWeight="700"
                  textAnchor="middle"
                  fontFamily="'IBM Plex Mono', monospace"
                  fill={(segs >> i) & 1 ? 'var(--seg7-on, #ef4444)' : '#475569'}
                  style={{ userSelect: 'none', pointerEvents: 'none' }}
                >
                  {it.name}
                </text>
              ))}
            </g>
          )}
          {/* Cadre noir mat (fixe) */}
          <rect
            x={boxX}
            y={boxY}
            width={boxW}
            height={boxH}
            rx="3"
            fill="#0f172a"
            stroke="#1f2937"
            strokeWidth="1"
          />
          {/* Segments (toujours droits) */}
          <g stroke="none" strokeLinejoin="miter">
            <polygon points={horiz(x1, x2, yTop)} fill={seg(0) ? on : off} />
            <polygon points={vert(x2, yTop, yMid)} fill={seg(1) ? on : off} />
            <polygon points={vert(x2, yMid, yBot)} fill={seg(2) ? on : off} />
            <polygon points={horiz(x1, x2, yBot)} fill={seg(3) ? on : off} />
            <polygon points={vert(x1, yMid, yBot)} fill={seg(4) ? on : off} />
            <polygon points={vert(x1, yTop, yMid)} fill={seg(5) ? on : off} />
            <polygon points={horiz(x1, x2, yMid)} fill={seg(6) ? on : off} />
          </g>
        </>
      );
    },
  },
  LEDMATRIX: {
    label: 'Matrice LED',
    category: 'E/S',
    w: 120,
    h: 120,
    inputs: [],
    outputs: [],
    // cols, rows : dimensions (1-16 chacune)
    // pixels    : Array(cols*rows) d'entiers 0/1 (un par pixel)
    // lastClk   : valeur CLK observée au tick précédent (front montant)
    defaultState: {
      cols: 8,
      rows: 8,
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
      const portsAreaW = 60; // largeur fixe : stubs + label « CLK » + triangle ▷
      // gridMarginR = 14 (épaisseur du bord du boîtier) + 20 (espace visuel souhaité)
      // pour avoir une marge identique à celle des LED des bascules.
      const gridMarginR = 32;
      const w = portsAreaW + gridW + gridMarginR;
      // Hauteur : 6 ports espacés de 18 px + marges 24+24 = 6*18 + 48 = 156 minimum
      // Mais il faut aussi que la grille rentre verticalement.
      const minPortsH = 24 + 5 * 18 + 24; // 5 intervalles entre 6 ports
      const h = Math.max(minPortsH, gridH + 32);
      const portSlots = [
        { name: 'X', width: xWidth },
        { name: 'Y', width: yWidth },
        { name: 'D', width: 1 },
        { name: 'WE', width: 1 },
        { name: 'CLK', width: 1 },
        { name: 'RST', width: 1 },
      ];
      const portTop = 24;
      const portBottom = h - 24;
      const slotStep = (portBottom - portTop) / (portSlots.length - 1);
      return {
        w,
        h,
        inputs: portSlots.map((p, i) => ({
          name: p.name,
          x: 0,
          y: Math.round(portTop + i * slotStep),
          width: p.width,
        })),
        outputs: [],
      };
    },
    shape: (comp, _o, _i, _inputsByName, angle) => {
      const cols = comp?.state?.cols ?? 8;
      const rows = comp?.state?.rows ?? 8;
      const pixels = Array.isArray(comp?.state?.pixels) ? comp.state.pixels : [];
      const pixelSize = cols * rows > 100 ? 10 : 12;
      const gridW = cols * pixelSize;
      const gridH = rows * pixelSize;
      const portsAreaW = 60;
      const gridMarginR = 32; // doit rester en phase avec getDynamicGeometry
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
          <rect
            x="14"
            y="10"
            width={w - 28}
            height={h - 20}
            fill="white"
            stroke="#0f172a"
            strokeWidth="2"
          />
          {/* Labels ports + triangle ▷ collé au bord pour CLK (5e port = index 4) */}
          <g stroke="none">
            {portSlots.map((name, i) => {
              const yy = Math.round(portTop + i * slotStep);
              // Pour CLK : on dessine le triangle à gauche puis le label à droite
              if (name === 'CLK') {
                return (
                  <g key={name}>
                    <path
                      d={`M 14 ${yy - 4} L 22 ${yy} L 14 ${yy + 4} Z`}
                      fill="#1f2937"
                      transform={uprightTransform(angle, 18, yy)}
                    />
                    <UprightText
                      angle={angle}
                      x="26"
                      y={yy + 4}
                      fontSize="11"
                      fontWeight="700"
                      fontFamily="'IBM Plex Mono', monospace"
                      fill="#1f2937"
                      style={{ userSelect: 'none', pointerEvents: 'none' }}
                    >
                      CLK
                    </UprightText>
                  </g>
                );
              }
              return (
                <UprightText
                  angle={angle}
                  key={name}
                  x="19"
                  y={yy + 4}
                  fontSize="11"
                  fontWeight="700"
                  fontFamily="'IBM Plex Mono', monospace"
                  fill="#1f2937"
                  style={{ userSelect: 'none', pointerEvents: 'none' }}
                >
                  {name}
                </UprightText>
              );
            })}
          </g>
          {/* Grille de pixels — contra-rotée pour rester lisible */}
          <g
            transform={
              angle ? `rotate(${-angle} ${gridX + gridW / 2} ${gridY + gridH / 2})` : undefined
            }
          >
            {/* Fond noir mat strictement aligné sur la grille (pas de stroke pour éviter le débordement). */}
            <rect x={gridX} y={gridY} width={gridW} height={gridH} fill="#0f172a" stroke="none" />
            {Array.from({ length: rows }).map((_, r) =>
              Array.from({ length: cols }).map((__, c) => {
                const v = pixels[r * cols + c] ? 1 : 0;
                return (
                  <rect
                    key={`${r}-${c}`}
                    x={gridX + c * pixelSize + 1}
                    y={gridY + r * pixelSize + 1}
                    width={pixelSize - 2}
                    height={pixelSize - 2}
                    fill={v ? on : off}
                    stroke="none"
                  />
                );
              }),
            )}
          </g>
        </>
      );
    },
  },
};
