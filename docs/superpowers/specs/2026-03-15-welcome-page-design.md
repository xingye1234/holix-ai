# Welcome Page & Splash Screen Design

**Date**: 2026-03-15
**Status**: Approved
**Scope**: First-launch welcome page + per-launch splash animation

---

## Overview

Two independent UI modules that together eliminate the white-screen flash on startup and provide a branded first-run experience.

- **SplashScreen** — shows on every launch, fades out after ~800ms
- **WelcomePage** — shows only on first launch, has actionable content

---

## Architecture

### First-launch detection

A single `localStorage` key determines whether the user has completed the welcome flow:

```
key:   'holix-welcomed'
value: '1'  → user has been welcomed before
absent      → first launch
```

### Routing

`__root.tsx` gains a `beforeLoad` hook:

```ts
beforeLoad: ({ location }) => {
  if (!localStorage.getItem('holix-welcomed') && location.pathname !== '/welcome') {
    throw redirect({ to: '/welcome' })
  }
}
```

### Startup flow

**First launch:**
```
App loads
  → SplashScreen mounts (z-60, covers everything)
  → beforeLoad redirects to /welcome
  → SplashScreen fades out at 500ms, unmounts at 800ms
  → WelcomePage is revealed underneath
  → User clicks "开始使用"
  → localStorage.setItem('holix-welcomed', '1')
  → navigate({ to: '/' })
```

**Subsequent launches:**
```
App loads
  → SplashScreen mounts (z-60, covers everything)
  → beforeLoad passes through to normal route
  → SplashScreen fades out at 500ms, unmounts at 800ms
  → Main app is revealed
```

---

## SplashScreen (`src/components/app/splash-screen.tsx`)

### Layout

`fixed inset-0 z-[60] bg-background` — full-screen overlay above all other content.

Content centered vertically and horizontally:

```
[logo.png — 56×56px]
Holix AI  (text-xl font-semibold)
```

### Animation (framer-motion)

| Time | State |
|------|-------|
| 0ms | Mounted, `opacity: 1` |
| 500ms | Begin fade-out (`opacity: 0`, duration 300ms) |
| 800ms | Animation complete, component unmounts via `AnimatePresence` |

### Integration in `__root.tsx`

```tsx
// State
const [splashDone, setSplashDone] = useState(false)

// Effect
useEffect(() => {
  const t = setTimeout(() => setSplashDone(true), 800)
  return () => clearTimeout(t)
}, [])

// Render (inside RootLayout, above everything)
<AnimatePresence>
  {!splashDone && <SplashScreen />}
</AnimatePresence>
```

---

## WelcomePage (`src/routes/welcome.tsx`)

### Layout

`fixed inset-0 z-50 bg-background` — full-screen, sits below SplashScreen (z-60).

Content centered:

```
[logo.png — 72×72px]

Holix AI
(text-3xl font-bold)

欢迎使用 Holix AI，您的智能 AI 对话与协作助手
(text-muted-foreground, max-w-sm, text-center)

[ 开始使用  → ]
(Button size="lg", arrow icon)
```

### Entry animation

Page fades in with framer-motion (`opacity: 0 → 1`, 300ms) after mount — naturally syncs with SplashScreen fade-out.

### Button behavior

```ts
onClick: () => {
  localStorage.setItem('holix-welcomed', '1')
  navigate({ to: '/' })
}
```

### i18n

Welcome copy is hardcoded (English/Chinese mixed acceptable). This page is shown exactly once per install and does not warrant i18n entries.

---

## File Changes

| File | Change |
|------|--------|
| `src/components/app/splash-screen.tsx` | New file |
| `src/routes/welcome.tsx` | New file |
| `src/routes/__root.tsx` | Add `beforeLoad` redirect + `SplashScreen` mount |

No store changes, no schema changes, no new dependencies (framer-motion already in use).

---

## Non-goals

- Onboarding wizard / guided tour (future task)
- Provider setup wizard (future task)
- i18n for welcome copy
- Skip button on splash
- Electron native splash window
