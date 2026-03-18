import { createFileRoute } from '@tanstack/react-router'
import { SkillsManagementPage } from '@/components/skills/skills-management-page'
import { getConfig } from '@/lib/config'
import { trpcClient } from '@/lib/trpc-client'

export const Route = createFileRoute('/skills')({
  component: RouteComponent,
  loader: async () => {
    const skills = await trpcClient.skill.list()
    const config = await getConfig()
    return { skills, config }
  },
})

function RouteComponent() {
  const { skills, config } = Route.useLoaderData()
  return <SkillsManagementPage skills={skills} config={config} />
}
