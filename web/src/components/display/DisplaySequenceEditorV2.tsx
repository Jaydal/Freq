'use client';

import { useState, useCallback } from 'react';
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
  idle: {
    interval: 10,
    pages: [
      {
        durationSeconds: 10,
        zones: [
          {
            panelStart: 0,
            panelEnd: 2,
            lines: [{ text: '{court_name}', color: '#00FF00', effect: 'STATIC' }],
          },
        ],
      },
    ],
  },
  prep: {
    interval: 10,
    pages: [
      {
        durationSeconds: 10,
        zones: [
          {
            panelStart: 0,
            panelEnd: 2,
            lines: [{ text: '{match_title}', color: '#00FFFF', effect: 'SCROLL' }],
          },
        ],
      },
    ],
  },
  game: {
    interval: 10,
    pages: [
      {
        durationSeconds: 10,
        zones: [
          {
            panelStart: 0,
            panelEnd: 1,
            lines: [
              { text: 'NOW PLAYING', color: '#00FF00', effect: 'STATIC' },
              { text: '{match_title}', color: '#FFFFFF', effect: 'SCROLL' },
            ],
          },
          {
            panelStart: 2,
            panelEnd: 2,
            lines: [{ text: '{timer}', color: '#00FFFF', effect: 'STATIC' }],
          },
        ],
      },
    ],
  },
}, null, 2);

interface Props {
  sequence: string;
}

function parseSequence(raw: string): Record<SectionKey, SectionState> {
  try {
    const parsed = JSON.parse(raw);
    const sections: Record<SectionKey, SectionState> = {} as Record<SectionKey, SectionState>;
    for (const key of SECTIONS) {
      const s = parsed[key];
      if (!s) throw new Error(`Missing section: ${key}`);
      const pages: ZonePage[] = (s.pages || []).map((p: any) => {
        if (p.zones) {
          return {
            durationSeconds: p.durationSeconds ?? s.interval ?? 10,
            zones: p.zones.map((z: any) => ({
              panelStart: z.panelStart ?? 0,
              panelEnd: z.panelEnd ?? 2,
              lines: (
                z.lines || [
                  {
                    text: z.text || '',
                    color: z.color || '#00FF00',
                    effect: z.effect || 'STATIC',
                  },
                ]
              ).map(
                (l: any): DisplayLine => ({
                  text: l.text ?? '',
                  color: l.color ?? '#00FF00',
                  effect: l.effect ?? 'STATIC',
                })
              ),
            })),
          };
        }
        return {
          durationSeconds: p.durationSeconds ?? s.interval ?? 10,
          zones: [
            {
              panelStart: 0,
              panelEnd: 2,
              lines: [
                {
                  text: p.text ?? p.line1 ?? '',
                  color: p.color ?? '#00FF00',
                  effect: p.effect ?? 'SCROLL',
                },
              ],
            },
          ],
        };
      });
      sections[key] = { interval: s.interval ?? 10, pages };
    }
    return sections;
  } catch {
    return parseSequence(DEFAULTS);
  }
}

function serializeSequence(
  sections: Record<SectionKey, SectionState>
): string {
  const obj: Record<string, unknown> = {};
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

function clampPage(page: number, max: number): number {
  return Math.max(0, Math.min(page, max - 1));
}

export function DisplaySequenceEditorV2({ sequence: initial }: Props) {
  const [sections, setSections] = useState<
    Record<SectionKey, SectionState>
  >(() => parseSequence(initial));
  const [activeSection, setActiveSection] = useState<SectionKey>('idle');
  const [currentPage, setCurrentPage] = useState(0);
  const [selectedZone, setSelectedZone] = useState<number | null>(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const section = sections[activeSection];
  const pageIdx = clampPage(currentPage, section.pages.length);
  const page = section.pages[pageIdx];
  const zones = page?.zones || [];

  function updateSection(
    updater: (s: SectionState) => SectionState
  ) {
    setSections(prev => ({
      ...prev,
      [activeSection]: updater(prev[activeSection]),
    }));
  }

  function updateCurrentPage(updater: (zones: DisplayZone[]) => DisplayZone[]) {
    updateSection(s => ({
      ...s,
      pages: s.pages.map((p, i) =>
        i === pageIdx ? { ...p, zones: updater(p.zones) } : p
      ),
    }));
  }

  const handleZoneChange = useCallback(
    (index: number, updated: DisplayZone) => {
      updateCurrentPage(zones =>
        zones.map((z, zi) => (zi === index ? updated : z))
      );
    },
    [pageIdx]
  );

  const applyTemplate = useCallback(
    (tpl: ZoneTemplate) => {
      const newZones = tpl.zones.map(z => ({
        panelStart: z.panelStart,
        panelEnd: z.panelEnd,
        lines: Array.from(
          { length: z.lines },
          (): DisplayLine => ({
            text: '',
            color: '#00FF00',
            effect: 'STATIC' as const,
          })
        ),
      }));
      updateCurrentPage(() => newZones);
      setSelectedZone(0);
    },
    [pageIdx]
  );

  async function handleSave() {
    setError(null);
    setSaving(true);
    try {
      const json = serializeSequence(sections);
      JSON.parse(json);
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'displaySequence', value: json }),
      });
      if (!res.ok) throw new Error('Save failed');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    }
    setSaving(false);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-1 border-b border-zinc-800 pb-2">
        {SECTIONS.map(s => (
          <button
            key={s}
            onClick={() => {
              setActiveSection(s);
              setCurrentPage(0);
              setSelectedZone(0);
            }}
            className={`px-3 py-1 text-xs rounded-md font-medium transition-colors ${
              activeSection === s
                ? 'bg-zinc-700 text-white'
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            {s}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-2">
          <TemplateDropdown onSelect={applyTemplate} />
          <Button
            onClick={handleSave}
            disabled={saving}
            size="sm"
            className="h-7 text-xs"
          >
            {saving ? 'Saving...' : 'Save Sequence'}
          </Button>
        </div>
      </div>

      {error && <p className="text-xs text-red-400">{error}</p>}

      <PageToolbar
        pageCount={section.pages.length}
        currentPage={pageIdx}
        durationSeconds={page?.durationSeconds ?? 10}
        onPageSelect={i => {
          setCurrentPage(i);
          setSelectedZone(0);
        }}
        onAddPage={() => {
          updateSection(s => ({
            ...s,
            pages: [
              ...s.pages,
              {
                durationSeconds: s.interval,
                zones: [
                  {
                    panelStart: 0,
                    panelEnd: 2,
                    lines: [
                      {
                        text: '',
                        color: '#00FF00',
                        effect: 'STATIC',
                      },
                    ],
                  },
                ],
              },
            ],
          }));
        }}
        onRemovePage={() => {
          if (section.pages.length <= 1) return;
          updateSection(s => ({
            ...s,
            pages: s.pages.filter((_, i) => i !== pageIdx),
          }));
          setCurrentPage(prev => Math.min(prev, section.pages.length - 2));
        }}
        onDurationChange={sec => {
          updateSection(s => ({
            ...s,
            pages: s.pages.map((p, i) =>
              i === pageIdx ? { ...p, durationSeconds: sec } : p
            ),
          }));
        }}
      />

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="xl:col-span-2">
          <P10Canvas
            zones={zones}
            selectedZoneIndex={selectedZone}
            onZoneSelect={setSelectedZone}
          />
          {zones.length === 0 && (
            <p className="text-xs text-zinc-500 mt-2">
              No zones defined. Use a template or add zones manually.
            </p>
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
