export default function AppMain({
  children,
}: {
  children?: React.ReactNode
}) {
  return (
    <main
      className="flex w-[calc(100vw-var(--sidebar-width))] h-full min-w-0 overflow-hidden pt-[var(--header-height)]"
      style={{ backgroundColor: 'var(--region-chat)' }}
    >
      {children}
    </main>
  )
}
