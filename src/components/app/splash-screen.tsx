import { motion } from 'framer-motion'

export default function SplashScreen() {
  return (
    <motion.div
      className="fixed inset-0 z-[60] bg-background flex flex-col items-center justify-center gap-3"
      initial={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.3, delay: 0.5 } }}
    >
      <img src="/logo.png" alt="Holix AI" className="w-14 h-14" />
      <span className="text-xl font-semibold">Holix AI</span>
    </motion.div>
  )
}
