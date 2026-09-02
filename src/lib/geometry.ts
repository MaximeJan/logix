// Helpers géométriques purs : rotation de labels, tracé de fils manhattan,
// pistes parallèles pour les bus, et dimensionnement des composants à mémoire.

export type Point = [number, number];

export interface Corners {
  tl: boolean;
  tr: boolean;
  br: boolean;
  bl: boolean;
}

// Rotation : `transform` qui maintient un élément droit quand le shape parent est
// tourné de `angle` degrés (contre-rotation autour de l'ancre (x, y)).
export function uprightTransform(
  angle: number | undefined,
  x: number,
  y: number,
): string | undefined {
  if (!angle) return undefined;
  return `rotate(${-angle} ${x} ${y})`;
}

// Nombre de bits nécessaires pour adresser `n` cases (au moins 1, même pour n=1).
export function addrBitsFor(n: number): number {
  if (n <= 1) return 1;
  return Math.max(1, Math.ceil(Math.log2(n)));
}

// Trace un rectangle dont seuls certains coins sont arrondis (les autres carrés).
// Sert aux cellules de bus : coins externes arrondis, séparations internes carrées.
export function roundedRectPath(
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  { tl, tr, br, bl }: Corners,
): string {
  const rtl = tl ? r : 0;
  const rtr = tr ? r : 0;
  const rbr = br ? r : 0;
  const rbl = bl ? r : 0;
  return [
    `M ${x + rtl},${y}`,
    `L ${x + w - rtr},${y}`,
    rtr ? `A ${rtr},${rtr} 0 0 1 ${x + w},${y + rtr}` : '',
    `L ${x + w},${y + h - rbr}`,
    rbr ? `A ${rbr},${rbr} 0 0 1 ${x + w - rbr},${y + h}` : '',
    `L ${x + rbl},${y + h}`,
    rbl ? `A ${rbl},${rbl} 0 0 1 ${x},${y + h - rbl}` : '',
    `L ${x},${y + rtl}`,
    rtl ? `A ${rtl},${rtl} 0 0 1 ${x + rtl},${y}` : '',
    'Z',
  ].join(' ');
}

// Tracé manhattan d'un fil entre deux points (sortie → entrée).
export function routeWire(from: { x: number; y: number }, to: { x: number; y: number }): Point[] {
  const dx = to.x - from.x;
  if (dx >= 20) {
    const mx = from.x + Math.max(20, dx / 2);
    return [
      [from.x, from.y],
      [mx, from.y],
      [mx, to.y],
      [to.x, to.y],
    ];
  }
  const stub = 16;
  const ay = from.y < to.y ? from.y - 30 : from.y + 30;
  return [
    [from.x, from.y],
    [from.x + stub, from.y],
    [from.x + stub, ay],
    [to.x - stub, ay],
    [to.x - stub, to.y],
    [to.x, to.y],
  ];
}

// Normale sortante d'un port : direction axiale dans laquelle le fil doit
// quitter (sortie) ou aborder (entrée) le port. [1,0]=droite, [-1,0]=gauche,
// [0,1]=bas, [0,-1]=haut.
export type Dir = [number, number];

const isHoriz = (d: Dir): boolean => d[1] === 0;

// Retire les doublons consécutifs et fusionne les sommets colinéaires, pour
// qu'une polyline manhattan reste minimale (pas de sommet inutile).
function simplifyPath(pts: Point[]): Point[] {
  const out: Point[] = [];
  for (const p of pts) {
    const last = out[out.length - 1];
    if (last && last[0] === p[0] && last[1] === p[1]) continue;
    out.push([p[0], p[1]]);
  }
  let i = 1;
  while (i < out.length - 1) {
    const a = out[i - 1];
    const b = out[i];
    const c = out[i + 1];
    const collinear = (a[0] === b[0] && b[0] === c[0]) || (a[1] === b[1] && b[1] === c[1]);
    if (collinear) out.splice(i, 1);
    else i++;
  }
  return out;
}

// Tracé manhattan tenant compte de l'ORIENTATION des ports : le fil quitte la
// source le long de `dFrom` et aborde la cible le long de `dTo` (normales
// sortantes). Indispensable dès qu'un composant n'est pas orienté « à droite »
// (sortie en bas, entrée en haut…), sinon le fil repart dans le composant.
//
// Le cas par défaut — source vers la droite, cible depuis la gauche — délègue à
// `routeWire` : les circuits orientés normalement gardent EXACTEMENT le même
// tracé qu'avant. `dTo` peut être null (extrémité libre, fil en cours de
// création) : on l'oriente alors vers la source.
export function routeWireDirected(
  from: { x: number; y: number },
  dFrom: Dir,
  to: { x: number; y: number },
  dTo: Dir | null,
): Point[] {
  if (dFrom[0] === 1 && dFrom[1] === 0 && dTo && dTo[0] === -1 && dTo[1] === 0) {
    return routeWire(from, to);
  }

  const S = 20;
  // Extrémité libre : oriente la cible vers la source, sur l'axe dominant.
  let d2: Dir = dTo ?? [0, 0];
  if (!dTo) {
    const dx = from.x - to.x;
    const dy = from.y - to.y;
    d2 =
      Math.abs(dx) >= Math.abs(dy) ? [Math.sign(dx) || -1, 0] : [0, Math.sign(dy) || -1];
  }

  const p1: Point = [from.x + dFrom[0] * S, from.y + dFrom[1] * S];
  const p2: Point = [to.x + d2[0] * S, to.y + d2[1] * S];

  let mid: Point[];
  if (isHoriz(dFrom) && isHoriz(d2)) {
    const mx = (p1[0] + p2[0]) / 2;
    mid = [
      [mx, p1[1]],
      [mx, p2[1]],
    ];
  } else if (!isHoriz(dFrom) && !isHoriz(d2)) {
    const my = (p1[1] + p2[1]) / 2;
    mid = [
      [p1[0], my],
      [p2[0], my],
    ];
  } else if (isHoriz(dFrom)) {
    mid = [[p2[0], p1[1]]];
  } else {
    mid = [[p1[0], p2[1]]];
  }

  return simplifyPath([[from.x, from.y], p1, ...mid, p2, [to.x, to.y]]);
}

export function pointsToStr(pts: Point[]): string {
  return pts.map((p) => `${p[0]},${p[1]}`).join(' ');
}

// Décale une polyline manhattan de `offset` px perpendiculairement à son tracé.
// Premier et dernier sommets restent en place (fan-in/fan-out vers les ports).
export function offsetManhattan(points: Point[], offset: number): Point[] {
  if (points.length < 2 || offset === 0) return points.map((p) => [p[0], p[1]]);

  // Directions unitaires de chaque segment
  const dirs: Point[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const dx = points[i + 1][0] - points[i][0];
    const dy = points[i + 1][1] - points[i][1];
    const len = Math.hypot(dx, dy);
    if (len === 0) {
      // Segment dégénéré : reprend la direction précédente ou (1,0)
      dirs.push(dirs[dirs.length - 1] ?? [1, 0]);
    } else {
      dirs.push([dx / len, dy / len]);
    }
  }
  // Perpendiculaire « à gauche » de la direction : rotation 90° CCW
  const perp = (d: Point): Point => [-d[1], d[0]];

  const result: Point[] = [[points[0][0], points[0][1]]];

  for (let i = 1; i < points.length - 1; i++) {
    const dPrev = dirs[i - 1];
    const dNext = dirs[i];
    const pP = perp(dPrev);
    const pN = perp(dNext);
    const Ax = points[i][0] + offset * pP[0];
    const Ay = points[i][1] + offset * pP[1];
    const Bx = points[i][0] + offset * pN[0];
    const By = points[i][1] + offset * pN[1];
    // Tracé manhattan : dPrev et dNext sont axiaux perpendiculaires.
    // Prev horizontal (dy≈0) → y reste Ay, next vertical → x reste Bx → (Bx, Ay).
    // Sinon → (Ax, By).
    let cx: number;
    let cy: number;
    if (Math.abs(dPrev[1]) < 0.01) {
      cx = Bx;
      cy = Ay;
    } else {
      cx = Ax;
      cy = By;
    }
    result.push([cx, cy]);
  }

  result.push([points[points.length - 1][0], points[points.length - 1][1]]);
  return result;
}

// N polylines parallèles pour un fil de bus (espacement `pitch`, centrées sur l'axe).
export function makeBusTracks(points: Point[], n: number, pitch: number): Point[][] {
  if (n <= 1) return [points];
  const tracks: Point[][] = [];
  for (let k = 0; k < n; k++) {
    const offset = (k - (n - 1) / 2) * pitch;
    tracks.push(offsetManhattan(points, offset));
  }
  return tracks;
}
