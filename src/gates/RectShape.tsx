import type { ReactNode } from 'react';
import { clkTrianglePath, type RectLayout } from './rectLayout';

interface Props {
  layout: RectLayout;
  /** Halo coloré autour du boîtier (DFF/REG sur capture, etc.). */
  halo?: { color: string; opacity: number };
  /** Contenu central (LCD, valeur, libellés spécifiques) dans `layout.content`. */
  children?: ReactNode;
}

// Rendu standardisé d'un composant rectangulaire à dessin fixe : boîtier, stubs
// des ports, labels et repères ▷ d'horloge. Le composant fournit son contenu
// central via `children` ; tout est positionné par `rectLayout` selon l'orientation.
export function RectShape({ layout, halo, children }: Props) {
  const { box, ports } = layout;
  return (
    <>
      {halo && (
        <rect
          x={box.x - 2}
          y={box.y - 2}
          width={box.w + 4}
          height={box.h + 4}
          rx="2"
          fill="none"
          stroke={halo.color}
          strokeWidth="3"
          opacity={halo.opacity}
        />
      )}
      {/* Boîtier */}
      <rect
        x={box.x}
        y={box.y}
        width={box.w}
        height={box.h}
        fill="white"
        stroke="#0f172a"
        strokeWidth="2"
      />
      {/* Stubs des ports */}
      {ports.map((p) => (
        <line
          key={p.name}
          x1={p.px}
          y1={p.py}
          x2={p.sx}
          y2={p.sy}
          stroke="#1f2937"
          strokeWidth="1.2"
        />
      ))}
      <g stroke="none">
        {/* Contenu fourni par le composant */}
        {children}
        {/* Labels des ports */}
        {ports.map((p) => (
          <text
            key={`l${p.name}`}
            x={p.lx}
            y={p.ly}
            textAnchor={p.anchor}
            fontSize="12"
            fontWeight="700"
            fontFamily="'IBM Plex Mono', monospace"
            fill="#1f2937"
            style={{ userSelect: 'none', pointerEvents: 'none' }}
          >
            {p.label}
          </text>
        ))}
        {/* Repères ▷ d'horloge */}
        {ports
          .filter((p) => p.clk)
          .map((p) => (
            <path key={`c${p.name}`} d={clkTrianglePath(p)} fill="#1f2937" />
          ))}
      </g>
    </>
  );
}
