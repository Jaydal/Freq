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
        </div>
      ))}
    </div>
  );
}
