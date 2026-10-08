import { useCallback, useEffect, useState } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { get, post } from './api'
import { AuthProvider, useData } from './store'
import Login from './pages/Login'
import Layout from './components/Layout'
import Toaster from './components/Toaster'
import CommandPalette from './components/CommandPalette'
import FrontDesk from './pages/FrontDesk'
import Timeline from './pages/Timeline'
import Book from './pages/Book'
import Stays from './pages/Stays'
import Services from './pages/Services'
import Housekeeping from './pages/Housekeeping'
import Billing from './pages/Billing'
import Guests from './pages/Guests'
import Reports from './pages/Reports'

export default function App() {
  const { bump } = useData()
  const [auth, setAuth] = useState(null) // null while we ask the server

  useEffect(() => {
    get('/session').then(setAuth).catch(() => setAuth({ auth_required: false, authenticated: true }))
    const out = () => setAuth((a) => ({ ...(a || {}), auth_required: true, authenticated: false }))
    window.addEventListener('taj-auth', out)
    return () => window.removeEventListener('taj-auth', out)
  }, [])

  const signOut = useCallback(async () => {
    await post('/logout').catch(() => {})
    setAuth({ auth_required: true, authenticated: false })
  }, [])

  if (!auth) return <div className="min-h-[100dvh] bg-green" aria-busy="true" />
  if (auth.auth_required && !auth.authenticated) {
    return (
      <Login
        onDone={() => {
          setAuth({ auth_required: true, authenticated: true })
          bump()
        }}
      />
    )
  }
  return (
    <AuthProvider value={{ required: auth.auth_required, signOut }}>
      <a
        href="#main"
        onClick={(e) => {
          e.preventDefault()
          document.getElementById("main")?.focus()
        }}
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[100] focus:bg-green focus:text-marble focus:px-4 focus:py-2 font-ui"
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
      <Toaster />
    </AuthProvider>
  )
}
