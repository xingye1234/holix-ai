export default function AppMain({
  children,
}: {
  children?: React.ReactNode
}) {
  return (
    <main className="flex flex-1 h-[calc(100vh-var(--app-header-height)-1px)] min-w-0 overflow-hidden">
      {children}
    </main>
  )
}
