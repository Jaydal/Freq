'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface Props {
  pageCount: number;
  currentPage: number;
  durationSeconds: number;
  hideIfEmpty?: string[];
  previewIndex?: number;
  onPageSelect: (index: number) => void;
  onAddPage: () => void;
  onRemovePage: () => void;
  onDuplicatePage: () => void;
  onDurationChange: (seconds: number) => void;
  onHideIfEmptyChange?: (vars: string[]) => void;
}

export function PageToolbar({
  pageCount,
  currentPage,
  durationSeconds,
  hideIfEmpty,
  previewIndex,
  onPageSelect,
  onAddPage,
  onRemovePage,
  onDuplicatePage,
  onDurationChange,
  onHideIfEmptyChange,
}: Props) {
  return (
    <div className="flex items-center gap-3 py-2 flex-wrap">
      <span className="text-xs text-zinc-500">Pages:</span>
      <div className="flex gap-1">
        {Array.from({ length: pageCount }).map((_, i) => (
          <button
            key={i}
            onClick={() => onPageSelect(i)}
            className={`w-6 h-6 text-xs rounded-full font-medium transition-colors ${
              i === currentPage
                ? 'bg-zinc-700 text-white'
                : i === previewIndex
                ? 'bg-green-900/50 text-green-400 border border-green-500/50'
                : 'bg-zinc-800 text-zinc-500 hover:text-zinc-300'
            }`}
          >
            {i + 1}
          </button>
        ))}
      </div>
      <Button variant="outline" size="sm" onClick={onAddPage} className="h-6 px-2 text-xs">
        +
      </Button>
      {pageCount > 1 && (
        <Button
          variant="outline"
          size="sm"
          onClick={onRemovePage}
          className="h-6 px-2 text-xs text-red-400"
        >
          &times;
        </Button>
      )}
      <Button
        variant="outline"
        size="sm"
        onClick={onDuplicatePage}
        className="h-6 px-2 text-xs"
        title="Duplicate current page"
      >
        D
      </Button>
      <div className="ml-auto flex items-center gap-2">
        <span className="text-xs text-zinc-500">Duration:</span>
        <Input
          type="number"
          min={2}
          max={60}
          value={durationSeconds}
          onChange={e => onDurationChange(Math.max(2, parseInt(e.target.value) || 10))}
          className="w-14 h-6 text-xs text-center bg-zinc-950 border-zinc-700 text-zinc-200"
        />
        <span className="text-xs text-zinc-600">s</span>
      </div>
      {onHideIfEmptyChange && (
        <div className="flex items-center gap-1">
          <span className="text-xs text-zinc-500">Hide if empty:</span>
          <Input
            type="text"
            value={(hideIfEmpty ?? []).join(', ')}
            onChange={e => onHideIfEmptyChange(e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
            placeholder="next_name, match_title"
            className="w-40 h-6 text-xs bg-zinc-950 border-zinc-700 text-zinc-200"
          />
        </div>
      )}
    </div>
  );
}
