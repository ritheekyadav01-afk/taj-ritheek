import { useId } from 'react'
import { motion } from 'motion/react'
import { EASE } from '../motion'
import { STATUS } from './KeyFob'

export function PageHeader({ title, subtitle, children }) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-x-8 gap-y-5 pb-7 mb-9 rule-b">
      <div className="min-w-0">
        <h1 className="font-display text-[34px] sm:text-[44px] font-medium text-claret m-0">{title}</h1>
        {subtitle && <p className="m-0 mt-3 text-[18px] italic text-muted max-w-[72ch]">{subtitle}</p>}
      </div>
      {children && <div className="flex flex-wrap items-center gap-3">{children}</div>}
    </header>
  )
}

export function SectionTitle({ children, aside, id }) {
  return (
    <div className="flex items-baseline justify-between gap-4 mb-4">
      <h2 id={id} className="sc m-0 text-[22px] text-claret">
        {children}
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
      <div
        role="group"
        aria-labelledby={id}
        className="inline-flex items-stretch border border-ink/60 bg-vellum/60"
        style={{ borderRadius: 2 }}
      >
        <button
          type="button"
          className="w-11 min-h-[44px] font-ui text-[20px] hover:bg-vellum disabled:opacity-40"
          onClick={() => onChange(Math.max(min, value - 1))}
          disabled={value <= min}
          aria-label={`Fewer ${label.toLowerCase()}`}
        >
          -
        </button>
        <span className="w-12 grid place-items-center text-[19px] num" aria-live="polite">
          {value}
        </span>
        <button
          type="button"
          className="w-11 min-h-[44px] font-ui text-[20px] hover:bg-vellum disabled:opacity-40"
          onClick={() => onChange(Math.min(max, value + 1))}
          disabled={value >= max}
          aria-label={`More ${label.toLowerCase()}`}
        >
          +
        </button>
      </div>
    </div>
  )
}

export function Segmented({ label, options, value, onChange, name }) {
  const gid = useId()
  return (
    <div role="radiogroup" aria-labelledby={gid}>
      <span className="field-label" id={gid}>
        {label}
      </span>
      <div className="inline-flex flex-wrap border border-ink/60" style={{ borderRadius: 2 }}>
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
              className={`font-ui text-[15px] px-4 min-h-[44px] transition-colors duration-500 ${
                on ? 'bg-green text-marble' : 'hover:bg-vellum'
              }`}
            >
              {o.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export function StatusTag({ status }) {
  const meta = STATUS[status]
  const color =
    status === 'maintenance' ? 'var(--color-muted)' : status === 'occupied' ? 'var(--color-ink)' : meta?.color
  const dot = meta?.color
  return (
    <span className="tag" style={{ color }}>
      <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: 9, background: dot, display: 'inline-block' }} />
      {meta?.label || status}
    </span>
  )
}

const RES_TONE = {
  booked: ['Booked', 'var(--color-green)'],
  checked_in: ['In house', 'var(--color-ink)'],
  completed: ['Completed', 'var(--color-muted)'],
  cancelled: ['Cancelled', 'var(--color-claret-light)'],
  no_show: ['No show', 'var(--color-claret-light)'],
  open: ['Open', 'var(--color-claret-light)'],
  partially_paid: ['Part paid', 'var(--color-ink)'],
  paid: ['Paid', 'var(--color-st-available)'],
  pending: ['To do', 'var(--color-muted)'],
  in_progress: ['In progress', 'var(--color-st-cleaning)'],
  done: ['Done', 'var(--color-st-available)'],
  requested: ['Requested', 'var(--color-ink)'],
  fulfilled: ['Fulfilled', 'var(--color-st-available)'],
}

export function PillTag({ status }) {
  const [label, color] = RES_TONE[status] || [status, 'var(--color-muted)']
  return (
    <span className="tag" style={{ color }}>
      {label}
    </span>
  )
}

export function Skeleton({ className = '', style }) {
  return <div className={`sk ${className}`} style={style} aria-hidden="true" />
}

export function SkeletonRows({ rows = 4, height = 54 }) {
  return (
    <div className="grid gap-3" role="status" aria-label="Loading">
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} style={{ height, opacity: 1 - i * 0.12 }} />
      ))}
    </div>
  )
}

export function EmptyState({ title, children, action }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.7, ease: EASE }}
      className="double-rule py-12 px-6 text-center"
    >
      <p className="font-display text-[30px] text-claret m-0">{title}</p>
      <p className="mx-auto mt-3 mb-0 max-w-[46ch] text-muted italic text-[18px]">{children}</p>
      {action && <div className="mt-6 flex justify-center">{action}</div>}
    </motion.div>
  )
}

export function ErrorNote({ error, onRetry }) {
  if (!error) return null
  return (
    <div role="alert" className="border-l-2 border-claret-light pl-4 py-2 my-4">
      <p className="m-0 font-ui text-[15px] font-medium text-claret-light">That did not load</p>
      <p className="m-0 text-[16px]">{error.message}</p>
      {onRetry && (
        <button className="btn btn-quiet btn-sm mt-2 -ml-3" onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  )
}
