// store.jsx: toasts, the data-refresh counter, the command palette switch, the theme and auth.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'

const ToastCtx = createContext(null)
const DataCtx = createContext(null)
const PaletteCtx = createContext(null)
const ThemeCtx = createContext(null)
const AuthCtx = createContext({ required: false, signOut: () => {} })

const readTheme = () => (typeof document !== 'undefined' && document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark')

export function AppProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const [version, setVersion] = useState(0)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [theme, setThemeState] = useState(readTheme)
  const idRef = useRef(1)

  const dismiss = useCallback((id) => setToasts((t) => t.filter((x) => x.id !== id)), [])
  const toast = useCallback(
    (title, message, tone = 'ok') => {
      const id = idRef.current++
      setToasts((t) => [...t.slice(-2), { id, title, message, tone }])
      window.setTimeout(() => dismiss(id), tone === 'error' ? 6500 : 4600)
    },
    [dismiss],
  )
  const bump = useCallback(() => setVersion((v) => v + 1), [])

  /** Switch theme, remember it between visits, and keep the browser chrome in step. */
  const setTheme = useCallback((next) => {
    const t = next === 'light' ? 'light' : 'dark'
    document.documentElement.setAttribute('data-theme', t)
    document.querySelector('meta[name=theme-color]')?.setAttribute('content', t === 'light' ? '#F7F7F5' : '#070708')
    try {
      localStorage.setItem('taj-theme', t)
    } catch {
      /* storage blocked: the choice still applies for this visit */
    }
    setThemeState(t)
  }, [])

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
  const themeValue = useMemo(() => ({ theme, setTheme }), [theme, setTheme])

  return (
    <ToastCtx.Provider value={toastValue}>
      <DataCtx.Provider value={dataValue}>
        <ThemeCtx.Provider value={themeValue}>
          <PaletteCtx.Provider value={paletteValue}>{children}</PaletteCtx.Provider>
        </ThemeCtx.Provider>
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
export const useTheme = () => useContext(ThemeCtx)
