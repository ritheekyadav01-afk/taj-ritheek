import { useEffect, useRef, useState } from 'react'
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
