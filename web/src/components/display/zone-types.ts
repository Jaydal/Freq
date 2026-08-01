export interface DisplayLineRule {
  type: 'time_remaining' | 'time_remaining_min' | 'time_remaining_pct';
  operator: '<' | '>' | '<=' | '>=' | '==';
  value: number;
  color?: string;
  effect?: 'SCROLL' | 'STATIC' | 'BLINK' | 'BLINK_FAST' | 'BLINK_SLOW';
  align?: 'left' | 'center' | 'right';
}

export interface SubPage {
  text: string;
  effect: 'SCROLL' | 'STATIC' | 'BLINK';
  color: string;
  bgColor?: string;
  align?: 'left' | 'center' | 'right';
  scrollSpeed?: number;
  durationMs: number;
  font?: string;
  bold?: boolean;
}

export interface DisplayLine {
  subpages?: SubPage[];
  text?: string;
  color?: string;
  bgColor?: string;
  font?: string;
  bold?: boolean;
  effect?: 'SCROLL' | 'STATIC' | 'BLINK' | 'paginate';
  align?: 'left' | 'center' | 'right';
  scrollSpeed?: number;
  marginTop?: number;
  marginBottom?: number;
  scaleX?: number;
  scaleY?: number;
  spacing?: number;
  rules?: DisplayLineRule[];
}

export interface DisplayZone {
  panelStart: number;
  panelEnd: number;
  lines: DisplayLine[];
  borderRows?: { start: number; end: number }[];
  scaleX?: number;
  scaleY?: number;
  valign?: 'top' | 'middle' | 'bottom';
}

export interface ZonePage {
  durationSeconds: number;
  zones: DisplayZone[];
  hideIfEmpty?: string[];
  showIfEmpty?: string[];
}

export interface DisplaySequenceConfig {
  idle: { interval: number; pages: ZonePage[] };
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
