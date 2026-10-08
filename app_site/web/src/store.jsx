// store.jsx: toasts, the data-refresh counter and the command palette switch.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'

const ToastCtx = createContext(null)
const DataCtx = createContext(null)
const PaletteCtx = createContext(null)
const AuthCtx = createContext({ required: false, signOut: () => {} })

export function AppProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const [version, setVersion] = useState(0)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const idRef = useRef(1)

  const dismiss = useCallback((id) => setToasts((t) => t.filter((x) => x.id !== id)), [])
  const toast = useCallback(
    (title, message, tone = 'ok') => {
      const id = idRef.current++
      setToasts((t) => [...t.slice(-2), { id, title, message, tone }])
      window.setTimeout(() => dismiss(id), tone === 'error' ? 6500 : 4200)
    },
    [dismiss],
  )
  const bump = useCallback(() => setVersion((v) => v + 1), [])

  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setPaletteOpen((o) => !o)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const toastValue = useMemo(() => ({ toasts, toast, dismiss }), [toasts, toast, dismiss])
  const dataValue = useMemo(() => ({ version, bump }), [version, bump])
  const paletteValue = useMemo(() => ({ open: paletteOpen, setOpen: setPaletteOpen }), [paletteOpen])

  return (
    <ToastCtx.Provider value={toastValue}>
      <DataCtx.Provider value={dataValue}>
        <PaletteCtx.Provider value={paletteValue}>{children}</PaletteCtx.Provider>
      </DataCtx.Provider>
    </ToastCtx.Provider>
  )
}

export const AuthProvider = AuthCtx.Provider
export const useAuth = () => useContext(AuthCtx)
export const useToasts = () => useContext(ToastCtx)
export const useToast = () => useContext(ToastCtx).toast
export const useData = () => useContext(DataCtx)
export const usePalette = () => useContext(PaletteCtx)
