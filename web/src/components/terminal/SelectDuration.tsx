import { BookingStepper } from './BookingStepper';
import { Clock, ArrowLeft } from 'lucide-react';

interface Props {
  member?: any;
  durations: number[];
  rates: Record<string, number>;
  onSelect: (duration: number) => void;
  onBack: () => void;
  onCancel?: () => void;
}

export function SelectDuration({ member, durations, rates, onSelect, onBack, onCancel }: Props) {
  // Simple helper to describe durations
  const getDurationLabel = (mins: number) => {
    if (mins <= 30) return 'Quick Match';
    if (mins <= 60) return 'Standard Play';
    return 'Extended Session';
  };

  return (
    <div className="flex-1 flex flex-col h-full">
      <BookingStepper
        current={2}
        memberName={member ? `${member.firstName} ${member.lastName}` : undefined}
        balance={member?.balance}
        onCancel={onCancel}
      />

      <div className="flex-1 flex flex-col px-5 pb-5 justify-between gap-4 overflow-y-auto">
        <div className="space-y-3 flex-1 flex flex-col justify-center">
          <div className="text-[10px] font-semibold text-zinc-500 uppercase tracking-widest text-center mb-1">
            Choose Match Duration
          </div>

          <div className="grid grid-cols-3 gap-3 w-full max-w-lg mx-auto">
            {durations.map(d => {
              const per30 = rates[String(d)] ?? 0;
              const total = per30 * (d / 30);
              const label = getDurationLabel(d);
              const isPopular = d === 60; // Standard 60 mins is usually popular

              return (
                <button
                  key={d}
                  onClick={() => onSelect(d)}
                  className={`group relative bg-primary/40 border border-primary-foreground/20 rounded-2xl p-5 text-center transition-all duration-300 active:scale-[0.97] cursor-pointer flex flex-col items-center justify-between min-h-[160px] shadow-lg shadow-black/10 ${
                    isPopular 
                      ? 'border-secondary/50 bg-secondary/[0.01]' 
                      : 'border-primary-foreground/20 hover:border-primary-foreground/30'
                  }`}
                >
                  {isPopular && (
                     <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 text-[8px] font-bold px-2 py-0.5 rounded-full bg-secondary text-white tracking-wider uppercase shadow-sm">
                      Popular
                    </span>
                  )}

                  <div className="text-primary-foreground/80 group-hover:text-secondary transition-colors mt-2">
                    <Clock className="size-5" />
                  </div>

                  <div className="my-3">
                    <span className="text-3xl font-black text-primary-foreground group-hover:text-secondary transition-colors block leading-none">
                      {d}
                    </span>
                    <span className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider mt-1">
                      minutes
                    </span>
                  </div>

                  <div className="w-full pt-2 border-t border-zinc-800/80">
                    <span className="block text-[10px] text-zinc-400 font-medium leading-none mb-1">{label}</span>
                    <span className="block text-sm font-extrabold text-secondary">₱{total}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <button 
          onClick={onBack} 
          className="py-3 px-4 rounded-xl border border-primary-foreground/20 text-xs font-bold uppercase tracking-wider text-primary-foreground/80 hover:text-primary-foreground hover:bg-primary-foreground/10 active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-2 w-full"
        >
          <ArrowLeft className="size-3.5" />
          <span>Back to Game Format</span>
        </button>
      </div>
    </div>
  );
}

