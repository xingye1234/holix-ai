# Welcome Page & Splash Screen Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a branded splash screen shown on every app launch, and a first-run welcome page shown only on the first launch.

**Architecture:** `SplashScreen` is a framer-motion `motion.div` mounted via `AnimatePresence` in `__root.tsx`; it fades out after 800ms. `WelcomePage` is a TanStack Router file route at `/welcome` rendered as a `fixed inset-0 z-50` overlay. A `localStorage` key `holix-welcomed` gates first-launch routing via `beforeLoad` on the root route.

**Tech Stack:** React, TanStack Router (file-based routing), framer-motion, Tailwind CSS v4, lucide-react, Vitest + @testing-library/react

**Spec:** `docs/superpowers/specs/2026-03-15-welcome-page-design.md`

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `src/components/app/splash-screen.tsx` | Create | Full-screen overlay with logo + app name, framer-motion exit animation |
| `src/components/app/__tests__/splash-screen.test.tsx` | Create | Render tests for SplashScreen content |
| `src/routes/welcome.tsx` | Create | First-launch welcome page: logo, headline, tagline, CTA button |
| `src/routes/__root.tsx` | Modify | Add `beforeLoad` redirect + `SplashScreen` via `AnimatePresence` |
| `src/routeTree.gen.ts` | Auto-regenerated | TanStack Router updates this when dev server runs |

---

## Chunk 1: SplashScreen Component

### Task 1: SplashScreen component with tests

**Files:**
- Create: `src/components/app/__tests__/splash-screen.test.tsx`
- Create: `src/components/app/splash-screen.tsx`

- [ ] **Step 1: Write the failing test**

  Create `src/components/app/__tests__/splash-screen.test.tsx`:

  ```tsx
  import { render, screen } from '@testing-library/react'
  import SplashScreen from '../splash-screen'

  describe('SplashScreen', () => {
    it('renders the app logo', () => {
      render(<SplashScreen />)
      const logo = screen.getByRole('img', { name: /holix ai/i })
      expect(logo).toBeInTheDocument()
    })

    it('renders the app name', () => {
      render(<SplashScreen />)
      expect(screen.getByText('Holix AI')).toBeInTheDocument()
    })
  })
  ```

- [ ] **Step 2: Run test to confirm it fails**

  ```bash
  pnpm vitest run --project ui src/components/app/__tests__/splash-screen.test.tsx
  ```

  Expected: FAIL — `Cannot find module '../splash-screen'`

- [ ] **Step 3: Implement SplashScreen**

  Create `src/components/app/splash-screen.tsx`:

  ```tsx
  import { motion } from 'framer-motion'

  export default function SplashScreen() {
    return (
      <motion.div
        className="fixed inset-0 z-[60] bg-background flex flex-col items-center justify-center gap-3"
        initial={{ opacity: 1 }}
        exit={{ opacity: 0, transition: { duration: 0.3, delay: 0.5 } }}
      >
        <img src="/logo.png" alt="Holix AI" className="w-14 h-14" />
        <span className="text-xl font-semibold">Holix AI</span>
      </motion.div>
    )
  }
  ```

  > Note: `/logo.png` references `public/logo.png` via Vite's public directory. No import needed — it is served at the root URL in both dev and production Electron builds.

- [ ] **Step 4: Run test to confirm it passes**

  ```bash
  pnpm vitest run --project ui src/components/app/__tests__/splash-screen.test.tsx
  ```

  Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

  ```bash
  git add src/components/app/splash-screen.tsx src/components/app/__tests__/splash-screen.test.tsx
  git commit -m "feat: add SplashScreen component"
  ```

---

## Chunk 2: WelcomePage Route

### Task 2: Welcome page route

**Files:**
- Create: `src/routes/welcome.tsx`

No unit tests for this route — it depends on TanStack Router context (`useNavigate`, `beforeLoad`). Functional coverage is provided by the manual verification in Task 4.

- [ ] **Step 1: Create the welcome route**

  Create `src/routes/welcome.tsx`:

  ```tsx
  import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router'
  import { motion } from 'framer-motion'
  import { ArrowRight } from 'lucide-react'
  import { Button } from '@/components/ui/button'

  function WelcomePage() {
    const navigate = useNavigate()

    function handleStart() {
      localStorage.setItem('holix-welcomed', '1')
      navigate({ to: '/' })
    }

    return (
      <motion.div
        className="fixed inset-0 z-50 bg-background flex flex-col items-center justify-center gap-6"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
      >
        <img src="/logo.png" alt="Holix AI" className="w-[72px] h-[72px]" />
        <div className="flex flex-col items-center gap-2">
          <h1 className="text-3xl font-bold">Holix AI</h1>
          <p className="text-muted-foreground text-center max-w-sm">
            欢迎使用 Holix AI，您的智能 AI 对话与协作助手
          </p>
        </div>
        <Button size="lg" onClick={handleStart}>
          开始使用
          <ArrowRight className="ml-2 w-4 h-4" />
        </Button>
      </motion.div>
    )
  }

  export const Route = createFileRoute('/welcome')({
    beforeLoad: () => {
      if (localStorage.getItem('holix-welcomed')) {
        throw redirect({ to: '/' })
      }
    },
    component: WelcomePage,
  })
  ```

- [ ] **Step 2: Start dev server — confirm no TypeScript errors**

  ```bash
  pnpm dev
  ```

  Expected: Dev server starts cleanly. TanStack Router auto-regenerates `src/routeTree.gen.ts` to include `/welcome`. No TS errors in the terminal or editor.

- [ ] **Step 3: Commit**

  ```bash
  git add src/routes/welcome.tsx src/routeTree.gen.ts
  git commit -m "feat: add /welcome first-launch route"
  ```

---

## Chunk 3: Root Layout Integration

### Task 3: Wire SplashScreen and beforeLoad into `__root.tsx`

**Files:**
- Modify: `src/routes/__root.tsx`

- [ ] **Step 1: Replace contents of `__root.tsx`**

  The current file only imports `createRootRoute` and `Outlet`. Replace the entire file with:

  ```tsx
  import { createRootRoute, Outlet, redirect } from '@tanstack/react-router'
  import { AnimatePresence } from 'framer-motion'
  import { useEffect, useState } from 'react'
  import AppHeader from '@/components/app/app-header'
  import AppMain from '@/components/app/app-main'
  import AppSideBar from '@/components/app/app-sidebar'
  import SplashScreen from '@/components/app/splash-screen'
  import { AsideChatSidebar } from '@/views/chat/chat'
  import { AsideChatHeader } from '@/views/chat/header'

  function RootLayout() {
    const [splashDone, setSplashDone] = useState(false)

    useEffect(() => {
      const t = setTimeout(() => setSplashDone(true), 800)
      return () => clearTimeout(t)
    }, [])

    return (
      <>
        <AnimatePresence>
          {!splashDone && <SplashScreen />}
        </AnimatePresence>
        <div className="size-full">
          <AppHeader />
          <section className="flex border-t h-[calc(100vh-var(--app-header-height))] overflow-hidden">
            <AppSideBar>
              <AsideChatHeader />
              <AsideChatSidebar />
            </AppSideBar>
            <AppMain>
              <Outlet />
            </AppMain>
          </section>
        </div>
      </>
    )
  }

  export const Route = createRootRoute({
    component: RootLayout,
    beforeLoad: ({ location }) => {
      if (!localStorage.getItem('holix-welcomed') && location.pathname !== '/welcome') {
        throw redirect({ to: '/welcome' })
      }
    },
  })
  ```

- [ ] **Step 2: Confirm no TypeScript errors**

  With `pnpm dev` running, check the terminal and editor for any TS errors in `__root.tsx`.

  Expected: No errors.

- [ ] **Step 3: Commit**

  ```bash
  git add src/routes/__root.tsx
  git commit -m "feat: integrate SplashScreen and first-launch redirect into root layout"
  ```

---

### Task 4: Manual end-to-end verification

- [ ] **Step 1: Test first-launch flow**

  In the running app, open DevTools console and run:

  ```js
  localStorage.removeItem('holix-welcomed')
  location.reload()
  ```

  Expected sequence:
  1. Splash screen appears (logo + "Holix AI") immediately on load
  2. Splash fades out after ~500ms, fully gone by ~800ms
  3. Welcome page is revealed: logo (72px), "Holix AI" heading, tagline, "开始使用" button
  4. Click "开始使用" → navigates to `/` (main app with header + sidebar)
  5. Reload: main app loads directly, no welcome page

- [ ] **Step 2: Test subsequent-launch splash**

  With `holix-welcomed = '1'` in localStorage, reload the app.

  Expected:
  - Splash appears briefly, fades out after ~800ms
  - Main app is visible underneath

- [ ] **Step 3: Test reverse guard on `/welcome`**

  With `holix-welcomed = '1'` set, navigate directly to `/welcome` (e.g., via `router.navigate({ to: '/welcome' })` in DevTools).

  Expected: Immediately redirects to `/`

- [ ] **Step 4: Run full test suite**

  ```bash
  pnpm vitest run
  ```

  Expected: All tests pass, including the 2 new SplashScreen tests.

- [ ] **Step 5: Commit any fixes found during verification**

  ```bash
  git add -p
  git commit -m "fix: address issues found during manual verification"
  ```
