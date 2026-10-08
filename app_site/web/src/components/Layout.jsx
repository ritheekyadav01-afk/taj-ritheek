import { useEffect, useState } from 'react'
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
  List,
  X,
} from '@phosphor-icons/react'
import Monogram from './Monogram'
import { useAuth, usePalette } from '../store'
import { EASE } from '../motion'
import { DEMO } from '../api'
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

function Brand() {
  return (
    <div className="flex items-center gap-4">
      <Monogram size={46} />
      <div>
        <p className="sc m-0 text-[24px] leading-none text-marble whitespace-nowrap" style={{ letterSpacing: '0.1em' }}>
          Taj Ritheek
        </p>
        <p className="m-0 mt-1.5 italic text-[15px] text-brass-soft leading-none">Est. 1926</p>
      </div>
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
          className="relative flex items-center gap-3.5 px-4 min-h-[46px] font-ui text-[15px] text-marble/90 hover:text-marble transition-colors duration-500"
        >
          {({ isActive }) => (
            <>
              {isActive && (
                <motion.span
                  layoutId="nav-active"
                  className="absolute inset-0"
                  style={{ background: 'var(--color-green-2)', borderLeft: '2px solid var(--color-brass)' }}
                  transition={{ duration: 0.6, ease: EASE }}
                />
              )}
              <Icon size={21} weight={isActive ? 'regular' : 'light'} className="relative" color={isActive ? 'var(--color-brass-soft)' : 'currentColor'} />
              <span className="relative">{label}</span>
            </>
          )}
        </NavLink>
      ))}
    </nav>
  )
}

function SearchButton({ className = '' }) {
  const { setOpen } = usePalette()
  return (
    <button
      type="button"
      onClick={() => setOpen(true)}
      className={`flex items-center gap-3 w-full min-h-[44px] px-4 font-ui text-[14px] text-marble/85 hover:text-marble transition-colors duration-500 ${className}`}
      style={{ border: '1px solid var(--color-green-line)', borderRadius: 2 }}
    >
      <MagnifyingGlass size={18} weight="light" />
      <span className="flex-1 text-left">Search the desk</span>
      <kbd className="font-ui text-[13px] text-brass-soft">Ctrl K</kbd>
    </button>
  )
}

export default function Layout() {
  const location = useLocation()
  const outlet = useOutlet()
  const auth = useAuth()
  const [menu, setMenu] = useState(false)
  useEffect(() => setMenu(false), [location.pathname])

  return (
    <>
    {DEMO && (
      <div className="bg-claret text-marble font-ui text-[14px] px-4 py-2 text-center" role="note">
        Live demo with the sample data. Book, check in, bill and pay as you like; everything resets when you reload the page.
      </div>
    )}
    <div className="min-h-[100dvh] lg:grid lg:grid-cols-[288px_minmax(0,1fr)]">
      {/* desktop sidebar */}
      <aside
        className="hidden lg:flex flex-col sticky top-0 h-[100dvh] bg-green text-marble px-5 pt-9 pb-6"
        aria-label="Taj Ritheek"
      >
        <div className="px-1 pb-8 mb-6" style={{ borderBottom: '1px solid var(--color-green-line)' }}>
          <Brand />
        </div>
        <div className="flex-1 overflow-y-auto thin-scroll -mx-1 px-1">
          <NavList />
        </div>
        <div className="pt-6 grid gap-5">
          <SearchButton />
          <p className="m-0 px-1 italic text-[15px] text-brass-soft leading-snug">{longDate(toISO(today()))}</p>
          {auth.required && (
            <button type="button" onClick={auth.signOut} className="btn btn-on-green btn-sm justify-self-start">
              Sign out
            </button>
          )}
        </div>
      </aside>

      {/* mobile bar */}
      <div className="lg:hidden sticky top-0 z-40 bg-green text-marble flex items-center justify-between px-4 h-[64px]">
        <Brand />
        <div className="flex items-center gap-1">
          <PaletteIcon />
          <button className="btn btn-quiet !text-marble hover:!bg-green-2" onClick={() => setMenu(true)} aria-label="Open menu">
            <List size={26} weight="light" />
          </button>
        </div>
      </div>
      <AnimatePresence>
        {menu && (
          <motion.div
            className="lg:hidden fixed inset-0 z-[60]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4, ease: EASE }}
          >
            <div className="absolute inset-0" style={{ background: 'color-mix(in srgb, #231A16 55%, transparent)' }} onClick={() => setMenu(false)} />
            <motion.div
              className="absolute left-0 top-0 bottom-0 w-[min(88vw,340px)] bg-green text-marble px-5 pt-7 pb-6 flex flex-col overflow-y-auto"
              initial={{ x: -40, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -30, opacity: 0 }}
              transition={{ duration: 0.55, ease: EASE }}
              role="dialog"
              aria-label="Menu"
              aria-modal="true"
            >
              <div className="flex justify-between items-start pb-6 mb-5" style={{ borderBottom: '1px solid var(--color-green-line)' }}>
                <Brand />
                <button className="btn btn-quiet !text-marble hover:!bg-green-2 -mr-3" onClick={() => setMenu(false)} aria-label="Close menu">
                  <X size={24} weight="light" />
                </button>
              </div>
              <NavList onNavigate={() => setMenu(false)} />
              <div className="mt-auto pt-6">
                <p className="m-0 italic text-[15px] text-brass-soft">{longDate(toISO(today()))}</p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <main className="min-w-0 px-4 sm:px-8 lg:px-12 xl:px-16 pt-8 lg:pt-12 pb-24" id="main" tabIndex={-1}>
        <div className="mx-auto max-w-[1280px]">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.5, ease: EASE }}
            >
              {outlet}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
    </>
  )
}

function PaletteIcon() {
  const { setOpen } = usePalette()
  return (
    <button className="btn btn-quiet !text-marble hover:!bg-green-2" onClick={() => setOpen(true)} aria-label="Search the desk">
      <MagnifyingGlass size={24} weight="light" />
    </button>
  )
}
