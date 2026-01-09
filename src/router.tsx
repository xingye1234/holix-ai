import { createRouter, ErrorComponent } from '@tanstack/react-router'
import { Spinner } from './components/spinner'
import { routeTree } from './routeTree.gen'

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

export const router = createRouter({
  routeTree,
  defaultPendingComponent: () => (
    <div className="p-2 text-2xl">
      <Spinner />
    </div>
  ),
  defaultErrorComponent: ({ error }) => <ErrorComponent error={error} />,
  context: {
    auth: undefined!, // We'll inject this when we render
  },
  basepath: '/',
  defaultPreload: 'intent',
  scrollRestoration: true,
  defaultNotFoundComponent: () => (
    <div style={{ padding: 24 }}>
      <h1>404</h1>
      <p>页面不存在</p>
    </div>
  ),
})
