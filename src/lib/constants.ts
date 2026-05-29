// Constantes globales et préférences d'apparence par défaut.

export const GRID = 20;
export const PORT_R = 3.5;

export const STORAGE_KEY = 'circuit:autosave';
export const PREFS_STORAGE_KEY = 'circuit:prefs';

// Taille d'une cellule cliquable d'une Entrée bus (px) — constante pour rester
// lisible quel que soit le nombre de bits.
export const INPUT_BUS_CELL_SIZE = 22;

export type GridStyle = 'dots' | 'lines' | 'off';

/** Préférences d'apparence (couleurs, épaisseurs, fond du canevas). */
export interface Prefs {
  wireOnColor: string;
  wireOffColor: string;
  wireWidth: number;
  inputOnColor: string;
  outputOnColor: string;
  canvasBg: string;
  gridStyle: GridStyle;
  busBitStroke: number;
  busBitGap: number;
  busOffColor: string;
  seg7OnColor: string;
  seg7OffColor: string;
  lcdBorderColor: string;
  lcdFillColor: string;
  lcdTextColor: string;
}

export const DEFAULT_PREFS: Prefs = {
  wireOnColor: '#65a30d',
  wireOffColor: '#78716c',
  wireWidth: 2,
  inputOnColor: '#84cc16',
  outputOnColor: '#f97316',
  canvasBg: '#faf8f3',
  gridStyle: 'dots',
  // Apparence des bus : chaque bus est dessiné comme N pistes parallèles.
  // busBitStroke = épaisseur d'une piste (1 bit) ; busBitGap = espace entre pistes.
  busBitStroke: 2.5,
  busBitGap: 1.2,
  busOffColor: '#0f172a',
  // Afficheur 7 segments
  seg7OnColor: '#ef4444',
  seg7OffColor: '#1f2937',
  // « Afficheur LCD » des composants à mémoire : fond sombre, texte clair contrasté.
  lcdBorderColor: '#0f172a',
  lcdFillColor: '#0f172a',
  lcdTextColor: '#fbbf24',
};

// Ordre d'affichage des composants dans la palette.
export const PALETTE_ORDER: string[] = [
  'INPUT',
  'OUTPUT',
  'SEG7',
  'LEDMATRIX',
  'AND',
  'OR',
  'NOT',
  'NAND',
  'NOR',
  'XOR',
  'MUX',
  'DEMUX',
  'DECODER',
  'SPLITTER',
  'MERGER',
  'ADDER',
  'SRLATCH',
  'DFF',
  'REG',
  'COUNTER',
  'RAM',
  'CLOCK',
];
