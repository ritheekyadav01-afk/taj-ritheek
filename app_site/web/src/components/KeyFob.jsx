import { forwardRef } from 'react'
import { motion, useMotionValue, useSpring } from 'motion/react'
import { Key } from '@phosphor-icons/react'
import { coarsePointer } from '../motion'

// With no colour to lean on, each state has its own form:
// available = solid pearl tag, black numeral; occupied = black tag, silver outline and key;
// cleaning = graphite tag with a slowly turning dashed ring; maintenance = hatched and dimmed.
export const STATUS = {
  available: { label: 'Available' },
  occupied: { label: 'Occupied' },
  cleaning: { label: 'Cleaning' },
  maintenance: { label: 'Maintenance' },
}

const SIZES = {
  lg: { w: 124, h: 172, num: 46 },
  md: { w: 94, h: 132, num: 34 },
  sm: { w: 46, h: 64, num: 13.5 },
}

/**
 * An engraved silver key fob. Bodoni numerals at 28px and above; the small size uses Jost.
 * `tilt` makes it lean toward the cursor (soft 3D), `sheen` sweeps a metallic highlight across once.
 */
const KeyFob = forwardRef(function KeyFob(
  { number, status = 'available', size = 'md', onClick, label, tilt = false, sheen = false, sheenDelay = 0, className = '', layoutId },
  ref,
) {
  const s = SIZES[size]
  const small = size === 'sm'
  const rx = useMotionValue(0)
  const ry = useMotionValue(0)
  const lift = useMotionValue(0)
  const spring = { stiffness: 170, damping: 30, mass: 0.9 }
  const srx = useSpring(rx, spring)
  const sry = useSpring(ry, spring)
  const sl = useSpring(lift, spring)

  const onMove = (e) => {
    if (!tilt || coarsePointer()) return
    const r = e.currentTarget.getBoundingClientRect()
    const px = (e.clientX - r.left) / r.width - 0.5
    const py = (e.clientY - r.top) / r.height - 0.5
    ry.set(px * 18)
    rx.set(-py * 14)
    lift.set(-8)
  }
  const onLeave = () => {
    rx.set(0)
    ry.set(0)
    lift.set(0)
  }

  const numTop = small ? 0.4 : 0.37
  const ringW = s.w * (small ? 0.78 : 0.74)
  const ringTop = s.h * numTop + s.num * 0.36 - ringW / 2

  const inner = (
    <>
      <span className="fob-body">
        <span className="fob-sheen" style={{ '--sheen-delay': `${sheenDelay}s` }} />
      </span>
      {status === 'cleaning' && <span className="fob-ring" style={{ width: ringW, top: ringTop }} aria-hidden="true" />}
      <span className="fob-hole" aria-hidden="true" />
      <span className="fob-num" style={{ top: `${numTop * 100}%`, fontSize: s.num }} aria-hidden="true">
        {number}
      </span>
      {!small && <span className="fob-rule" style={{ top: size === 'lg' ? '63%' : '62%' }} aria-hidden="true" />}
      {status === 'occupied' && (
        <Key className="fob-key" size={small ? 10 : size === 'lg' ? 20 : 15} weight="light" style={{ top: small ? '70%' : '71%' }} aria-hidden="true" />
      )}
    </>
  )

  const common = {
    ref,
    layoutId,
    className: `fob fob--${status} fob--${size} ${sheen ? 'fob--sheen' : ''} ${className}`,
    'aria-label': label || `Room ${number}, ${STATUS[status]?.label || status}`,
    style: {
      width: s.w,
      height: s.h,
      rotateX: srx,
      rotateY: sry,
      y: sl,
      transformPerspective: 640,
      originX: 0.5,
      originY: 0.12,
    },
    onPointerMove: onMove,
    onPointerLeave: onLeave,
  }
  if (onClick) {
    return (
      <motion.button type="button" onClick={onClick} {...common} style={{ ...common.style, background: 'none', border: 0, padding: 0, cursor: 'pointer' }}>
        {inner}
      </motion.button>
    )
  }
  return (
    <motion.span role="img" {...common}>
      {inner}
    </motion.span>
  )
})

export default KeyFob

/** The legend: the four forms in miniature, each with its words. */
export function FobLegend({ className = '' }) {
  return (
    <ul className={`list-none m-0 p-0 flex flex-wrap gap-x-7 gap-y-2 ${className}`} aria-label="Room status legend">
      {Object.entries(STATUS).map(([k, v]) => (
        <li key={k} className="flex items-center gap-2.5 text-[13px]">
          <span className={`swatch swatch--${k}`} aria-hidden="true" />
          {v.label}
        </li>
      ))}
    </ul>
  )
}
