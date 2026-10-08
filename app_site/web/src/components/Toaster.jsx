import { AnimatePresence, motion } from 'motion/react'
import { CheckCircle, WarningCircle, X } from '@phosphor-icons/react'
import { useToasts } from '../store'
import { EASE } from '../motion'

export default function Toaster() {
  const { toasts, dismiss } = useToasts()
  return (
    <div
      className="fixed z-[90] bottom-4 right-4 left-4 sm:left-auto sm:w-[390px] grid gap-3 pointer-events-none"
      aria-live="polite"
      aria-atomic="false"
    >
      <AnimatePresence initial={false}>
        {toasts.map((t) => {
          const bad = t.tone === 'error'
          return (
            <motion.div
              key={t.id}
              layout
              role="status"
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              transition={{ duration: 0.55, ease: EASE }}
              className="pointer-events-auto bg-marble flex gap-3 items-start p-4"
              style={{
                borderLeft: `3px solid ${bad ? 'var(--color-claret-light)' : 'var(--color-brass)'}`,
                border: '1px solid var(--color-hairline)',
                borderLeftWidth: 3,
                borderLeftColor: bad ? 'var(--color-claret-light)' : 'var(--color-brass)',
                boxShadow: '0 18px 30px -20px color-mix(in srgb, #231A16 55%, transparent)',
              }}
            >
              <span style={{ color: bad ? 'var(--color-claret-light)' : 'var(--color-st-available)' }} className="mt-0.5">
                {bad ? <WarningCircle size={22} weight="light" /> : <CheckCircle size={22} weight="light" />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="m-0 font-ui text-[15px] font-medium">{t.title}</p>
                {t.message && <p className="m-0 text-[16px] leading-snug text-muted">{t.message}</p>}
              </div>
              <button className="btn btn-quiet btn-sm -mr-2 -mt-1" aria-label="Dismiss" onClick={() => dismiss(t.id)}>
                <X size={16} />
              </button>
            </motion.div>
          )
        })}
      </AnimatePresence>
    </div>
  )
}
