// Définitions de composants — catégorie « io ». Agrégées dans ./index.
import { asInt, maskTo } from '../lib/sim';
import { uprightTransform } from '../lib/geometry';
import { INPUT_BUS_CELL_SIZE } from '../lib/constants';
import { bitCells } from './shared';
import { UprightText } from './UprightText';
import type { GateDef } from './types';

export const ioGates: Record<string, GateDef> = {
  INPUT: {
    label: 'Entrée',
    category: 'E/S',
    w: 40,
    h: 40,
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
            <rect
              x="3"
              y="7"
              width="26"
              height="26"
              rx="2"
              fill={v ? 'var(--input-on, #84cc16)' : 'white'}
            />
            <UprightText
              angle={angle}
              x="16"
              y="25"
              textAnchor="middle"
              fontSize="16"
              fontWeight="700"
              fontFamily="'IBM Plex Mono', monospace"
              fill={v ? '#1a2e05' : '#94a3b8'}
              style={{ userSelect: 'none', pointerEvents: 'none' }}
            >
              {v ? '1' : '0'}
            </UprightText>
            <line x1="29" y1="20" x2="36" y2="20" />
          </>
        );
      }
      // Mode bus : une rangée de N cellules cliquables (un bit par case).
      const totalW = width * INPUT_BUS_CELL_SIZE;
      const h = 52;
      const cells = bitCells(width, v, { onColor: 'var(--input-on, #84cc16)', angle });
      return (
        <>
          {cells}
          <UprightText
            angle={angle}
            x={totalW / 2}
            y={8}
            textAnchor="middle"
            fontSize="9"
            fontWeight="600"
            fontFamily="'IBM Plex Mono', monospace"
            fill="#475569"
            style={{ userSelect: 'none', pointerEvents: 'none' }}
          >
            MSB ··· LSB · /{width}
          </UprightText>
          <line x1={totalW} y1={h / 2} x2={totalW + 8} y2={h / 2} />
        </>
      );
    },
  },
  OUTPUT: {
    label: 'Sortie',
    category: 'E/S',
    w: 40,
    h: 40,
    inputs: [{ name: 'in0', x: 0, y: 20, width: 1 }],
    outputs: [],
    defaultState: { width: 1, label: '' },
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
            <rect
              x="9"
              y="7"
              width="26"
              height="26"
              rx="2"
              fill={isOn ? 'var(--output-on, #f97316)' : 'white'}
            />
            <UprightText
              angle={angle}
              x="22"
              y="25"
              textAnchor="middle"
              fontSize="16"
              fontWeight="700"
              fontFamily="'IBM Plex Mono', monospace"
              fill={isOn ? '#1a2e05' : '#94a3b8'}
              style={{ userSelect: 'none', pointerEvents: 'none' }}
            >
              {isOn ? '1' : '0'}
            </UprightText>
          </>
        );
      }
      // Mode bus : une rangée de N cellules en lecture seule (un bit par case),
      // visuel identique à l'entrée mais en couleur de sortie. Pas de dec/hex/bin.
      const totalW = width * INPUT_BUS_CELL_SIZE;
      const h = 52;
      const offX = 8; // décalage pour le stub d'entrée à gauche
      const cells = bitCells(width, v, {
        onColor: 'var(--output-on, #f97316)',
        offsetX: offX,
        angle,
      });
      return (
        <>
          {cells}
          <UprightText
            angle={angle}
            x={offX + totalW / 2}
            y={8}
            textAnchor="middle"
            fontSize="9"
            fontWeight="600"
            fontFamily="'IBM Plex Mono', monospace"
            fill="#475569"
            style={{ userSelect: 'none', pointerEvents: 'none' }}
          >
            MSB ··· LSB · /{width}
          </UprightText>
          <line x1="0" y1={h / 2} x2={offX} y2={h / 2} />
        </>
      );
    },
  },
  CLOCK: {
    label: 'Horloge',
    category: 'Séquentiel',
    w: 44,
    h: 40,
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
          <rect
            x="0"
            y="0"
            width="40"
            height="40"
            rx="5"
            fill={v ? 'var(--input-on, #84cc16)' : 'white'}
            stroke={running ? '#dc2626' : '#1f2937'}
            strokeWidth={running ? 1.2 : 1}
          />
          {/* Mini onde carrée stylisée */}
          <path
            d="M 6 12 L 10 12 L 10 7 L 18 7 L 18 12 L 26 12 L 26 7 L 32 7"
            fill="none"
            stroke="#475569"
            strokeWidth="0.8"
            opacity="0.6"
            transform={uprightTransform(angle, 20, 10)}
          />
          {/* Valeur 0/1 */}
          <UprightText
            angle={angle}
            x="20"
            y="32"
            textAnchor="middle"
            fontSize="14"
            fontWeight="700"
            fontFamily="'IBM Plex Mono', monospace"
            fill={v ? '#1a2e05' : '#475569'}
            style={{ userSelect: 'none', pointerEvents: 'none' }}
          >
            {v ? '1' : '0'}
          </UprightText>
          {running && (
            <circle cx="35" cy="6" r="2.5" fill="#dc2626">
              <animate
                attributeName="opacity"
                values="1;0.3;1"
                dur="0.8s"
                repeatCount="indefinite"
              />
            </circle>
          )}
          <line x1="40" y1="20" x2="44" y2="20" />
        </>
      );
    },
  },
};
