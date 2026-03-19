import { createFileRoute } from '@tanstack/react-router'
import { getMcpConfig } from '@/lib/mcp'
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

    let mcpServers: string[] = []
    try {
      const mcpConfig = await getMcpConfig()
      mcpServers = Object.keys(mcpConfig.mcpServers ?? {})
    }
    catch {
      mcpServers = []
    }

    return {
      skills: skills.map(skill => ({
        name: skill.name,
        description: skill.description,
      })),
      mcpServers,
    }
  },
})

function RouteComponent() {
  const { skills, mcpServers } = Route.useLoaderData()
  return <AgentsPage skills={skills} mcpServers={mcpServers} />
}
