# Display Sub-Pages, BG Color & Space Width — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the `paginate` effect with per-line sub-pages, add background color per sub-page, reduce space width to 2 dots, fix line 2 scale, and publish after save.

**Architecture:** Each line gets a `subpages[]` array replacing the single text/color/effect. Lines independently cycle through sub-pages at their own ms-level pace. Page-level timer still controls page advancement. Background color renders as a filled rectangle behind the text at its exact position. Space character advances by 0 (gap = standard SPACING only). Server passes subpages through without paginate expansion. Firmware handles cycling in `update()`.

**Tech Stack:** TypeScript (Next.js), C++ (ESP32 PlatformIO), MQTT

---

## File Structure

| File | Change |
|---|---|
| `web/src/components/display/zone-types.ts` | Add `SubPage` interface, update `DisplayLine` |
| `web/src/lib/mqtt.ts` | Update `DisplayPage` line type with `subpages` / backward compat |
| `web/src/lib/display/sports-caster.ts` | Remove paginate expansion, pass subpages through, fix textWidthPx for space |
| `web/src/lib/display/sports-caster.test.ts` | Update textWidthPx test, update/remove paginateWords tests |
| `web/src/components/display/DisplaySequenceEditorV2.tsx` | Backward compat on load, publish after save |
| `web/src/components/display/ZonePanel.tsx` | Sub-page list editor with bgColor |
| `web/src/components/display/P10Display.tsx` | space fix in textToDots, bgColor rendering |
| `web/src/components/display/P10Canvas.tsx` | space fix in textWidthPx, sub-page preview, bgColor |
| `web/src/components/display/P10Canvas.test.ts` | Update textWidthPx expected values, add bgColor tests |
| `display-firmware/src/MqttDisplayClient.h` | SubPage struct, update ZoneLine, add _subpageIdx / _lastSubChange |
| `display-firmware/src/MqttDisplayClient.cpp` | Parser, update() cycling, applyCurrentPage() sub-page resolution |
| `display-firmware/src/Hub75Driver.h` | Update LineRenderInfo (bgColor) |
| `display-firmware/src/Hub75Driver.cpp` | redraw(): bgColor, space width, per-line scale, sub-page text source |

---

### Task 1: Types

**Files:**
- Modify: `web/src/components/display/zone-types.ts`
- Modify: `web/src/lib/mqtt.ts`

- [ ] **Step 1: Add SubPage interface and update DisplayLine in zone-types.ts**

Replace the entire file:
```typescript
export interface SubPage {
  text: string;
  effect: 'SCROLL' | 'STATIC' | 'BLINK';
  color: string;
  bgColor?: string;
  align?: 'left' | 'center' | 'right';
  scrollSpeed?: number;
  durationMs: number;
}

export interface DisplayLine {
  subpages: SubPage[];
  marginTop?: number;
  marginBottom?: number;
}

export interface DisplayZone {
  panelStart: number;
  panelEnd: number;
  lines: DisplayLine[];
  borderRows?: { start: number; end: number }[];
  scale?: number;
  valign?: 'top' | 'middle' | 'bottom';
}

export interface ZonePage {
  durationSeconds: number;
  zones: DisplayZone[];
}

export interface DisplaySequenceConfig {
  idle: { interval: number; pages: ZonePage[] };
  prep: { interval: number; pages: ZonePage[] };
  game: { interval: number; pages: ZonePage[] };
}

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

- [ ] **Step 2: Update DisplayPage line type in mqtt.ts**

The `lines` entry in `DisplayPage.zones` needs to accept both old format (for backward compat on receive) and new format:
```typescript
lines: {
  subpages?: { text: string; color: string; effect: string; align?: string; scrollSpeed?: number; durationMs: number; bgColor?: string }[];
  text?: string;  // legacy compat
  color?: string;
  effect?: string;
  marginTop?: number;
  marginBottom?: number;
  align?: string;
  scrollSpeed?: number;
}[];
```

Don't change `DisplayPage` itself — this is the MQTT wire format. The subpages will be sent as an array inside each line object.

- [ ] **Step 3: Commit**

```bash
git add web/src/components/display/zone-types.ts web/src/lib/mqtt.ts
git commit -m "feat: add SubPage type, update DisplayLine for sub-pages"
```

---

### Task 2: Sports-caster — remove paginate, pass subpages through, fix space width

**Files:**
- Modify: `web/src/lib/display/sports-caster.ts`
- Modify: `web/src/lib/display/sports-caster.test.ts`

- [ ] **Step 1: Fix `textWidthPx` to skip SPACING before space**

Before fix:
```typescript
function textWidthPx(text: string, scale: number) {
  let w = 0;
  let first = true;
  for (let i = 0; i < text.length; i++) {
    if (!first) w += SPACING * scale;
    w += text[i] === ' ' ? 0 : CHAR_W * scale;
    first = false;
  }
  return w;
}
```

After fix — skip the pre-gap when char is space:
```typescript
function textWidthPx(text: string, scale: number) {
  let w = 0;
  let first = true;
  for (let i = 0; i < text.length; i++) {
    if (!first) w += SPACING * scale;
    if (text[i] !== ' ') w += CHAR_W * scale;
    first = text[i] === ' ' ? first : false; // space doesn't consume a "first" slot
  }
  return w;
}
```

Now "A B" at scale 1 = 5 ('A') + 0 (space, no pre-gap since we keep first=true) + 1 (SPACING before B) + 5 ('B') = 11.

- [ ] **Step 2: Remove `paginateWords` function entirely**

Delete lines 61-86 (the `paginateWords` function).

- [ ] **Step 3: Update `generatePayload` — handle subpages, remove paginate expansion**

Replace the zoned page handling (lines 157-210). The key changes:
- Read `line.subpages` from each line (if present; else convert single text/color/effect to one sub-page)
- No more `paginateWords()` calls
- No more `maxChunks` tracking across zones
- Each output `DisplayPage` maps 1:1 from template pages (no paginate expansion)
- Each line's subpages pass through directly with `durationMs`

New zoned page logic (replace lines 157-210):
```typescript
for (const tpl of section.pages) {
  if (tpl.zones) {
    const mappedZones = tpl.zones.map(zone => {
      const zoneW = (zone.panelEnd - zone.panelStart + 1) * 32;
      return {
        panelStart: zone.panelStart,
        panelEnd: zone.panelEnd,
        ...(zone.borderRows && zone.borderRows.length > 0 ? { borderRows: zone.borderRows } : {}),
        ...(zone.scale ? { scale: zone.scale } : {}),
        ...(zone.valign && zone.valign !== 'middle' ? { valign: zone.valign } : {}),
        lines: zone.lines.map(line => {
          let subpages: SubPagePayload[];
          if ((line as any).subpages) {
            subpages = (line as any).subpages.map((sp: any) => ({
              text: substituteVars(sp.text, subVars),
              color: sp.color || defaultColor,
              effect: sp.effect === 'paginate' ? 'STATIC' : (sp.effect || 'STATIC'),
              ...(sp.bgColor ? { bgColor: sp.bgColor } : {}),
              ...(sp.align && sp.align !== 'center' ? { align: sp.align } : {}),
              ...(sp.scrollSpeed != null && sp.scrollSpeed !== 1 ? { scrollSpeed: sp.scrollSpeed } : {}),
              durationMs: sp.durationMs || 5000,
            }));
          } else {
            const rawText = substituteVars(line.text, subVars);
            const eff = line.effect || 'STATIC';
            subpages = [{
              text: rawText,
              color: line.color || defaultColor,
              effect: eff === 'paginate' ? 'STATIC' : eff,
              ...(line.align && line.align !== 'center' ? { align: line.align } : {}),
              ...(line.scrollSpeed != null && line.scrollSpeed !== 1 ? { scrollSpeed: line.scrollSpeed } : {}),
              durationMs: (tpl.durationSeconds ?? section.interval) * 1000,
            }];
          }
          return {
            subpages,
            ...(line.marginTop != null && line.marginTop !== 0 ? { marginTop: line.marginTop } : {}),
            ...(line.marginBottom != null && line.marginBottom !== 2 ? { marginBottom: line.marginBottom } : {}),
          };
        }),
      };
    });

    pages.push({
      zones: mappedZones,
      durationSeconds: tpl.durationSeconds ?? section.interval,
    });
  } else {
    // flat page (no zones) — backward compat only
    const raw = tpl.text ?? tpl.line1 ?? '';
    const text = substituteVars(raw, subVars);
    pages.push({
      text,
      color: tpl.color ?? defaultColor,
      effect: (tpl.effect === 'paginate' ? 'SCROLL' : (tpl.effect as any)) ?? 'SCROLL',
      durationSeconds: tpl.durationSeconds ?? section.interval,
    });
  }
}
```

Add a local type at top of file or inline:
```typescript
interface SubPagePayload {
  text: string;
  color: string;
  effect: string;
  bgColor?: string;
  align?: string;
  scrollSpeed?: number;
  durationMs: number;
}
```

- [ ] **Step 4: Update tests**

In `sports-caster.test.ts`:
- Update `textWidthPx('A B', 1)` expectation from 12 → 11 (space fix)
- Remove any paginateWord tests or update them

If there are tests for paginate expansion in generatePayload, update them to expect a single page with subpages array instead of multiple pages.

- [ ] **Step 5: Commit**

```bash
git add web/src/lib/display/sports-caster.ts web/src/lib/display/sports-caster.test.ts
git commit -m "feat: remove paginateWords, pass subpages through, fix space width in textWidthPx"
```

---

### Task 3: Editor — ZonePanel sub-page list

**Files:**
- Modify: `web/src/components/display/ZonePanel.tsx`

- [ ] **Step 1: Replace line text input with sub-page list editor**

Key changes in `ZonePanel.tsx`:

Replace `lineDefault()`:
```typescript
function subpageDefault(): import('./zone-types').SubPage {
  return { text: '', color: '#00FF00', effect: 'STATIC', durationMs: 5000 };
}
```

Replace the `zone.lines.map((line, li) => ...)` section (lines 222-345). Each line now shows:
- Sub-page list: each sub-page has text input, effect dropdown, color picker, bgColor picker, align buttons, scrollSpeed, durationMs input
- Add sub-page button
- Remove sub-page button (only if > 1 sub-page)

Inside `updateLine`, update signature to accept `subpages`:
```typescript
function updateLine(index: number, subpages: SubPage[]) {
  const lines = zone.lines.map((l, i) => (i === index ? { ...l, subpages } : l));
  onChange({ ...zone, lines });
}
```

The sub-page editor section (inside the line's div):
```tsx
{zone.lines[li].subpages.map((sp, spi) => (
  <div key={spi} className="space-y-2 p-3 bg-zinc-900/50 rounded border border-zinc-700/50">
    <div className="flex items-center justify-between">
      <Label className="text-xs text-zinc-500">Sub-page {spi + 1}</Label>
      {zone.lines[li].subpages.length > 1 && (
        <button
          onClick={() => updateLine(li, zone.lines[li].subpages.filter((_, i) => i !== spi))}
          className="text-xs text-red-500 hover:text-red-400"
        >
          Remove
        </button>
      )}
    </div>
    <Input
      value={sp.text}
      onChange={e => {
        const subs = [...zone.lines[li].subpages];
        subs[spi] = { ...subs[spi], text: e.target.value };
        updateLine(li, subs);
      }}
      placeholder="Enter text..."
      className="font-mono text-xs bg-zinc-950 border-zinc-700 text-zinc-200"
    />
    <div className="flex gap-2 items-center">
      <div className="space-y-1 flex-1">
        <Label className="text-xs text-zinc-500">Effect</Label>
        <Select value={sp.effect} onValueChange={v => {
          const subs = [...zone.lines[li].subpages];
          subs[spi] = { ...subs[spi], effect: v as SubPage['effect'] };
          updateLine(li, subs);
        }}>
          <SelectTrigger className="h-7 text-xs bg-zinc-950 border-zinc-700 text-zinc-200">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="STATIC">Static (center)</SelectItem>
            <SelectItem value="SCROLL">Scroll</SelectItem>
            <SelectItem value="BLINK">Blink</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <Label className="text-xs text-zinc-500">Color</Label>
        <input type="color" value={sp.color}
          onChange={e => {
            const subs = [...zone.lines[li].subpages];
            subs[spi] = { ...subs[spi], color: e.target.value };
            updateLine(li, subs);
          }}
          className="w-7 h-7 rounded cursor-pointer border-0 p-0 bg-transparent"
        />
      </div>
      <div className="space-y-1">
        <Label className="text-xs text-zinc-500">BG</Label>
        <input type="color" value={sp.bgColor || '#000000'}
          onChange={e => {
            const subs = [...zone.lines[li].subpages];
            subs[spi] = { ...subs[spi], bgColor: e.target.value === '#000000' ? undefined : e.target.value };
            updateLine(li, subs);
          }}
          className="w-7 h-7 rounded cursor-pointer border-0 p-0 bg-transparent"
        />
      </div>
    </div>
    <div className="space-y-1">
      <Label className="text-xs text-zinc-500">Duration (ms)</Label>
      <Input type="number" min={100} max={60000} step={100}
        value={sp.durationMs}
        onChange={e => {
          const subs = [...zone.lines[li].subpages];
          subs[spi] = { ...subs[spi], durationMs: Math.max(100, Math.min(60000, Number(e.target.value))) };
          updateLine(li, subs);
        }}
        className="w-20 h-7 text-xs bg-zinc-950 border-zinc-700 text-zinc-200"
      />
    </div>
    {sp.effect === 'SCROLL' && (
      <div className="space-y-1">
        <Label className="text-xs text-zinc-500">Scroll Speed</Label>
        <Input type="number" min={0.5} max={5} step={0.5}
          value={sp.scrollSpeed ?? 1}
          onChange={e => {
            const subs = [...zone.lines[li].subpages];
            subs[spi] = { ...subs[spi], scrollSpeed: Math.max(0.5, Math.min(5, Number(e.target.value))) };
            updateLine(li, subs);
          }}
          className="w-16 h-7 text-xs bg-zinc-950 border-zinc-700 text-zinc-200"
        />
      </div>
    )}
    <div className="space-y-1">
      <Label className="text-xs text-zinc-500">H Align</Label>
      <div className="flex gap-1">
        {(['left', 'center', 'right'] as const).map(a => (
          <button key={a}
            onClick={() => {
              const subs = [...zone.lines[li].subpages];
              subs[spi] = { ...subs[spi], align: a };
              updateLine(li, subs);
            }}
            className={`px-2 py-1 text-xs rounded font-medium transition-colors ${
              (sp.align || 'center') === a ? 'bg-zinc-700 text-white' : 'bg-zinc-800 text-zinc-500 hover:text-zinc-300'
            }`}
          >
            {a.charAt(0).toUpperCase() + a.slice(1)}
          </button>
        ))}
      </div>
    </div>
  </div>
))}
<Button variant="outline" size="sm" onClick={() => {
  updateLine(li, [...zone.lines[li].subpages, subpageDefault()]);
}} className="text-xs">
  + Add Sub-page
</Button>
```

Remove the old line-level text/color/effect/align/scrollSpeed controls (they're now per sub-page).

Keep the margins section unchanged per line.

- [ ] **Step 2: Commit**

```bash
git add web/src/components/display/ZonePanel.tsx
git commit -m "feat: sub-page list editor with bgColor in ZonePanel"
```

---

### Task 4: Editor — backward compat and publish after save

**Files:**
- Modify: `web/src/components/display/DisplaySequenceEditorV2.tsx`

- [ ] **Step 1: Add backward compat on load**

In the sequence loading code (where `rows[0]?.value` is parsed), add conversion from old format to new format:

```typescript
function convertLineToSubpages(line: any): any {
  if (line.subpages) return line;  // already new format
  return {
    ...line,
    subpages: [{
      text: line.text || '',
      color: line.color || '#00FF00',
      effect: line.effect || 'STATIC',
      ...(line.align ? { align: line.align } : {}),
      ...(line.scrollSpeed != null ? { scrollSpeed: line.scrollSpeed } : {}),
      durationMs: 5000,
    }],
  };
}

function convertZoneToNewFormat(zone: any): any {
  return {
    ...zone,
    lines: (zone.lines || []).map(convertLineToSubpages),
  };
}

function convertPageToNewFormat(page: any): any {
  if (!page.zones) return page;  // flat page — skip
  return {
    ...page,
    zones: (page.zones || []).map(convertZoneToNewFormat),
  };
}

// Use when parsing the saved sequence:
const parsed = JSON.parse(jsonStr);
for (const section of ['idle', 'prep', 'game']) {
  if (parsed[section]) {
    parsed[section].pages = (parsed[section].pages || []).map(convertPageToNewFormat);
  }
}
```

- [ ] **Step 2: Add publish after save**

In `handleSave`, after the save fetch succeeds:
```typescript
const res = await fetch('/api/settings', {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ key: 'displaySequence', value: json }),
});
if (!res.ok) throw new Error('Save failed');

// Publish updated sequence to all displays
try {
  await fetch('/api/display/publish-all', { method: 'POST' });
} catch {
  // non-critical — don't show error
}
```

- [ ] **Step 3: Commit**

```bash
git add web/src/components/display/DisplaySequenceEditorV2.tsx
git commit -m "feat: backward compat for sub-pages, publish after save"
```

---

### Task 5: Web preview — P10Canvas

**Files:**
- Modify: `web/src/components/display/P10Canvas.tsx`
- Modify: `web/src/components/display/P10Canvas.test.ts`

- [ ] **Step 1: Fix `textWidthPx` for space width**

Same fix as sports-caster.ts — skip pre-gap for space character:
```typescript
export function textWidthPx(text: string, scale: number): number {
  let w = 0;
  let first = true;
  for (let i = 0; i < text.length; i++) {
    if (!first) w += SPACING * scale;
    if (text[i] !== ' ') w += CHAR_W * scale;
    first = text[i] === ' ' ? first : false;
  }
  return w;
}
```

- [ ] **Step 2: Remove `paginateWords` import and usage**

Remove `paginateWords` from the import statement. Remove the paginate handling in the canvas rendering (lines 132-137 where `paginateWords` was called).

Replace with sub-page cycling using the same tick approach:
```typescript
// In the rendering loop, for each zone's lines:
const subpages = line.subpages || [{ text: line.text, color: line.color, effect: line.effect, durationMs: 5000 }];
let currentSpIdx = 0;
// Determine current sub-page based on tick and cumulative durations
let elapsed = Math.floor(currentTick / 30) * 50; // ms elapsed
let acc = 0;
for (let si = 0; si < subpages.length; si++) {
  acc += subpages[si].durationMs;
  if (elapsed < acc) { currentSpIdx = si; break; }
}
const sp = subpages[currentSpIdx % subpages.length];
```

Actually, simpler: just use Math.floor(tick / N) % subpages.length where N is set so each sub-page gets its proportional time. More robust: track running duration per sub-page.

For the preview canvas (browser, approx), a simple approach:
```typescript
// state at module level
let _spAccum: Record<string, number> = {};

function getSubPageIndex(subpages: SubPage[], zoneKey: string, lineIdx: number): number {
  const key = `${zoneKey}-${lineIdx}`;
  if (!_spAccum[key]) _spAccum[key] = 0;
  _spAccum[key] += 50; // tick interval
  let elapsed = _spAccum[key];
  for (let i = 0; i < subpages.length; i++) {
    if (elapsed < subpages[i].durationMs) return i;
    elapsed -= subpages[i].durationMs;
  }
  _spAccum[key] = 0;
  return 0;
}
```

- [ ] **Step 3: Render bgColor in canvas**

Before drawing text dots, fill a rectangle:
```typescript
if (sp.bgColor) {
  ctx.fillStyle = sp.bgColor;
  ctx.fillRect(x, y, textWidthPx(sp.text, scale), CHAR_H * scale);
}
```

- [ ] **Step 4: Update tests**

Update `textWidthPx('A B', 1)` test from 12 → 11.
Remove paginateWords tests.

- [ ] **Step 5: Commit**

```bash
git add web/src/components/display/P10Canvas.tsx web/src/components/display/P10Canvas.test.ts
git commit -m "feat: sub-page preview, bgColor, space fix in P10Canvas"
```

---

### Task 6: Web preview — P10Display

**Files:**
- Modify: `web/src/components/display/P10Display.tsx`

- [ ] **Step 1: Fix `textToDots` space width**

In `textToDots`, change space handling:
```typescript
if (ch === ' ') { continue; } // space advances by 0
```

And in `textWidth`, same fix as textWidthPx:
```typescript
function textWidth(text: string): number {
  let w = 0;
  let first = true;
  for (const ch of text) {
    if (!first) w += SPACING;
    if (ch !== ' ') w += CHAR_W;
    first = ch === ' ' ? first : false;
  }
  return w;
}
```

- [ ] **Step 2: Add bgColor to textToDots**

Add an optional parameter:
```typescript
export function textToDots(text: string, offsetX = 0, offsetY = 0, bgColor?: string): { x: number; y: number; color?: string }[] {
```
Return bgColor dots (as color entries) before text dots.

Actually, `textToDots` returns `{x, y}[]` (no color). For bgColor, emit all dots in the text rectangle with a special marker. Or simpler: add a separate `bgColor` param to the rendering component.

Simpler approach: don't modify `textToDots`. Instead, in `P10Display.tsx`'s SVG renderer, draw the bgColor rectangle before calling textToDots. This keeps the function's interface clean.

- [ ] **Step 3: Commit**

```bash
git add web/src/components/display/P10Display.tsx
git commit -m "fix: space width to 2 dots in P10Display textToDots"
```

---

### Task 7: Firmware structs — MqttDisplayClient.h

**Files:**
- Modify: `display-firmware/src/MqttDisplayClient.h`

- [ ] **Step 1: Add SubPage struct and update ZoneLine**

Replace existing header structs (lines 11-36):

```cpp
struct SubPage {
  std::string text;
  std::string color;
  std::string bgColor;    // hex string "" = transparent
  std::string effect;
  std::string align;
  float scrollSpeed;
  uint16_t durationMs;     // ms-level duration
};

struct ZoneLine {
  std::vector<SubPage> subpages;  // replaces text/color/effect/align/scrollSpeed
  uint8_t marginTop;
  uint8_t marginBottom;
};

struct DisplayZone {
  uint8_t panelStart;
  uint8_t panelEnd;
  ZoneLine lines[2];
  uint8_t lineCount;
  uint8_t borderCount;
  uint8_t scale;
  std::string valign;
  BorderRange borderRanges[4];
};

struct DisplayPage {
  DisplayZone zones[3];
  uint8_t zoneCount;
  uint16_t durationSeconds;
};
```

Add member variables to the class (in private section, alongside `_playlist`):
```cpp
uint8_t _subpageIdx[3][2];          // per-zone, per-line current sub-page index
unsigned long _lastSubChange[3][2];  // ms timestamp of last sub-page advance
```

- [ ] **Step 2: Commit**

```bash
git add display-firmware/src/MqttDisplayClient.h
git commit -m "feat: SubPage struct, update ZoneLine, add _subpageIdx tracking"
```

---

### Task 8: Firmware — MqttDisplayClient.cpp parser, update, applyCurrentPage

**Files:**
- Modify: `display-firmware/src/MqttDisplayClient.cpp`

- [ ] **Step 1: Update JSON parser to read subpages**

In `handleMessage()` / `parseDisplayPayload()`, update the zone line parsing:

Old: read `lines[li].text`, `lines[li].color`, `lines[li].effect` directly into `ZoneLine`.
New: check for `lines[li].subpages` array. If present, parse each entry into `SubPage` and store in `zl.subpages`. If absent, create a single `SubPage` from the legacy `text`/`color`/`effect` fields.

```cpp
// Inside zone line parsing loop:
if (doc["subpages"].is<JsonArray>()) {
  auto spArr = doc["subpages"].as<JsonArray>();
  for (JsonVariant spv : spArr) {
    SubPage sp;
    sp.text = spv["text"].as<std::string>();
    sp.color = spv["color"].as<std::string>();
    sp.bgColor = spv["bgColor"].as<std::string>();  // "" if absent
    sp.effect = spv["effect"].as<std::string>();
    sp.align = spv["align"].as<std::string>();
    sp.scrollSpeed = spv["scrollSpeed"].as<float>();
    sp.durationMs = spv["durationMs"].as<uint16_t>();
    if (sp.durationMs == 0) sp.durationMs = 5000;
    zl.subpages.push_back(sp);
  }
} else {
  // Legacy format: single text/color/effect
  SubPage sp;
  sp.text = doc["text"].as<std::string>();
  sp.color = doc["color"].as<std::string>();
  sp.effect = doc["effect"].as<std::string>();
  sp.align = doc["align"].as<std::string>();
  sp.scrollSpeed = doc["scrollSpeed"].as<float>();
  sp.durationMs = page.durationSeconds > 0 ? page.durationSeconds * 1000 : 5000;
  zl.subpages.push_back(sp);
}
```

- [ ] **Step 2: Init _subpageIdx and _lastSubChange in applyCurrentPage**

At the start of `applyCurrentPage()`:
```cpp
for (int zi = 0; zi < page.zoneCount; zi++) {
  for (int li = 0; li < page.zones[zi].lineCount; li++) {
    _subpageIdx[zi][li] = 0;
    _lastSubChange[zi][li] = millis();
  }
}
```

- [ ] **Step 3: Resolve active sub-page in applyCurrentPage**

When populating `rz[zi].lines[li]` for the renderer, resolve the current sub-page by index:
```cpp
auto& line = page.zones[zi].lines[li];
int si = _subpageIdx[zi][li];
if (si >= (int)line.subpages.size()) si = 0;
auto& sp = line.subpages[si];
rz[zi].lines[li].text = sp.text.c_str();
rz[zi].lines[li].color = parseHexColor(sp.color.c_str());
rz[zi].lines[li].hasBgColor = !sp.bgColor.empty();
if (rz[zi].lines[li].hasBgColor) {
  rz[zi].lines[li].bgColor = parseHexColor(sp.bgColor.c_str());
}
rz[zi].lines[li].effect = sp.effect.c_str();
rz[zi].lines[li].align = sp.align.c_str();
rz[zi].lines[li].scrollSpeed = sp.scrollSpeed;
```

- [ ] **Step 4: Sub-page cycling in update()**

In `update()`, after the page-level timer check, add per-line sub-page cycling:

```cpp
// Sub-page cycling
auto& page = _playlist[_currentPageIndex]; // or _overridePages
for (int zi = 0; zi < page.zoneCount && zi < 3; zi++) {
  for (int li = 0; li < page.zones[zi].lineCount && li < 2; li++) {
    auto& line = page.zones[zi].lines[li];
    if (line.subpages.size() <= 1) continue;
    int si = _subpageIdx[zi][li];
    if (si >= (int)line.subpages.size()) si = 0;
    auto& sp = line.subpages[si];
    if (sp.durationMs > 0 && now - _lastSubChange[zi][li] >= sp.durationMs) {
      _lastSubChange[zi][li] = now;
      _subpageIdx[zi][li] = (si + 1) % line.subpages.size();
      needsRedraw = true;
    }
  }
}
```

- [ ] **Step 5: Commit**

```bash
git add display-firmware/src/MqttDisplayClient.cpp
git commit -m "feat: sub-page parser, cycling in update(), resolution in applyCurrentPage"
```

---

### Task 9: Firmware — Hub75Driver bgColor, space width, per-line scale

**Files:**
- Modify: `display-firmware/src/Hub75Driver.h`
- Modify: `display-firmware/src/Hub75Driver.cpp`

- [ ] **Step 1: Add bgColor to LineRenderInfo**

In `Hub75Driver.h`, find `struct LineRenderInfo` and add:
```cpp
bool hasBgColor;   // true when bgColor should be drawn
uint16_t bgColor;  // RGB565 fill color, only valid when hasBgColor is true
```

- [ ] **Step 2: Fix `textWidth5x7Scaled` — skip SPACING before space**

```cpp
int Hub75Driver::textWidth5x7Scaled(const char* s, int scale) {
  int w = 0;
  bool first = true;
  for (const char* p = s; *p; p++) {
    if (!first) w += SPACING * scale;
    if (*p != ' ') w += CHAR_W * scale;
    first = (*p == ' ') ? first : false;
  }
  return w;
}
```

- [ ] **Step 3: Fix `drawText5x7Scaled` — space advances by 0**

Line 449 change:
```cpp
cursor += (*p == ' ') ? 0 : CELL_W * scale;
```

- [ ] **Step 4: Fix per-line scale for 2-line zones**

In `redraw()`, replace the blanket `scales[li] = 1` for `z.lineCount == 2` (around lines 343-344) with per-line logic:

```cpp
if (z.scale > 0) {
  scales[li] = z.scale;
} else if (ln.effect == "SCROLL") {
  scales[li] = 2;
} else {
  int tw2x = textWidth5x7Scaled(ln.text.c_str(), 2);
  scales[li] = (tw2x <= zoneW) ? 2 : 1;
}
```

This makes all zones use the same logic regardless of line count.

- [ ] **Step 5: Add bgColor rectangle fill in redraw()**

Before `drawText5x7Scaled()` (around line 398), add:
```cpp
if (line.hasBgColor) {
  int tw = textWidth5x7Scaled(display.c_str(), scale);
  for (int row = 0; row < CHAR_H * scale; row++) {
    for (int col = 0; col < tw; col++) {
      int px = x + col;
      int py = lineY[li] + row;
      if (px >= zoneX && px < zoneXEnd && py >= 0 && py < WF2_RES_Y) {
        drawPixelMapped(px, py, line.bgColor);
      }
    }
  }
}
```

This draws a solid rectangle of size `tw × (CHAR_H * scale)` at the text position, clipped to zone bounds.

- [ ] **Step 6: Commit**

```bash
git add display-firmware/src/Hub75Driver.h display-firmware/src/Hub75Driver.cpp
git commit -m "feat: bgColor rendering, space width fix, per-line scale"
```

---

### Task 10: Verify builds

- [ ] **Step 1: Build firmware**

```bash
cd /Users/junedelmar/Documents/PlatformIO/Projects/Freq/display-firmware && pio run -e esp32-hub75-wf2 2>&1
```
Expected: success (no errors)

- [ ] **Step 2: Build web**

```bash
cd /Users/junedelmar/Documents/PlatformIO/Projects/Freq/web && npm run build 2>&1
```
Expected: success

- [ ] **Step 3: Run web tests**

```bash
cd /Users/junedelmar/Documents/PlatformIO/Projects/Freq/web && npx vitest run 2>&1
```
Expected: all tests pass (59/62 with 3 pre-existing esp32.test.ts failures)

- [ ] **Step 4: Commit remaining changes**

```bash
git add -A
git commit -m "chore: build fixes and test updates"
```
