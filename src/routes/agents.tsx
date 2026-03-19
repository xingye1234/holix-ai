import { createFileRoute } from '@tanstack/react-router'
import { trpcClient } from '@/lib/trpc-client'
import { AgentsPage } from '@/views/agents/page'

export interface Skill {
  name: string
  description: string
}

export const Route = createFileRoute('/agents')({
  component: RouteComponent,
  loader: async () => {
    const skills = await trpcClient.skill.list()
    return {
      skills: skills.map(skill => ({
        name: skill.name,
        description: skill.description,
      })),
    }
  },
})

function RouteComponent() {
  const { skills } = Route.useLoaderData()
  return <AgentsPage skills={skills} />
}
