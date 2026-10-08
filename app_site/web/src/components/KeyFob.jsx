import { motion } from 'motion/react'
import { EASE } from '../motion'

export const STATUS = {
  available: { label: 'Available', color: 'var(--color-st-available)' },
  occupied: { label: 'Occupied', color: 'var(--color-st-occupied)' },
  cleaning: { label: 'Cleaning', color: 'var(--color-st-cleaning)' },
  maintenance: { label: 'Maintenance', color: 'var(--color-st-maintenance)' },
}

const SIZES = {
  lg: { w: 124, h: 172, num: 46 },
  md: { w: 94, h: 132, num: 36 },
  sm: { w: 46, h: 64, num: 0 },
}

/**
 * An engraved key fob. Body colour is the room status; the numeral is cut into it.
 * Below 28px the numeral falls back to Newsreader because Bodoni is display-only.
 */
export default function KeyFob({ number, status = 'available', size = 'md', onClick, layoutId, label, className = '' }) {
  const s = SIZES[size]
  const small = size === 'sm'
  const inner = (
    <>
      <span className="fob-body" aria-hidden="true" />
      <span className="fob-hole" aria-hidden="true" />
      <span
        className="absolute left-1/2 -translate-x-1/2 flex flex-col items-center"
        style={{ top: small ? '38%' : '37%' }}
      >
        <span
          className="fob-num"
          style={{
            fontSize: small ? 14 : s.num,
            lineHeight: 1,
            fontFamily: small ? 'var(--font-body)' : undefined,
            fontWeight: small ? 700 : 600,
          }}
        >
          {number}
        </span>
        {!small && (
          <span
            aria-hidden="true"
            style={{
              display: 'block',
              width: s.w * 0.42,
              height: 1,
              marginTop: size === 'lg' ? 10 : 7,
              background: 'currentColor',
              opacity: 0.55,
            }}
          />
        )}
      </span>
    </>
  )
  const style = { width: s.w, height: s.h }
  const common = {
    className: `fob fob--${status} ${className}`,
    style,
    layoutId,
    'aria-label': label || `Room ${number}, ${STATUS[status]?.label || status}`,
  }
  if (onClick) {
    return (
      <motion.button
        type="button"
        onClick={onClick}
        whileHover={{ rotate: 1.8, y: 2 }}
        whileTap={{ scale: 0.985 }}
        transition={{ duration: 0.6, ease: EASE }}
        {...common}
        style={{ ...style, cursor: 'pointer', background: 'none', border: 0, padding: 0, originX: 0.5, originY: '8px' }}
      >
        {inner}
      </motion.button>
    )
  }
  return (
    <motion.div {...common} role="img" style={{ ...style, originX: 0.5, originY: '8px' }}>
      {inner}
    </motion.div>
  )
}
