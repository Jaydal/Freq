# Paddle Point Brand Theme Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply the Paddle Point brand theme across all web surfaces and add a 10-second web boot animation adapted from the display firmware.

**Architecture:** Extend the existing shadcn/ui + Tailwind v4 token system in `globals.css` with brand colors, then update public-facing pages and admin surfaces to use semantic tokens instead of ad-hoc Tailwind classes. Add a client-side boot animation component that plays once per session on the landing page.

**Tech Stack:** Next.js 14 (App Router), Tailwind CSS v4, shadcn/ui, React, TypeScript, CSS keyframe animations.

**Spec reference:** `docs/superpowers/specs/2026-08-19-paddle-point-brand-theme-design.md`

---

## File Structure

```
web/
├── public/
│   └── brand/
│       ├── pp-logo.svg        # Primary logo (copied from assets)
│       ├── pp-submark.svg     # Compact logo mark (copied from assets)
│       └── pp-icon.png        # Favicon/OG image (copied from assets)
├── src/
│   ├── app/
│   │   ├── globals.css        # Theme token source of truth
│   │   ├── layout.tsx         # Font + metadata (minor brand update)
│   │   ├── page.tsx           # Landing page — full rebrand
│   │   └── register/
│   │       └── page.tsx       # Registration — brand card + buttons
│   ├── components/
│   │   ├── brand/
│   │   │   └── BootAnimation.tsx  # NEW — 10s animated overlay
│   │   ├── layout/
│   │   │   ├── sidebar.tsx    # Brand sidebar
│   │   │   └── header.tsx     # Subtle brand accent
│   │   └── terminal/
│   │       └── TerminalKiosk.tsx  # Brand kiosk screens
```

---

### Task 1: Copy branding assets to web public

**Files:**
- Create: `web/public/brand/` directory
- Copy: `assets/Paddle Point/SVG/Submark 1.svg` → `web/public/brand/pp-submark.svg`
- Copy: `assets/Paddle Point/SVG/Primary Logo 1.svg` → `web/public/brand/pp-logo.svg`
- Copy: `assets/Paddle Point/PNG/Submark 1.png` → `web/public/brand/pp-icon.png`

- [ ] **Step 1: Create brand directory and copy assets**

```bash
mkdir -p web/public/brand
cp "assets/Paddle Point/SVG/Submark 1.svg" web/public/brand/pp-submark.svg
cp "assets/Paddle Point/SVG/Primary Logo 1.svg" web/public/brand/pp-logo.svg
cp "assets/Paddle Point/PNG/Submark 1.png" web/public/brand/pp-icon.png
```

- [ ] **Step 2: Verify copies**

Run: `ls -la web/public/brand/`
Expected: 3 files present (`pp-logo.svg`, `pp-submark.svg`, `pp-icon.png`)

- [ ] **Step 3: Commit**

```bash
git add web/public/brand/
git commit -m "feat: add Paddle Point branding assets to web public"
```

---

### Task 2: Update theme tokens in globals.css

**Files:**
- Modify: `src/app/globals.css` (replace all `--primary`, `--secondary`, `--accent`, `--ring`, `--foreground`, `--background`, `--card`, `--muted`, `--border`, `--input`, `--chart-*`, `--sidebar-*` tokens)
- Test: Verify build passes and shadcn components render with brand colors

- [ ] **Step 1: Update light mode tokens**

Replace the `:root` block in `src/app/globals.css` with:

```css
:root {
  --background: #ffffff;
  --foreground: #0E5E9A;
  --card: #ffffff;
  --card-foreground: #0E5E9A;
  --popover: #ffffff;
  --popover-foreground: #0E5E9A;
  --primary: #0E5E9A;
  --primary-foreground: #ffffff;
  --secondary: #32A45E;
  --secondary-foreground: #ffffff;
  --muted: #f0f9ff;
  --muted-foreground: #0E5E9A;
  --accent: oklch(0.95 0.02 230);
  --accent-foreground: #0E5E9A;
  --destructive: oklch(0.577 0.245 27.325);
  --border: #e0f2fe;
  --input: #e0f2fe;
  --ring: #0E5E9A;
  --chart-1: #0E5E9A;
  --chart-2: #1e88e5;
  --chart-3: #32A45E;
  --chart-4: #66bb6a;
  --chart-5: #f9a825;
  --radius: 0.625rem;
  --sidebar: #0E5E9A;
  --sidebar-foreground: #ffffff;
  --sidebar-primary: #ffffff;
  --sidebar-primary-foreground: #0E5E9A;
  --sidebar-accent: oklch(0.2 0.05 230);
  --sidebar-accent-foreground: #ffffff;
  --sidebar-border: oklch(1 0 0 / 10%);
  --sidebar-ring: #32A45E;
}
```

- [ ] **Step 2: Update dark mode tokens**

Replace the `.dark` block in `src/app/globals.css` with:

```css
.dark {
  --background: oklch(0.145 0 0);
  --foreground: #ffffff;
  --card: oklch(0.205 0 0);
  --card-foreground: #ffffff;
  --popover: oklch(0.205 0 0);
  --popover-foreground: #ffffff;
  --primary: #0E5E9A;
  --primary-foreground: #ffffff;
  --secondary: #32A45E;
  --secondary-foreground: #ffffff;
  --muted: oklch(0.269 0 0);
  --muted-foreground: oklch(0.708 0 0);
  --accent: oklch(0.2 0.05 230);
  --accent-foreground: #ffffff;
  --destructive: oklch(0.704 0.191 22.216);
  --border: oklch(1 0 0 / 10%);
  --input: oklch(1 0 0 / 15%);
  --ring: #0E5E9A;
  --chart-1: #0E5E9A;
  --chart-2: #1e88e5;
  --chart-3: #32A45E;
  --chart-4: #66bb6a;
  --chart-5: #f9a825;
  --sidebar: #0E5E9A;
  --sidebar-foreground: #ffffff;
  --sidebar-primary: #ffffff;
  --sidebar-primary-foreground: #0E5E9A;
  --sidebar-accent: oklch(0.2 0.05 230);
  --sidebar-accent-foreground: #ffffff;
  --sidebar-border: oklch(1 0 0 / 10%);
  --sidebar-ring: #32A45E;
}
```

- [ ] **Step 3: Verify build**

Run: `cd web && npm run build`
Expected: Build succeeds with no CSS/token errors

- [ ] **Step 4: Commit**

```bash
git add src/app/globals.css
git commit -m "feat: update theme tokens to Paddle Point brand colors"
```

---

### Task 3: Create BootAnimation component

**Files:**
- Create: `src/components/brand/BootAnimation.tsx`
- Test: Manual visual test in browser

**Behavior:** Full-screen overlay, plays 10s animation, auto-dismisses, respects `sessionStorage`.

- [ ] **Step 1: Write BootAnimation.tsx**

```tsx
'use client';

import { useEffect, useState } from 'react';

const BRAND_BLUE = '#0E5E9A';
const BRAND_GREEN = '#32A45E';

export default function BootAnimation({ durationMs = 10000 }: { durationMs?: number }) {
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const seen = sessionStorage.getItem('pp-boot-animation-seen');
    if (!seen) {
      setVisible(true);
      sessionStorage.setItem('pp-boot-seen', 'true');
    }
  }, []);

  useEffect(() => {
    if (!visible) return;
    const timer = setTimeout(() => {
      setDismissed(true);
      setTimeout(() => setVisible(false), 500);
    }, durationMs);
    return () => clearTimeout(timer);
  }, [visible, durationMs]);

  if (!visible) return null;

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center transition-opacity duration-500 ${
        dismissed ? 'opacity-0' : 'opacity-100'
      }`}
      style={{ backgroundColor: BRAND_BLUE }}
      aria-live="polite"
      role="status"
    >
      {/* Phase 1: 0-1s — Center pulse + expanding ring */}
      <Phase1Ring />

      {/* Phase 2: 1-3s — Glowing orb + ball materialize */}
      <Phase2Orb />

      {/* Phase 3: 3-6s — Bouncing ball with trail */}
      <Phase3Bounce />

      {/* Phase 4: 6-8s — Paddles slide in */}
      <Phase4Paddles />

      {/* Phase 5: 8-9s — Rally + particle burst */}
      <Phase5Rally />

      {/* Phase 6: 9-10s — Text fade in */}
      <Phase6Text />

      {/* Skip button (accessibility) */}
      <button
        onClick={() => {
          setDismissed(true);
          setTimeout(() => setVisible(false), 500);
        }}
        className="absolute top-4 right-4 text-white/50 hover:text-white text-sm z-50"
        aria-label="Skip animation"
      >
        Skip
      </button>
    </div>
  );
}
```

**Note:** For the actual animation implementation, use CSS keyframes defined in `globals.css` or inline styles with `@keyframes`. The phases should be driven by CSS animation-delay so they run sequentially within the 10s window.

- [ ] **Step 2: Add CSS keyframes to globals.css**

Append to `src/app/globals.css`:

```css
@keyframes boot-pulse {
  0%, 100% { transform: scale(1); opacity: 0.8; }
  50% { transform: scale(1.5); opacity: 1; }
}

@keyframes boot-ring-rotate {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

@keyframes boot-float {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-20px); }
}

@keyframes boot-fade-in {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes boot-particle {
  0% { transform: translate(0, 0) scale(1); opacity: 1; }
  100% { transform: translate(var(--dx), var(--dy)) scale(0); opacity: 0; }
}

@keyframes boot-slide-left {
  from { transform: translateX(-120%); }
  to { transform: translateX(0); }
}

@keyframes boot-slide-right {
  from { transform: translateX(120%); }
  to { transform: translateX(0); }
}
```

- [ ] **Step 3: Implement each phase sub-component**

Create the phase components inline or as separate files within `src/components/brand/`:

| Sub-component | Timing | Visual |
|---|---|---|
| `Phase1Ring` | 0–1s | Center circle with `boot-pulse` animation, surrounded by rotating colored ring |
| `Phase2Orb` | 1–3s | Large radial gradient circle (green core → blue halo) with `boot-float` |
| `Phase3Bounce` | 3–6s | Yellow ball bouncing with CSS `@keyframes` moving it around viewport |
| `Phase4Paddles` | 6–8s | Two SVG paddles (simplified from `Submark 1.svg`) sliding in from left/right |
| `Phase5Rally` | 8–9s | Paddles center, ball scales up, particles burst outward |
| `Phase6Text` | 9–10s | "PADDLE POINT" text with `boot-fade-in` |

- [ ] **Step 4: Test in browser**

Run: `cd web && npm run dev`
Open: `http://localhost:3000`
Expected: Full-screen blue overlay with animated sequence plays, auto-dismisses after 10s, reveals landing page. Refresh page — animation replays (sessionStorage). Open in new tab — animation plays again.

- [ ] **Step 5: Commit**

```bash
git add src/components/brand/BootAnimation.tsx src/app/globals.css
git commit -m "feat: add Paddle Point web boot animation"
```

---

### Task 4: Brand the landing page

**Files:**
- Modify: `src/app/page.tsx`
- Modify: `src/app/layout.tsx` (update favicon)

- [ ] **Step 1: Update layout.tsx favicon**

In `src/app/layout.tsx`, add favicon link:

```tsx
import { PP_ICON } from '@/constants/brand';

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="icon" href={PP_ICON} />
      </head>
      <body className={inter.className}>
        {/* ... */}
      </body>
    </html>
  );
}
```

Create `src/constants/brand.ts`:

```ts
export const PP_LOGO = '/brand/pp-logo.svg';
export const PP_SUBMARK = '/brand/pp-submark.svg';
export const PP_ICON = '/brand/pp-icon.png';
```

- [ ] **Step 2: Replace ad-hoc colors in page.tsx**

Replace all `sky-*`, `emerald-*`, `gray-*` utility classes with semantic theme tokens:

**Header:**
```tsx
<header className="px-6 py-4 flex justify-between items-center bg-background/80 backdrop-blur border-b sticky top-0 z-10">
  <div className="flex items-center gap-2">
    <Image src={PP_SUBMARK} alt="Paddle Point" width={32} height={32} />
    <div>
      <div className="text-lg font-bold text-primary leading-tight">Paddle Point</div>
      <div className="text-xs text-primary/70 leading-tight">Solano, Nueva Vizcaya</div>
    </div>
  </div>
  <nav className="flex gap-4 items-center">
    <Link href="/terminal">
      <Button className="bg-secondary text-white hover:bg-secondary/90">Book Now</Button>
    </Link>
    <Link href="/login">
      <Button variant="ghost" className="text-primary hover:bg-primary/10">Staff Login</Button>
    </Link>
  </nav>
</header>
```

**Hero:**
```tsx
<section className="py-16 md:py-24 px-4 bg-gradient-to-br from-primary via-primary to-[#1a4a7a] text-white">
  {/* badge */}
  <div className="inline-block px-3 py-1 bg-primary-foreground/10 text-primary-foreground text-sm rounded-full border border-primary-foreground/20">
    Solano, Nueva Vizcaya • 3 Outdoor Courts • Open Daily
  </div>
  {/* headline */}
  <h1 className="text-5xl md:text-6xl font-extrabold tracking-tight leading-tight text-primary-foreground">
    Your Next <span className="text-secondary">Pickle Ball</span> Game
    <span className="block text-3xl md:text-4xl font-semibold text-primary-foreground/80">Starts Here</span>
  </h1>
  {/* ... */}
</section>
```

**How It Works / Courts / Why / Rates / CTA / Footer:** Apply semantic tokens per spec section 5.

- [ ] **Step 3: Replace CourtIllustration SVG with brand SVG**

```tsx
import Image from 'next/image';

function CourtIllustration() {
  return (
    <Image
      src={PP_LOGO}
      alt="Paddle Point court illustration"
      width={400}
      height={260}
      className="w-full max-w-lg mx-auto"
    />
  );
}
```

- [ ] **Step 4: Wrap landing page with BootAnimation**

```tsx
import BootAnimation from '@/components/brand/BootAnimation';

export default async function LandingPage({ searchParams }) {
  // ... existing logic ...
  return (
    <>
      <BootAnimation />
      <div className="flex flex-col min-h-screen">
        {/* existing landing page markup */}
      </div>
    </>
  );
}
```

- [ ] **Step 5: Verify in browser**

Run: `cd web && npm run dev`
Open: `http://localhost:3000`
Expected: Boot animation plays, then landing page renders with brand colors (blue headers, green CTAs, branded cards).

- [ ] **Step 6: Commit**

```bash
git add src/app/page.tsx src/app/layout.tsx src/constants/brand.ts
git commit -m "feat: brand landing page with Paddle Point theme"
```

---

### Task 5: Brand the register page

**Files:**
- Modify: `src/app/register/page.tsx`

- [ ] **Step 1: Update background and card**

```tsx
<div className="min-h-screen flex items-center justify-center bg-muted p-4">
  <Card className="w-full max-w-md border-primary/20 shadow-lg shadow-primary/5">
    <CardHeader>
      <CardTitle className="text-primary">Member Registration</CardTitle>
    </CardHeader>
    <CardContent>
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* ... inputs ... */}
        <Button type="submit" disabled={submitting} className="w-full bg-primary hover:bg-primary/90 text-primary-foreground">
          {submitting ? 'Registering…' : 'Register Member'}
        </Button>
      </form>
    </CardContent>
  </Card>
</div>
```

- [ ] **Step 2: Update NFC scan button**

```tsx
<Button
  type="button"
  variant="outline"
  onClick={handleScanNfc}
  disabled={scanning}
  className="shrink-0 border-primary text-primary hover:bg-primary/10"
>
  {scanning ? 'Scanning…' : 'Scan NFC'}
</Button>
```

- [ ] **Step 3: Verify in browser**

Run: `cd web && npm run dev`
Open: `http://localhost:3000/register`
Expected: Page has light blue background, card has blue border, primary button is brand blue.

- [ ] **Step 4: Commit**

```bash
git add src/app/register/page.tsx
git commit -m "feat: brand register page with Paddle Point theme"
```

---

### Task 6: Brand the terminal/kiosk

**Files:**
- Modify: `src/components/terminal/TerminalKiosk.tsx`
- Modify: `src/app/terminal/page.tsx` (if wrapper styling needed)

- [ ] **Step 1: Update TerminalKiosk.tsx wrapper**

Find the root container and update:

```tsx
<div className="min-h-screen bg-primary text-primary-foreground">
  {/* existing terminal content */}
</div>
```

- [ ] **Step 2: Update primary action buttons**

Find Accept/Confirm buttons and update:

```tsx
<Button className="bg-secondary hover:bg-secondary/90 text-white">
  Accept Offer
</Button>
```

- [ ] **Step 3: Update secondary/ghost buttons**

```tsx
<Button variant="ghost" className="text-primary-foreground hover:bg-primary-foreground/10">
  Decline
</Button>
```

- [ ] **Step 4: Update timer/countdown styling**

Find timer displays and apply:

```tsx
<span className="text-secondary font-mono tabular-nums text-2xl font-bold">
  {formatTime(remaining)}
</span>
```

- [ ] **Step 5: Add logo to kiosk header**

```tsx
import Image from 'next/image';
import { PP_SUBMARK } from '@/constants/brand';

<div className="flex items-center gap-2 mb-6">
  <Image src={PP_SUBMARK} alt="Paddle Point" width={32} height={32} />
  <span className="text-lg font-bold">Paddle Point</span>
</div>
```

- [ ] **Step 6: Verify in browser**

Run: `cd web && npm run dev`
Open: `http://localhost:3000/terminal`
Expected: Deep blue background, white text, green action buttons, branded header.

- [ ] **Step 7: Commit**

```bash
git add src/components/terminal/TerminalKiosk.tsx src/app/terminal/page.tsx
git commit -m "feat: brand terminal kiosk with Paddle Point theme"
```

---

### Task 7: Brand the admin dashboard

**Files:**
- Modify: `src/components/layout/sidebar.tsx`
- Modify: `src/components/layout/header.tsx`
- Test: Navigate through dashboard pages, verify sidebar and header branding

- [ ] **Step 1: Update sidebar.tsx**

```tsx
<aside className="w-64 bg-primary text-primary-foreground flex flex-col">
  <div className="p-4 flex items-center gap-2">
    <Image src={PP_SUBMARK} alt="Paddle Point" width={28} height={28} />
    <span className="font-bold text-lg">Paddle Point</span>
  </div>
  <nav className="flex-1 px-2 space-y-1">
    {items.map((item) => (
      <Link
        key={item.href}
        href={item.href}
        className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
          isActive
            ? 'bg-primary-foreground/15 text-primary-foreground'
            : 'text-primary-foreground/80 hover:bg-primary-foreground/10'
        }`}
      >
        {item.icon}
        {item.label}
      </Link>
    ))}
  </nav>
</aside>
```

- [ ] **Step 2: Update header.tsx**

```tsx
<header className="h-14 bg-background border-b border-border flex items-center px-6">
  {/* existing header content */}
  <div className="absolute bottom-0 left-0 w-1 h-full bg-secondary" />
</header>
```

- [ ] **Step 3: Verify dashboard pages**

Run: `cd web && npm run dev`
Open: `http://localhost:3000/dashboard`
Navigate through courts, settings, leds pages.
Expected: Blue sidebar, white text, green accent on active items, subtle green left-edge accent on header.

- [ ] **Step 4: Commit**

```bash
git add src/components/layout/sidebar.tsx src/components/layout/header.tsx
git commit -m "feat: brand admin dashboard sidebar and header"
```

---

### Task 8: Final verification

- [ ] **Step 1: Run build**

Run: `cd web && npm run build`
Expected: Build succeeds with no errors.

- [ ] **Step 2: Run tests**

Run: `cd web && npx vitest run`
Expected: Same pass rate as baseline (3 pre-existing `esp32.test.ts` failures allowed).

- [ ] **Step 3: Visual verification checklist**

- [ ] Landing page: blue header, green CTAs, branded hero gradient
- [ ] Landing page: boot animation plays on first load
- [ ] Register page: blue-bordered card, blue primary button
- [ ] Terminal: deep blue background, green actions
- [ ] Admin dashboard: blue sidebar, white text, green accents
- [ ] Dark mode: all surfaces readable with brand colors

- [ ] **Step 4: Commit any remaining changes**

```bash
git add .
git commit -m "feat: complete Paddle Point brand theme across web"
```

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-08-19-paddle-point-brand-theme.md`. Two execution options:

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints

Which approach?
