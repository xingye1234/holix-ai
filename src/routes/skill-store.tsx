import { createFileRoute, Navigate } from '@tanstack/react-router'

export const Route = createFileRoute('/skill-store')({
  component: RouteComponent,
})

function RouteComponent() {
  return <Navigate to="/skills" />
}
