# Paddle Point Brand Theme — Design Spec

## 1. Goal

Incorporate the Paddle Point brand look and feel across all web surfaces in `web/`, using the existing brand assets in `assets/Paddle Point/` as the source of truth. The approach is **Option A**: extend the existing shadcn/ui + Tailwind v4 setup with custom brand tokens, rather than importing an external design system.

## 2. Brand Assets

**Location:** `assets/Paddle Point/`

**Primary logo:** `SVG/Primary Logo 1.svg` — stylized pickleball paddle graphic in brand blue and green.

**Submarks:** `SVG/Submark 1.svg` (and variants) — compact logo marks for small UI spaces.

**Formats available:** SVG (preferred for web), PNG, JPG.

**Brand colors (extracted from SVGs):**
- Blue: `#0E5E9A`
- Green: `#32A45E` / `#33A55B`

## 3. Theme Token Changes

**File:** `src/app/globals.css`

### Light mode (`:root`)
- `--primary`: `#0E5E9A` (Paddle Point blue)
- `--primary-foreground`: `#ffffff` (white)
- `--secondary`: `#32A45E` (Paddle Point green)
- `--secondary-foreground`: `#ffffff` (white)
- `--accent`: `oklch(0.95 0.02 230)` (light blue tint)
- `--accent-foreground`: `#0E5E9A`
- `--ring`: `#0E5E9A`
- `--destructive`: Keep existing red
- `--background`: `#ffffff`
- `--foreground`: `#0E5E9A` (brand blue for primary text)
- `--card`: `#ffffff`
- `--card-foreground`: `#0E5E9A`
- `--popover`: `#ffffff`
- `--popover-foreground`: `#0E5E9A`
- `--muted`: `#f0f9ff` (very light blue)
- `--muted-foreground`: `#0E5E9A` (slightly muted blue)
- `--border`: `#e0f2fe` (light sky)
- `--input`: `#e0f2fe`
- `--chart-1` through `--chart-5`: derived from brand palette (blue → green spectrum)

### Dark mode (`.dark`)
- `--background`: `oklch(0.145 0 0)` (keep existing dark)
- `--foreground`: `#ffffff`
- `--primary`: `#0E5E9A` (same blue works on dark)
- `--primary-foreground`: `#ffffff`
- `--secondary`: `#32A45E`
- `--secondary-foreground`: `#ffffff`
- `--accent`: `oklch(0.2 0.05 230)` (dark blue tint)
- `--accent-foreground`: `#ffffff`
- `--card`: `oklch(0.205 0 0)`
- `--card-foreground`: `#ffffff`
- `--muted`: `oklch(0.269 0 0)`
- `--muted-foreground`: `oklch(0.708 0 0)`
- `--border`: `oklch(1 0 0 / 10%)`
- `--ring`: `#0E5E9A`

### Sidebar
- `--sidebar`: `#0E5E9A`
- `--sidebar-foreground`: `#ffffff`
- `--sidebar-primary`: `#ffffff`
- `--sidebar-primary-foreground`: `#0E5E9A`
- `--sidebar-accent`: `oklch(0.2 0.05 230)`
- `--sidebar-accent-foreground`: `#ffffff`
- `--sidebar-border`: `oklch(1 0 0 / 10%)`
- `--sidebar-ring`: `#32A45E`

## 4. Branding Asset Integration

**Copy logo to web public folder:**
- Copy `assets/Paddle Point/SVG/Submark 1.svg` → `web/public/brand/pp-submark.svg`
- Copy `assets/Paddle Point/SVG/Primary Logo 1.svg` → `web/public/brand/pp-logo.svg`
- Also export/copy PNG versions for favicon/og: `assets/Paddle Point/PNG/Submark 1.png` → `web/public/brand/pp-icon.png`

**Use locations:**
- `favicon.ico`: replace with `pp-icon.png` (or generate from SVG)
- Landing page header logo: use `pp-logo.svg` or `pp-submark.svg` inline
- Admin sidebar: use `pp-submark.svg`
- Terminal/booking screens: use `pp-submark.svg` as watermark or header

## 5. Landing Page (`src/app/page.tsx`)

**Header:**
- Replace `bg-white/80` with `bg-background/80 backdrop-blur`
- Logo mark: use `pp-submark.svg` inline (or an `<Image>` component pointing to `/brand/pp-submark.svg`)
- Brand name text: `text-primary`
- Location tagline: `text-primary/70`
- CTA "Book Now": `bg-secondary text-white hover:bg-secondary/90`
- "Staff Login": `text-primary hover:bg-primary/10`

**Hero section:**
- Background: `bg-gradient-to-br from-primary via-primary to-[#1a4a7a]` (derived from brand blue)
- Badge: `bg-primary-foreground/10 text-primary-foreground border-primary-foreground/20`
- Headline: `text-primary-foreground`
- "Pickle Ball" highlight: `text-secondary`
- Subheadline: `text-primary-foreground/80`
- Primary CTA: `bg-secondary text-white hover:bg-secondary/90`
- Secondary CTA: `border-primary-foreground/40 text-primary-foreground hover:bg-primary-foreground/10`

**How It Works section:**
- Background: `bg-background`
- Section title: `text-primary`
- Step badges: `bg-primary text-primary-foreground` for step numbers
- Icon containers: alternating `bg-primary/10` and `bg-secondary/10`
- Icon colors: `text-primary` and `text-secondary`

**Courts section:**
- Background: `bg-muted`
- Card images: use brand gradient `from-primary to-secondary` instead of generic green
- Card borders: `border-primary/10`
- Card titles: `text-primary`

**Why Paddle Point section:**
- Background: `bg-background`
- Icon containers: `bg-primary/10`
- Icons: `text-primary`

**Rates section:**
- Background: `bg-muted`
- Rate cards: `bg-background border-primary/10 hover:border-primary/30`
- Price text: `text-secondary`
- Duration labels: `text-primary/60`

**CTA section:**
- Background: `bg-primary`
- Text: `text-primary-foreground`
- Button: `bg-secondary text-white hover:bg-secondary/90`

**Footer:**
- Background: `bg-primary`
- Text: `text-primary-foreground/70`
- Logo: `pp-submark.svg`

## 6. Register Page (`src/app/register/page.tsx`)

- Background: `bg-muted` or subtle gradient `bg-gradient-to-br from-primary/5 to-secondary/5`
- Card: `border-primary/20 shadow-lg shadow-primary/5`
- Card title: `text-primary`
- Inputs: border `border-input` (already themed)
- Submit button: `bg-primary hover:bg-primary/90 text-primary-foreground`
- NFC scan button: `border-primary text-primary hover:bg-primary/10`
- Success state: `text-secondary`
- Error state: keep existing destructive red

## 7. Terminal/Kiosk (`src/components/terminal/TerminalKiosk.tsx`)

- Background: deep brand blue `bg-primary` or dark variant
- Cards/screens: `bg-background text-foreground`
- Primary actions (Accept, Confirm): `bg-secondary hover:bg-secondary/90`
- Secondary actions: `bg-primary-foreground/10 text-primary-foreground hover:bg-primary-foreground/20`
- Timer/countdown: `text-secondary` for active/urgent states
- Status badges: `bg-primary text-primary-foreground`
- Logo: `pp-submark.svg` in header

## 8. Admin Dashboard (`src/app/(dashboard)/**`)

**Sidebar (`src/components/layout/sidebar.tsx`):**
- Background: `bg-primary`
- Text: `text-primary-foreground`
- Active item: `bg-primary-foreground/15`
- Hover: `hover:bg-primary-foreground/10`
- Logo: `pp-submark.svg`

**Header (`src/components/layout/header.tsx`):**
- Background: `bg-background`
- Border: `border-border` (themed)
- Subtle brand accent on bottom or left edge

**Cards/Tables:**
- Card borders: `border-primary/10`
- Hover: `hover:border-primary/30`
- Action buttons: primary = `bg-primary`, success = `bg-secondary`

**Status indicators:**
- Online/active: `bg-secondary`
- Offline/inactive: `bg-muted-foreground`

## 9. Typography

- **Font:** Keep `Inter` (already loaded via `next/font/google`)
- **Headings:** `font-bold` or `font-extrabold` for hero numbers and section titles
- **Body:** default `Inter` weight
- **Monospace:** `font-mono` for court numbers, timer displays, queue counts, RFID UIDs
- **Tabular nums:** `tabular-nums` on numeric displays

## 10. Border Radius

Keep existing `--radius: 0.625rem`. The existing radius scale (`sm`, `md`, `lg`, `xl`, `2xl`, `3xl`, `4xl`) maps to multiples of this base value. No change needed — rounded but not bubbly, feels athletic.

## 11. Accessibility

- Ensure `primary-foreground` (white) has sufficient contrast against `#0E5E9A` blue (WCAG AA: 4.5:1 minimum)
- `secondary-foreground` (white) against `#32A45E` green: verify contrast ratio
- Focus rings: `ring` color is `#0E5E9A`, visible on all interactive elements
- Dark mode: same contrast checks apply

## 12. Files to Modify

| File | Change |
|---|---|
| `src/app/globals.css` | Update all theme tokens |
| `src/app/page.tsx` | Replace ad-hoc colors with semantic tokens |
| `src/app/register/page.tsx` | Brand card and button |
| `src/components/terminal/TerminalKiosk.tsx` | Brand terminal screens |
| `src/components/layout/sidebar.tsx` | Brand sidebar |
| `src/components/layout/header.tsx` | Subtle brand accent |
| `web/public/brand/` | New: copy logo assets from `assets/Paddle Point/` |

## 13. Out of Scope

- LVGL kiosk firmware styling (separate C/LVGL project)
- ESP32 LED display content (MQTT-driven, separate firmware)
- Mobile app (none exists)

## 14. Web Boot Animation

**Source of truth:** `display-firmware/src/Hub75Driver.cpp::playBootAnimation(10000)` — a 10-second, 6-phase LED animation:
1. **0–1s:** Center pulse → expanding colorful ring
2. **1–3s:** Glowing orb with ball materializing
3. **3–6s:** Ball bounces around screen with rainbow trail and particle impacts
4. **6–8s:** Ball returns to center, two paddles slide in from left/right
5. **8–9s:** Paddles rally toward center, ball strikes with particle burst
6. **9–10s:** "PADDLE POINT" text fades in over settled scene

**Web adaptation:** Full-screen overlay animation shown on first site visit (or once per session), then dismissed automatically. Must use brand colors (`#0E5E9A`, `#32A45E`) and feel energetic/sports-like.

### Implementation approach

**Recommended:** CSS + SVG animation (no canvas dependency, GPU-accelerated, lightweight).

**File:** `src/components/brand/BootAnimation.tsx` (new)

**Component contract:**
- **Props:** `durationMs?: number` (default 10000)
- **Behavior:** 
  - Renders fixed full-screen overlay with `z-50`
  - Animates through 6 phases using CSS keyframes / SVG transforms
  - Auto-dismisses after `durationMs` via `setTimeout`
  - Stores dismissal in `sessionStorage` (show once per tab/session) — NOT `localStorage` (we want returning visitors to see it again for brand reinforcement, but not on every page navigation)
  - Fade-out transition (~500ms) before removing from DOM
- **Accessibility:** `aria-live="polite"` with hidden status text; `pointer-events-none` after dismissal; respects `prefers-reduced-motion` (skip or shorten to 2s)

### Phase-to-visual mapping (web)

| Phase | Duration | Visual |
|---|---|---|
| 1 | 0–1s | Center dot pulses, then expands into a rotating rainbow ring. Background: deep brand blue `#0E5E9A`. |
| 2 | 1–3s | Glowing orb (radial gradient, green `#32A45E` core → blue halo). Ball (yellow circle) scales up from center. |
| 3 | 3–6s | Ball bounces off screen edges with a trailing comet effect (CSS motion blur or multiple fading clones). Hue-rotates through brand spectrum. |
| 4 | 6–8s | Ball eases back to center. Two paddle shapes (SVG paths matching `Submark 1.svg` style) slide in from off-screen left/right. |
| 5 | 8–9s | Paddles center, ball strikes midpoint, particle burst (small divs with `border-radius: 50%` animated outward with CSS). |
| 6 | 9–10s | Ball/paddles settle. "PADDLE POINT" text fades in using brand white. Subtitle: "Solano, Nueva Vizcaya" fades in below. |

### Integration point

**File:** `src/app/page.tsx`

Wrap the landing page content:

```tsx
import BootAnimation from '@/components/brand/BootAnimation';

export default async function LandingPage({ searchParams }) {
  // ... existing logic ...
  return (
    <>
      <BootAnimation />
      {/* existing landing page markup */}
    </>
  );
}
```

The animation mounts before the rest of the page renders. Since the landing page is already a server component, `BootAnimation` must be a `'use client'` component.

### Files to add/modify

| File | Change |
|---|---|
| `src/components/brand/BootAnimation.tsx` | New: boot animation client component |
| `src/app/page.tsx` | Wrap with `<BootAnimation />` |
| `src/app/globals.css` | Optional: add boot animation keyframes if CSS-only (no Framer Motion) |
