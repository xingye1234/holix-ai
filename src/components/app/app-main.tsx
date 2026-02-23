export default function AppMain({
  children,
}: {
  children?: React.ReactNode
}) {
  return (
    <main className="flex h-[calc(100vh-var(--app-header-height)-1px)] w-(--app-chat-width) overflow-hidden">
      {children}
    </main>
  )
}
