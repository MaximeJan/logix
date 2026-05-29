import { useEffect, useRef, useState } from 'react';
import type { MouseEvent as ReactMouseEvent, WheelEvent as ReactWheelEvent } from 'react';

export interface ViewBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

type Pt = { clientX: number; clientY: number };

// Zoom et pan du canevas SVG. Le viewBox (en unités SVG) est appliqué au <svg> ;
// les clics restent alignés via getScreenCTM().inverse(). `viewBoxBaseRef` retient
// la taille mesurée au montage (= vue à 100 %), `panRef` l'état d'un pan en cours
// (bouton du milieu). Le hook possède svgRef ; le rendu l'attache au <svg>.
export function useViewport() {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [viewBox, setViewBox] = useState<ViewBox | null>(null);
  const viewBoxBaseRef = useRef<{ w: number; h: number } | null>(null);
  const panRef = useRef<{
    startClientX: number;
    startClientY: number;
    vbStartX: number;
    vbStartY: number;
  } | null>(null);

  // Point d'un évènement souris en coordonnées SVG (gère viewBox + zoom).
  const getSvgPoint = (e: Pt) => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) return { x: 0, y: 0 };
    const p = pt.matrixTransform(ctm.inverse());
    return { x: p.x, y: p.y };
  };

  // Mesure la taille initiale du SVG au montage (référence pour le reset zoom).
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      const base = { w: rect.width, h: rect.height };
      viewBoxBaseRef.current = base;
      setViewBox((vb) => vb ?? { x: 0, y: 0, w: base.w, h: base.h });
    }
  }, []);

  const resetView = () => {
    const base = viewBoxBaseRef.current;
    if (base) setViewBox({ x: 0, y: 0, w: base.w, h: base.h });
  };

  // Zoom centré sur la souris (molette sans modificateur).
  const handleCanvasWheel = (e: ReactWheelEvent) => {
    e.preventDefault();
    const vb = viewBox;
    if (!vb) return;
    const p = getSvgPoint(e);
    const factor = e.deltaY > 0 ? 1.15 : 1 / 1.15;
    const base = viewBoxBaseRef.current;
    const minW = base ? base.w / 8 : 100; // zoom in max 8x
    const maxW = base ? base.w * 4 : 8000; // zoom out max 4x
    const newW = Math.max(minW, Math.min(maxW, vb.w * factor));
    const newH = newW * (vb.h / vb.w);
    const newX = p.x - (p.x - vb.x) * (newW / vb.w);
    const newY = p.y - (p.y - vb.y) * (newH / vb.h);
    setViewBox({ x: newX, y: newY, w: newW, h: newH });
  };

  // Pan au bouton du milieu (button === 1). Renvoie true s'il prend la main.
  const handleCanvasMouseDownPan = (e: ReactMouseEvent) => {
    if (e.button !== 1) return false;
    if (!viewBox) return false;
    e.preventDefault();
    panRef.current = {
      startClientX: e.clientX,
      startClientY: e.clientY,
      vbStartX: viewBox.x,
      vbStartY: viewBox.y,
    };
    return true;
  };

  const handleCanvasMouseMovePan = (e: ReactMouseEvent) => {
    if (!panRef.current) return false;
    const svg = svgRef.current;
    if (!svg || !viewBox) return false;
    const rect = svg.getBoundingClientRect();
    const dxScreen = e.clientX - panRef.current.startClientX;
    const dyScreen = e.clientY - panRef.current.startClientY;
    const dxSvg = dxScreen * (viewBox.w / rect.width);
    const dySvg = dyScreen * (viewBox.h / rect.height);
    setViewBox({
      ...viewBox,
      x: panRef.current.vbStartX - dxSvg,
      y: panRef.current.vbStartY - dySvg,
    });
    return true;
  };

  const handleCanvasMouseUpPan = () => {
    if (panRef.current) {
      panRef.current = null;
      return true;
    }
    return false;
  };

  return {
    svgRef,
    viewBox,
    viewBoxBaseRef,
    panRef,
    getSvgPoint,
    resetView,
    handleCanvasWheel,
    handleCanvasMouseDownPan,
    handleCanvasMouseMovePan,
    handleCanvasMouseUpPan,
  };
}
