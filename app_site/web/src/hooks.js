import { useEffect, useRef, useState } from 'react'
import { animate, useMotionValue, useReducedMotion, useTransform } from 'motion/react'
import { get } from './api'
import { useData } from './store'

/**
 * useApi(path): stale-while-revalidate GET. `data` keeps the previous value
 * while a refresh is in flight, so lists never flash back to skeletons.
 * Any mutation that calls bump() makes every mounted useApi refetch.
 */
export function useApi(path, { enabled = true } = {}) {
  const { version } = useData()
  const [state, setState] = useState({ data: null, error: null, loading: enabled })
  const seq = useRef(0)

  useEffect(() => {
    if (!enabled || path == null) return
    const id = ++seq.current
    setState((s) => ({ ...s, loading: true }))
    get(path)
      .then((data) => {
        if (id === seq.current) setState({ data, error: null, loading: false })
      })
      .catch((error) => {
        if (id === seq.current) setState((s) => ({ data: s.data, error, loading: false }))
      })
  }, [path, enabled, version])

  return state
}

/** Count a number up from 0 (or its previous value) over ~1.4s. Honors reduced motion. */
export function useCountUp(target, { duration = 1.4, decimals = 0 } = {}) {
  const reduce = useReducedMotion()
  const mv = useMotionValue(reduce ? target : 0)
  const text = useTransform(mv, (v) => v.toFixed(decimals))
  useEffect(() => {
    if (reduce) {
      mv.set(target)
      return undefined
    }
    const c = animate(mv, target, { duration, ease: [0.32, 0.72, 0, 1] })
    return () => c.stop()
  }, [target, duration, reduce, mv])
  return { mv, text }
}

export function useDebounced(value, ms = 220) {
  const [v, setV] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms)
    return () => clearTimeout(t)
  }, [value, ms])
  return v
}

export function useMedia(query) {
  const [m, setM] = useState(() => (typeof window !== 'undefined' ? window.matchMedia(query).matches : false))
  useEffect(() => {
    const mq = window.matchMedia(query)
    const on = () => setM(mq.matches)
    on()
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [query])
  return m
}
