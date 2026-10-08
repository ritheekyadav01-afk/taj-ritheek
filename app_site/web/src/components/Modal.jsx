import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'motion/react'
import { X } from '@phosphor-icons/react'
import { EASE } from '../motion'

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

/**
 * Modal / drawer with a double-rule border. Esc closes, Tab is trapped,
 * focus returns to whatever opened it. variant="drawer" slides in from the right.
 */
export default function Modal({ open, onClose, title, children, size = 'md', variant = 'center', footer, labelledBy, tone }) {
  return createPortal(
    <AnimatePresence>
      {open && (
        <Layer
          key="layer"
          onClose={onClose}
          title={title}
          size={size}
          variant={variant}
          footer={footer}
          labelledBy={labelledBy}
          tone={tone}
        >
          {children}
        </Layer>
      )}
    </AnimatePresence>,
    document.body,
  )
}

const WIDTH = { sm: 440, md: 600, lg: 820, xl: 1040 }

function Layer({ onClose, title, children, size, variant, footer, labelledBy, tone }) {
  const panel = useRef(null)
  const opener = useRef(document.activeElement)

  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const t = setTimeout(() => {
      const first = panel.current?.querySelector('[data-autofocus]') || panel.current
      first?.focus({ preventScroll: true })
    }, 60)
    const returnTo = opener.current
    return () => {
      clearTimeout(t)
      document.body.style.overflow = prev
      returnTo?.focus?.({ preventScroll: true })
    }
  }, [])

  const onKeyDown = (e) => {
    if (e.key === 'Escape') {
      e.stopPropagation()
      onClose?.()
      return
    }
    if (e.key !== 'Tab' || !panel.current) return
    const items = [...panel.current.querySelectorAll(FOCUSABLE)].filter((el) => el.offsetParent !== null)
    if (!items.length) return
    const first = items[0]
    const last = items[items.length - 1]
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault()
      last.focus()
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault()
      first.focus()
    }
  }

  const drawer = variant === 'drawer'
  const headId = labelledBy || 'modal-title'
  return (
    <motion.div
      className="fixed inset-0 z-[70] flex"
      style={{ justifyContent: drawer ? 'flex-end' : 'center', alignItems: drawer ? 'stretch' : 'center', padding: drawer ? 0 : 12 }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.45, ease: EASE }}
      onKeyDown={onKeyDown}
    >
      <div
        className="absolute inset-0"
        style={{ background: 'color-mix(in srgb, #173528 62%, transparent)' }}
        onClick={onClose}
        aria-hidden="true"
      />
      <motion.div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? headId : undefined}
        tabIndex={-1}
        className="double-rule bg-marble relative flex flex-col outline-none"
        style={{
          width: drawer ? `min(${WIDTH[size] || 560}px, 100vw)` : `min(${WIDTH[size]}px, 100%)`,
          maxHeight: drawer ? '100dvh' : '92dvh',
          height: drawer ? '100dvh' : undefined,
          boxShadow: '0 30px 60px -30px color-mix(in srgb, #231A16 60%, transparent)',
        }}
        initial={drawer ? { x: 60, opacity: 0 } : { y: 26, opacity: 0 }}
        animate={drawer ? { x: 0, opacity: 1 } : { y: 0, opacity: 1 }}
        exit={drawer ? { x: 40, opacity: 0 } : { y: 14, opacity: 0 }}
        transition={{ duration: 0.6, ease: EASE }}
      >
        <div className="flex items-start justify-between gap-4 px-7 pt-7 pb-4">
          {title ? (
            <h2
              id={headId}
              className="font-display text-[30px] font-medium m-0"
              style={{ color: tone === 'claret' ? 'var(--color-claret)' : 'var(--color-claret)' }}
            >
              {title}
            </h2>
          ) : (
            <span />
          )}
          <button className="btn btn-quiet -mr-3 -mt-1" onClick={onClose} aria-label="Close">
            <X size={22} weight="light" />
          </button>
        </div>
        <div className="px-7 pb-7 overflow-y-auto thin-scroll flex-1 min-h-0">{children}</div>
        {footer && <div className="px-7 py-5 rule-t flex flex-wrap justify-end gap-3">{footer}</div>}
      </motion.div>
    </motion.div>
  )
}
