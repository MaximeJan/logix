import type { CSSProperties, ReactNode, SVGProps } from 'react';

// Texte qui reste droit quand le composant est tourné. On le contre-tourne de
// `-angle` via `transform-box: fill-box`, en pivotant autour de SON ANCRE (et non
// du centre de la bbox) : l'origine horizontale suit `textAnchor` (left/center/
// right) pour que le point d'ancrage ne se DÉCALE pas en rotation ; l'origine
// verticale reste au centre (centrage visuel). À angle 0/undefined, aucun style
// n'est ajouté → rendu strictement identique à un `<text>` ordinaire.
export function UprightText({
  angle,
  x,
  y,
  style,
  children,
  ...rest
}: {
  angle?: number;
  x: number | string;
  y: number | string;
  style?: CSSProperties;
  children?: ReactNode;
} & Omit<SVGProps<SVGTextElement>, 'x' | 'y' | 'transform' | 'children' | 'style'>) {
  const originX = rest.textAnchor === 'end' ? 'right' : rest.textAnchor === 'middle' ? 'center' : 'left';
  const upright: CSSProperties = angle
    ? {
        transform: `rotate(${-angle}deg)`,
        transformBox: 'fill-box',
        transformOrigin: `${originX} center`,
      }
    : {};
  return (
    <text x={x} y={y} style={{ ...style, ...upright }} {...rest}>
      {children}
    </text>
  );
}
