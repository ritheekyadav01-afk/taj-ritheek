import { useRef } from 'react'
import { motion, useInView } from 'motion/react'
import CountUp from './CountUp'
import { EASE } from '../motion'
import { inrWhole } from '../format'

// Charts are drawn once the section scrolls into view, slowly, from a quiet zero.
function useReveal() {
  const ref = useRef(null)
  const shown = useInView(ref, { once: true, amount: 0.25 })
  return [ref, shown]
}

/** A ring gauge: brass track, bottle-green arc, the percentage counted up in the middle. */
export function Gauge({ value, caption }) {
  const [ref, shown] = useReveal()
  const pct = Math.max(0, Math.min(100, Number(value) || 0))
  const r = 74
  return (
    <div ref={ref} className="relative mx-auto" style={{ width: 220, height: 220 }}>
      <svg viewBox="0 0 200 200" width="220" height="220" role="img" aria-label={`Occupancy ${pct.toFixed(1)} percent`}>
        <circle cx="100" cy="100" r={r} fill="none" stroke="var(--color-hairline)" strokeWidth="12" />
        <circle cx="100" cy="100" r="90" fill="none" stroke="var(--color-brass)" strokeWidth="1" />
        <motion.circle
          cx="100"
          cy="100"
          r={r}
          fill="none"
          stroke="var(--color-green)"
          strokeWidth="12"
          strokeLinecap="butt"
          transform="rotate(-90 100 100)"
          pathLength="1"
          strokeDasharray="1"
          initial={{ strokeDashoffset: 1 }}
          animate={{ strokeDashoffset: shown ? 1 - pct / 100 : 1 }}
          transition={{ duration: 1.6, ease: EASE }}
        />
      </svg>
      <div className="absolute inset-0 grid place-content-center text-center">
        <p className="m-0 font-display text-[48px] font-medium text-claret num leading-none">
          {shown ? <CountUp value={pct} decimals={1} /> : '0.0'}
          <span className="text-[28px]">%</span>
        </p>
        <p className="m-0 mt-2 italic text-[16px] text-muted">{caption}</p>
      </div>
    </div>
  )
}

/** Vertical bars with a quiet y-axis. Used for revenue by month. */
export function VBars({ data, label, value, format = inrWhole, color = 'var(--color-green)' }) {
  const [ref, shown] = useReveal()
  const max = Math.max(...data.map((d) => Number(value(d))), 1)
  const top = niceMax(max)
  const H = 240
  return (
    <div ref={ref}>
      <div className="relative" style={{ height: H + 44 }}>
        {[0, 0.5, 1].map((t) => (
          <div key={t} className="absolute left-0 right-0 flex items-center" style={{ bottom: 44 + t * H }}>
            <span className="font-ui text-[13px] text-muted w-[84px] shrink-0 num">{format(top * t)}</span>
            <span className="flex-1" style={{ borderTop: `1px solid ${t === 0 ? 'var(--color-ink)' : 'var(--color-hairline)'}` }} />
          </div>
        ))}
        <div className="absolute inset-0 flex items-end justify-around gap-4" style={{ left: 92, paddingBottom: 44 }}>
          {data.map((d, i) => {
            const v = Number(value(d))
            const h = Math.max((v / top) * H, v > 0 ? 3 : 0)
            return (
              <div key={label(d)} className="flex flex-col items-center justify-end" style={{ maxWidth: 84, flex: '1 1 0' }}>
                <motion.span
                  className="font-ui text-[14px] mb-2 num whitespace-nowrap"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: shown ? 1 : 0 }}
                  transition={{ duration: 0.8, ease: EASE, delay: 0.9 + i * 0.1 }}
                >
                  {format(v)}
                </motion.span>
                <motion.div
                  style={{ width: '100%', height: h, background: color, originY: 1 }}
                  initial={{ scaleY: 0 }}
                  animate={{ scaleY: shown ? 1 : 0 }}
                  transition={{ duration: 1.1, ease: EASE, delay: 0.15 + i * 0.1 }}
                />
              </div>
            )
          })}
        </div>
        <div className="absolute left-0 right-0 bottom-0 flex justify-around gap-4" style={{ left: 92, height: 40 }}>
          {data.map((d) => (
            <span key={label(d)} className="font-ui text-[14px] text-muted text-center pt-2.5 num" style={{ maxWidth: 84, flex: '1 1 0' }}>
              {label(d)}
            </span>
          ))}
        </div>
      </div>
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

/** Horizontal bars, one per row, labelled at the left with the value at the end. */
export function HBars({ data, label, value, format = inrWhole, color = 'var(--color-brass)' }) {
  const [ref, shown] = useReveal()
  const max = Math.max(...data.map((d) => Number(value(d))), 1)
  return (
    <ul ref={ref} className="list-none m-0 p-0 grid gap-5">
      {data.map((d, i) => {
        const v = Number(value(d))
        return (
          <li key={label(d) + i}>
            <div className="flex items-baseline justify-between gap-4 mb-1.5">
              <span className="text-[17px] truncate">{label(d)}</span>
              <span className="text-[17px] num whitespace-nowrap">{format(v)}</span>
            </div>
            <motion.div
              style={{ height: 14, width: `${Math.max((v / max) * 100, 1.5)}%`, background: color, originX: 0 }}
              initial={{ scaleX: 0 }}
              animate={{ scaleX: shown ? 1 : 0 }}
              transition={{ duration: 1.1, ease: EASE, delay: 0.1 + i * 0.1 }}
            />
          </li>
        )
      })}
    </ul>
  )
}

/** One bar split into proportional segments, with a legend that carries the counts. */
export function Segments({ parts }) {
  const [ref, shown] = useReveal()
  const total = parts.reduce((s, p) => s + p.value, 0)
  return (
    <div ref={ref}>
      <div className="flex w-full overflow-hidden" style={{ height: 22 }} role="img" aria-label={parts.map((p) => `${p.label} ${p.value}`).join(', ')}>
        {total === 0 && <span className="flex-1" style={{ background: 'var(--color-hairline)' }} />}
        {parts.map((p, i) =>
          p.value ? (
            <motion.span
              key={p.label}
              style={{ background: p.color, flexGrow: p.value, flexBasis: 0, originX: 0, marginRight: i < parts.length - 1 ? 2 : 0 }}
              initial={{ scaleX: 0, opacity: 0 }}
              animate={{ scaleX: shown ? 1 : 0, opacity: shown ? 1 : 0 }}
              transition={{ duration: 1.1, ease: EASE, delay: 0.1 + i * 0.15 }}
            />
          ) : null,
        )}
      </div>
      <ul className="list-none m-0 mt-5 p-0 flex flex-wrap gap-x-9 gap-y-3">
        {parts.map((p) => (
          <li key={p.label} className="flex items-center gap-3">
            <span aria-hidden="true" style={{ width: 14, height: 14, background: p.color, display: 'inline-block' }} />
            <span className="font-display text-[34px] font-medium leading-none num text-claret">{shown ? <CountUp value={p.value} duration={1} /> : 0}</span>
            <span className="font-ui text-[15px]">{p.label}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
