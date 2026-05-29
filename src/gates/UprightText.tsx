import type { CSSProperties, ReactNode, SVGProps } from 'react';

// Texte qui reste droit quand le composant est tourné. On le contre-tourne de
// `-angle` autour de SON PROPRE centre (bounding box) via `transform-box: fill-box`
// + `transform-origin: center` : le glyphe reste horizontal ET visuellement centré
// à sa place, quelle que soit l'orientation du composant parent.
// À angle 0/undefined, aucun style n'est ajouté → rendu strictement identique à un
// `<text>` ordinaire.
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
  const upright: CSSProperties = angle
    ? { transform: `rotate(${-angle}deg)`, transformBox: 'fill-box', transformOrigin: 'center' }
    : {};
  return (
    <text x={x} y={y} style={{ ...style, ...upright }} {...rest}>
      {children}
    </text>
  );
}
