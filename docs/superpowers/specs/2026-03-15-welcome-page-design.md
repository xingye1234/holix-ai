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

This key is separate from `holix-ui-preferences` (the Zustand UI store). It is a one-way flag. Any future "reset app" feature must explicitly clear this key alongside other localStorage entries.

### Routing

`__root.tsx` gains a `beforeLoad` hook. Requires importing `redirect` from `@tanstack/react-router`.

```ts
import { createRootRoute, Outlet, redirect } from '@tanstack/react-router'

beforeLoad: ({ location }) => {
  if (!localStorage.getItem('holix-welcomed') && location.pathname !== '/welcome') {
    throw redirect({ to: '/welcome' })
  }
}
```

`/welcome` also gains its own `beforeLoad` to redirect away when the user has already been welcomed (prevents landing on the welcome page via back-navigation or direct URL):

```ts
// src/routes/welcome.tsx
export const Route = createFileRoute('/welcome')({
  beforeLoad: () => {
    if (localStorage.getItem('holix-welcomed')) {
      throw redirect({ to: '/' })
    }
  },
  component: WelcomePage,
})
```

### Layout overlay approach

`/welcome` renders inside `RootLayout` (AppHeader + AppSideBar + AppMain are mounted). The WelcomePage component uses `fixed inset-0 z-50` to visually cover the entire viewport. This is intentional: the implementation avoids a root layout refactor. The underlying chrome mounts but remains invisible beneath the overlays.

SplashScreen (z-[60]) sits above WelcomePage (z-50), blocking all pointer interaction with both the underlying app chrome and the welcome page until it unmounts. SplashScreen must NOT use `pointer-events-none` — its presence must block interaction with anything underneath while it is visible.

### Startup flow

**First launch:**
```
App loads
  → SplashScreen mounts (z-[60], covers everything, blocks pointer events)
  → beforeLoad redirects to /welcome (AppHeader + AppSideBar mount underneath, invisible)
  → SplashScreen fades out at 500ms, unmounts at 800ms
  → WelcomePage (z-50) is revealed
  → User clicks "开始使用"
  → localStorage.setItem('holix-welcomed', '1')
  → navigate({ to: '/' })
```

**Subsequent launches:**
```
App loads
  → SplashScreen mounts (z-[60], covers everything, blocks pointer events)
  → beforeLoad passes through to normal route
  → SplashScreen fades out at 500ms, unmounts at 800ms
  → Main app is revealed
```

---

## SplashScreen (`src/components/app/splash-screen.tsx`)

### Layout

`fixed inset-0 z-[60] bg-background` — full-screen overlay above all other content. No `pointer-events-none`.

Content centered vertically and horizontally:

```
[logo.png — 56×56px]
Holix AI  (text-xl font-semibold)
```

### Animation (framer-motion)

The root element must be `motion.div`. The exit animation is driven by framer-motion via `AnimatePresence` in the parent — the component does not manage its own fade timer.

```tsx
// SplashScreen root element
<motion.div
  className="fixed inset-0 z-[60] bg-background flex items-center justify-center"
  initial={{ opacity: 1 }}
  exit={{ opacity: 0, transition: { duration: 0.3, delay: 0.5 } }}
>
  {/* Logo + name */}
</motion.div>
```

| Time | State |
|------|-------|
| 0ms | Mounted, `opacity: 1` |
| 500ms | `exit` animation begins (`delay: 0.5`), fade to `opacity: 0` over 300ms |
| 800ms | Animation complete, `AnimatePresence` unmounts component |

### Integration in `__root.tsx`

Requires adding `useState`, `useEffect` to React imports in `__root.tsx`.

```tsx
import { useState, useEffect } from 'react'
import { AnimatePresence } from 'framer-motion'

// Inside RootLayout:
const [splashDone, setSplashDone] = useState(false)

useEffect(() => {
  const t = setTimeout(() => setSplashDone(true), 800)
  return () => clearTimeout(t)
}, [])

// Render above the main layout div:
<AnimatePresence>
  {!splashDone && <SplashScreen />}
</AnimatePresence>
```

---

## WelcomePage (`src/routes/welcome.tsx`)

### Layout

`fixed inset-0 z-50 bg-background` — full-screen, sits below SplashScreen (z-[60]).

Content centered:

```
[logo.png — 72×72px]

Holix AI
(text-3xl font-bold)

欢迎使用 Holix AI，您的智能 AI 对话与协作助手
(text-muted-foreground, max-w-sm, text-center)

[ 开始使用  → ]
(Button size="lg", ArrowRight icon)
```

### Entry animation

Page fades in with framer-motion (`opacity: 0 → 1`, 300ms) on mount — naturally syncs with SplashScreen fade-out.

```tsx
<motion.div
  className="fixed inset-0 z-50 bg-background ..."
  initial={{ opacity: 0 }}
  animate={{ opacity: 1 }}
  transition={{ duration: 0.3 }}
>
```

### Button behavior

```ts
// welcome.tsx requires:
// import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router'
const navigate = useNavigate()

onClick: () => {
  localStorage.setItem('holix-welcomed', '1')
  navigate({ to: '/' })
}
```

### i18n

Welcome copy is hardcoded. This page is shown exactly once per install and does not warrant i18n entries.

---

## File Changes

| File | Change |
|------|--------|
| `src/components/app/splash-screen.tsx` | New file |
| `src/routes/welcome.tsx` | New file |
| `src/routes/__root.tsx` | Add `redirect` import, `beforeLoad`, `useState`/`useEffect`, `SplashScreen` + `AnimatePresence` |
| `src/routeTree.gen.ts` | Auto-regenerated by TanStack Router (adds `/welcome` route entry) |

No store changes, no schema changes, no new dependencies (framer-motion already in use).

---

## Developer Notes

**Resetting welcome state during development:**

```js
// In browser DevTools console:
localStorage.removeItem('holix-welcomed')
// Then reload the app to see the welcome flow
```

Hot reload (Vite HMR) resets `splashDone` state to `false`, causing the splash to replay on every full reload in dev mode. This is expected dev-mode behavior and is not a bug.

---

## Non-goals

- Onboarding wizard / guided tour (future task)
- Provider setup wizard (future task)
- i18n for welcome copy
- Skip button on splash
- Electron native splash window
