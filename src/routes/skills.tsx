import { createFileRoute } from '@tanstack/react-router'
import { SkillsPage } from '@/views/skills/page'
import { getConfig } from '@/lib/config'
import { trpcClient } from '@/lib/trpc-client'

export const Route = createFileRoute('/skills')({
  component: RouteComponent,
  loader: async () => {
    const skills = await trpcClient.skill.list()
    const externalSources = await trpcClient.skill.externalSources()
    const config = await getConfig()
    return { skills, externalSources, config }
  },
})

function RouteComponent() {
  const { skills, externalSources, config } = Route.useLoaderData()
  return <SkillsPage skills={skills} externalSources={externalSources} config={config} />
}
