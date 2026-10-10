import { useId } from 'react'
import { motion, useReducedMotion, useScroll, useTransform } from 'motion/react'
import { Minus, Plus, WarningDiamond } from '@phosphor-icons/react'
import { EASE, introDelay } from '../motion'
import { STATUS } from './KeyFob'
import { Display, Rule } from './motion'

/** Page header: the title rises line by line, then drifts slower than the page as you scroll. */
export function PageHeader({ title, subtitle, children, micro, figure }) {
  const reduce = useReducedMotion()
  const { scrollY } = useScroll()
  const y = useTransform(scrollY, [0, 520], [0, 72])
  const opacity = useTransform(scrollY, [0, 420], [1, 0.3])
  const d = introDelay()
  return (
    <header className="relative mb-12 sm:mb-16">
      <motion.div style={reduce ? undefined : { y, opacity }} className="flex flex-wrap items-end justify-between gap-x-10 gap-y-7 pb-9">
        <div className="min-w-0 max-w-[860px]">
          {micro && (
            <motion.p
              className="micro m-0 mb-5"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.9, ease: EASE, delay: d + 0.05 }}
            >
              {micro}
            </motion.p>
          )}
          <Display text={title} className="m-0 text-[42px] sm:text-[56px] lg:text-[64px] text-strong" />
          {subtitle && (
            <motion.p
              className="lede m-0 mt-5"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.9, ease: EASE, delay: d + 0.35 }}
            >
              {subtitle}
            </motion.p>
          )}
        </div>
        {children && (
          <motion.div
            className="flex flex-wrap items-center gap-3"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, ease: EASE, delay: d + 0.45 }}
          >
            {children}
          </motion.div>
        )}
        {figure}
      </motion.div>
      <Rule />
    </header>
  )
}

/** Section title in Bodoni. A Roman numeral only where the content is a real sequence. */
export function SectionTitle({ children, numeral, aside, id, className = '' }) {
  return (
    <div className={`flex flex-wrap items-end justify-between gap-x-6 gap-y-2 mb-6 ${className}`}>
      <h2 id={id} className="display m-0 text-[30px] sm:text-[32px] text-strong flex items-baseline gap-4">
        {numeral && (
          <span className="italic text-accent text-[30px]" aria-hidden="true">
            {numeral}.
          </span>
        )}
        <span>{children}</span>
      </h2>
      {aside}
    </div>
  )
}

export function Field({ label, help, error, children, className = '', htmlFor }) {
  return (
    <div className={className}>
      <label className="field-label" htmlFor={htmlFor}>
        {label}
      </label>
      {children}
      {help && !error && <p className="field-help m-0">{help}</p>}
      {error && <p className="field-error m-0">{error}</p>}
    </div>
  )
}

export function TextInput({ label, help, error, className = '', ...props }) {
  const id = useId()
  return (
    <Field label={label} help={help} error={error} className={className} htmlFor={id}>
      <input id={id} className="input" aria-invalid={error ? 'true' : undefined} {...props} />
    </Field>
  )
}

export function SelectInput({ label, help, error, className = '', children, ...props }) {
  const id = useId()
  return (
    <Field label={label} help={help} error={error} className={className} htmlFor={id}>
      <select id={id} className="input" aria-invalid={error ? 'true' : undefined} {...props}>
        {children}
      </select>
    </Field>
  )
}

export function Stepper({ label, value, onChange, min = 0, max = 12 }) {
  const id = useId()
  return (
    <div>
      <span className="field-label" id={id}>
        {label}
      </span>
      <div role="group" aria-labelledby={id} className="inline-flex items-stretch border border-line-strong" style={{ borderRadius: 1 }}>
        <button
          type="button"
          className="w-12 min-h-[48px] grid place-items-center hover:bg-surface-2 transition-colors duration-500 disabled:opacity-35"
          onClick={() => onChange(Math.max(min, value - 1))}
          disabled={value <= min}
          aria-label={`Fewer ${label.toLowerCase()}`}
        >
          <Minus size={16} weight="light" />
        </button>
        <span className="w-12 grid place-items-center text-[17px] num border-x border-line" aria-live="polite">
          {value}
        </span>
        <button
          type="button"
          className="w-12 min-h-[48px] grid place-items-center hover:bg-surface-2 transition-colors duration-500 disabled:opacity-35"
          onClick={() => onChange(Math.min(max, value + 1))}
          disabled={value >= max}
          aria-label={`More ${label.toLowerCase()}`}
        >
          <Plus size={16} weight="light" />
        </button>
      </div>
    </div>
  )
}

/** Radio group with a silver bar that slides to the chosen option. */
export function Segmented({ label, options, value, onChange, name, hideLabel = false }) {
  const gid = useId()
  return (
    <div role="radiogroup" aria-labelledby={gid}>
      <span className={hideLabel ? 'sr-only' : 'field-label'} id={gid}>
        {label}
      </span>
      <div className="inline-flex flex-wrap border border-line-strong" style={{ borderRadius: 1 }}>
        {options.map((o) => {
          const on = value === o.value
          return (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={on}
              name={name}
              onClick={() => onChange(o.value)}
              className={`relative px-4 min-h-[44px] text-[14px] tracking-[0.02em] transition-colors duration-500 ${on ? 'text-bg' : 'text-text hover:bg-surface-2'}`}
            >
              {on && (
                <motion.span
                  layoutId={`seg-${gid}`}
                  className="absolute inset-0 bg-text"
                  transition={{ duration: 0.6, ease: EASE }}
                  aria-hidden="true"
                />
              )}
              <span className="relative">{o.label}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

/** Room status in running text: the same miniature form as the fob, plus the word. */
export function StatusTag({ status }) {
  return (
    <span className="tag">
      <span className={`swatch swatch--${status}`} aria-hidden="true" style={{ transform: 'scale(0.85)' }} />
      {STATUS[status]?.label || status}
    </span>
  )
}

// Reservation, invoice and task states, told apart by outline, fill and dash rather than colour.
const STATES = {
  booked: ['Booked', ''],
  checked_in: ['In house', 'tag--solid'],
  completed: ['Completed', 'tag--quiet'],
  cancelled: ['Cancelled', 'tag--error'],
  no_show: ['No show', 'tag--error tag--dashed'],
  open: ['Open', 'tag--dashed'],
  partially_paid: ['Part paid', ''],
  paid: ['Paid', 'tag--solid'],
  pending: ['To do', 'tag--dashed'],
  in_progress: ['In progress', ''],
  done: ['Done', 'tag--solid'],
  requested: ['Requested', 'tag--dashed'],
  fulfilled: ['Fulfilled', 'tag--solid'],
}

export function PillTag({ status }) {
  const [label, cls] = STATES[status] || [status, 'tag--quiet']
  return <span className={`tag ${cls}`}>{label}</span>
}

export function Skeleton({ className = '', style }) {
  return <div className={`sk ${className}`} style={style} aria-hidden="true" />
}

export function SkeletonRows({ rows = 4, height = 56 }) {
  return (
    <div className="grid gap-3" role="status" aria-label="Loading">
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} style={{ height, opacity: 1 - i * 0.13 }} />
      ))}
    </div>
  )
}

export function EmptyState({ title, children, action }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.9, ease: EASE }}
      className="double-rule px-6 py-14 text-center"
    >
      <p className="display m-0 text-[32px] text-strong">{title}</p>
      <p className="mx-auto mt-4 mb-0 max-w-[46ch] text-muted text-[16px]">{children}</p>
      {action && <div className="mt-8 flex justify-center">{action}</div>}
    </motion.div>
  )
}

export function ErrorNote({ error, onRetry }) {
  if (!error) return null
  return (
    <div role="alert" className="flex gap-4 items-start border-l-2 border-error pl-5 py-3 my-5">
      <WarningDiamond size={22} weight="light" className="text-error mt-0.5 shrink-0" />
      <div>
        <p className="m-0 text-[14px] font-medium text-error-text">That did not load</p>
        <p className="m-0 text-[15px] text-text">{error.message}</p>
        {onRetry && (
          <button className="btn btn-quiet btn-sm mt-2 -ml-3" onClick={onRetry}>
            Try again
          </button>
        )}
      </div>
    </div>
  )
}
