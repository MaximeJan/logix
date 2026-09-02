import type {
  CSSProperties,
  MouseEvent as ReactMouseEvent,
  RefObject,
  WheelEvent as ReactWheelEvent,
} from 'react';
import { GRID, PORT_R } from '../lib/constants';
import { asInt, portKey } from '../lib/sim';
import { routeWireDirected, pointsToStr, makeBusTracks } from '../lib/geometry';
import { getDef, getPortPosition, getPortWidth, getPortFacing } from '../gates/registry';
import type { Circuit, CircuitComponent, Port, SimResult, Selection, Wire } from '../domain/types';
import type { Prefs } from '../lib/constants';
import type { ViewBox } from '../hooks/useViewport';

interface CircuitCanvasProps {
  svgRef: RefObject<SVGSVGElement>;
  viewBox: ViewBox | null;
  prefs: Prefs;
  circuit: Circuit;
  sim: SimResult;
  selection: Selection;
  dragOffset: { dx: number; dy: number; ids: Set<string> } | null;
  wireStart: { componentId: string; port: string; x: number; y: number } | null;
  mousePos: { x: number; y: number } | null;
  wireMovedRef: RefObject<boolean>;
  rectSelect: { x: number; y: number; w: number; h: number; didMove?: boolean } | null;
  placeType: string | null;
  paletteDrag: { didMove?: boolean } | null;
  panRef: RefObject<unknown>;
  onCanvasMouseDown: (e: ReactMouseEvent) => void;
  onCanvasMouseMove: (e: ReactMouseEvent) => void;
  onCanvasMouseUp: () => void;
  onCanvasWheel: (e: ReactWheelEvent) => void;
  onWireClick: (e: ReactMouseEvent, w: Wire) => void;
  onComponentMouseDown: (e: ReactMouseEvent, comp: CircuitComponent) => void;
  onComponentClick: (e: ReactMouseEvent, comp: CircuitComponent) => void;
  onPortMouseDown: (
    e: ReactMouseEvent,
    comp: CircuitComponent,
    port: Port,
    kind: 'input' | 'output',
  ) => void;
}

// Canevas SVG : grille de fond, fils (1-bit ou nappe de bus), fil en cours de
// câblage, cadre de sélection rectangulaire, puis les composants (forme via
// def.shape, halo de sélection, étiquette, ports). Composant présentationnel —
// l'orchestrateur fournit l'état et les gestionnaires d'évènements.
export function CircuitCanvas({
  svgRef,
  viewBox,
  prefs,
  circuit,
  sim,
  selection,
  dragOffset,
  wireStart,
  mousePos,
  wireMovedRef,
  rectSelect,
  placeType,
  paletteDrag,
  panRef,
  onCanvasMouseDown,
  onCanvasMouseMove,
  onCanvasMouseUp,
  onCanvasWheel,
  onWireClick,
  onComponentMouseDown,
  onComponentClick,
  onPortMouseDown,
}: CircuitCanvasProps) {
  const svgStyle = {
    cursor: panRef.current
      ? 'grabbing'
      : paletteDrag?.didMove
        ? 'copy'
        : placeType
          ? 'crosshair'
          : wireStart
            ? 'crosshair'
            : 'default',
    background: prefs.canvasBg,
    '--input-on': prefs.inputOnColor,
    '--output-on': prefs.outputOnColor,
    '--seg7-on': prefs.seg7OnColor,
    '--seg7-off': prefs.seg7OffColor,
    '--lcd-border': prefs.lcdBorderColor,
    '--lcd-fill': prefs.lcdFillColor,
    '--lcd-text': prefs.lcdTextColor,
  } as CSSProperties;

  return (
    <svg
      ref={svgRef}
      width="100%"
      height="100%"
      viewBox={viewBox ? `${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}` : undefined}
      preserveAspectRatio="xMidYMid meet"
      onMouseDown={onCanvasMouseDown}
      onMouseMove={onCanvasMouseMove}
      onMouseUp={onCanvasMouseUp}
      onMouseLeave={onCanvasMouseUp}
      onWheel={onCanvasWheel}
      onContextMenu={(e) => e.preventDefault()}
      style={svgStyle}
    >
      <defs>
        <pattern id="grid" width={GRID} height={GRID} patternUnits="userSpaceOnUse">
          {prefs.gridStyle === 'dots' && <circle cx="1" cy="1" r="0.7" fill="#d6d3d1" />}
          {prefs.gridStyle === 'lines' && (
            <path
              d={`M ${GRID} 0 L 0 0 0 ${GRID}`}
              fill="none"
              stroke="#e7e5e4"
              strokeWidth="0.5"
            />
          )}
        </pattern>
      </defs>
      <rect
        width="100%"
        height="100%"
        fill={prefs.gridStyle === 'off' ? 'transparent' : 'url(#grid)'}
        data-canvas-bg="true"
      />

      {/* FILS */}
      {circuit.wires.map((w) => {
        const fromComp = circuit.components.find((c) => c.id === w.from.componentId);
        const toComp = circuit.components.find((c) => c.id === w.to.componentId);
        if (!fromComp || !toComp) return null;
        let from = getPortPosition(fromComp, w.from.port, 'output', circuit.customDefinitions);
        let to = getPortPosition(toComp, w.to.port, 'input', circuit.customDefinitions);
        if (!from || !to) return null;
        if (dragOffset) {
          if (dragOffset.ids.has(fromComp.id))
            from = { x: from.x + dragOffset.dx, y: from.y + dragOffset.dy };
          if (dragOffset.ids.has(toComp.id))
            to = { x: to.x + dragOffset.dx, y: to.y + dragOffset.dy };
        }
        const wireWidth = getPortWidth(fromComp, w.from.port, 'output', circuit.customDefinitions);
        const value = asInt(sim.wireValues.get(w.id) ?? 0);
        const isSelected = selection.wires.includes(w.id);
        const dFrom = getPortFacing(fromComp, w.from.port, 'output', circuit.customDefinitions);
        const dTo = getPortFacing(toComp, w.to.port, 'input', circuit.customDefinitions);
        const points = routeWireDirected(from, dFrom, to, dTo);
        const pointsStr = pointsToStr(points);

        if (wireWidth === 1) {
          const active = !!value;
          return (
            <g key={w.id} onClick={(e) => onWireClick(e, w)} style={{ cursor: 'pointer' }}>
              <polyline points={pointsStr} fill="none" stroke="transparent" strokeWidth={10} />
              <polyline
                points={pointsStr}
                fill="none"
                stroke={isSelected ? '#0284c7' : active ? prefs.wireOnColor : prefs.wireOffColor}
                strokeWidth={
                  isSelected
                    ? prefs.wireWidth + 1
                    : active
                      ? prefs.wireWidth + 0.5
                      : prefs.wireWidth
                }
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </g>
          );
        }

        const strokeBit = prefs.busBitStroke ?? 2.5;
        const gap = prefs.busBitGap ?? 1.2;
        const offColor = prefs.busOffColor ?? '#0f172a';
        const pitch = strokeBit + gap;
        const halfThick = ((wireWidth - 1) * pitch) / 2;
        const tracks = makeBusTracks(points, wireWidth, pitch);
        const totalThick = wireWidth * pitch + 4;
        return (
          <g key={w.id} onClick={(e) => onWireClick(e, w)} style={{ cursor: 'pointer' }}>
            <polyline
              points={pointsStr}
              fill="none"
              stroke="transparent"
              strokeWidth={Math.max(12, totalThick + 4)}
            />
            {isSelected && (
              <polyline
                points={pointsStr}
                fill="none"
                stroke="#0284c7"
                strokeWidth={totalThick + 3}
                strokeOpacity={0.22}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}
            {tracks.map((trackPoints, k) => {
              const bitIdx = wireWidth - 1 - k;
              const bit = (value >> bitIdx) & 1;
              const color = bit ? prefs.wireOnColor : offColor;
              return (
                <polyline
                  key={k}
                  points={pointsToStr(trackPoints)}
                  fill="none"
                  stroke={color}
                  strokeWidth={strokeBit}
                  strokeLinecap="butt"
                  strokeLinejoin="miter"
                />
              );
            })}
            <text
              x={from.x + 12}
              y={from.y - halfThick - 4}
              fontSize="9"
              fontFamily="'IBM Plex Mono', monospace"
              fill="#475569"
              style={{ userSelect: 'none', pointerEvents: 'none' }}
            >
              /{wireWidth}
            </text>
          </g>
        );
      })}

      {/* FIL EN COURS DE CRÉATION */}
      {wireStart &&
        mousePos &&
        wireMovedRef.current &&
        (() => {
          const startComp = circuit.components.find((c) => c.id === wireStart.componentId);
          const dFrom: [number, number] = startComp
            ? getPortFacing(startComp, wireStart.port, 'output', circuit.customDefinitions)
            : [1, 0];
          return (
            <polyline
              points={pointsToStr(routeWireDirected(wireStart, dFrom, mousePos, null))}
              fill="none"
              stroke="#0ea5e9"
              strokeWidth={2}
              strokeDasharray="5,3"
              pointerEvents="none"
            />
          );
        })()}

      {/* CADRE DE SÉLECTION RECTANGULAIRE */}
      {rectSelect?.didMove && (
        <rect
          x={rectSelect.x}
          y={rectSelect.y}
          width={rectSelect.w}
          height={rectSelect.h}
          fill="rgba(14, 165, 233, 0.08)"
          stroke="#0ea5e9"
          strokeWidth={1}
          strokeDasharray="4,3"
          pointerEvents="none"
        />
      )}

      {/* COMPOSANTS */}
      {circuit.components.map((comp) => {
        const def = getDef(comp.type, circuit.customDefinitions, comp);
        if (!def) return null;
        const isSelected = selection.components.includes(comp.id);
        const outputValue = def.outputs[0]
          ? sim.outValues.get(portKey(comp.id, def.outputs[0].name))
          : 0;
        const inputValue = def.inputs[0]
          ? sim.inputValues.get(portKey(comp.id, def.inputs[0].name))
          : 0;
        const inputsByName: Record<string, number> = {};
        for (const p of def.inputs) {
          inputsByName[p.name] = sim.inputValues.get(portKey(comp.id, p.name)) ?? 0;
        }
        const isDragging = dragOffset && dragOffset.ids.has(comp.id);
        const rx = isDragging ? comp.x + dragOffset!.dx : comp.x;
        const ry = isDragging ? comp.y + dragOffset!.dy : comp.y;
        return (
          <g
            key={comp.id}
            transform={`translate(${rx},${ry})`}
            onMouseDown={(e) => onComponentMouseDown(e, comp)}
            onClick={(e) => onComponentClick(e, comp)}
            style={{
              cursor:
                comp.type === 'INPUT' || (comp.type === 'CLOCK' && !comp.state?.running)
                  ? 'pointer'
                  : 'move',
            }}
          >
            {isSelected && (
              <rect
                x={-4}
                y={-4}
                width={def.w + 8}
                height={def.h + 8}
                rx={6}
                fill="rgba(14, 165, 233, 0.08)"
                stroke="#0ea5e9"
                strokeWidth={1}
                strokeDasharray="3,2"
              />
            )}
            {(() => {
              const nativeW = def.nativeW ?? def.w;
              const nativeH = def.nativeH ?? def.h;
              const orientation = def.orientation ?? 'right';
              const angle =
                orientation === 'down'
                  ? 90
                  : orientation === 'left'
                    ? 180
                    : orientation === 'up'
                      ? 270
                      : 0;
              const cx = def.w / 2;
              const cy = def.h / 2;
              const innerTransform =
                angle === 0
                  ? undefined
                  : `translate(${cx} ${cy}) rotate(${angle}) translate(${-nativeW / 2} ${-nativeH / 2})`;
              return (
                <g
                  stroke="#1f2937"
                  strokeWidth={1.5}
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  transform={innerTransform}
                >
                  {def.shape?.(comp, outputValue, inputValue, inputsByName, angle)}
                </g>
              );
            })()}
            {(comp.type === 'INPUT' || comp.type === 'OUTPUT') && comp.label && (
              <text
                x={comp.type === 'INPUT' ? -4 : def.w + 4}
                y={def.h / 2 + 4}
                textAnchor={comp.type === 'INPUT' ? 'end' : 'start'}
                fontSize="12"
                fontFamily="'IBM Plex Mono', monospace"
                fill="#475569"
              >
                {comp.label}
              </text>
            )}
            {def.inputs.map((p) => {
              const v = sim.inputValues.get(portKey(comp.id, p.name));
              const portWidth = p.width ?? 1;
              const isBus = portWidth > 1;
              const r = isBus ? PORT_R + 1.5 : PORT_R;
              const canConnect = !!wireStart;
              let widthOk = true;
              if (canConnect && wireStart) {
                const startComp = circuit.components.find((c) => c.id === wireStart.componentId);
                const startWidth = startComp
                  ? getPortWidth(startComp, wireStart.port, 'output', circuit.customDefinitions)
                  : 1;
                widthOk = startWidth === portWidth;
              }
              const fill = canConnect ? (widthOk ? '#fef3c7' : '#fee2e2') : 'white';
              const stroke = canConnect && !widthOk ? '#dc2626' : v ? '#65a30d' : '#1f2937';
              return (
                <g key={p.name}>
                  {isBus && (
                    <rect
                      x={(p.x ?? 0) - r - 1.5}
                      y={(p.y ?? 0) - r - 1.5}
                      width={(r + 1.5) * 2}
                      height={(r + 1.5) * 2}
                      fill="none"
                      stroke={stroke}
                      strokeWidth={0.8}
                      strokeDasharray="2,1.5"
                      pointerEvents="none"
                    />
                  )}
                  <circle
                    cx={p.x}
                    cy={p.y}
                    r={12}
                    fill="none"
                    pointerEvents="all"
                    style={{ cursor: canConnect ? 'crosshair' : 'default' }}
                    onMouseDown={(e) => onPortMouseDown(e, comp, p, 'input')}
                    onClick={(e) => e.stopPropagation()}
                  />
                  <circle
                    cx={p.x}
                    cy={p.y}
                    r={r}
                    fill={fill}
                    stroke={stroke}
                    strokeWidth={isBus ? 2 : 1.5}
                    pointerEvents="none"
                  />
                </g>
              );
            })}
            {def.outputs.map((p) => {
              const v = sim.outValues.get(portKey(comp.id, p.name));
              const portWidth = p.width ?? 1;
              const isBus = portWidth > 1;
              const r = isBus ? PORT_R + 1.5 : PORT_R;
              return (
                <g key={p.name}>
                  {isBus && (
                    <rect
                      x={(p.x ?? 0) - r - 1.5}
                      y={(p.y ?? 0) - r - 1.5}
                      width={(r + 1.5) * 2}
                      height={(r + 1.5) * 2}
                      fill="none"
                      stroke={v ? '#65a30d' : '#1f2937'}
                      strokeWidth={0.8}
                      strokeDasharray="2,1.5"
                      pointerEvents="none"
                    />
                  )}
                  <circle
                    cx={p.x}
                    cy={p.y}
                    r={12}
                    fill="none"
                    pointerEvents="all"
                    style={{ cursor: 'crosshair' }}
                    onMouseDown={(e) => onPortMouseDown(e, comp, p, 'output')}
                    onClick={(e) => e.stopPropagation()}
                  />
                  <circle
                    cx={p.x}
                    cy={p.y}
                    r={r}
                    fill="white"
                    stroke={v ? '#65a30d' : '#1f2937'}
                    strokeWidth={isBus ? 2 : 1.5}
                    pointerEvents="none"
                  />
                </g>
              );
            })}
          </g>
        );
      })}
    </svg>
  );
}
