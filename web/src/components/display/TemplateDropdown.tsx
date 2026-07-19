'use client';

import { Button } from '@/components/ui/button';
import { ZONE_TEMPLATES, type ZoneTemplate } from './zone-types';

interface Props {
  onSelect: (template: ZoneTemplate) => void;
}

export function TemplateDropdown({ onSelect }: Props) {
  return (
    <div className="relative group">
      <Button variant="outline" size="sm" className="text-xs h-7">
        Templates &#9660;
      </Button>
      <div className="absolute left-0 top-full mt-1 bg-zinc-900 border border-zinc-700 rounded-md shadow-xl z-10 min-w-[200px] hidden group-hover:block">
        {ZONE_TEMPLATES.map(t => (
          <button
            key={t.name}
            onClick={() => onSelect(t)}
            className="block w-full text-left px-3 py-2 text-xs text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 first:rounded-t-md last:rounded-b-md"
          >
            <span className="font-medium text-zinc-300">{t.name}</span>
            <span className="block text-zinc-600">{t.description}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
