'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface Props {
  pageCount: number;
  currentPage: number;
  durationSeconds: number;
  hideIfEmpty?: string[];
  showIfEmpty?: string[];
  previewIndex?: number;
  onPageSelect: (index: number) => void;
  onAddPage: () => void;
  onRemovePage: () => void;
  onDuplicatePage: () => void;
  onDurationChange: (seconds: number) => void;
  onHideIfEmptyChange?: (vars: string[]) => void;
  onShowIfEmptyChange?: (vars: string[]) => void;
}

export function PageToolbar({
  pageCount,
  currentPage,
  durationSeconds,
  hideIfEmpty,
  showIfEmpty,
  previewIndex,
  onPageSelect,
  onAddPage,
  onRemovePage,
  onDuplicatePage,
  onDurationChange,
  onHideIfEmptyChange,
  onShowIfEmptyChange,
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

      {onHideIfEmptyChange && onShowIfEmptyChange && (
        <div className="w-full mt-2 pt-2 border-t border-zinc-800">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[10px] text-zinc-500 font-bold uppercase">Page Conditional Actions</span>
          </div>
          
          <div className="space-y-2">
            {[...(hideIfEmpty || []).map(v => ({ v, type: 'hide' })), ...(showIfEmpty || []).map(v => ({ v, type: 'show' }))].map((rule, i) => (
              <div key={`rule-${i}`} className="flex flex-wrap items-center gap-2 p-2 bg-zinc-900/50 border border-zinc-800 rounded-md">
                <span className="text-[10px] text-zinc-500 uppercase font-bold shrink-0">If</span>
                <Input
                  type="text"
                  value={rule.v}
                  onChange={e => {
                    if (rule.type === 'hide') {
                      const newHide = [...(hideIfEmpty || [])];
                      newHide[hideIfEmpty!.indexOf(rule.v)] = e.target.value;
                      onHideIfEmptyChange(newHide.filter(Boolean));
                    } else {
                      const newShow = [...(showIfEmpty || [])];
                      newShow[showIfEmpty!.indexOf(rule.v)] = e.target.value;
                      onShowIfEmptyChange(newShow.filter(Boolean));
                    }
                  }}
                  className="w-32 h-7 text-xs bg-zinc-950 border-zinc-700"
                  placeholder="{next_name}"
                />
                
                <select
                  value={rule.type}
                  onChange={e => {
                    const newType = e.target.value;
                    if (newType === rule.type) return;
                    
                    if (rule.type === 'hide') {
                      onHideIfEmptyChange((hideIfEmpty || []).filter(x => x !== rule.v));
                      onShowIfEmptyChange([...(showIfEmpty || []), rule.v]);
                    } else {
                      onShowIfEmptyChange((showIfEmpty || []).filter(x => x !== rule.v));
                      onHideIfEmptyChange([...(hideIfEmpty || []), rule.v]);
                    }
                  }}
                  className="h-7 text-xs bg-zinc-950 border border-zinc-700 text-zinc-200 rounded px-2 outline-none focus:ring-1 focus:ring-zinc-500"
                >
                  <option value="hide">is empty</option>
                  <option value="show">is NOT empty</option>
                </select>
                
                <span className="text-[10px] text-zinc-500 uppercase font-bold shrink-0 mx-2">Then</span>
                <span className="text-xs text-red-400 font-medium">Hide Page</span>
                
                <button
                  onClick={() => {
                    if (rule.type === 'hide') {
                      onHideIfEmptyChange((hideIfEmpty || []).filter(x => x !== rule.v));
                    } else {
                      onShowIfEmptyChange((showIfEmpty || []).filter(x => x !== rule.v));
                    }
                  }}
                  className="ml-auto shrink-0 w-6 h-6 flex items-center justify-center text-zinc-500 hover:text-red-400 hover:bg-zinc-800 rounded"
                >✕</button>
              </div>
            ))}
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => onHideIfEmptyChange([...(hideIfEmpty || []), '{next_name}'])}
              className="h-6 px-2 text-[10px] bg-zinc-900 border-zinc-700 hover:bg-zinc-800"
            >
              + Add Rule
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
