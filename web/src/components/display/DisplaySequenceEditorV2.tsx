'use client';

import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { P10Canvas } from './P10Canvas';
import { ZonePanel } from './ZonePanel';
import { PageToolbar } from './PageToolbar';
import { TemplateDropdown } from './TemplateDropdown';
import { ZONE_TEMPLATES, type ZoneTemplate } from './zone-types';
import type { DisplayZone, DisplayLine, ZonePage } from './zone-types';
import { MockValuesPanel, DEFAULT_MOCK_VALUES, type MockValues } from './MockValuesPanel';

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
              borderRows: z.borderRows && z.borderRows.length > 0 ? z.borderRows : undefined,
              scale: z.scale,
              valign: z.valign,
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
                  align: l.align,
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
          ...(z.borderRows && z.borderRows.length > 0 ? { borderRows: z.borderRows } : {}),
          ...(z.scale ? { scale: z.scale } : {}),
          ...(z.valign && z.valign !== 'middle' ? { valign: z.valign } : {}),
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
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [previewPageIndex, setPreviewPageIndex] = useState(0);
  const [mockValues, setMockValues] = useState<MockValues>(DEFAULT_MOCK_VALUES);
  const previewTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const section = sections[activeSection];
  const pageIdx = clampPage(currentPage, section.pages.length);
  const page = section.pages[pageIdx];
  const zones = page?.zones || [];

  const flatPages = useMemo(() => {
    const all: { page: ZonePage; section: string }[] = [];
    for (const key of SECTIONS) {
      for (const p of sections[key].pages) {
        all.push({ page: p, section: key });
      }
    }
    return all;
  }, [sections]);

  function substituteMockVariables(text: string): string {
    let result = text;
    for (const [key, val] of Object.entries(mockValues)) {
      result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), val);
    }
    return result;
  }

  const previewZones = useMemo(() => {
    if (!isPreviewing || flatPages.length === 0) return zones;
    const activePage = flatPages[previewPageIndex].page;
    return activePage.zones.map(zone => ({
      ...zone,
      lines: zone.lines.map(line => ({
        ...line,
        text: substituteMockVariables(line.text),
      })),
    }));
  }, [isPreviewing, previewPageIndex, flatPages, zones, mockValues]);

  function startPreview() {
    setIsPreviewing(true);
    setPreviewPageIndex(0);
  }

  function stopPreview() {
    setIsPreviewing(false);
    if (previewTimerRef.current) {
      clearTimeout(previewTimerRef.current);
      previewTimerRef.current = null;
    }
  }

  useEffect(() => {
    if (!isPreviewing || flatPages.length === 0) return;
    const currentPage = flatPages[previewPageIndex].page;
    const ms = (currentPage.durationSeconds || 10) * 1000;
    previewTimerRef.current = setTimeout(() => {
      setPreviewPageIndex(prev => (prev + 1) % flatPages.length);
    }, ms);
    return () => {
      if (previewTimerRef.current) clearTimeout(previewTimerRef.current);
    };
  }, [isPreviewing, previewPageIndex, flatPages]);

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
    [pageIdx, activeSection]
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
    [pageIdx, activeSection]
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
          <Button
            onClick={isPreviewing ? stopPreview : startPreview}
            size="sm"
            variant={isPreviewing ? 'destructive' : 'default'}
            className="h-7 text-xs"
          >
            {isPreviewing ? '■ Stop' : '▶ Live Preview'}
          </Button>
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

      {isPreviewing && (
        <MockValuesPanel values={mockValues} onChange={setMockValues} />
      )}

      <PageToolbar
        pageCount={section.pages.length}
        currentPage={pageIdx}
        previewIndex={isPreviewing ? previewPageIndex : undefined}
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
            zones={isPreviewing ? previewZones : zones}
            selectedZoneIndex={isPreviewing ? null : selectedZone}
            onZoneSelect={isPreviewing ? () => {} : setSelectedZone}
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
