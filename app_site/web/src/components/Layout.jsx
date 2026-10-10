import { Suspense, useEffect, useLayoutEffect, useState } from 'react'
import { NavLink, useLocation, useOutlet } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import {
  Key,
  CalendarDots,
  Bed,
  DoorOpen,
  CallBell,
  Broom,
  Receipt,
  AddressBook,
  ChartLineUp,
  MagnifyingGlass,
  SignOut,
} from '@phosphor-icons/react'
import Monogram from './Monogram'
import { PageSpotlight } from './motion'
import { useAuth, usePalette, useTheme } from '../store'
import { DEMO } from '../api'
import { EASE } from '../motion'
import { lockScroll, scrollToTop, unlockScroll } from '../smooth'
import { longDate, toISO, today } from '../format'

export const NAV = [
  { to: '/', label: 'Front desk', icon: Key, end: true },
  { to: '/timeline', label: 'Reservation timeline', icon: CalendarDots },
  { to: '/book', label: 'Book a room', icon: Bed },
  { to: '/stays', label: 'Check-in and check-out', icon: DoorOpen },
  { to: '/services', label: 'Guest services', icon: CallBell },
  { to: '/housekeeping', label: 'Housekeeping', icon: Broom },
  { to: '/billing', label: 'Billing', icon: Receipt },
  { to: '/guests', label: 'Guests', icon: AddressBook },
  { to: '/reports', label: 'Reports', icon: ChartLineUp },
]

function Brand({ compact = false }) {
  return (
    <div className="flex items-center gap-4">
      <Monogram size={compact ? 36 : 46} />
      <div className="leading-none">
        <p className="display m-0 text-[28px] leading-none text-strong whitespace-nowrap">Taj Ritheek</p>
        {!compact && <p className="micro m-0 mt-2.5">Est. 1926</p>}
      </div>
    </div>
  )
}

/** Dark or light, remembered between visits. */
function ThemeSwitch() {
  const { theme, setTheme } = useTheme()
  return (
    <div role="radiogroup" aria-label="Theme" className="inline-flex border border-line" style={{ borderRadius: 1 }}>
      {['dark', 'light'].map((t) => {
        const on = theme === t
        return (
          <button
            key={t}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => setTheme(t)}
            className={`relative px-4 min-h-[36px] text-[13px] tracking-[0.03em] transition-colors duration-500 ${on ? 'text-bg' : 'text-muted hover:text-text'}`}
          >
            {on && <motion.span layoutId="theme-pill" className="absolute inset-0 bg-text" transition={{ duration: 0.6, ease: EASE }} aria-hidden="true" />}
            <span className="relative">{t === 'dark' ? 'Dark' : 'Light'}</span>
          </button>
        )
      })}
    </div>
  )
}

function NavList({ onNavigate }) {
  return (
    <nav aria-label="Main" className="grid gap-0.5">
      {NAV.map(({ to, label, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          onClick={onNavigate}
          className="group relative flex items-center gap-3.5 pl-5 pr-3 min-h-[44px] text-[14.5px] transition-colors duration-500"
        >
          {({ isActive }) => (
            <>
              {isActive && (
                <motion.span
                  layoutId="nav-active"
                  className="absolute left-0 top-2 bottom-2 w-[2px] bg-accent"
                  transition={{ duration: 0.7, ease: EASE }}
                  aria-hidden="true"
                />
              )}
              <Icon size={19} weight="light" className={`shrink-0 transition-colors duration-500 ${isActive ? 'text-strong' : 'text-muted group-hover:text-text'}`} />
              <span
                className={`transition-all duration-500 group-hover:translate-x-[3px] ${isActive ? 'text-strong' : 'text-muted group-hover:text-text'}`}
                style={{ transitionTimingFunction: 'var(--ease)' }}
              >
                {label}
              </span>
            </>
          )}
        </NavLink>
      ))}
    </nav>
  )
}

/** Shown for the moment a page's code is still arriving: the shape of a page, shimmering. */
function PageSkeleton() {
  return (
    <div aria-label="Loading" role="status">
      <div className="sk" style={{ height: 14, width: 120, marginBottom: 24 }} />
      <div className="sk" style={{ height: 58, width: 'min(560px, 90%)' }} />
      <div className="sk" style={{ height: 16, width: 'min(420px, 70%)', marginTop: 22 }} />
      <div className="sk" style={{ height: 1, width: '100%', margin: '36px 0 48px' }} />
      <div className="grid gap-4">
        <div className="sk" style={{ height: 92 }} />
        <div className="sk" style={{ height: 92, opacity: 0.8 }} />
        <div className="sk" style={{ height: 92, opacity: 0.6 }} />
      </div>
    </div>
  )
}

function SearchButton() {
  const { setOpen } = usePalette()
  return (
    <button
      type="button"
      onClick={() => setOpen(true)}
      className="flex items-center gap-3 w-full min-h-[44px] px-4 text-[13.5px] text-muted hover:text-text border border-line hover:border-line-strong transition-colors duration-500"
      style={{ borderRadius: 1 }}
    >
      <MagnifyingGlass size={17} weight="light" />
      <span className="flex-1 text-left">Search the desk</span>
      <kbd className="text-[11.5px] tracking-[0.08em]">Ctrl K</kbd>
    </button>
  )
}

export default function Layout() {
  const location = useLocation()
  const outlet = useOutlet()
  const auth = useAuth()
  const { setOpen } = usePalette()
  const [menu, setMenu] = useState(false)

  useEffect(() => setMenu(false), [location.pathname])
  useLayoutEffect(() => {
    scrollToTop()
  }, [location.pathname])
  useEffect(() => {
    if (!menu) return undefined
    lockScroll()
    return () => unlockScroll()
  }, [menu])

  return (
    <>
      <PageSpotlight />
      {DEMO && (
        <div className="relative z-[2] bg-surface-2 text-text text-[12.5px] tracking-[0.02em] px-4 py-2 text-center" role="note">
          Live demo with the sample data. Book, check in, bill and pay as you like; everything resets when you reload the page.
        </div>
      )}
      <div className="relative z-[1] min-h-[100dvh] lg:grid lg:grid-cols-[284px_minmax(0,1fr)]">
        {/* desktop rail */}
        <aside className="hidden lg:flex flex-col sticky top-0 h-[100dvh] bg-surface border-r border-line px-6 pt-10 pb-7" aria-label="Taj Ritheek">
          <div className="pb-9">
            <Brand />
          </div>
          <div className="flex-1 overflow-y-auto thin-scroll -ml-6 pr-1" data-lenis-prevent>
            <NavList />
          </div>
          <div className="pt-6 grid gap-5 border-t border-line mt-4">
            <SearchButton />
            <div className="flex items-center justify-between gap-3">
              <ThemeSwitch />
              {auth.required && (
                <button type="button" onClick={auth.signOut} className="btn btn-quiet btn-sm text-muted" aria-label="Sign out">
                  <SignOut size={17} weight="light" />
                  Sign out
                </button>
              )}
            </div>
            <p className="m-0 text-[12.5px] text-muted leading-snug">{longDate(toISO(today()))}</p>
          </div>
        </aside>

        {/* phone and tablet bar */}
        <div className="lg:hidden sticky top-0 z-40 bg-bg/90 backdrop-blur-md border-b border-line flex items-center justify-between px-4 h-[68px]">
          <Brand compact />
          <div className="flex items-center gap-1">
            <button className="btn btn-quiet btn-icon" onClick={() => setOpen(true)} aria-label="Search the desk">
              <MagnifyingGlass size={22} weight="light" />
            </button>
            <button className="btn btn-quiet btn-icon" onClick={() => setMenu((m) => !m)} aria-label={menu ? 'Close menu' : 'Open menu'} aria-expanded={menu} aria-controls="mobile-menu">
              <span className="burger" aria-hidden="true">
                <span />
                <span />
              </span>
            </button>
          </div>
        </div>
        <AnimatePresence>
          {menu && (
            <motion.div
              id="mobile-menu"
              className="lg:hidden fixed inset-x-0 bottom-0 top-[68px] z-[70] bg-bg/95 backdrop-blur-xl overflow-y-auto"
              data-lenis-prevent
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.45, ease: EASE }}
              role="dialog"
              aria-modal="true"
              aria-label="Menu"
            >
              <nav aria-label="Main" className="px-6 pt-8 pb-10 grid gap-1">
                {NAV.map(({ to, label, end }, i) => (
                  <span key={to} className="block overflow-hidden">
                    <motion.span
                      className="block"
                      initial={{ y: '105%', opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      transition={{ duration: 0.8, ease: EASE, delay: 0.05 + i * 0.045 }}
                    >
                      <NavLink
                        to={to}
                        end={end}
                        onClick={() => setMenu(false)}
                        className={({ isActive }) => `display block py-1.5 text-[30px] ${isActive ? 'text-strong italic' : 'text-muted'}`}
                      >
                        {label}
                      </NavLink>
                    </motion.span>
                  </span>
                ))}
              </nav>
              <motion.div
                className="px-6 pb-12 grid gap-5"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.6, ease: EASE, delay: 0.5 }}
              >
                <div className="flex items-center justify-between gap-3">
                  <ThemeSwitch />
                  {auth.required && (
                    <button type="button" onClick={auth.signOut} className="btn btn-ghost btn-sm">
                      Sign out
                    </button>
                  )}
                </div>
                <p className="m-0 text-[13px] text-muted">{longDate(toISO(today()))}</p>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        <main className="relative min-w-0 px-4 sm:px-8 lg:px-14 xl:px-20 pt-10 lg:pt-16 pb-28 outline-none" id="main" tabIndex={-1}>
          <div className="relative mx-auto max-w-[1240px]">
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.div
                key={location.pathname}
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, transition: { duration: 0.3, ease: EASE } }}
                transition={{ duration: 0.8, ease: EASE }}
              >
                <Suspense fallback={<PageSkeleton />}>{outlet}</Suspense>
              </motion.div>
            </AnimatePresence>
          </div>
        </main>
      </div>
    </>
  )
}
