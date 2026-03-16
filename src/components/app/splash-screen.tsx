import { motion } from 'framer-motion'

// 加载动画点组件
function LoadingDots() {
  return (
    <div className="flex items-center justify-center gap-1.5" aria-hidden="true">
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          className="w-2 h-2 rounded-full bg-primary/60"
          initial={{ scale: 0.8, opacity: 0.4 }}
          animate={{ scale: [0.8, 1.2, 0.8], opacity: [0.4, 1, 0.4] }}
          transition={{
            duration: 1.2,
            repeat: Infinity,
            delay: i * 0.2,
            ease: 'easeInOut',
          }}
        />
      ))}
    </div>
  )
}

// 脉冲光环动画
function PulseRing() {
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      {[0, 1].map((i) => (
        <motion.div
          key={i}
          className="absolute w-20 h-20 rounded-full border-2 border-primary/20"
          initial={{ scale: 1, opacity: 0.6 }}
          animate={{ scale: [1, 1.8, 1], opacity: [0.6, 0, 0.6] }}
          transition={{
            duration: 2,
            repeat: Infinity,
            delay: i * 1,
            ease: 'easeInOut',
          }}
        />
      ))}
    </div>
  )
}

export default function SplashScreen() {
  return (
    <motion.div
      role="status"
      aria-label="应用加载中"
      className="fixed inset-0 z-[60] bg-background flex flex-col items-center justify-center gap-6"
      initial={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.3, delay: 0.5 } }}
    >
      {/* Logo 区域 */}
      <div className="relative">
        <PulseRing />
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{
            duration: 0.6,
            ease: 'easeOut',
          }}
          className="relative z-10"
        >
          <img
            src="/logo.png"
            alt="Holix AI"
            className="w-16 h-16 drop-shadow-lg"
          />
        </motion.div>
      </div>

      {/* 品牌名称 */}
      <motion.span
        aria-hidden="true"
        className="text-2xl font-semibold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent"
        initial={{ y: 10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{
          duration: 0.5,
          delay: 0.2,
          ease: 'easeOut',
        }}
      >
        Holix AI
      </motion.span>

      {/* 加载动画 */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{
          duration: 0.5,
          delay: 0.4,
        }}
      >
        <LoadingDots />
      </motion.div>

      {/* 加载提示文字 */}
      <motion.p
        className="text-sm text-muted-foreground"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{
          duration: 0.5,
          delay: 0.6,
        }}
      >
        正在为您准备...
      </motion.p>
    </motion.div>
  )
}
