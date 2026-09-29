// Définitions de composants — catégorie « io ». Agrégées dans ./index.
import { asInt, maskTo } from '../lib/sim';
import { uprightTransform } from '../lib/geometry';
import { bitCells } from './shared';
import { UprightText } from './UprightText';
import { bitRowLayout, type BitRowLayout } from './busLayout';
import type { GateDef } from './types';

const MONO = "'IBM Plex Mono', monospace";
const NO_SEL = { userSelect: 'none' as const, pointerEvents: 'none' as const };

// Entrée / Sortie en mode bus : rangée de cases (MSB à gauche) toujours droite,
// repères MSB / LSB au-dessus, trait vers le port. Voir bitRowLayout.
function bitRowShape(L: BitRowLayout, width: number, value: number, onColor: string) {
  const { cells } = L;
  return (
    <>
      <line x1={L.stub.x1} y1={L.stub.y1} x2={L.stub.x2} y2={L.stub.y2} />
      {bitCells(width, value, { onColor, offsetX: cells.x, offsetY: cells.y, cellH: cells.h })}
      <g
        stroke="none"
        fontSize="8"
        fontWeight="600"
        fontFamily={MONO}
        fill="#64748b"
        style={NO_SEL}
      >
        <text x={cells.x + 1} y={L.headerY}>
          MSB
        </text>
        {width >= 4 && (
          <text x={cells.x + cells.w / 2} y={L.headerY} textAnchor="middle" fill="#94a3b8">
            /{width}
          </text>
        )}
        <text x={cells.x + cells.w - 1} y={L.headerY} textAnchor="end">
          LSB
        </text>
      </g>
    </>
  );
}

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
      // Mode bus : dessin fixe (les cases ne tournent pas, MSB toujours à
      // gauche) ; l'orientation choisit seulement le bord du port de sortie.
      const L = bitRowLayout(width, comp?.state?.orientation, 'out');
      return {
        w: L.w,
        h: L.h,
        fixedDisplay: true,
        inputs: [],
        outputs: [{ name: 'out', x: L.port.x, y: L.port.y, width }],
      };
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
      const L = bitRowLayout(width, comp?.state?.orientation, 'out');
      return bitRowShape(L, width, v, 'var(--input-on, #84cc16)');
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
      // Mode bus : rangée de N cellules (visuel identique à l'entrée), dessin
      // fixe ; l'orientation choisit le bord du port d'entrée.
      const L = bitRowLayout(width, comp?.state?.orientation, 'in');
      return {
        w: L.w,
        h: L.h,
        fixedDisplay: true,
        inputs: [{ name: 'in0', x: L.port.x, y: L.port.y, width }],
        outputs: [],
      };
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
      const L = bitRowLayout(width, comp?.state?.orientation, 'in');
      return bitRowShape(L, width, v, 'var(--output-on, #f97316)');
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
