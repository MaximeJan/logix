// Helpers de rendu partagés par plusieurs catégories de composants.
import type { ReactNode } from 'react';
import { roundedRectPath } from '../lib/geometry';
import { INPUT_BUS_CELL_SIZE } from '../lib/constants';
import type { CircuitComponent } from '../domain/types';
import { UprightText } from './UprightText';

// Rangée de N cellules « un bit par case », partagée par l'entrée et la sortie en
// mode bus (MSB à gauche). `onColor` = couleur du bit allumé ; `offsetX` décale la
// rangée (la sortie laisse 8 px à gauche pour le stub du port d'entrée).
export function bitCells(
  width: number,
  value: number,
  { onColor, offsetX = 0, angle }: { onColor: string; offsetX?: number; angle?: number },
): ReactNode[] {
  const size = INPUT_BUS_CELL_SIZE;
  const cellY = 12;
  const cellH = 34;
  const out: ReactNode[] = [];
  for (let i = 0; i < width; i++) {
    const bit = (value >> (width - 1 - i)) & 1;
    const x0 = offsetX + i * size;
    const cx = x0 + size / 2;
    const cy = cellY + cellH / 2;
    out.push(
      <path
        key={`r${i}`}
        d={roundedRectPath(x0, cellY, size, cellH, 3, {
          tl: i === 0,
          bl: i === 0,
          tr: i === width - 1,
          br: i === width - 1,
        })}
        fill={bit ? onColor : 'white'}
        stroke="#1f2937"
        strokeWidth={0.8}
      />,
    );
    out.push(
      <UprightText
        key={`t${i}`}
        angle={angle}
        x={cx}
        y={cy + 5}
        textAnchor="middle"
        fontSize={size >= 18 ? 14 : 11}
        fontWeight="700"
        fontFamily="'IBM Plex Mono', monospace"
        fill={bit ? '#1a2e05' : '#94a3b8'}
        style={{ userSelect: 'none', pointerEvents: 'none' }}
      >
        {bit}
      </UprightText>,
    );
  }
  return out;
}

// Disposition de l'afficheur 7 segments (dessin FIXE). Le cadre et les segments ne
// tournent jamais ; seuls les ports d'entrée se placent sur le bord choisi par
// l'orientation. Renvoie le cadre + pour chaque port : sa position (px,py), le bout
// de stub côté cadre (sx,sy) et la position de son étiquette (lx,ly, mode raw).
export function seg7Layout(comp?: CircuitComponent) {
  const mode = comp?.state?.mode ?? 'hex';
  const orientation = comp?.state?.orientation ?? 'right';
  const hex = mode === 'hex';
  const w = hex ? 56 : 76;
  const h = hex ? 88 : 104;
  const boxX = hex ? 6 : 26;
  const boxW = w - (hex ? 12 : 32);
  const boxY = 6;
  const boxH = h - 12;
  const names = hex ? ['D'] : ['a', 'b', 'c', 'd', 'e', 'f', 'g'];
  const portWidth = hex ? 4 : 1;
  const n = names.length;
  // Bord d'accroche des entrées selon l'orientation (le dessin, lui, ne bouge pas).
  const edge =
    orientation === 'down'
      ? 'top'
      : orientation === 'left'
        ? 'right'
        : orientation === 'up'
          ? 'bottom'
          : 'left';
  const vertical = edge === 'left' || edge === 'right';
  const span = vertical ? h : w;
  // Répartition centrée le long du bord (identique à l'ancienne sur le bord gauche).
  const along = (i: number) => (n === 1 ? span / 2 : 16 + (i * (span - 24)) / (n - 1));
  const items = names.map((name, i) => {
    const a = along(i);
    let px: number, py: number, sx: number, sy: number, lx: number, ly: number;
    if (edge === 'left') {
      px = 0;
      py = a;
      sx = boxX;
      sy = a;
      lx = 10;
      ly = a - 3;
    } else if (edge === 'right') {
      px = w;
      py = a;
      sx = boxX + boxW;
      sy = a;
      lx = w - 10;
      ly = a - 3;
    } else if (edge === 'top') {
      px = a;
      py = 0;
      sx = a;
      sy = boxY;
      lx = a;
      ly = boxY - 2;
    } else {
      px = a;
      py = h;
      sx = a;
      sy = boxY + boxH;
      lx = a;
      ly = h - 1;
    }
    return { name, px, py, sx, sy, lx, ly, width: portWidth };
  });
  return { w, h, boxX, boxW, boxY, boxH, items };
}
