import { useRef } from 'react'
import { motion, useInView } from 'motion/react'
import { Odometer } from './motion'
import { EASE } from '../motion'
import { inrWhole } from '../format'

// Charts draw themselves once they scroll into view, slowly, from a quiet zero.
function useReveal() {
  const ref = useRef(null)
  const shown = useInView(ref, { once: true, amount: 0.3 })
  return [ref, shown]
}

/** A ring gauge: hairline track, an ink arc drawn in, the percentage rolling up in the middle. */
export function Gauge({ value, caption }) {
  const [ref, shown] = useReveal()
  const pct = Math.max(0, Math.min(100, Number(value) || 0))
  const r = 76
  return (
    <div ref={ref} className="relative mx-auto" style={{ width: 236 }}>
      <svg viewBox="0 0 200 200" width="236" height="236" className="block" role="img" aria-label={`Occupancy ${pct.toFixed(1)} percent`}>
        <circle cx="100" cy="100" r="94" fill="none" stroke="var(--line)" strokeWidth="1" />
        <circle cx="100" cy="100" r={r} fill="none" stroke="var(--line)" strokeWidth="9" />
        <motion.circle
          cx="100"
          cy="100"
          r={r}
          fill="none"
          stroke="var(--text)"
          strokeWidth="9"
          transform="rotate(-90 100 100)"
          pathLength="1"
          strokeDasharray="1"
          initial={{ strokeDashoffset: 1 }}
          animate={{ strokeDashoffset: shown ? 1 - pct / 100 : 1 }}
          transition={{ duration: 1.8, ease: EASE }}
        />
        <motion.circle
          cx="100"
          cy="100"
          r="62"
          fill="none"
          stroke="var(--accent)"
          strokeWidth="0.8"
          pathLength="1"
          strokeDasharray="1"
          initial={{ strokeDashoffset: 1 }}
          animate={{ strokeDashoffset: shown ? 0 : 1 }}
          transition={{ duration: 2.2, ease: EASE, delay: 0.2 }}
        />
      </svg>
      <div className="absolute inset-x-0 top-0 h-[236px] grid place-content-center text-center">
        <p className="display m-0 text-[52px] leading-none text-strong">
          <Odometer value={pct} format={(v) => v.toFixed(1)} />
          <span className="text-[28px]">%</span>
        </p>
      </div>
      <p className="m-0 mt-4 text-center text-[13.5px] text-muted">{caption}</p>
    </div>
  )
}

function niceMax(v) {
  if (v <= 0) return 1
  const p = Math.pow(10, Math.floor(Math.log10(v)))
  const n = v / p
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10
  return step * p
}

/** Vertical bars rising from a drawn baseline. Used for revenue by month. */
export function VBars({ data, label, value, format = inrWhole }) {
  const [ref, shown] = useReveal()
  const max = Math.max(...data.map((d) => Number(value(d))), 1)
  const top = niceMax(max)
  const H = 240
  return (
    <div ref={ref}>
      <div className="relative" style={{ height: H + 46 }}>
        {[0, 0.5, 1].map((t, i) => (
          <div key={t} className="absolute left-0 right-0 flex items-center gap-3" style={{ bottom: 46 + t * H }}>
            <span className="text-[12px] text-muted w-[84px] shrink-0 num">{format(top * t)}</span>
            <motion.span
              className="flex-1 h-px"
              style={{ background: t === 0 ? 'var(--line-strong)' : 'var(--line)', originX: 0 }}
              initial={{ scaleX: 0 }}
              animate={{ scaleX: shown ? 1 : 0 }}
              transition={{ duration: 1.3, ease: EASE, delay: i * 0.12 }}
            />
          </div>
        ))}
        <div className="absolute inset-0 flex items-end justify-around gap-5" style={{ left: 96, paddingBottom: 46 }}>
          {data.map((d, i) => {
            const v = Number(value(d))
            const h = Math.max((v / top) * H, v > 0 ? 3 : 0)
            return (
              <div key={label(d)} className="flex flex-col items-center justify-end" style={{ maxWidth: 72, flex: '1 1 0' }}>
                <motion.span
                  className="text-[12.5px] mb-2 num whitespace-nowrap text-text"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: shown ? 1 : 0 }}
                  transition={{ duration: 0.8, ease: EASE, delay: 1.0 + i * 0.1 }}
                >
                  {format(v)}
                </motion.span>
                <motion.div
                  style={{ width: '100%', height: h, background: 'var(--text)', originY: 1 }}
                  initial={{ scaleY: 0 }}
                  animate={{ scaleY: shown ? 1 : 0 }}
                  transition={{ duration: 1.25, ease: EASE, delay: 0.3 + i * 0.1 }}
                />
              </div>
            )
          })}
        </div>
        <div className="absolute right-0 bottom-0 flex justify-around gap-5" style={{ left: 96, height: 40 }}>
          {data.map((d) => (
            <span key={label(d)} className="text-[12.5px] text-muted text-center pt-3 num" style={{ maxWidth: 72, flex: '1 1 0' }}>
              {label(d)}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}

/** Horizontal bars drawn from the left, the value at the end. */
export function HBars({ data, label, value, format = inrWhole }) {
  const [ref, shown] = useReveal()
  const max = Math.max(...data.map((d) => Number(value(d))), 1)
  return (
    <ul ref={ref} className="list-none m-0 p-0 grid gap-6">
      {data.map((d, i) => {
        const v = Number(value(d))
        return (
          <li key={label(d) + i}>
            <div className="flex items-baseline justify-between gap-4 mb-2">
              <span className="text-[15px] truncate">{label(d)}</span>
              <span className="text-[15px] num whitespace-nowrap">{format(v)}</span>
            </div>
            <div className="relative h-[10px]">
              <span className="absolute left-0 right-0 top-1/2 h-px bg-line" aria-hidden="true" />
              <motion.div
                className="absolute left-0 top-0 bottom-0"
                style={{ width: `${Math.max((v / max) * 100, 1.5)}%`, background: 'var(--accent)', originX: 0 }}
                initial={{ scaleX: 0 }}
                animate={{ scaleX: shown ? 1 : 0 }}
                transition={{ duration: 1.25, ease: EASE, delay: 0.15 + i * 0.12 }}
              />
            </div>
          </li>
        )
      })}
    </ul>
  )
}

// Fills that differ by form, not colour: solid ink, silver, hatching, outline.
export const FILLS = {
  solid: { background: 'var(--text)' },
  silver: { background: 'var(--accent)' },
  hatch: { background: 'repeating-linear-gradient(135deg, var(--surface-2) 0 4px, var(--line-strong) 4px 5.5px)' },
  outline: { background: 'transparent', boxShadow: 'inset 0 0 0 1px var(--line-strong)' },
}

/** One bar split into segments; the legend carries the counts, which roll up. */
export function Segments({ parts }) {
  const [ref, shown] = useReveal()
  const total = parts.reduce((s, p) => s + p.value, 0)
  return (
    <div ref={ref}>
      <div className="flex w-full overflow-hidden gap-[3px]" style={{ height: 20 }} role="img" aria-label={parts.map((p) => `${p.label} ${p.value}`).join(', ')}>
        {total === 0 && <span className="flex-1" style={FILLS.outline} />}
        {parts.map((p, i) =>
          p.value ? (
            <motion.span
              key={p.label}
              style={{ ...FILLS[p.fill || 'solid'], flexGrow: p.value, flexBasis: 0, originX: 0 }}
              initial={{ scaleX: 0, opacity: 0 }}
              animate={{ scaleX: shown ? 1 : 0, opacity: shown ? 1 : 0 }}
              transition={{ duration: 1.2, ease: EASE, delay: 0.1 + i * 0.16 }}
            />
          ) : null,
        )}
      </div>
      <ul className="list-none m-0 mt-6 p-0 flex flex-wrap gap-x-10 gap-y-4">
        {parts.map((p) => (
          <li key={p.label} className="flex items-center gap-3">
            <span aria-hidden="true" style={{ width: 14, height: 14, display: 'inline-block', ...FILLS[p.fill || 'solid'] }} />
            <span className="display text-[36px] leading-none text-strong">
              <Odometer value={p.value} />
            </span>
            <span className="text-[14px] text-muted">{p.label}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
