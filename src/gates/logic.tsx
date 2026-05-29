// Définitions de composants — catégorie « logic ». Agrégées dans ./index.
import { asInt } from '../lib/sim';
import type { GateDef } from './types';

export const logicGates: Record<string, GateDef> = {
  AND: {
    label: 'AND',
    category: 'Portes',
    w: 60,
    h: 40,
    inputs: [
      { name: 'in0', x: 0, y: 10, width: 1 },
      { name: 'in1', x: 0, y: 30, width: 1 },
    ],
    outputs: [{ name: 'out', x: 60, y: 20, width: 1 }],
    fn: (ins) => [asInt(ins[0]) & asInt(ins[1]) & 1],
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
    w: 60,
    h: 40,
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
    w: 60,
    h: 40,
    inputs: [{ name: 'in0', x: 0, y: 20, width: 1 }],
    outputs: [{ name: 'out', x: 60, y: 20, width: 1 }],
    fn: (ins) => [~asInt(ins[0]) & 1],
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
    w: 60,
    h: 40,
    inputs: [
      { name: 'in0', x: 0, y: 10, width: 1 },
      { name: 'in1', x: 0, y: 30, width: 1 },
    ],
    outputs: [{ name: 'out', x: 60, y: 20, width: 1 }],
    fn: (ins) => [~(asInt(ins[0]) & asInt(ins[1])) & 1],
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
    w: 60,
    h: 40,
    inputs: [
      { name: 'in0', x: 0, y: 10, width: 1 },
      { name: 'in1', x: 0, y: 30, width: 1 },
    ],
    outputs: [{ name: 'out', x: 60, y: 20, width: 1 }],
    fn: (ins) => [~(asInt(ins[0]) | asInt(ins[1])) & 1],
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
    w: 60,
    h: 40,
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
};
