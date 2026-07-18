'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Trash2 } from 'lucide-react';

interface Props {
  sequence: string;
}

const DEFAULTS = `{
  "idle": {
    "interval": 10,
    "pages": [
      {"text": "{court_name}"},
      {"text": "{queue_count} IN QUEUE"}
    ]
  },
  "prep": {
    "interval": 10,
    "pages": [
      {"text": "{match_title} {timer}"},
      {"text": "{queue_count} WAITING"}
    ]
  },
  "game": {
    "interval": 10,
    "pages": [
      {"text": "{match_title} — {duration}"},
      {"text": "{timer} LEFT"},
      {"text": "{queue_count} IN QUEUE"}
    ]
  }
}`;

export function DisplaySequenceEditor({ sequence: initial }: Props) {
  const [raw, setRaw] = useState(initial || DEFAULTS);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setError(null);
    try {
      const parsed = JSON.parse(raw);
      if (!parsed.idle || !parsed.prep || !parsed.game) {
        setError('Must have idle, prep, and game sections');
        return;
      }
    } catch {
      setError('Invalid JSON');
      return;
    }
    setSaving(true);
    await fetch('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: 'displaySequence', value: raw }),
    });
    setSaving(false);
  }

  return (
    <div className="space-y-4">
      <div className="text-xs text-muted-foreground space-y-1 mb-2">
        <p>Sections: <code className="text-zinc-300">idle</code> <code className="text-zinc-300">prep</code> <code className="text-zinc-300">game</code></p>
        <p>Variables: <code className="text-emerald-400">{'{court_name}'}</code> <code className="text-emerald-400">{'{match_title}'}</code> <code className="text-emerald-400">{'{match_type}'}</code> <code className="text-emerald-400">{'{duration}'}</code> <code className="text-emerald-400">{'{players}'}</code> <code className="text-emerald-400">{'{timer}'}</code> <code className="text-emerald-400">{'{elapsed}'}</code> <code className="text-emerald-400">{'{queue_count}'}</code> <code className="text-emerald-400">{'{next_name}'}</code> <code className="text-emerald-400">{'{next_match}'}</code></p>
        <p>Each section has <code className="text-zinc-300">interval</code> (seconds per page) and <code className="text-zinc-300">pages</code> (array of display templates). The display cycles through the pages in order.</p>
      </div>
      <textarea
        value={raw}
        onChange={e => { setRaw(e.target.value); setError(null); }}
        rows={24}
        className="w-full bg-background border border-border rounded-lg px-4 py-3 text-sm font-mono text-foreground"
      />
      {error && <p className="text-xs text-red-400">{error}</p>}
      <Button onClick={handleSave} disabled={saving}>
        {saving ? 'Saving...' : 'Save Sequence'}
      </Button>
      <Button variant="outline" size="sm" onClick={() => setRaw(DEFAULTS)} className="ml-2">
        Reset to Defaults
      </Button>
    </div>
  );
}
