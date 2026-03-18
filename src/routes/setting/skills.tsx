import { createFileRoute, Navigate } from '@tanstack/react-router'

export const Route = createFileRoute('/setting/skills')({
  component: RouteComponent,
})

function RouteComponent() {
  return <Navigate to="/skills" />
}
