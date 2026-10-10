import { AnimatePresence, motion } from 'motion/react'
import { CheckCircle, WarningDiamond, X } from '@phosphor-icons/react'
import { useToasts } from '../store'
import { EASE } from '../motion'

/** Quiet notes that slide down from the top and leave on their own. */
export default function Toaster() {
  const { toasts, dismiss } = useToasts()
  return (
    <div
      className="fixed z-[90] top-4 right-4 left-4 sm:left-auto sm:w-[410px] grid gap-3 pointer-events-none"
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
              initial={{ opacity: 0, y: -22 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.7, ease: EASE }}
              className="pointer-events-auto bg-surface flex gap-4 items-start px-5 py-4 border border-line"
              style={{ boxShadow: 'var(--shadow)', borderLeft: `2px solid ${bad ? 'var(--error-line)' : 'var(--accent)'}` }}
            >
              <span className={`mt-0.5 ${bad ? 'text-error' : 'text-accent'}`}>
                {bad ? <WarningDiamond size={20} weight="light" /> : <CheckCircle size={20} weight="light" />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="m-0 text-[14.5px] font-medium text-strong">{t.title}</p>
                {t.message && <p className="m-0 text-[14px] leading-snug text-muted">{t.message}</p>}
              </div>
              <button className="btn btn-quiet btn-sm btn-icon -mr-3 -mt-2" aria-label="Dismiss" onClick={() => dismiss(t.id)}>
                <X size={15} weight="light" />
              </button>
            </motion.div>
          )
        })}
      </AnimatePresence>
    </div>
  )
}
