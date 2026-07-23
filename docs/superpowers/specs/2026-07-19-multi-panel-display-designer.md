# Multi-Panel Display Visual Designer

## Overview

Replace the flat JSON textarea display sequence editor with a WYSIWYG visual designer for 3-P10 LED panels (96x16). Each page in a sequence defines zones that partition panels into independently configurable regions.

## Architecture

### Component Tree

```
DisplaySequenceEditor
├── SectionTabs — idle / prep / game
├── PageToolbar — page navigation (dots), add/remove page, duration slider
├── MainWorkspace (horizontal flex split)
│   ├── P10Canvas — interactive 3-panel LED preview (96x16 SVG)
│   │   ├── per-zone rendering (lines, colors, scroll/static/blink)
│   │   ├── click zone to select → shows ZonePanel
│   │   └── draggable zone dividers (@dnd-kit useDraggable/useDroppable)
│   └── ZonePanel — properties sidebar for the selected zone
│       ├── panelStart / panelEnd assignment (P1/P2/P3 checkboxes)
│       ├── line count toggle (1/2)
│       └── per-line card:
│           ├── text input (with {variable} inline badge)
│           ├── color picker (native <input type="color">)
│           ├── effect dropdown (SCROLL/STATIC/BLINK/paginate)
│           └── shrink toggle
├── TemplateDropdown — preset zone layouts + "Save as template"
└── SaveButton
```

### Zone Model (internal state, not exposed as JSON to admin)

```ts
interface DisplayPage {
  durationSeconds: number;
  zones: DisplayZone[];
}

interface DisplayZone {
  panelStart: number;     // 0, 1, or 2
  panelEnd: number;       // 0, 1, or 2 (≥ panelStart)
  lines: DisplayLine[];
}

interface DisplayLine {
  text: string;           // supports {timer}, {elapsed}, {court_name}, etc.
  color: string;          // hex "#00FF00"
  effect: 'SCROLL' | 'STATIC' | 'BLINK' | 'paginate';
}
```

Zones tile horizontally, partition at panel boundaries (32px increments). Max 3 zones. Max 2 lines per zone.

### Zone Layout Templates

Built-in presets:
- **All 3 combined**: 1 zone spanning panels 0-2 (96px), 2 lines
- **2+1 split**: zone 1 = panels 0-1 (64px, 2 lines), zone 2 = panel 2 (32px, 1 line)
- **1+1+1**: 3 independent zones, each 32px, 1 line
- **1+2 split**: zone 1 = panel 0 (32px, 1 line), zone 2 = panels 1-2 (64px, 2 lines)

### P10Canvas Rendering

The existing `P10Display.tsx` 5x7 bitmap font + SVG dot rendering is reused. Key changes:
- ViewBox `0 0 98 16` (32+1+32+1+32 with 1px gaps between panels)
- Each zone renders its lines stacked vertically within its panel bounds
- Effect handling per-line (not per-page): SCROLL, STATIC, BLINK, paginate
- Physical panel borders rendered as dark gaps with bezel effect
- Click handler on each zone region to select
- Drag handles at zone boundaries using @dnd-kit
- Persisted default brightness/glow/scanline overlay from current P10Display

### Backward Compatibility

The old flat `text`/`color`/`effect` fields on a page are implicitly treated as:
- 1 zone spanning all 3 panels
- 1 line with the given text/color/effect

The `sports-caster.ts` and firmware will continue to work with the old format until updated.

## Data Flow

1. Admin edits zones visually in DisplaySequenceEditor
2. On save, serialized to JSON in `settings` table key `displaySequence`
3. `sports-caster.ts` reads the sequence, generates `DisplayPayload` with zone-based pages
4. MQTT publishes `courts/{courtId}/display` with zone data
5. ESP32 firmware parses zones, renders per-panel regions

## Phasing

1. **Phase 1** — Build the visual designer component (`DisplaySequenceEditorV2` replacing the old one). Works standalone, saves to settings. The new format co-exists with the old parser.
2. **Phase 2** — Update `sports-caster.ts` `generatePayload()` to produce zone-based `DisplayPayload` pages
3. **Phase 3** — Update MQTT `DisplayPayload` type and `publishDisplay` to include zones
4. **Phase 4** — Update ESP32 firmware `MqttDisplayClient.cpp` and `Hub75Driver.cpp` to parse and render zones
