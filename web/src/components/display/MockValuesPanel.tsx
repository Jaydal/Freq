'use client';

import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';

export interface MockValues {
  court_name: string;
  match_title: string;
  match_type: string;
  duration: string;
  players: string;
  timer: string;
  elapsed: string;
  queue_count: string;
  next_name: string;
  next_match: string;
}

export const DEFAULT_MOCK_VALUES: MockValues = {
  court_name: 'COURT 1',
  match_title: 'MATCH 5',
  match_type: 'Singles',
  duration: '60min',
  players: 'Player 1 / Player 2',
  timer: '5:00',
  elapsed: '2:30',
  queue_count: '3',
  next_name: 'TEAM A',
  next_match: 'Next: TEAM B',
};

interface Props {
  values: MockValues;
  onChange: (values: MockValues) => void;
}

export function MockValuesPanel({ values, onChange }: Props) {
  const entries = Object.entries(values) as [keyof MockValues, string][];
  return (
    <div className="space-y-2 p-3 bg-zinc-900/50 rounded-lg border border-zinc-800">
      <Label className="text-xs text-zinc-400 font-medium">Mock Values</Label>
      {entries.map(([key, val]) => (
        <div key={key} className="flex items-center gap-2">
          <span className="text-xs text-zinc-600 w-24 shrink-0 font-mono">{`{${key}}`}</span>
          <Input
            value={val}
            onChange={e => onChange({ ...values, [key]: e.target.value })}
            className="h-6 text-xs bg-zinc-950 border-zinc-700 text-zinc-200 flex-1"
          />
        </div>
      ))}
    </div>
  );
}
