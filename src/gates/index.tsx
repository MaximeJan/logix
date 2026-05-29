// Registre central des composants primitifs : agrège les définitions par
// catégorie (io, portes, bus, arithmétique, séquentiel, affichage). L'ordre de
// fusion n'a pas d'incidence (getDef résout par clé ; la palette suit PALETTE_ORDER).
import type { GateDef } from './types';
import { ioGates } from './io';
import { logicGates } from './logic';
import { busGates } from './bus';
import { arithGates } from './arith';
import { sequentialGates } from './sequential';
import { displayGates } from './display';

export type { GateDef, DynamicGeometry } from './types';

export const GATES: Record<string, GateDef> = {
  ...ioGates,
  ...logicGates,
  ...busGates,
  ...arithGates,
  ...sequentialGates,
  ...displayGates,
};
