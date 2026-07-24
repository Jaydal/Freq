'use client';

import { useCallback, useState, useEffect } from 'react';
import { CHAR_W, CHAR_H, CELL_W, SPACING, textToDots } from './P10Display';
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

function isBorderRow(y: number, borderRows?: { start: number; end: number }[]): boolean {
  if (!borderRows || borderRows.length === 0) return false;
  return borderRows.some(br => y >= br.start && y <= br.end);
}

function getAvailableVRange(borderRows?: { start: number; end: number }[]): { top: number; bottom: number } {
  if (!borderRows || borderRows.length === 0) return { top: 0, bottom: PANEL_H - 1 };
  const isBorder = new Array(PANEL_H).fill(false);
  for (const br of borderRows) {
    for (let y = br.start; y <= br.end; y++) isBorder[y] = true;
  }
  let top = -1, bottom = -1;
  for (let y = 0; y < PANEL_H; y++) {
    if (!isBorder[y]) {
      if (top === -1) top = y;
      bottom = y;
    }
  }
  return { top: top >= 0 ? top : 0, bottom: bottom >= 0 ? bottom : PANEL_H - 1 };
}

export function textWidthPx(text: string, scale: number): number {
  let w = 0;
  for (const ch of text) {
    if (w > 0) w += SPACING * scale;
    w += CHAR_W * scale;
  }
  return w;
}

export function subst(t: string, mockVars: Record<string, string>): string {
  let r = t;
  for (const [key, val] of Object.entries(mockVars)) {
    r = r.replace(new RegExp(`\\{${key}\\}`, 'gi'), val);
  }
  return r;
}

const _spAccum: Record<string, number> = {};

function renderZoneDots(
  zoneIndex: number,
  zone: DisplayZone,
  mockVars: Record<string, string>,
  tick: number,
): { dots: { x: number; y: number; color: string }[]; bgRects: { x: number; y: number; w: number; h: number; color: string }[] } {
  const zoneWidth = (zone.panelEnd - zone.panelStart + 1) * PANEL_W;
  const zoneX = getPanelX(zone.panelStart);
  const dots: { x: number; y: number; color: string }[] = [];
  const bgRects: { x: number; y: number; w: number; h: number; color: string }[] = [];

  const avail = getAvailableVRange(zone.borderRows);
  const availH = avail.bottom - avail.top + 1;

  const lineScales = zone.lines.map((line) => {
    if (zone.lines.length === 2) return 1;
    if (zone.scale) return zone.scale;
    const sp = (line as any).subpages?.[0];
    if (sp && sp.effect === 'SCROLL') return 2;
    if (!sp) {
      if (line.effect === 'SCROLL') return 2;
      const tw2x = textWidthPx(subst(line.text ?? '', mockVars).toUpperCase(), 2);
      return tw2x <= zoneWidth ? 2 : 1;
    }
    const tw2x = textWidthPx(subst(sp.text, mockVars).toUpperCase(), 2);
    return tw2x <= zoneWidth ? 2 : 1;
  });

  let totalTextH = 0;
  const lineYOffsets: number[] = [];
  for (let li = 0; li < zone.lines.length; li++) {
    const mt = zone.lines[li].marginTop ?? 0;
    const mb = zone.lines[li].marginBottom ?? (li < zone.lines.length - 1 ? 2 : 0);
    lineYOffsets.push(totalTextH + mt);
    totalTextH += mt + CHAR_H * lineScales[li] + mb;
  }
  const valign = zone.valign || 'middle';
  let startY: number;
  if (availH <= totalTextH) {
    startY = avail.top;
  } else if (valign === 'top') {
    startY = avail.top;
  } else if (valign === 'bottom') {
    startY = avail.bottom - totalTextH + 1;
  } else {
    startY = Math.floor(avail.top + (availH - totalTextH) / 2);
  }

  zone.lines.forEach((line, li) => {
    const scale = lineScales[li];

    const subpages = (line as any).subpages;
    let displayText = '';
    let displayColor = '#00FF00';
    let displayBgColor = '';
    let displayEffect = 'STATIC';
    let displayAlign: 'left' | 'center' | 'right' = 'center';
    let displayScrollSpeed = 1;

    if (subpages && subpages.length > 0) {
      const key = `${zoneIndex}-${li}`;
      if (!_spAccum[key]) _spAccum[key] = 0;

      let elapsed = _spAccum[key]!;
      const totalCycle = subpages.reduce((sum: number, sp: any) => sum + (sp.durationMs || 5000), 0);
      if (totalCycle > 0) elapsed %= totalCycle;
      let sp: any = subpages[0];
      for (let i = 0; i < subpages.length; i++) {
        if (elapsed < (subpages[i].durationMs || 5000)) {
          sp = subpages[i];
          break;
        }
        elapsed -= (subpages[i].durationMs || 5000);
      }
      _spAccum[key]! += 50;

      displayText = subst(sp.text, mockVars).toUpperCase();
      displayColor = sp.color || '#00FF00';
      displayBgColor = sp.bgColor || '';
      displayEffect = sp.effect || 'STATIC';
      displayAlign = sp.align || 'center';
      displayScrollSpeed = sp.scrollSpeed ?? 1;
    } else {
      displayText = subst(line.text ?? '', mockVars).toUpperCase();
      displayColor = line.color || '#00FF00';
      displayEffect = line.effect || 'STATIC';
      displayAlign = line.align || 'center';
      displayScrollSpeed = line.scrollSpeed ?? 1;
    }

    const displayW = textWidthPx(displayText, scale);
    const textW = displayW;

    if (displayEffect === 'BLINK') {
      const show = Math.floor(tick / 10) % 2 === 0;
      if (!show) return;
    }

    let xOff: number;
    if (displayEffect === 'SCROLL') {
      const speed = displayScrollSpeed;
      const loopW = textW + zoneWidth;
      const offset = zoneWidth - ((tick * speed) % loopW);
      xOff = zoneX + offset;
    } else if (displayAlign === 'left') {
      xOff = zoneX;
    } else if (displayAlign === 'right') {
      xOff = zoneX + zoneWidth - textW;
    } else {
      xOff = zoneX + Math.floor((zoneWidth - textW) / 2);
    }

    const yOff = startY + lineYOffsets[li];

    if (displayBgColor) {
      bgRects.push({
        x: xOff,
        y: yOff,
        w: textWidthPx(displayText, scale),
        h: CHAR_H * scale,
        color: displayBgColor,
      });
    }

    const rawDots = textToDots(displayText, 0, 0);
    for (const d of rawDots) {
      const px = xOff + d.x * scale;
      const py = yOff + d.y * scale;
      if (px < zoneX || px >= zoneX + zoneWidth) continue;
      if (isBorderRow(py, zone.borderRows)) continue;
      dots.push({
        x: px,
        y: py,
        color: displayColor,
      });
    }
  });

  return { dots, bgRects };
}

function fmtTimer(totalSec: number): string {
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}:${sec.toString().padStart(2, '0')}`;
}

const TIMER_INIT_SEC = 600;

export function P10Canvas({ zones, selectedZoneIndex, onZoneSelect }: Props) {
  const [remainingSec, setRemainingSec] = useState(TIMER_INIT_SEC);
  const [startTime] = useState(Date.now());
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      setRemainingSec(Math.max(0, TIMER_INIT_SEC - elapsed));
    }, 1000);
    return () => clearInterval(id);
  }, [startTime]);

  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 50);
    return () => clearInterval(id);
  }, []);

  const timerStr = fmtTimer(remainingSec);
  const elapsedStr = fmtTimer(TIMER_INIT_SEC - remainingSec);
  const mockVars: Record<string, string> = {
    timer: timerStr,
    elapsed: elapsedStr,
    match_title: 'Juan | 2v2 Game',
    next_match: 'Maria & Alex vs Tom',
    next_wait: '5min',
    next_booked_time: '2:30PM',
    _tick: String(tick),
  };

  const handleZoneClick = useCallback((e: React.MouseEvent, index: number) => {
    e.stopPropagation();
    onZoneSelect(index);
  }, [onZoneSelect]);

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

            <defs>
              {zones.map((zone, zi) => {
                const zx = getPanelX(zone.panelStart);
                const zw = (zone.panelEnd - zone.panelStart + 1) * PANEL_W;
                return (
                  <clipPath key={`zone-clip-${zi}`} id={`zone-clip-${zi}`}>
                    <rect x={zx} y={0} width={zw} height={PANEL_H} />
                  </clipPath>
                );
              })}
            </defs>
            <g clipPath="url(#canvas-clip)" filter="url(#led-glow-canvas)">
              {zones.map((zone, zi) => {
                const zoneResult = renderZoneDots(zi, zone, mockVars, tick);
                return (
                  <g key={`zd-${zi}`} clipPath={`url(#zone-clip-${zi})`}>
                    {zoneResult.bgRects.map((r, i) => (
                      <rect
                        key={`bg-${zi}-${i}`}
                        x={r.x}
                        y={r.y}
                        width={r.w}
                        height={r.h}
                        fill={r.color}
                        opacity={0.95}
                      />
                    ))}
                    {zoneResult.dots.map((d, i) => (
                      <rect
                        key={`dot-${zi}-${i}`}
                        x={d.x + 0.1}
                        y={d.y + 0.1}
                        width={0.8}
                        height={0.8}
                        fill={d.color}
                        opacity={0.95}
                      />
                    ))}
                  </g>
                );
              })}
            </g>

            {zones.map((zone, zi) => {
              if (!zone.borderRows || zone.borderRows.length === 0) return null;
              const zx = getPanelX(zone.panelStart);
              const zw = (zone.panelEnd - zone.panelStart + 1) * PANEL_W;
              return zone.borderRows.map((br, bri) => (
                <rect
                  key={`border-${zi}-${bri}`}
                  x={zx}
                  y={br.start}
                  width={zw}
                  height={br.end - br.start + 1}
                  fill="rgba(255,0,0,0.08)"
                  stroke="rgba(255,0,0,0.25)"
                  strokeWidth={0.15}
                  rx={0.1}
                  pointerEvents="none"
                />
              ));
            })}

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