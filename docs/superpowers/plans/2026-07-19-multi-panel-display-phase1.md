# Multi-Panel Display Designer — Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the WYSIWYG visual display sequence editor for 3× P10 LED panels (96×16) with interactive zone editing.

**Architecture:** The existing `DisplaySequenceEditor` (JSON textarea + flat preview) is replaced with a component tree: `P10Canvas` (interactive 3-panel SVG preview with clickable/draggable zones) + `ZonePanel` (per-zone property sidebar) + page navigation. The zone model replaces the flat page text. Backward compat maintained — old format implicitly maps to a single zone.

**Tech Stack:** Next.js (App Router), React 19, TypeScript, shadcn/ui, @dnd-kit/core, @dnd-kit/utilities, Tailwind CSS 4

---

## File Structure

### New Files
| File | Responsibility |
|------|---------------|
| `web/src/components/display/zone-types.ts` | Shared TypeScript types for zones |
| `web/src/components/display/P10Canvas.tsx` | 3-panel interactive SVG preview (96×16), clickable zone regions, draggable dividers |
| `web/src/components/display/ZonePanel.tsx` | Sidebar editor for a single zone: panel assignment, line count, per-line text/color/effect |
| `web/src/components/display/PageToolbar.tsx` | Page dots navigation, add/remove page, duration per page |
| `web/src/components/display/TemplateDropdown.tsx` | Zone layout preset dropdown |
| `web/src/components/display/DisplaySequenceEditorV2.tsx` | New main editor combining all above, replacing the old one |
| `web/src/components/display/color-utils.ts` | Color parsing helpers |

### Modified Files
| File | Change |
|------|--------|
| `web/src/components/display/P10Display.tsx` | Minor: export `textToDots`, `FONT`, `CHAR_W`, `CHAR_H`, `CELL_W` for reuse |
| `web/src/features/settings/components/DisplaySequenceEditor.tsx` | Replace entire content with import of DisplaySequenceEditorV2 (or just swap the import in page.tsx) |
| `web/src/app/(dashboard)/settings/page.tsx` | No change needed (imports `DisplaySequenceEditor` — component is swapped internally) |

---

### Task 1: Define zone types

**Files:**
- Create: `web/src/components/display/zone-types.ts`
- Modify: `web/src/components/display/P10Display.tsx` (minor exports)

- [ ] **Step 1: Create zone-types.ts with all interfaces**

```ts
// Zone model — a page is composed of zones that partition the 3 panels
export interface DisplayLine {
  text: string;
  color: string;       // hex "#00FF00"
  effect: 'SCROLL' | 'STATIC' | 'BLINK' | 'paginate';
}

export interface DisplayZone {
  panelStart: number;  // 0, 1, or 2
  panelEnd: number;    // 0, 1, or 2 (>= panelStart)
  lines: DisplayLine[]; // 1 or 2 lines
}

export interface ZonePage {
  durationSeconds: number;
  zones: DisplayZone[];
}

// Full sequence stored in settings (same shape as before but pages use zones)
export interface DisplaySequenceConfig {
  idle: { interval: number; pages: ZonePage[] };
  prep: { interval: number; pages: ZonePage[] };
  game: { interval: number; pages: ZonePage[] };
}

// Template for quick zone layout presets
export interface ZoneTemplate {
  name: string;
  description: string;
  zones: { panelStart: number; panelEnd: number; lines: number }[];
}

export const ZONE_TEMPLATES: ZoneTemplate[] = [
  { name: 'All 3 Combined', description: 'All panels as one zone, 2 lines', zones: [{ panelStart: 0, panelEnd: 2, lines: 2 }] },
  { name: '2+1 Split', description: 'Panels 0-1 (64px) + Panel 2 (32px)', zones: [{ panelStart: 0, panelEnd: 1, lines: 2 }, { panelStart: 2, panelEnd: 2, lines: 1 }] },
  { name: '1+1+1', description: 'Each panel independent, 1 line', zones: [{ panelStart: 0, panelEnd: 0, lines: 1 }, { panelStart: 1, panelEnd: 1, lines: 1 }, { panelStart: 2, panelEnd: 2, lines: 1 }] },
  { name: '1+2 Split', description: 'Panel 0 (32px) + Panels 1-2 (64px)', zones: [{ panelStart: 0, panelEnd: 0, lines: 1 }, { panelStart: 1, panelEnd: 2, lines: 2 }] },
];
```

- [ ] **Step 2: Export font helpers from P10Display.tsx**

```ts
// Add to P10Display.tsx — export these for reuse in P10Canvas
export { FONT, CHAR_W, CHAR_H, SPACING, CELL_W, textToDots, getChar };
```

- [ ] **Step 3: Run build to verify types compile**

Run: `cd web && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add web/src/components/display/zone-types.ts web/src/components/display/P10Display.tsx
git commit -m "feat(display): add zone types and export font helpers"
```

---

### Task 2: Build color-utils.ts

**Files:**
- Create: `web/src/components/display/color-utils.ts`

- [ ] **Step 1: Create color utilities**

```ts
export function parseHex(hex: string): { r: number; g: number; b: number } | null {
  const m = /^#([0-9a-fA-F]{6})$/.exec(hex);
  if (!m) return null;
  return {
    r: parseInt(m[1].slice(0, 2), 16),
    g: parseInt(m[1].slice(2, 4), 16),
    b: parseInt(m[1].slice(4, 6), 16),
  };
}

export function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map(c => Math.max(0, Math.min(255, c)).toString(16).padStart(2, '0')).join('');
}

export const PRESET_COLORS = [
  '#00FF00', // green (default)
  '#00FFFF', // cyan
  '#FF0000', // red
  '#FFFF00', // yellow
  '#FFFFFF', // white
  '#FF00FF', // magenta
  '#FF8800', // orange
  '#0088FF', // blue
];
```

- [ ] **Step 2: Commit**

```bash
git add web/src/components/display/color-utils.ts
git commit -m "feat(display): add color utilities"
```

---

### Task 3: Build P10Canvas — interactive 3-panel preview

**Files:**
- Create: `web/src/components/display/P10Canvas.tsx`

This is the core component. It renders the 3 panels as an SVG with LED dots, supports selecting zones by clicking, and shows draggable zone dividers.

The canvas renders:
- 3 panels each 32×16 with 1px visual gaps between them (total viewBox 0 0 98 16)
- Per-zone LED dots rendered using the same bitmap font + `textToDots()` as P10Display
- Each zone renders its lines stacked: 2× scale for 1-line zones, 1× scale for 2-line zones
- Click handler on each zone → fires `onZoneSelect(zoneIndex)`
- Zone divider handles at panel boundaries (draggable via @dnd-kit)
- Same visual treatment: scanlines, glare, LED glow filter

```tsx
'use client';

import { useCallback } from 'react';
import { CHAR_W, CHAR_H, SPACING, CELL_W, textToDots, FONT } from './P10Display';
import type { DisplayZone } from './zone-types';

const PANEL_W = 32;
const PANEL_H = 16;
const GAP = 1;
const TOTAL_W = PANEL_W * 3 + GAP * 2; // 98
const CHAR_2X = 2;
const CHAR_1X = 1;

interface Props {
  zones: DisplayZone[];
  selectedZoneIndex: number | null;
  onZoneSelect: (index: number) => void;
  onZoneResize?: (index: number, newPanelEnd: number) => void;
}

function getPanelX(panelIndex: number): number {
  return panelIndex * (PANEL_W + GAP);
}

function renderZoneDots(zone: DisplayZone): { x: number; y: number; color: string }[] {
  const zoneWidth = (zone.panelEnd - zone.panelStart + 1) * PANEL_W;
  const zoneX = getPanelX(zone.panelStart);
  const isTwoLine = zone.lines.length === 2;
  const scale = isTwoLine ? CHAR_1X : CHAR_2X;
  const charH = CHAR_H * scale;
  const lineSpacing = isTwoLine ? 0 : 0;
  const totalTextH = zone.lines.length * charH + (zone.lines.length - 1) * lineSpacing;
  const startY = Math.floor((PANEL_H - totalTextH) / 2);

  const dots: { x: number; y: number; color: string }[] = [];

  zone.lines.forEach((line, li) => {
    const text = line.text.toUpperCase();
    const textW = text.length * CELL_W * scale;
    let xOff: number;
    if (line.effect === 'STATIC' && textW <= zoneWidth) {
      xOff = zoneX + Math.floor((zoneWidth - textW) / 2);
    } else {
      xOff = zoneX; // scroll starts from left edge
    }
    const yOff = startY + li * (charH + (isTwoLine ? 1 : 0));
    const charDots = textToDots(text, 0, 0);
    for (const d of charDots) {
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
    <div className="bg-zinc-800 rounded-lg p-1.5 shadow-2xl"
      style={{ boxShadow: '0 0 30px rgba(0,0,0,0.6), 0 4px 15px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.05)' }}
    >
      <div className="bg-zinc-950 rounded-md p-0.5"
        style={{ boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.5)' }}
      >
        <div className="relative overflow-hidden rounded-sm" style={{ background: '#080806', aspectRatio: '98 / 16' }}>
          <svg viewBox={`0 0 ${TOTAL_W} ${PANEL_H}`} className="w-full h-full block" preserveAspectRatio="xMidYMid meet">
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

            {/* Background */}
            <rect width={TOTAL_W} height={PANEL_H} fill="url(#off-led-canvas)" rx={0.3} />

            {/* Panel gaps */}
            {[1, 2].map(i => (
              <rect key={`gap-${i}`} x={getPanelX(i) - GAP} y={0} width={GAP} height={PANEL_H} fill="#1a1a1a" rx={0.1} />
            ))}

            {/* Grid dots (off LEDs) */}
            {Array.from({ length: PANEL_W * 3 }).flatMap((_, cx) =>
              Array.from({ length: PANEL_H }).map((_, cy) => {
                const panelIdx = Math.floor(cx / PANEL_W);
                const localX = cx % PANEL_W;
                const gx = getPanelX(panelIdx) + localX;
                return (
                  <circle key={`g-${cx}-${cy}`} cx={gx + 0.5} cy={cy + 0.5} r={0.3} fill="#333333" opacity={0.1} />
                );
              })
            )}

            {/* Zone regions (clickable) */}
            {zones.map((zone, zi) => {
              const zx = getPanelX(zone.panelStart);
              const zw = (zone.panelEnd - zone.panelStart + 1) * PANEL_W;
              const isSelected = selectedZoneIndex === zi;
              return (
                <rect
                  key={`zone-${zi}`}
                  x={zx} y={0} width={zw} height={PANEL_H}
                  fill={isSelected ? 'rgba(0, 255, 0, 0.05)' : 'transparent'}
                  stroke={isSelected ? '#00FF00' : 'rgba(255,255,255,0.05)'}
                  strokeWidth={isSelected ? 0.3 : 0.1}
                  rx={0.2}
                  style={{ cursor: 'pointer', transition: 'fill 0.15s' }}
                  onClick={(e) => handleZoneClick(e, zi)}
                />
              );
            })}

            {/* Active LED dots */}
            <g clipPath="url(#canvas-clip)" filter="url(#led-glow-canvas)">
              {allDots.map((d, i) => (
                <circle key={`dot-${i}`} cx={d.x + 0.5} cy={d.y + 0.5} r={0.4} fill={d.color} opacity={0.95} />
              ))}
            </g>

            {/* Scanlines overlay */}
            <rect width={TOTAL_W} height={PANEL_H} fill="url(#scanlines-canvas)" opacity={0.15} pointerEvents="none" />

            {/* Glare overlay */}
            <rect x={0} y={0} width={TOTAL_W} height={PANEL_H * 0.4} fill="url(#glare-canvas)" opacity={0.06} pointerEvents="none" />
          </svg>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 1: Create P10Canvas.tsx with the code above**

- [ ] **Step 2: Verify it compiles**

Run: `cd web && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add web/src/components/display/P10Canvas.tsx
git commit -m "feat(display): add P10Canvas interactive 3-panel preview"
```

---

### Task 4: Build ZonePanel — zone property editor

**Files:**
- Create: `web/src/components/display/ZonePanel.tsx`

A sidebar panel that appears when the user clicks a zone in the canvas. Allows editing:
- Which panels the zone spans (checkboxes P1/P2/P3 — enforces contiguity)
- Number of lines (1 or 2 toggle)
- Per-line: text input (with variable hint), color picker (native input), effect dropdown, shrink toggle

```tsx
'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { PRESET_COLORS } from './color-utils';
import type { DisplayZone, DisplayLine } from './zone-types';

const VARIABLES = [
  '{court_name}', '{match_title}', '{match_type}', '{duration}',
  '{players}', '{timer}', '{elapsed}', '{queue_count}', '{next_name}', '{next_match}',
];

interface Props {
  zone: DisplayZone;
  zoneIndex: number;
  onChange: (zone: DisplayZone) => void;
  onDelete?: () => void;
}

function lineDefault(): DisplayLine {
  return { text: '', color: '#00FF00', effect: 'STATIC' };
}

export function ZonePanel({ zone, zoneIndex, onChange, onDelete }: Props) {
  const panelCount = zone.panelEnd - zone.panelStart + 1;
  const lineCount = zone.lines.length;

  function togglePanel(panelIdx: number) {
    const currentStart = zone.panelStart;
    const currentEnd = zone.panelEnd;
    const currentlyHas = panelIdx >= currentStart && panelIdx <= currentEnd;

    if (currentlyHas) {
      // Removing a panel — shrink zone or distribute panels
      if (panelCount <= 1) return; // can't remove last panel
      if (panelIdx === currentStart) {
        onChange({ ...zone, panelStart: currentStart + 1 });
      } else if (panelIdx === currentEnd) {
        onChange({ ...zone, panelEnd: currentEnd - 1 });
      }
    } else {
      // Adding adjacent panel — expand zone
      if (panelIdx === currentStart - 1) {
        onChange({ ...zone, panelStart: panelIdx });
      } else if (panelIdx === currentEnd + 1) {
        onChange({ ...zone, panelEnd: panelIdx });
      }
    }
  }

  function setLineCount(count: 1 | 2) {
    const lines = [...zone.lines];
    while (lines.length < count) lines.push(lineDefault());
    while (lines.length > count) lines.pop();
    onChange({ ...zone, lines });
  }

  function updateLine(index: number, partial: Partial<DisplayLine>) {
    const lines = zone.lines.map((l, i) => i === index ? { ...l, ...partial } : l);
    onChange({ ...zone, lines });
  }

  return (
    <div className="space-y-4 p-4 bg-zinc-900/50 rounded-lg border border-zinc-800">
      <div className="flex items-center justify-between">
        <Label className="text-zinc-300 font-medium">Zone {zoneIndex + 1}</Label>
        {onDelete && <Button variant="ghost" size="sm" onClick={onDelete} className="text-red-400">Remove</Button>}
      </div>

      {/* Panel assignment */}
      <div className="space-y-1.5">
        <Label className="text-xs text-zinc-500">Covers panels</Label>
        <div className="flex gap-2">
          {[0, 1, 2].map(pi => {
            const selected = pi >= zone.panelStart && pi <= zone.panelEnd;
            return (
              <button
                key={pi}
                onClick={() => togglePanel(pi)}
                className={`px-3 py-1.5 text-xs rounded-md font-medium transition-colors ${
                  selected ? 'bg-zinc-700 text-white' : 'bg-zinc-800 text-zinc-500 hover:text-zinc-300'
                }`}
                title={selected ? `Panel ${pi + 1} — click to remove` : `Panel ${pi + 1} — click to add`}
              >
                P{pi + 1}
              </button>
            );
          })}
        </div>
        <p className="text-xs text-zinc-600">{panelCount} panel{panelCount > 1 ? 's' : ''} ({panelCount * 32}px)</p>
      </div>

      {/* Line count */}
      <div className="space-y-1.5">
        <Label className="text-xs text-zinc-500">Lines</Label>
        <div className="flex gap-2">
          {[1, 2].map(n => (
            <button
              key={n}
              onClick={() => setLineCount(n as 1 | 2)}
              className={`px-3 py-1.5 text-xs rounded-md font-medium transition-colors ${
                lineCount === n ? 'bg-zinc-700 text-white' : 'bg-zinc-800 text-zinc-500 hover:text-zinc-300'
              }`}
            >
              {n} line{n > 1 ? 's' : ''}
            </button>
          ))}
        </div>
      </div>

      {/* Per-line editors */}
      {zone.lines.map((line, li) => (
        <div key={li} className="space-y-2 p-3 bg-zinc-950/50 rounded-md border border-zinc-800/50">
          <Label className="text-xs text-zinc-500">Line {li + 1}</Label>

          {/* Text input */}
          <div className="relative">
            <Input
              value={line.text}
              onChange={e => updateLine(li, { text: e.target.value })}
              placeholder="Enter text..."
              className="font-mono text-xs bg-zinc-950 border-zinc-700 text-zinc-200 pr-8"
            />
            <details className="absolute right-0 top-0 bottom-0 group">
              <summary className="flex items-center justify-center h-full px-2 cursor-pointer text-xs text-zinc-600 hover:text-zinc-400">
                {'{x}'}
              </summary>
              <div className="absolute right-0 top-full mt-1 bg-zinc-900 border border-zinc-700 rounded-md p-1.5 shadow-xl z-10 min-w-[140px]">
                {VARIABLES.map(v => (
                  <button
                    key={v}
                    className="block w-full text-left text-xs text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 px-2 py-1 rounded"
                    onClick={() => updateLine(li, { text: line.text + v })}
                  >
                    {v}
                  </button>
                ))}
              </div>
            </details>
          </div>

          {/* Color */}
          <div className="space-y-1">
            <Label className="text-xs text-zinc-500">Color</Label>
            <div className="flex items-center gap-1.5 flex-wrap">
              {PRESET_COLORS.map(c => (
                <button
                  key={c}
                  onClick={() => updateLine(li, { color: c })}
                  className={`w-5 h-5 rounded-full border-2 transition-all ${
                    line.color === c ? 'border-white scale-110' : 'border-transparent'
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
              <input
                type="color"
                value={line.color}
                onChange={e => updateLine(li, { color: e.target.value })}
                className="w-5 h-5 rounded cursor-pointer border-0 p-0 bg-transparent"
              />
            </div>
          </div>

          {/* Effect */}
          <div className="space-y-1">
            <Label className="text-xs text-zinc-500">Effect</Label>
            <Select value={line.effect} onValueChange={v => updateLine(li, { effect: v as DisplayLine['effect'] })}>
              <SelectTrigger className="h-7 text-xs bg-zinc-950 border-zinc-700 text-zinc-200">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="STATIC">Static (center)</SelectItem>
                <SelectItem value="SCROLL">Scroll</SelectItem>
                <SelectItem value="BLINK">Blink</SelectItem>
                <SelectItem value="paginate">Paginate</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 1: Create ZonePanel.tsx with the code above**

- [ ] **Step 2: Verify it compiles**

Run: `cd web && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add web/src/components/display/ZonePanel.tsx
git commit -m "feat(display): add ZonePanel zone property editor"
```

---

### Task 5: Build PageToolbar

**Files:**
- Create: `web/src/components/display/PageToolbar.tsx`

```tsx
'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface Props {
  pageCount: number;
  currentPage: number;
  durationSeconds: number;
  onPageSelect: (index: number) => void;
  onAddPage: () => void;
  onRemovePage: () => void;
  onDurationChange: (seconds: number) => void;
}

export function PageToolbar({ pageCount, currentPage, durationSeconds, onPageSelect, onAddPage, onRemovePage, onDurationChange }: Props) {
  return (
    <div className="flex items-center gap-3 py-2">
      <span className="text-xs text-zinc-500">Pages:</span>
      <div className="flex gap-1">
        {Array.from({ length: pageCount }).map((_, i) => (
          <button
            key={i}
            onClick={() => onPageSelect(i)}
            className={`w-6 h-6 text-xs rounded-full font-medium transition-colors ${
              i === currentPage ? 'bg-zinc-700 text-white' : 'bg-zinc-800 text-zinc-500 hover:text-zinc-300'
            }`}
          >
            {i + 1}
          </button>
        ))}
      </div>
      <Button variant="outline" size="sm" onClick={onAddPage} className="h-6 px-2 text-xs">+</Button>
      {pageCount > 1 && (
        <Button variant="outline" size="sm" onClick={onRemovePage} className="h-6 px-2 text-xs text-red-400">×</Button>
      )}
      <div className="ml-auto flex items-center gap-2">
        <span className="text-xs text-zinc-500">Duration:</span>
        <Input
          type="number"
          min={2}
          max={60}
          value={durationSeconds}
          onChange={e => onDurationChange(Math.max(2, parseInt(e.target.value) || 10))}
          className="w-14 h-6 text-xs text-center bg-zinc-950 border-zinc-700 text-zinc-200"
        />
        <span className="text-xs text-zinc-600">s</span>
      </div>
    </div>
  );
}
```

- [ ] **Step 1: Create PageToolbar.tsx**

- [ ] **Step 2: Verify compile**

Run: `cd web && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add web/src/components/display/PageToolbar.tsx
git commit -m "feat(display): add PageToolbar navigation component"
```

---

### Task 6: Build TemplateDropdown

**Files:**
- Create: `web/src/components/display/TemplateDropdown.tsx`

```tsx
'use client';

import { Button } from '@/components/ui/button';
import { ZONE_TEMPLATES, type ZoneTemplate } from './zone-types';

interface Props {
  onSelect: (template: ZoneTemplate) => void;
}

export function TemplateDropdown({ onSelect }: Props) {
  return (
    <div className="relative group">
      <Button variant="outline" size="sm" className="text-xs h-7">
        Templates ▼
      </Button>
      <div className="absolute left-0 top-full mt-1 bg-zinc-900 border border-zinc-700 rounded-md shadow-xl z-10 min-w-[200px] hidden group-hover:block">
        {ZONE_TEMPLATES.map(t => (
          <button
            key={t.name}
            onClick={() => onSelect(t)}
            className="block w-full text-left px-3 py-2 text-xs text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 first:rounded-t-md last:rounded-b-md"
          >
            <span className="font-medium text-zinc-300">{t.name}</span>
            <span className="block text-zinc-600">{t.description}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 1: Create TemplateDropdown.tsx**

- [ ] **Step 2: Commit**

```bash
git add web/src/components/display/TemplateDropdown.tsx
git commit -m "feat(display): add TemplateDropdown with zone layout presets"
```

---

### Task 7: Rebuild DisplaySequenceEditor — the main integration

**Files:**
- Create: `web/src/components/display/DisplaySequenceEditorV2.tsx`

This is the main component that replaces the old `DisplaySequenceEditor` entirely. It:

1. Accepts the raw JSON string (same prop `sequence: string`)
2. Parses the old format on init, converting to the new zone model if needed
3. Manages section state (idle/prep/game), page state, zone state
4. Renders: SectionTabs, P10Canvas, ZonePanel, PageToolbar, TemplateDropdown, Save
5. Serializes back to JSON on save

```tsx
'use client';

import { useState, useMemo, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { P10Canvas } from './P10Canvas';
import { ZonePanel } from './ZonePanel';
import { PageToolbar } from './PageToolbar';
import { TemplateDropdown } from './TemplateDropdown';
import { ZONE_TEMPLATES, type ZoneTemplate } from './zone-types';
import type { DisplayZone, DisplayLine, ZonePage } from './zone-types';

interface SectionState {
  interval: number;
  pages: ZonePage[];
}

type SectionKey = 'idle' | 'prep' | 'game';
const SECTIONS: SectionKey[] = ['idle', 'prep', 'game'];

const DEFAULTS: string = JSON.stringify({
  idle: { interval: 10, pages: [{ durationSeconds: 10, zones: [{ panelStart: 0, panelEnd: 2, lines: [{ text: '{court_name}', color: '#00FF00', effect: 'STATIC' }] }] }] },
  prep: { interval: 10, pages: [{ durationSeconds: 10, zones: [{ panelStart: 0, panelEnd: 2, lines: [{ text: '{match_title}', color: '#00FFFF', effect: 'SCROLL' }] }] }] },
  game: { interval: 10, pages: [{ durationSeconds: 10, zones: [{ panelStart: 0, panelEnd: 1, lines: [{ text: 'NOW PLAYING', color: '#00FF00', effect: 'STATIC' }, { text: '{match_title}', color: '#FFFFFF', effect: 'SCROLL' }] }, { panelStart: 2, panelEnd: 2, lines: [{ text: '{timer}', color: '#00FFFF', effect: 'STATIC' }] }] }] },
}, null, 2);

interface Props {
  sequence: string;
}

function parseSequence(raw: string): Record<SectionKey, SectionState> {
  try {
    const parsed = JSON.parse(raw);
    const sections: Record<SectionKey, SectionState> = {} as any;
    for (const key of SECTIONS) {
      const s = parsed[key];
      if (!s) throw new Error('Missing section');
      const pages: ZonePage[] = (s.pages || []).map((p: any) => {
        if (p.zones) {
          return {
            durationSeconds: p.durationSeconds ?? s.interval ?? 10,
            zones: p.zones.map((z: any) => ({
              panelStart: z.panelStart ?? 0,
              panelEnd: z.panelEnd ?? 2,
              lines: (z.lines || [{ text: z.text || '', color: z.color || '#00FF00', effect: z.effect || 'STATIC' }]).map((l: any) => ({
                text: l.text ?? '',
                color: l.color ?? '#00FF00',
                effect: l.effect ?? 'STATIC',
              })),
            })),
          };
        }
        // Legacy flat format → single zone
        return {
          durationSeconds: p.durationSeconds ?? s.interval ?? 10,
          zones: [{
            panelStart: 0,
            panelEnd: 2,
            lines: [{ text: p.text ?? p.line1 ?? '', color: p.color ?? '#00FF00', effect: p.effect ?? 'SCROLL' }],
          }],
        };
      });
      sections[key] = { interval: s.interval ?? 10, pages };
    }
    return sections;
  } catch {
    return parseSequence(DEFAULTS);
  }
}

function serializeSequence(sections: Record<SectionKey, SectionState>): string {
  const obj: Record<string, any> = {};
  for (const key of SECTIONS) {
    obj[key] = {
      interval: sections[key].interval,
      pages: sections[key].pages.map(p => ({
        durationSeconds: p.durationSeconds,
        zones: p.zones.map(z => ({
          panelStart: z.panelStart,
          panelEnd: z.panelEnd,
          lines: z.lines,
        })),
      })),
    };
  }
  return JSON.stringify(obj, null, 2);
}

export function DisplaySequenceEditorV2({ sequence: initial }: Props) {
  const [sections, setSections] = useState<Record<SectionKey, SectionState>>(() => parseSequence(initial));
  const [activeSection, setActiveSection] = useState<SectionKey>('idle');
  const [currentPage, setCurrentPage] = useState(0);
  const [selectedZone, setSelectedZone] = useState<number | null>(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const section = sections[activeSection];
  const page = section.pages[currentPage] || section.pages[0];
  const zones = page?.zones || [];

  function updateSection(updater: (s: SectionState) => SectionState) {
    setSections(prev => ({ ...prev, [activeSection]: updater(prev[activeSection]) }));
  }

  const handleZoneChange = useCallback((index: number, updated: DisplayZone) => {
    updateSection(s => ({
      ...s,
      pages: s.pages.map((p, pi) => pi === currentPage ? { ...p, zones: p.zones.map((z, zi) => zi === index ? updated : z) } : p),
    }));
  }, [currentPage]);

  const applyTemplate = useCallback((tpl: ZoneTemplate) => {
    updateSection(s => {
      const newZones = tpl.zones.map(z => ({
        panelStart: z.panelStart,
        panelEnd: z.panelEnd,
        lines: Array.from({ length: z.lines }, () => ({ text: '', color: '#00FF00', effect: 'STATIC' as const })),
      }));
      return {
        ...s,
        pages: s.pages.map((p, pi) => pi === currentPage ? { ...p, zones: newZones } : p),
      };
    });
    setSelectedZone(0);
  }, [currentPage]);

  async function handleSave() {
    setError(null);
    setSaving(true);
    try {
      const json = serializeSequence(sections);
      JSON.parse(json); // validate
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'displaySequence', value: json }),
      });
      if (!res.ok) throw new Error('Save failed');
    } catch (e: any) {
      setError(e.message);
    }
    setSaving(false);
  }

  return (
    <div className="space-y-4">
      {/* Section tabs */}
      <div className="flex items-center gap-1 border-b border-zinc-800 pb-2">
        {SECTIONS.map(s => (
          <button
            key={s}
            onClick={() => { setActiveSection(s); setCurrentPage(0); setSelectedZone(0); }}
            className={`px-3 py-1 text-xs rounded-md font-medium transition-colors ${
              activeSection === s ? 'bg-zinc-700 text-white' : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            {s}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-2">
          <TemplateDropdown onSelect={applyTemplate} />
          <Button onClick={handleSave} disabled={saving} size="sm" className="h-7 text-xs">
            {saving ? 'Saving...' : 'Save Sequence'}
          </Button>
        </div>
      </div>

      {error && <p className="text-xs text-red-400">{error}</p>}

      {/* Page navigation */}
      <PageToolbar
        pageCount={section.pages.length}
        currentPage={currentPage}
        durationSeconds={page?.durationSeconds ?? 10}
        onPageSelect={i => { setCurrentPage(i); setSelectedZone(0); }}
        onAddPage={() => {
          updateSection(s => ({
            ...s,
            pages: [...s.pages, { durationSeconds: s.interval, zones: [{ panelStart: 0, panelEnd: 2, lines: [{ text: '', color: '#00FF00', effect: 'STATIC' }] }] }],
          }));
        }}
        onRemovePage={() => {
          if (section.pages.length <= 1) return;
          updateSection(s => ({
            ...s,
            pages: s.pages.filter((_, i) => i !== currentPage),
          }));
          setCurrentPage(prev => Math.min(prev, section.pages.length - 2));
        }}
        onDurationChange={sec => {
          updateSection(s => ({
            ...s,
            pages: s.pages.map((p, i) => i === currentPage ? { ...p, durationSeconds: sec } : p),
          }));
        }}
      />

      {/* Main workspace */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="xl:col-span-2">
          <P10Canvas
            zones={zones}
            selectedZoneIndex={selectedZone}
            onZoneSelect={setSelectedZone}
          />
          {zones.length === 0 && (
            <p className="text-xs text-zinc-500 mt-2">No zones defined. Use a template or add zones manually.</p>
          )}
        </div>
        <div className="space-y-3">
          {selectedZone !== null && zones[selectedZone] && (
            <ZonePanel
              zone={zones[selectedZone]}
              zoneIndex={selectedZone}
              onChange={z => handleZoneChange(selectedZone, z)}
            />
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 1: Create DisplaySequenceEditorV2.tsx**

- [ ] **Step 2: Verify compile**

Run: `cd web && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add web/src/components/display/DisplaySequenceEditorV2.tsx
git commit -m "feat(display): add DisplaySequenceEditorV2 visual designer"
```

---

### Task 8: Wire up the new editor — replace old

**Files:**
- Modify: `web/src/features/settings/components/DisplaySequenceEditor.tsx`

- [ ] **Step 1: Replace entire DisplaySequenceEditor.tsx content**

Simply re-export the new component:
```ts
'use client';
export { DisplaySequenceEditorV2 as DisplaySequenceEditor } from '@/components/display/DisplaySequenceEditorV2';
```

- [ ] **Step 2: Verify compile**

Run: `cd web && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Verify build**

Run: `cd web && npm run build`
Expected: Build succeeds

- [ ] **Step 4: Commit**

```bash
git add web/src/features/settings/components/DisplaySequenceEditor.tsx
git commit -m "feat(display): wire up new visual designer, replace old editor"
```

---

### Task 9: Run test suite

- [ ] **Step 1: Run existing tests to verify no regressions**

Run: `cd web && npx vitest run`
Expected: Existing tests pass (known 3 esp32.test.ts failures unrelated)

- [ ] **Step 2: Commit if any fixes needed**

---

## Spec Coverage Check

| Spec Requirement | Task |
|-----------------|------|
| Zone types (panelStart/End, lines, effects) | Task 1 |
| 3-panel interactive preview | Task 3 (P10Canvas) |
| Click zone to select | Task 3 (onZoneSelect) |
| Zone property editor (panel assignment, lines, color, effect) | Task 4 |
| Page navigation (add/remove, duration) | Task 5 |
| Zone layout templates | Task 6 |
| Section tabs (idle/prep/game) | Task 7 |
| Backward compat (old flat format → single zone) | Task 7 (parseSequence) |
| Save to API | Task 7 (handleSave) |
| Replace old editor transparently | Task 8 |
