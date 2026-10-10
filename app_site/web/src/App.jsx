import { lazy, useCallback, useEffect, useState } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import { get, post } from './api'
import { AuthProvider, useData } from './store'
import Login from './pages/Login'
import Layout from './components/Layout'
import Toaster from './components/Toaster'
import CommandPalette from './components/CommandPalette'
import FrontDesk from './pages/FrontDesk'
import { useMagneticButtons } from './components/motion'
import { EASE, openDoors } from './motion'
import { startSmoothScroll, stopSmoothScroll } from './smooth'

// The front desk ships with the first load; every other page arrives as its own chunk.
const pages = {
  Timeline: () => import('./pages/Timeline'),
  Book: () => import('./pages/Book'),
  Stays: () => import('./pages/Stays'),
  Services: () => import('./pages/Services'),
  Housekeeping: () => import('./pages/Housekeeping'),
  Billing: () => import('./pages/Billing'),
  Guests: () => import('./pages/Guests'),
  Reports: () => import('./pages/Reports'),
}
const Timeline = lazy(pages.Timeline)
const Book = lazy(pages.Book)
const Stays = lazy(pages.Stays)
const Services = lazy(pages.Services)
const Housekeeping = lazy(pages.Housekeeping)
const Billing = lazy(pages.Billing)
const Guests = lazy(pages.Guests)
const Reports = lazy(pages.Reports)

export default function App() {
  const { bump } = useData()
  const [auth, setAuth] = useState(null) // null while we ask the server; the closed doors cover this moment

  useEffect(() => {
    startSmoothScroll()
    return () => stopSmoothScroll()
  }, [])
  useMagneticButtons()

  useEffect(() => {
    get('/session')
      .then(setAuth)
      .catch(() => setAuth({ auth_required: false, authenticated: true }))
    const out = () => setAuth((a) => ({ ...(a || {}), auth_required: true, authenticated: false }))
    window.addEventListener('taj-auth', out)
    return () => window.removeEventListener('taj-auth', out)
  }, [])

  // Part the doors once the first real screen is on the page underneath them.
  useEffect(() => {
    if (!auth) return undefined
    let b = 0
    const a = requestAnimationFrame(() => {
      b = requestAnimationFrame(openDoors)
    })
    return () => {
      cancelAnimationFrame(a)
      cancelAnimationFrame(b)
    }
  }, [auth])

  // Warm the other pages once the browser is idle, so moving between them never waits.
  useEffect(() => {
    if (!auth || (auth.auth_required && !auth.authenticated)) return undefined
    const warm = () => Object.values(pages).forEach((load) => load().catch(() => {}))
    const id = 'requestIdleCallback' in window ? window.requestIdleCallback(warm, { timeout: 2500 }) : window.setTimeout(warm, 1500)
    return () => ('cancelIdleCallback' in window ? window.cancelIdleCallback(id) : window.clearTimeout(id))
  }, [auth])

  const signOut = useCallback(async () => {
    await post('/logout').catch(() => {})
    setAuth({ auth_required: true, authenticated: false })
  }, [])

  const needLogin = !!auth && auth.auth_required && !auth.authenticated
  const showApp = !!auth && !needLogin

  return (
    <>
      {showApp && (
        <AuthProvider value={{ required: auth.auth_required, signOut }}>
          <a
            href="#main"
            onClick={(e) => {
              e.preventDefault()
              document.getElementById('main')?.focus()
            }}
            className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[95] focus:bg-text focus:text-bg focus:px-4 focus:py-2"
          >
            Skip to content
          </a>
          <Routes>
            <Route element={<Layout />}>
              <Route index element={<FrontDesk />} />
              <Route path="timeline" element={<Timeline />} />
              <Route path="book" element={<Book />} />
              <Route path="stays" element={<Stays />} />
              <Route path="services" element={<Services />} />
              <Route path="housekeeping" element={<Housekeeping />} />
              <Route path="billing" element={<Billing />} />
              <Route path="guests" element={<Guests />} />
              <Route path="reports" element={<Reports />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
          <CommandPalette />
        </AuthProvider>
      )}
      {/* Sign-in sits over the app; after a good password the front desk is already rendered beneath it. */}
      <AnimatePresence>
        {needLogin && (
          <motion.div
            key="login"
            className="fixed inset-0 z-[75] overflow-y-auto bg-bg"
            data-lenis-prevent
            initial={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 1.015 }}
            transition={{ duration: 0.8, ease: EASE }}
          >
            <Login
              onDone={() => {
                setAuth({ auth_required: true, authenticated: true })
                bump()
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>
      <Toaster />
    </>
  )
}
