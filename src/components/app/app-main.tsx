export default function AppMain({
  children,
}: {
  children?: React.ReactNode
}) {
  return (
    <main
      className="flex flex-1 h-full min-w-0 overflow-hidden"
      style={{ backgroundColor: 'var(--region-chat)' }}
    >
      {children}
    </main>
  )
}
