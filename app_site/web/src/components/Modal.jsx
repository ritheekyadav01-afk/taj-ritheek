import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'motion/react'
import { X } from '@phosphor-icons/react'
import { EASE } from '../motion'
import { lockScroll, unlockScroll } from '../smooth'

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

/**
 * Modal or side sheet inside a fine double rule. Esc closes, Tab is trapped,
 * focus returns to whatever opened it, and the page stops scrolling underneath.
 */
export default function Modal({ open, onClose, title, children, size = 'md', variant = 'center', footer, labelledBy }) {
  return createPortal(
    <AnimatePresence>
      {open && (
        <Layer key="layer" onClose={onClose} title={title} size={size} variant={variant} footer={footer} labelledBy={labelledBy}>
          {children}
        </Layer>
      )}
    </AnimatePresence>,
    document.body,
  )
}

const WIDTH = { sm: 460, md: 620, lg: 840, xl: 1080 }

function Layer({ onClose, title, children, size, variant, footer, labelledBy }) {
  const panel = useRef(null)
  const opener = useRef(document.activeElement)

  useEffect(() => {
    lockScroll()
    const t = setTimeout(() => {
      const first = panel.current?.querySelector('[data-autofocus]') || panel.current
      first?.focus({ preventScroll: true })
    }, 80)
    const returnTo = opener.current
    return () => {
      clearTimeout(t)
      unlockScroll()
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
      className="fixed inset-0 z-[80] flex"
      style={{ justifyContent: drawer ? 'flex-end' : 'center', alignItems: drawer ? 'stretch' : 'center', padding: drawer ? 0 : 14 }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5, ease: EASE }}
      onKeyDown={onKeyDown}
    >
      <div className="absolute inset-0 backdrop-blur-[3px]" style={{ background: 'var(--scrim)' }} onClick={onClose} aria-hidden="true" />
      <motion.div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? headId : undefined}
        tabIndex={-1}
        data-lenis-prevent
        className="double-rule bg-surface relative flex flex-col outline-none"
        style={{
          width: drawer ? `min(${WIDTH[size] || 620}px, 100vw)` : `min(${WIDTH[size]}px, 100%)`,
          maxHeight: drawer ? '100dvh' : '92dvh',
          height: drawer ? '100dvh' : undefined,
          boxShadow: 'var(--shadow)',
        }}
        initial={drawer ? { x: 80, opacity: 0 } : { y: 28, opacity: 0, scale: 0.985 }}
        animate={drawer ? { x: 0, opacity: 1 } : { y: 0, opacity: 1, scale: 1 }}
        exit={drawer ? { x: 50, opacity: 0 } : { y: 14, opacity: 0, scale: 0.99 }}
        transition={{ duration: 0.75, ease: EASE }}
      >
        <div className="flex items-start justify-between gap-4 px-8 pt-8 pb-5">
          {title ? (
            <h2 id={headId} className="display text-[32px] m-0 text-strong">
              {title}
            </h2>
          ) : (
            <span />
          )}
          <button className="btn btn-quiet btn-icon -mr-3 -mt-1" onClick={onClose} aria-label="Close">
            <X size={20} weight="light" />
          </button>
        </div>
        <div className="px-8 pb-8 overflow-y-auto thin-scroll flex-1 min-h-0" data-lenis-prevent>
          {children}
        </div>
        {footer && <div className="px-8 py-5 border-t border-line flex flex-wrap justify-end gap-3">{footer}</div>}
      </motion.div>
    </motion.div>
  )
}
