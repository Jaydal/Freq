'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { PRESET_COLORS } from './color-utils';
import type { DisplayZone, DisplayLine } from './zone-types';

const VARIABLES = [
  '{court_name}', '{match_title}', '{match_type}', '{duration}',
  '{players}', '{timer}', '{elapsed}', '{queue_count}', '{next_name}', '{next_match}', '{next_wait}', '{next_booked_time}',
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
      if (panelCount <= 1) return;
      if (panelIdx === currentStart) {
        onChange({ ...zone, panelStart: currentStart + 1 });
      } else if (panelIdx === currentEnd) {
        onChange({ ...zone, panelEnd: currentEnd - 1 });
      }
    } else {
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
    const lines = zone.lines.map((l, i) => (i === index ? { ...l, ...partial } : l));
    onChange({ ...zone, lines });
  }

  return (
    <div className="space-y-4 p-4 bg-zinc-900/50 rounded-lg border border-zinc-800">
      <div className="flex items-center justify-between">
        <Label className="text-zinc-300 font-medium">Zone {zoneIndex + 1}</Label>
        {onDelete && (
          <Button variant="ghost" size="sm" onClick={onDelete} className="text-red-400">
            Remove
          </Button>
        )}
      </div>

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
                  selected
                    ? 'bg-zinc-700 text-white'
                    : 'bg-zinc-800 text-zinc-500 hover:text-zinc-300'
                }`}
              >
                P{pi + 1}
              </button>
            );
          })}
        </div>
        <p className="text-xs text-zinc-600">
          {panelCount} panel{panelCount > 1 ? 's' : ''} ({panelCount * 32}px)
        </p>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs text-zinc-500">Lines</Label>
        <div className="flex gap-2">
          {[1, 2].map(n => (
            <button
              key={n}
              onClick={() => setLineCount(n as 1 | 2)}
              className={`px-3 py-1.5 text-xs rounded-md font-medium transition-colors ${
                lineCount === n
                  ? 'bg-zinc-700 text-white'
                  : 'bg-zinc-800 text-zinc-500 hover:text-zinc-300'
              }`}
            >
              {n} line{n > 1 ? 's' : ''}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label className="text-xs text-zinc-500">Border Rows (unlit)</Label>
          <button
            onClick={() => {
              const rows = [...(zone.borderRows || []), { start: 0, end: 0 }];
              onChange({ ...zone, borderRows: rows });
            }}
            className="text-xs text-zinc-500 hover:text-zinc-300 px-1"
          >
            + Add range
          </button>
        </div>
        {(zone.borderRows || []).map((br, bri) => (
          <div key={bri} className="flex items-center gap-2">
            <Input
              type="number" min={0} max={15}
              value={br.start}
              onChange={e => {
                const rows = [...(zone.borderRows || [])];
                rows[bri] = { ...rows[bri], start: Math.min(Math.max(Number(e.target.value), 0), 15) };
                onChange({ ...zone, borderRows: rows });
              }}
              className="w-16 h-7 text-xs bg-zinc-950 border-zinc-700 text-zinc-200"
              placeholder="0"
            />
            <span className="text-xs text-zinc-600">→</span>
            <Input
              type="number" min={0} max={15}
              value={br.end}
              onChange={e => {
                const rows = [...(zone.borderRows || [])];
                rows[bri] = { ...rows[bri], end: Math.min(Math.max(Number(e.target.value), 0), 15) };
                onChange({ ...zone, borderRows: rows });
              }}
              className="w-16 h-7 text-xs bg-zinc-950 border-zinc-700 text-zinc-200"
              placeholder="0"
            />
            <button
              onClick={() => {
                const rows = (zone.borderRows || []).filter((_, i) => i !== bri);
                onChange({ ...zone, borderRows: rows.length > 0 ? rows : undefined });
              }}
              className="text-xs text-red-500 hover:text-red-400 px-1"
            >
              x
            </button>
          </div>
        ))}
        {(zone.borderRows || []).length > 0 && (
          <p className="text-xs text-zinc-600">
            Masking {(zone.borderRows || []).reduce((s, r) => s + (r.end - r.start + 1), 0)} row{(zone.borderRows || []).reduce((s, r) => s + (r.end - r.start + 1), 0) > 1 ? 's' : ''}
          </p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs text-zinc-500">Text Size</Label>
        <div className="flex items-center gap-2">
          <Input
            type="number" min={1} max={9}
            value={zone.scale ?? ''}
            onChange={e => {
              const v = e.target.value;
              onChange({ ...zone, scale: v ? Math.max(1, Math.min(9, Number(v))) : undefined });
            }}
            placeholder="Auto"
            className="w-16 h-7 text-xs bg-zinc-950 border-zinc-700 text-zinc-200"
          />
          {!zone.scale && (
            <span className="text-xs text-zinc-600">Auto</span>
          )}
          {zone.scale && (
            <button
              onClick={() => onChange({ ...zone, scale: undefined })}
              className="text-xs text-zinc-500 hover:text-zinc-300"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs text-zinc-500">V Align</Label>
        <div className="flex gap-1">
          {(['top', 'middle', 'bottom'] as const).map(v => (
            <button
              key={v}
              onClick={() => onChange({ ...zone, valign: v })}
              className={`px-2 py-1 text-xs rounded font-medium transition-colors ${
                (zone.valign || 'middle') === v
                  ? 'bg-zinc-700 text-white'
                  : 'bg-zinc-800 text-zinc-500 hover:text-zinc-300'
              }`}
            >
              {v.charAt(0).toUpperCase() + v.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <hr className="border-zinc-800 my-2" />

      {zone.lines.map((line, li) => (
        <div
          key={li}
          className="space-y-2 p-3 bg-zinc-950/50 rounded-md border border-zinc-800/50"
        >
          <Label className="text-xs text-zinc-500">Line {li + 1}</Label>

          <div className="relative">
            <Input
              value={line.text}
              onChange={e => updateLine(li, { text: e.target.value })}
              placeholder="Enter text..."
              className="font-mono text-xs bg-zinc-950 border-zinc-700 text-zinc-200 pr-8"
            />
            <details className="absolute right-0 top-0 bottom-0 group">
              <summary className="flex items-center justify-center h-full px-2 cursor-pointer text-xs text-zinc-600 hover:text-zinc-400">
{'{'}x{'}'}
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

          <div className="space-y-1">
            <Label className="text-xs text-zinc-500">Effect</Label>
            <Select
              value={line.effect}
              onValueChange={v => updateLine(li, { effect: v as DisplayLine['effect'] })}
            >
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

          {line.effect === 'SCROLL' && (
            <div className="space-y-1">
              <Label className="text-xs text-zinc-500">Scroll Speed</Label>
              <Input
                type="number" min={0.5} max={5} step={0.5}
                value={line.scrollSpeed ?? 1}
                onChange={e => updateLine(li, { scrollSpeed: Math.max(0.5, Math.min(5, Number(e.target.value))) })}
                className="w-16 h-7 text-xs bg-zinc-950 border-zinc-700 text-zinc-200"
              />
              <p className="text-xs text-zinc-600">Higher = faster</p>
            </div>
          )}

          <div className="space-y-1">
            <Label className="text-xs text-zinc-500">H Align</Label>
            <div className="flex gap-1">
              {(['left', 'center', 'right'] as const).map(a => (
                <button
                  key={a}
                  onClick={() => updateLine(li, { align: a })}
                  className={`px-2 py-1 text-xs rounded font-medium transition-colors ${
                    (line.align || 'center') === a
                      ? 'bg-zinc-700 text-white'
                      : 'bg-zinc-800 text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  {a.charAt(0).toUpperCase() + a.slice(1)}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-xs text-zinc-500">Margins (top / bottom)</Label>
            <div className="flex items-center gap-2">
              <Input
                type="number" min={0} max={16}
                value={line.marginTop ?? 0}
                onChange={e => updateLine(li, { marginTop: Math.max(0, Math.min(16, Number(e.target.value))) })}
                className="w-14 h-7 text-xs bg-zinc-950 border-zinc-700 text-zinc-200"
              />
              <span className="text-xs text-zinc-600">/</span>
              <Input
                type="number" min={0} max={16}
                value={line.marginBottom ?? (li < zone.lines.length - 1 ? 2 : 0)}
                onChange={e => updateLine(li, { marginBottom: Math.max(0, Math.min(16, Number(e.target.value))) })}
                className="w-14 h-7 text-xs bg-zinc-950 border-zinc-700 text-zinc-200"
              />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
