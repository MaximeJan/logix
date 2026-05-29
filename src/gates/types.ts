// Types des définitions de composants (UI + logique).
import type { ReactNode } from 'react';
import type { CircuitComponent, ComponentState, Port } from '../domain/types';

/** Géométrie renvoyée par `getDynamicGeometry` (taille + ports selon l'état). */
export interface DynamicGeometry {
  w?: number;
  h?: number;
  inputs: Port[];
  outputs: Port[];
}

/** Définition d'un composant primitif (UI + logique). */
export interface GateDef {
  label: string;
  category: string;
  w: number;
  h: number;
  inputs: Port[];
  outputs: Port[];
  defaultState?: ComponentState;
  isToggle?: boolean;
  fixedDisplay?: boolean;
  fn?: (ins: number[]) => number[];
  getDynamicGeometry?: (comp: CircuitComponent) => DynamicGeometry;
  shape?: (
    comp: CircuitComponent,
    outputValue?: number,
    inputValue?: number,
    inputsByName?: Record<string, number>,
    angle?: number,
  ) => ReactNode;
}
