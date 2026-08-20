'use client';

import type { RefObject } from 'react';

interface Props {
  rfidRef: RefObject<HTMLInputElement | null>;
  onRfidSubmit: (e: React.FormEvent) => void;
}

export function IdleScreen({ rfidRef, onRfidSubmit }: Props) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-6">
      <div className="size-16 rounded-full border-2 border-primary-foreground/20 flex items-center justify-center">
        <svg className="size-8 text-primary-foreground/80" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.568 3H5.25A2.25 2.25 0 0 0 3 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 0 0 5.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 0 0 9.568 3Z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 6h.008v.008H6V6Z" />
        </svg>
      </div>
      <div className="text-center">
        <h1 className="text-2xl font-semibold text-primary-foreground mb-1">Court Terminal</h1>
        <p className="text-sm text-primary-foreground/80">Tap RFID card to book</p>
      </div>

      <form onSubmit={onRfidSubmit} className="w-full max-w-xs">
        <input ref={rfidRef} type="text" autoFocus
          className="w-full h-12 text-center text-lg bg-primary-foreground/10 border border-primary-foreground/20 rounded-lg text-primary-foreground placeholder-primary-foreground/50 focus:outline-none focus:border-primary-foreground/30 focus:ring-1 focus:ring-primary-foreground/30"
          placeholder="RFID card number"
        />
        <button type="submit" hidden />
      </form>
    </div>
  );
}
