// motion.jsx: the reusable motion pieces. Transform and opacity only; under reduced
// motion MotionConfig drops the transforms, so each of these becomes a plain fade.
import { useEffect, useMemo, useRef, useState } from 'react'
import { motion, useInView, useMotionValue, useReducedMotion, useSpring } from 'motion/react'
import { EASE, coarsePointer, introDelay, reduceMotion } from '../motion'

/** Split "Good *afternoon*|Ritheek" into lines (|) and words, *italic* marking italic words. */
function parseLines(text) {
  return String(text)
    .split('|')
    .map((line) => {
      const out = []
      line.split(/(\*[^*]+\*)/).forEach((seg) => {
        if (!seg) return
        const italic = seg.startsWith('*') && seg.endsWith('*')
        const body = italic ? seg.slice(1, -1) : seg
        body.split(/(\s+)/).forEach((w) => {
          if (!w) return
          if (/^\s+$/.test(w)) out.push({ space: true })
          else out.push({ word: w, italic })
        })
      })
      return out
    })
}

/**
 * Display headline in Bodoni. Each line rises out of its own mask, word by word;
 * italic words arrive a moment after the roman ones.
 */
export function Display({ as: Tag = 'h1', text, className = '', delay = 0, inView = false, id }) {
  const lines = useMemo(() => parseLines(text), [text])
  const [base] = useState(() => delay + (inView ? 0 : introDelay()))
  const plain = String(text).replace(/\*/g, '').replace(/\|/g, ' ')
  let wordIndex = 0
  return (
    <Tag className={`display ${className}`} aria-label={plain} id={id}>
      {lines.map((line, li) => (
        <span key={li} className="rv-line" aria-hidden="true">
          {line.map((tok, ti) => {
            if (tok.space) return <span key={ti}> </span>
            const i = wordIndex++
            const t = { duration: 1.0, ease: EASE, delay: base + li * 0.12 + i * 0.045 + (tok.italic ? 0.16 : 0) }
            const from = { y: '112%', opacity: 0, x: tok.italic ? '0.12em' : 0 }
            const to = { y: '0%', opacity: 1, x: 0 }
            return (
              <span key={ti} className="rv-word">
                <motion.span
                  className={tok.italic ? 'inline-block italic' : 'inline-block'}
                  initial={from}
                  {...(inView ? { whileInView: to, viewport: { once: true, amount: 0.6 } } : { animate: to })}
                  transition={t}
                >
                  {tok.word}
                </motion.span>
              </span>
            )
          })}
        </span>
      ))}
    </Tag>
  )
}

/** Fade-and-rise on entering the viewport. */
export function Reveal({ as = 'div', delay = 0, y = 22, amount = 0.15, className = '', children, ...rest }) {
  const Comp = motion[as] || motion.div
  return (
    <Comp
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount }}
      transition={{ duration: 0.9, ease: EASE, delay }}
      className={className}
      {...rest}
    >
      {children}
    </Comp>
  )
}

/** A hairline that draws itself from the left when it scrolls into view. */
export function Rule({ strong = false, className = '', delay = 0 }) {
  return (
    <motion.span
      aria-hidden="true"
      className={`draw-rule ${strong ? 'draw-rule--strong' : ''} ${className}`}
      initial={{ scaleX: 0 }}
      whileInView={{ scaleX: 1 }}
      viewport={{ once: true, amount: 1 }}
      transition={{ duration: 1.3, ease: EASE, delay }}
    />
  )
}

const DIGITS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9']

/**
 * Odometer: every digit is a column of 0-9 that rolls into place. Columns are keyed
 * from the right, so 999 becoming 1,000 rolls instead of jumping.
 */
export function Odometer({ value, format = (v) => String(v), className = '', delay = 0 }) {
  const text = format(Number(value) || 0)
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, amount: 0.3 })
  const [armed, setArmed] = useState(() => reduceMotion())
  const [base] = useState(() => delay + introDelay())
  useEffect(() => {
    if (!inView || armed) return undefined
    const id = requestAnimationFrame(() => requestAnimationFrame(() => setArmed(true)))
    return () => cancelAnimationFrame(id)
  }, [inView, armed])
  const chars = [...text]
  const digitCount = chars.filter((c) => c >= '0' && c <= '9').length
  let seen = 0
  return (
    <span ref={ref} className={`odo ${className}`} role="text" aria-label={text}>
      <span className="odo-inner" aria-hidden="true">
        {chars.map((c, i) => {
          const fromRight = chars.length - i
          if (c < '0' || c > '9') {
            return (
              <span key={`s${fromRight}`} className="odo-ch">
                {c}
              </span>
            )
          }
          const order = seen++
          const target = armed ? Number(c) : 0
          return (
            <span key={`d${fromRight}`} className="odo-col">
              <span
                className="odo-strip"
                style={{ transform: `translateY(${-target * 10}%)`, transitionDelay: `${base + (digitCount - order) * 0.045}s` }}
              >
                {DIGITS.map((d) => (
                  <span key={d}>{d}</span>
                ))}
              </span>
            </span>
          )
        })}
      </span>
    </span>
  )
}

/** A soft silver light that follows the pointer inside its (dark) parent. */
export function Spotlight() {
  const ref = useRef(null)
  const x = useMotionValue(0)
  const y = useMotionValue(0)
  const o = useMotionValue(0)
  const sx = useSpring(x, { stiffness: 120, damping: 28, mass: 0.8 })
  const sy = useSpring(y, { stiffness: 120, damping: 28, mass: 0.8 })
  const so = useSpring(o, { stiffness: 90, damping: 30 })
  useEffect(() => {
    const parent = ref.current?.parentElement
    if (!parent || coarsePointer()) return undefined
    const move = (e) => {
      const r = parent.getBoundingClientRect()
      x.set(e.clientX - r.left)
      y.set(e.clientY - r.top)
      o.set(1)
    }
    const leave = () => o.set(0)
    parent.addEventListener('pointermove', move, { passive: true })
    parent.addEventListener('pointerleave', leave)
    return () => {
      parent.removeEventListener('pointermove', move)
      parent.removeEventListener('pointerleave', leave)
    }
  }, [x, y, o])
  return <motion.span ref={ref} aria-hidden="true" className="spotlight spotlight--local" style={{ x: sx, y: sy, opacity: so }} />
}

/** The same light across the whole page; it only shows in the dark theme (--spot is transparent in light). */
export function PageSpotlight() {
  const reduce = useReducedMotion()
  const x = useMotionValue(-800)
  const y = useMotionValue(-800)
  const sx = useSpring(x, { stiffness: 80, damping: 26, mass: 1 })
  const sy = useSpring(y, { stiffness: 80, damping: 26, mass: 1 })
  useEffect(() => {
    if (reduce || coarsePointer()) return undefined
    const move = (e) => {
      x.set(e.clientX)
      y.set(e.clientY)
    }
    window.addEventListener('pointermove', move, { passive: true })
    return () => window.removeEventListener('pointermove', move)
  }, [reduce, x, y])
  if (reduce) return null
  return <motion.span aria-hidden="true" className="spotlight" style={{ x: sx, y: sy }} />
}

/**
 * Magnetic primary buttons: one delegated listener, no React state. The button eases
 * toward the pointer and settles back when it leaves (the CSS transition does the easing).
 */
export function useMagneticButtons() {
  useEffect(() => {
    if (reduceMotion() || coarsePointer()) return undefined
    let current = null
    const release = () => {
      if (current) current.style.transform = ''
      current = null
    }
    const move = (e) => {
      const el = e.target instanceof Element ? e.target.closest('.btn-primary:not(:disabled), .btn-magnetic') : null
      if (el !== current) release()
      if (!el) return
      current = el
      const r = el.getBoundingClientRect()
      const dx = e.clientX - (r.left + r.width / 2)
      const dy = e.clientY - (r.top + r.height / 2)
      el.style.transform = `translate(${(dx * 0.14).toFixed(2)}px, ${(dy * 0.26).toFixed(2)}px)`
    }
    const out = (e) => {
      if (current && !current.contains(e.relatedTarget)) release()
    }
    document.addEventListener('pointermove', move, { passive: true })
    document.addEventListener('pointerout', out)
    window.addEventListener('blur', release)
    return () => {
      document.removeEventListener('pointermove', move)
      document.removeEventListener('pointerout', out)
      window.removeEventListener('blur', release)
      release()
    }
  }, [])
}
