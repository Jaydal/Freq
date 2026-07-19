'use client';

import { useCallback } from 'react';
import { CHAR_W, CHAR_H, CELL_W, textToDots } from './P10Display';
import type { DisplayZone } from './zone-types';

const PANEL_W = 32;
const PANEL_H = 16;
const GAP = 1;
const TOTAL_W = PANEL_W * 3 + GAP * 2;

interface Props {
  zones: DisplayZone[];
  selectedZoneIndex: number | null;
  onZoneSelect: (index: number) => void;
}

function getPanelX(panelIndex: number): number {
  return panelIndex * (PANEL_W + GAP);
}

function renderZoneDots(zone: DisplayZone): { x: number; y: number; color: string }[] {
  const zoneWidth = (zone.panelEnd - zone.panelStart + 1) * PANEL_W;
  const zoneX = getPanelX(zone.panelStart);
  const isTwoLine = zone.lines.length === 2;
  const scale = isTwoLine ? 1 : 2;
  const charH = CHAR_H * scale;
  const totalTextH = zone.lines.length * charH + (zone.lines.length - 1) * (isTwoLine ? 2 : 0);
  const startY = Math.floor((PANEL_H - totalTextH) / 2);

  const dots: { x: number; y: number; color: string }[] = [];

  zone.lines.forEach((line, li) => {
    const text = line.text.toUpperCase();
    const textW = text.length * CELL_W * scale;
    let xOff: number;
    if (line.effect === 'STATIC' && textW <= zoneWidth) {
      xOff = zoneX + Math.floor((zoneWidth - textW) / 2);
    } else {
      xOff = zoneX;
    }
    const yOff = startY + li * (charH + (isTwoLine ? 2 : 0));
    const rawDots = textToDots(text, 0, 0);
    for (const d of rawDots) {
      dots.push({
        x: xOff + d.x * scale,
        y: yOff + d.y * scale,
        color: line.color || '#00FF00',
      });
    }
  });

  return dots;
}

export function P10Canvas({ zones, selectedZoneIndex, onZoneSelect }: Props) {
  const handleZoneClick = useCallback((e: React.MouseEvent, index: number) => {
    e.stopPropagation();
    onZoneSelect(index);
  }, [onZoneSelect]);

  const allDots = zones.flatMap(renderZoneDots);

  return (
    <div
      className="bg-zinc-800 rounded-lg p-1.5 shadow-2xl"
      style={{
        boxShadow: '0 0 30px rgba(0,0,0,0.6), 0 4px 15px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.05)',
      }}
    >
      <div
        className="bg-zinc-950 rounded-md p-0.5"
        style={{ boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.5)' }}
      >
        <div
          className="relative overflow-hidden rounded-sm"
          style={{ background: '#080806', aspectRatio: `${TOTAL_W} / ${PANEL_H}` }}
        >
          <svg
            viewBox={`0 0 ${TOTAL_W} ${PANEL_H}`}
            className="w-full h-full block"
            preserveAspectRatio="xMidYMid meet"
          >
            <defs>
              <clipPath id="canvas-clip">
                <rect x={0} y={0} width={TOTAL_W} height={PANEL_H} rx={0.3} />
              </clipPath>
              <filter id="led-glow-canvas" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="0.3" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
              <radialGradient id="off-led-canvas" cx="50%" cy="40%" r="60%">
                <stop offset="0%" stopColor="#1a1210" />
                <stop offset="100%" stopColor="#0d0806" />
              </radialGradient>
              <pattern id="scanlines-canvas" width="1" height="2" patternUnits="userSpaceOnUse">
                <rect width="1" height="1" fill="#000" opacity={0.3} />
                <rect y="1" width="1" height="1" fill="transparent" />
              </pattern>
              <linearGradient id="glare-canvas" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#fff" stopOpacity={0.3} />
                <stop offset="100%" stopColor="#fff" stopOpacity={0} />
              </linearGradient>
            </defs>

            <rect width={TOTAL_W} height={PANEL_H} fill="url(#off-led-canvas)" rx={0.3} />

            {[1, 2].map(i => (
              <rect
                key={`gap-${i}`}
                x={getPanelX(i) - GAP}
                y={0}
                width={GAP}
                height={PANEL_H}
                fill="#1a1a1a"
                rx={0.1}
              />
            ))}

            {Array.from({ length: PANEL_W * 3 }).flatMap((_, cx) =>
              Array.from({ length: PANEL_H }).map((_, cy) => {
                const panelIdx = Math.floor(cx / PANEL_W);
                const localX = cx % PANEL_W;
                const gx = getPanelX(panelIdx) + localX;
                return (
                  <circle
                    key={`g-${cx}-${cy}`}
                    cx={gx + 0.5}
                    cy={cy + 0.5}
                    r={0.3}
                    fill="#333333"
                    opacity={0.1}
                  />
                );
              })
            )}

            {zones.map((zone, zi) => {
              const zx = getPanelX(zone.panelStart);
              const zw = (zone.panelEnd - zone.panelStart + 1) * PANEL_W;
              const isSelected = selectedZoneIndex === zi;
              return (
                <rect
                  key={`zone-${zi}`}
                  x={zx}
                  y={0}
                  width={zw}
                  height={PANEL_H}
                  fill={isSelected ? 'rgba(0, 255, 0, 0.05)' : 'transparent'}
                  stroke={isSelected ? '#00FF00' : 'rgba(255,255,255,0.05)'}
                  strokeWidth={isSelected ? 0.3 : 0.1}
                  rx={0.2}
                  style={{ cursor: 'pointer', transition: 'fill 0.15s' }}
                  onClick={(e) => handleZoneClick(e, zi)}
                />
              );
            })}

            <g clipPath="url(#canvas-clip)" filter="url(#led-glow-canvas)">
              {allDots.map((d, i) => (
                <circle
                  key={`dot-${i}`}
                  cx={d.x + 0.5}
                  cy={d.y + 0.5}
                  r={0.4}
                  fill={d.color}
                  opacity={0.95}
                />
              ))}
            </g>

            <rect
              width={TOTAL_W}
              height={PANEL_H}
              fill="url(#scanlines-canvas)"
              opacity={0.15}
              pointerEvents="none"
            />

            <rect
              x={0}
              y={0}
              width={TOTAL_W}
              height={PANEL_H * 0.4}
              fill="url(#glare-canvas)"
              opacity={0.06}
              pointerEvents="none"
            />
          </svg>
        </div>
      </div>
    </div>
  );
}
