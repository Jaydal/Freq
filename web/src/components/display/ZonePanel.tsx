'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import type { DisplayZone, SubPage, DisplayLineRule } from './zone-types';

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

function subpageDefault(): SubPage {
  return { text: '', color: '#00FF00', effect: 'STATIC', durationMs: 5000 };
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
    while (lines.length < count) lines.push({ subpages: [subpageDefault()] });
    while (lines.length > count) lines.pop();
    onChange({ ...zone, lines });
  }

  function updateLine(index: number, subpages: SubPage[]) {
    const lines = zone.lines.map((l, i) => (i === index ? { ...l, subpages } : l));
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

      <div className="flex gap-4">
        <div className="space-y-1.5 flex-1">
          <Label className="text-xs text-zinc-500">Scale X (Width)</Label>
          <div className="flex items-center gap-2">
            <Input
              type="number" min={1} max={9}
              value={zone.scaleX ?? ''}
              onChange={e => {
                const v = e.target.value;
                onChange({ ...zone, scaleX: v ? Math.max(1, Math.min(9, Number(v))) : undefined });
              }}
              placeholder="Auto"
              className="h-7 text-xs bg-zinc-950 border-zinc-700 text-zinc-200"
            />
            {zone.scaleX && (
              <button
                onClick={() => onChange({ ...zone, scaleX: undefined })}
                className="text-xs text-zinc-500 hover:text-zinc-300 shrink-0"
              >
                Clear
              </button>
            )}
          </div>
        </div>
        <div className="space-y-1.5 flex-1">
          <Label className="text-xs text-zinc-500">Scale Y (Height)</Label>
          <div className="flex items-center gap-2">
            <Input
              type="number" min={1} max={9}
              value={zone.scaleY ?? ''}
              onChange={e => {
                const v = e.target.value;
                onChange({ ...zone, scaleY: v ? Math.max(1, Math.min(9, Number(v))) : undefined });
              }}
              placeholder="Auto"
              className="h-7 text-xs bg-zinc-950 border-zinc-700 text-zinc-200"
            />
            {zone.scaleY && (
              <button
                onClick={() => onChange({ ...zone, scaleY: undefined })}
                className="text-xs text-zinc-500 hover:text-zinc-300 shrink-0"
              >
                Clear
              </button>
            )}
          </div>
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

          {(zone.lines[li].subpages ?? []).map((sp, spi) => (
            <div key={spi} className="space-y-2 p-3 bg-zinc-900/50 rounded border border-zinc-700/50">
              <div className="flex items-center justify-between">
                <Label className="text-xs text-zinc-500">Sub-page {spi + 1}</Label>
                {(zone.lines[li].subpages?.length ?? 0) > 1 && (
                  <button
                    onClick={() => updateLine(li, (zone.lines[li].subpages ?? []).filter((_, i) => i !== spi))}
                    className="text-xs text-red-500 hover:text-red-400"
                  >
                    Remove
                  </button>
                )}
              </div>

              <div className="relative">
                <Input
                  value={sp.text}
                  onChange={e => {
                    const subs = [...(zone.lines[li].subpages ?? [])];
                    subs[spi] = { ...subs[spi], text: e.target.value };
                    updateLine(li, subs);
                  }}
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
                        onClick={() => {
                          const subs = [...(zone.lines[li].subpages ?? [])];
                          subs[spi] = { ...subs[spi], text: sp.text + v };
                          updateLine(li, subs);
                        }}
                      >
                        {v}
                      </button>
                    ))}
                  </div>
                </details>
              </div>

              <div className="flex gap-2 items-center">
                <div className="space-y-1 flex-1">
                  <Label className="text-xs text-zinc-500">Font</Label>
                  <Select value={sp.font ?? 'default'}
                    onValueChange={v => {
                      const subs = [...(zone.lines[li].subpages ?? [])];
                      subs[spi] = { ...subs[spi], font: (v === 'default' || !v) ? undefined : v };
                      updateLine(li, subs);
                    }}
                  >
                    <SelectTrigger className="h-7 text-xs bg-zinc-950 border-zinc-700 text-zinc-200">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="default">Default 5x7</SelectItem>
                      <SelectItem value="digital">7-Segment Digital</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1 flex-1">
                  <Label className="text-xs text-zinc-500">Effect</Label>
                  <Select value={sp.effect}
                    onValueChange={v => {
                      const subs = [...(zone.lines[li].subpages ?? [])];
                      subs[spi] = { ...subs[spi], effect: v as 'SCROLL' | 'STATIC' | 'BLINK' };
                      updateLine(li, subs);
                    }}
                  >
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
                      const subs = [...(zone.lines[li].subpages ?? [])];
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
                      const subs = [...(zone.lines[li].subpages ?? [])];
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
                    const subs = [...(zone.lines[li].subpages ?? [])];
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
                      const subs = [...(zone.lines[li].subpages ?? [])];
                      subs[spi] = { ...subs[spi], scrollSpeed: Math.max(0.5, Math.min(5, Number(e.target.value))) };
                      updateLine(li, subs);
                    }}
                    className="w-16 h-7 text-xs bg-zinc-950 border-zinc-700 text-zinc-200"
                  />
                </div>
              )}

              {sp.effect !== 'SCROLL' && (
                <div className="space-y-1">
                  <Label className="text-xs text-zinc-500">H Align</Label>
                  <div className="flex gap-1">
                    {(['left', 'center', 'right'] as const).map(a => (
                      <button key={a}
                        onClick={() => {
                          const subs = [...(zone.lines[li].subpages ?? [])];
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
              )}
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={() => {
            updateLine(li, [...(zone.lines[li].subpages ?? []), subpageDefault()]);
          }} className="text-xs">
            + Add Sub-page
          </Button>

          <div className="flex gap-4">
            <div className="space-y-1">
              <Label className="text-xs text-zinc-500">Margins (top / bottom)</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number" min={0} max={16}
                  value={line.marginTop ?? 0}
                  onChange={e => {
                    const lines = zone.lines.map((l, i) =>
                      i === li ? { ...l, marginTop: Math.max(0, Math.min(16, Number(e.target.value))) } : l
                    );
                    onChange({ ...zone, lines });
                  }}
                  className="w-14 h-7 text-xs bg-zinc-950 border-zinc-700 text-zinc-200"
                />
                <span className="text-xs text-zinc-600">/</span>
                <Input
                  type="number" min={0} max={16}
                  value={line.marginBottom ?? (li < zone.lines.length - 1 ? 2 : 0)}
                  onChange={e => {
                    const lines = zone.lines.map((l, i) =>
                      i === li ? { ...l, marginBottom: Math.max(0, Math.min(16, Number(e.target.value))) } : l
                    );
                    onChange({ ...zone, lines });
                  }}
                  className="w-14 h-7 text-xs bg-zinc-950 border-zinc-700 text-zinc-200"
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs text-zinc-500">Font Size (W / H)</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number" min={1} max={4}
                  value={line.scaleX ?? zone.scaleX ?? (zone.lines.length === 2 ? 1 : 2)}
                  onChange={e => {
                    const lines = zone.lines.map((l, i) =>
                      i === li ? { ...l, scaleX: Math.max(1, Math.min(4, Number(e.target.value))) } : l
                    );
                    onChange({ ...zone, lines });
                  }}
                  className="w-14 h-7 text-xs bg-zinc-950 border-zinc-700 text-zinc-200"
                />
                <span className="text-xs text-zinc-600">x</span>
                <Input
                  type="number" min={1} max={4}
                  value={line.scaleY ?? zone.scaleY ?? (zone.lines.length === 2 ? 1 : 2)}
                  onChange={e => {
                    const lines = zone.lines.map((l, i) =>
                      i === li ? { ...l, scaleY: Math.max(1, Math.min(4, Number(e.target.value))) } : l
                    );
                    onChange({ ...zone, lines });
                  }}
                  className="w-14 h-7 text-xs bg-zinc-950 border-zinc-700 text-zinc-200"
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs text-zinc-500">Char Spacing</Label>
              <Input
                type="number" min={0} max={10}
                value={line.spacing ?? 1}
                onChange={e => {
                  const lines = zone.lines.map((l, i) =>
                    i === li ? { ...l, spacing: Math.max(0, Math.min(10, Number(e.target.value))) } : l
                  );
                  onChange({ ...zone, lines });
                }}
                className="w-16 h-7 text-xs bg-zinc-950 border-zinc-700 text-zinc-200"
              />
            </div>
          </div>
          
          <div className="space-y-2 mt-4 border-t border-zinc-800 pt-3">
            <div className="flex items-center justify-between">
              <Label className="text-xs text-zinc-400 font-semibold">Conditional Actions</Label>
              <Button
                variant="outline"
                size="sm"
                className="h-6 px-2 text-[10px] bg-zinc-900 border-zinc-700 hover:bg-zinc-800"
                onClick={() => {
                  const currentRules = line.rules || [];
                  const newRule: DisplayLineRule = { type: 'time_remaining', operator: '<', value: 60, effect: 'BLINK_FAST' };
                  const newLines = zone.lines.map((l, i) => i === li ? { ...l, rules: [...currentRules, newRule] } : l);
                  onChange({ ...zone, lines: newLines });
                }}
              >
                + Add Rule
              </Button>
            </div>
            
            <div className="space-y-2">
              {(line.rules || []).map((rule, ri) => (
                <div key={ri} className="flex flex-wrap items-center gap-2 p-2 bg-zinc-900/50 border border-zinc-800 rounded-md">
                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <span className="text-[10px] text-zinc-500 uppercase font-bold shrink-0">If</span>
                    <Select
                      value={rule.type}
                      onValueChange={(val: any) => {
                        const newRules = [...(line.rules || [])];
                        newRules[ri] = { ...newRules[ri], type: val };
                        onChange({ ...zone, lines: zone.lines.map((l, i) => i === li ? { ...l, rules: newRules } : l) });
                      }}
                    >
                      <SelectTrigger className="h-7 text-xs bg-zinc-950 border-zinc-700 w-32"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="time_remaining">Time Left (sec)</SelectItem>
                        <SelectItem value="time_remaining_min">Time Left (min)</SelectItem>
                        <SelectItem value="time_remaining_pct">Time Left (%)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-center gap-2">
                    <Select
                      value={rule.operator}
                      onValueChange={(val: any) => {
                        if (!['<', '>', '<=', '>=', '=='].includes(val)) return;
                        const newRules = [...(line.rules || [])];
                        newRules[ri] = { ...newRules[ri], operator: val as '<' | '>' | '<=' | '>=' | '==' };
                        onChange({ ...zone, lines: zone.lines.map((l, i) => i === li ? { ...l, rules: newRules } : l) });
                      }}
                    >
                      <SelectTrigger className="h-7 text-xs bg-zinc-950 border-zinc-700 w-16"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="<">{'<'}</SelectItem>
                        <SelectItem value=">">{'>'}</SelectItem>
                        <SelectItem value="<=">{'<='}</SelectItem>
                        <SelectItem value=">=">{'>='}</SelectItem>
                        <SelectItem value="==">{'=='}</SelectItem>
                      </SelectContent>
                    </Select>

                    <Input
                      type="number"
                      value={rule.value}
                      onChange={e => {
                        const newRules = [...(line.rules || [])];
                        newRules[ri] = { ...newRules[ri], value: parseInt(e.target.value) || 0 };
                        onChange({ ...zone, lines: zone.lines.map((l, i) => i === li ? { ...l, rules: newRules } : l) });
                      }}
                      className="w-16 h-7 text-xs bg-zinc-950 border-zinc-700 text-center"
                    />
                  </div>

                  <div className="w-full sm:w-px sm:h-5 bg-zinc-800 my-1 sm:my-0"></div>
                  
                  <div className="flex flex-1 items-center flex-wrap gap-2 pr-6 relative">
                    <span className="text-[10px] text-zinc-500 uppercase font-bold shrink-0">Then</span>
                    <div className="flex items-center gap-1 shrink-0">
                      <Label className="text-[10px] text-zinc-500 shrink-0">Color:</Label>
                      <div className="flex items-center gap-1 bg-zinc-950 border border-zinc-700 rounded px-1 h-7">
                        <input
                          type="color"
                          value={rule.color || '#00FF00'}
                          onChange={e => {
                            const newRules = [...(line.rules || [])];
                            newRules[ri] = { ...newRules[ri], color: e.target.value };
                            onChange({ ...zone, lines: zone.lines.map((l, i) => i === li ? { ...l, rules: newRules } : l) });
                          }}
                          className={`w-5 h-5 rounded cursor-pointer border-0 p-0 bg-transparent ${!rule.color ? 'opacity-30 grayscale' : ''}`}
                          title="Override Color"
                        />
                        <button
                          onClick={() => {
                            const newRules = [...(line.rules || [])];
                            delete newRules[ri].color;
                            onChange({ ...zone, lines: zone.lines.map((l, i) => i === li ? { ...l, rules: newRules } : l) });
                          }}
                          className={`text-[10px] px-1 hover:text-red-400 transition-colors ${rule.color ? 'text-zinc-400' : 'text-zinc-700'}`}
                          title="Remove Color Override"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-1 min-w-[120px] flex-1">
                      <Label className="text-[10px] text-zinc-500 shrink-0">Effect:</Label>
                      <Select
                        value={rule.effect || 'none'}
                        onValueChange={(val: any) => {
                          const newRules = [...(line.rules || [])];
                          if (val === 'none') delete newRules[ri].effect;
                          else newRules[ri] = { ...newRules[ri], effect: val };
                          onChange({ ...zone, lines: zone.lines.map((l, i) => i === li ? { ...l, rules: newRules } : l) });
                        }}
                      >
                        <SelectTrigger className="h-7 text-xs bg-zinc-950 border-zinc-700 w-full"><SelectValue placeholder="No change" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">No change</SelectItem>
                          <SelectItem value="STATIC">Static</SelectItem>
                          <SelectItem value="SCROLL">Scroll</SelectItem>
                          <SelectItem value="BLINK">Blink</SelectItem>
                          <SelectItem value="BLINK_FAST">Blink Fast</SelectItem>
                          <SelectItem value="BLINK_SLOW">Blink Slow</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="flex items-center gap-1 min-w-[110px] flex-1">
                      <Label className="text-[10px] text-zinc-500 shrink-0">Align:</Label>
                      <Select
                        value={rule.align || 'none'}
                        onValueChange={(val: any) => {
                          const newRules = [...(line.rules || [])];
                          if (val === 'none') delete newRules[ri].align;
                          else newRules[ri] = { ...newRules[ri], align: val };
                          onChange({ ...zone, lines: zone.lines.map((l, i) => i === li ? { ...l, rules: newRules } : l) });
                        }}
                      >
                        <SelectTrigger className="h-7 text-xs bg-zinc-950 border-zinc-700 w-full"><SelectValue placeholder="No change" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">No change</SelectItem>
                          <SelectItem value="left">Left</SelectItem>
                          <SelectItem value="center">Center</SelectItem>
                          <SelectItem value="right">Right</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <button
                      onClick={() => {
                        const newRules = [...(line.rules || [])];
                        newRules.splice(ri, 1);
                        onChange({ ...zone, lines: zone.lines.map((l, i) => i === li ? { ...l, rules: newRules.length > 0 ? newRules : undefined } : l) });
                      }}
                      className="absolute right-0 top-0 bottom-0 my-auto w-6 h-6 flex items-center justify-center text-zinc-500 hover:text-red-400 hover:bg-zinc-800 rounded transition-colors"
                      title="Remove rule"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))}
              
              {(!line.rules || line.rules.length === 0) && (
                <div className="text-center py-4 border border-dashed border-zinc-800 rounded-md bg-zinc-950/30 text-zinc-600 text-xs">
                  No conditional actions added.
                </div>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
