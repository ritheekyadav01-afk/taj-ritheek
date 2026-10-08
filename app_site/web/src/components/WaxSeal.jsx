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

/** A claret wax seal with a brass-ruled crest. `stamp` plays the landing once. */
export default function WaxSeal({ size = 120, stamp = false, label = 'Paid in full' }) {
  return (
    <div style={{ width: size, height: size, position: 'relative' }} role="img" aria-label={label}>
      {stamp && (
        <motion.span
          aria-hidden="true"
          className="absolute inset-0 rounded-full"
          style={{ border: '1.5px solid var(--color-brass)' }}
          initial={{ scale: 0.8, opacity: 0.7 }}
          animate={{ scale: 2.1, opacity: 0 }}
          transition={{ duration: 1.5, ease: EASE, delay: 0.55 }}
        />
      )}
      <motion.svg
        viewBox="0 0 120 120"
        width={size}
        height={size}
        initial={stamp ? { scale: 2.3, opacity: 0, rotate: -26 } : false}
        animate={{ scale: 1, opacity: 1, rotate: -8 }}
        transition={{ duration: 1.1, ease: EASE }}
        style={{ filter: 'drop-shadow(0 6px 5px color-mix(in srgb, #231A16 35%, transparent))' }}
      >
        <defs>
          <path id="seal-arc" d="M60 60 m-33 0 a33 33 0 1 1 66 0 a33 33 0 1 1 -66 0" />
        </defs>
        <path d={EDGE} fill="var(--color-claret)" />
        <circle cx="60" cy="60" r="41" fill="none" stroke="color-mix(in srgb, #F2F0EB 18%, #5A1626)" strokeWidth="1.4" />
        <circle cx="60" cy="60" r="38" fill="none" stroke="var(--color-brass-soft)" strokeWidth="0.8" />
        <text fontFamily="var(--font-body)" fontSize="9.5" letterSpacing="1.9" fill="var(--color-brass-soft)">
          <textPath href="#seal-arc" startOffset="2%">
            PAID IN FULL · TAJ RITHEEK ·
          </textPath>
        </text>
        <text x="60" y="73" textAnchor="middle" fontFamily="var(--font-display)" fontSize="38" fontWeight="700" fill="var(--color-brass-soft)">
          T
        </text>
      </motion.svg>
    </div>
  )
}
