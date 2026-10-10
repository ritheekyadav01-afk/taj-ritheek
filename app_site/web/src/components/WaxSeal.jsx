import { useId } from 'react'
import { motion } from 'motion/react'
import { EASE } from '../motion'

// scalloped wax edge: 18 soft lobes around a circle
function lobes(cx, cy, r, n = 18, amp = 3.2) {
  let d = ''
  const steps = n * 12
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * Math.PI * 2
    const rr = r + Math.sin(a * n) * amp
    d += `${i ? 'L' : 'M'}${(cx + Math.cos(a) * rr).toFixed(2)} ${(cy + Math.sin(a) * rr).toFixed(2)}`
  }
  return d + 'Z'
}
const EDGE = lobes(60, 60, 50)

/**
 * A silver wax seal. With `stamp` it presses down onto the receipt once:
 * it arrives large and lifted, lands, and leaves a ring in the paper.
 */
export default function WaxSeal({ size = 120, stamp = false, label = 'Paid in full' }) {
  const uid = useId().replace(/:/g, '')
  return (
    <div style={{ width: size, height: size, position: 'relative' }} role="img" aria-label={label}>
      {stamp && (
        <motion.span
          aria-hidden="true"
          className="absolute inset-0 rounded-full"
          style={{ border: '1px solid var(--accent)' }}
          initial={{ scale: 0.86, opacity: 0 }}
          animate={{ scale: [0.86, 1.9], opacity: [0.75, 0] }}
          transition={{ duration: 1.5, ease: EASE, delay: 0.62 }}
        />
      )}
      <motion.svg
        viewBox="0 0 120 120"
        width={size}
        height={size}
        initial={stamp ? { scale: 1.65, opacity: 0, rotate: -26, y: -18 } : false}
        animate={{ scale: 1, opacity: 1, rotate: -9, y: 0 }}
        transition={{ duration: 0.8, ease: EASE }}
        style={{ filter: 'drop-shadow(0 7px 6px color-mix(in srgb, #070708 45%, transparent))' }}
      >
        <defs>
          <radialGradient id={`wax-${uid}`} cx="38%" cy="32%" r="75%">
            <stop offset="0%" stopColor="#F7F7F5" />
            <stop offset="45%" stopColor="#C3C6CB" />
            <stop offset="100%" stopColor="#8E9196" />
          </radialGradient>
          <path id={`arc-${uid}`} d="M60 60 m-33 0 a33 33 0 1 1 66 0 a33 33 0 1 1 -66 0" />
        </defs>
        <path d={EDGE} fill={`url(#wax-${uid})`} />
        <circle cx="60" cy="60" r="41" fill="none" stroke="#8E9196" strokeWidth="1.2" />
        <circle cx="60" cy="60" r="38" fill="none" stroke="#F7F7F5" strokeOpacity="0.7" strokeWidth="0.7" />
        <text fontFamily="var(--font-ui)" fontSize="8.6" fontWeight="500" letterSpacing="2.2" fill="#1A1A1D">
          <textPath href={`#arc-${uid}`} startOffset="1%">
            PAID IN FULL · TAJ RITHEEK ·
          </textPath>
        </text>
        <text x="60" y="73" textAnchor="middle" fontFamily="var(--font-display)" fontSize="38" fill="#1A1A1D">
          T
        </text>
      </motion.svg>
    </div>
  )
}
