'use client';

import { useEffect, useRef, useState } from 'react';

const BRAND_BLUE = '#0E5E9A';
const BRAND_GREEN = '#32A45E';

/* ── Phase 1: 0–1s — Center pulse + expanding ring ── */
const Phase1Ring = () => (
  <div className="absolute inset-0 flex items-center justify-center">
    <div className="relative flex items-center justify-center">
      <div
        className="w-20 h-20 rounded-full"
        style={{
          backgroundColor: 'rgba(255,255,255,0.15)',
          animation: 'boot-pulse 0.8s ease-in-out infinite',
        }}
      />
      <div
        className="absolute w-32 h-32 rounded-full border-2"
        style={{
          borderColor: 'rgba(255,255,255,0.3)',
          borderTopColor: BRAND_GREEN,
          borderRightColor: BRAND_BLUE,
          animation: 'boot-ring-rotate 1s linear infinite',
        }}
      />
    </div>
  </div>
);

/* ── Phase 2: 1–3s — Glowing orb ── */
const Phase2Orb = () => (
  <div className="absolute inset-0 flex items-center justify-center">
    <div
      className="w-40 h-40 rounded-full"
      style={{
        background: `radial-gradient(circle, ${BRAND_GREEN} 0%, ${BRAND_BLUE} 60%, transparent 100%)`,
        boxShadow: `0 0 60px ${BRAND_GREEN}40, 0 0 120px ${BRAND_BLUE}30`,
        animation: 'boot-float 2s ease-in-out infinite',
      }}
    />
  </div>
);

/* ── Phase 3: 3–6s — Bouncing ball with trail ── */
const Phase3Bounce = () => {
  const trails = Array.from({ length: 5 }, (_, i) => i);
  return (
    <div className="absolute inset-0">
      {trails.map((i) => (
        <div
          key={i}
          className="absolute w-4 h-4 rounded-full bg-yellow-400"
          style={{
            opacity: 0.5 - i * 0.08,
            animation: `boot-bounce 3s ease-in-out ${3 + i * 0.08}s forwards`,
            boxShadow: '0 0 8px rgba(255,215,0,0.4)',
          }}
        />
      ))}
      <div
        className="absolute w-6 h-6 rounded-full bg-yellow-400"
        style={{
          animation: 'boot-bounce 3s ease-in-out 3s forwards',
          boxShadow: '0 0 15px rgba(255,215,0,0.6)',
        }}
      />
    </div>
  );
};

/* ── Paddle SVG (simplified) ── */
const PaddleSVG = ({ className, style }: { className?: string; style?: React.CSSProperties }) => (
  <svg viewBox="0 0 60 120" className={className} style={style}>
    <rect x="22" y="70" width="16" height="45" rx="4" fill="#8B4513" />
    <ellipse cx="30" cy="35" rx="24" ry="28" fill="white" stroke={BRAND_GREEN} strokeWidth="3" />
    <line x1="25" y1="78" x2="35" y2="78" stroke="#654321" strokeWidth="2" />
    <line x1="25" y1="85" x2="35" y2="85" stroke="#654321" strokeWidth="2" />
    <line x1="25" y1="92" x2="35" y2="92" stroke="#654321" strokeWidth="2" />
  </svg>
);

/* ── Phase 4: 6–8s — Paddles slide in ── */
const Phase4Paddles = () => (
  <div className="absolute inset-0 flex items-center justify-between px-20">
    <PaddleSVG
      className="w-16 h-32"
      style={{
        animation: 'boot-slide-left 1.5s ease-out 6s forwards',
        opacity: 0,
        filter: 'drop-shadow(0 0 10px rgba(255,255,255,0.3))',
      }}
    />
    <PaddleSVG
      className="w-16 h-32"
      style={{
        animation: 'boot-slide-right 1.5s ease-out 6s forwards',
        opacity: 0,
        filter: 'drop-shadow(0 0 10px rgba(255,255,255,0.3))',
      }}
    />
  </div>
);

/* ── Phase 5: 8–9s — Rally + particle burst ── */
const Phase5Rally = () => {
  const particles = Array.from({ length: 12 }, (_, i) => {
    const angle = (i * 30 * Math.PI) / 180;
    return {
      id: i,
      dx: Math.cos(angle) * 120,
      dy: Math.sin(angle) * 120,
      color: i % 2 === 0 ? BRAND_GREEN : '#FFD700',
    };
  });

  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <div className="absolute flex items-center justify-between w-full max-w-3xl px-32">
        <PaddleSVG
          className="w-20 h-40"
          style={{ animation: 'boot-rally-pulse 0.4s ease-in-out infinite alternate' }}
        />
        <PaddleSVG
          className="w-20 h-40"
          style={{ animation: 'boot-rally-pulse 0.4s ease-in-out infinite alternate' }}
        />
      </div>
      <div
        className="absolute w-8 h-8 rounded-full bg-yellow-400"
        style={{
          animation: 'boot-ball-rally 0.8s ease-in-out infinite',
          boxShadow: '0 0 20px rgba(255,215,0,0.6)',
        }}
      />
      {particles.map((p) => (
        <div
          key={p.id}
          className="absolute w-2 h-2 rounded-full"
          style={{
            backgroundColor: p.color,
            '--dx': `${p.dx}px`,
            '--dy': `${p.dy}px`,
            animation: 'boot-particle 0.8s ease-out infinite',
          } as React.CSSProperties}
        />
      ))}
    </div>
  );
};

/* ── Phase 6: 9–10s — Text fade in ── */
const Phase6Text = () => (
  <div className="absolute inset-0 flex items-center justify-center">
    <h1
      className="text-5xl font-black tracking-widest text-white relative z-10"
      style={{
        animation: 'boot-fade-in 1s ease-out 9s forwards',
        opacity: 0,
        textShadow: '0 0 20px rgba(50,164,94,0.5)',
      }}
    >
      PADDLE POINT
    </h1>
  </div>
);

/* ── Main component ── */
export default function BootAnimation() {
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const dismissedRef = useRef(false);

  useEffect(() => {
    const seen = sessionStorage.getItem('pp-boot-animation-seen');
    if (!seen) {
      sessionStorage.setItem('pp-boot-animation-seen', 'true');
      const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (prefersReducedMotion) {
        setVisible(false);
      } else {
        setVisible(true);
      }
    }
  }, []);

  useEffect(() => {
    if (!visible) return;
    const timer = setTimeout(() => {
      if (dismissedRef.current) return;
      dismissedRef.current = true;
      setDismissed(true);
      setTimeout(() => setVisible(false), 500);
    }, 10000);
    return () => clearTimeout(timer);
  }, [visible]);

  if (!visible) return null;

  const dismiss = () => {
    if (dismissedRef.current) return;
    dismissedRef.current = true;
    setDismissed(true);
    setTimeout(() => setVisible(false), 500);
  };

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center transition-opacity duration-500 ${
        dismissed ? 'opacity-0' : 'opacity-100'
      }`}
      style={{ backgroundColor: BRAND_BLUE }}
      aria-live="polite"
      role="status"
    >
      <div className="absolute inset-0" style={{ animation: 'phase-visibility 1s ease 0s forwards' }}>
        <Phase1Ring />
      </div>

      <div className="absolute inset-0" style={{ animation: 'phase-visibility 2s ease 1s forwards' }}>
        <Phase2Orb />
      </div>

      <div className="absolute inset-0" style={{ animation: 'phase-visibility 3s ease 3s forwards' }}>
        <Phase3Bounce />
      </div>

      <div className="absolute inset-0" style={{ animation: 'phase-visibility 2s ease 6s forwards' }}>
        <Phase4Paddles />
      </div>

      <div className="absolute inset-0" style={{ animation: 'phase-visibility 1s ease 8s forwards' }}>
        <Phase5Rally />
      </div>

      <div className="absolute inset-0" style={{ animation: 'phase-visibility-last 1s ease 9s forwards' }}>
        <Phase6Text />
      </div>

      <button
        onClick={dismiss}
        className="absolute top-4 right-4 text-white/50 hover:text-white text-sm z-50"
        aria-label="Skip animation"
      >
        Skip
      </button>
    </div>
  );
}
