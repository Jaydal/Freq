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
