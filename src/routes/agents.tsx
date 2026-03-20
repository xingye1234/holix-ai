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
    const [skillsRes, agentsRes] = await Promise.allSettled([
      trpcClient.skill.list(),
      trpcClient.agent.list(),
    ])

    const skills = skillsRes.status === 'fulfilled' ? skillsRes.value : []
    const agents = agentsRes.status === 'fulfilled' ? agentsRes.value : []

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
      agents,
      mcpServers,
    }
  },
})

function RouteComponent() {
  const { skills, agents, mcpServers } = Route.useLoaderData()
  return <AgentsPage initialAgents={agents} skills={skills} mcpServers={mcpServers} />
}
