export default function AppMain({
  children,
}: {
  children?: React.ReactNode
}) {
  return (
    <main
      className="flex w-full h-full min-w-0 overflow-hidden flex-1 pt-(--header-height)"
      style={{ backgroundColor: 'var(--region-chat)' }}
    >
      {children}
    </main>
  )
}
