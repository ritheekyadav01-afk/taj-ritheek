import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import { MagnifyingGlass, ArrowElbowDownLeft, User, Key, Plus } from '@phosphor-icons/react'
import { NAV } from './Layout'
import { usePalette } from '../store'
import { useDebounced } from '../hooks'
import { get } from '../api'
import { EASE } from '../motion'
import { lockScroll, unlockScroll } from '../smooth'

const ACTIONS = [
  { label: 'Book a room', to: '/book', hint: 'Dates, party and guest' },
  { label: 'Add a guest', to: '/guests?new=1', hint: 'Guests' },
  { label: 'Log a guest request', to: '/services', hint: 'Guest services' },
  { label: 'Record a payment', to: '/billing', hint: 'Billing' },
  { label: 'Create a housekeeping task', to: '/housekeeping?new=1', hint: 'Housekeeping' },
]

export default function CommandPalette() {
  const { open, setOpen } = usePalette()
  return createPortal(<AnimatePresence>{open && <Palette key="palette" close={() => setOpen(false)} />}</AnimatePresence>, document.body)
}

function Palette({ close }) {
  const nav = useNavigate()
  const [q, setQ] = useState('')
  const [active, setActive] = useState(0)
  const [found, setFound] = useState({ guests: [], rooms: [] })
  const [searching, setSearching] = useState(false)
  const dq = useDebounced(q.trim(), 200)
  const input = useRef(null)
  const listRef = useRef(null)
  const opener = useRef(document.activeElement)

  useEffect(() => {
    lockScroll()
    input.current?.focus()
    const back = opener.current
    return () => {
      unlockScroll()
      back?.focus?.({ preventScroll: true })
    }
  }, [])

  useEffect(() => {
    if (dq.length < 2) {
      setFound({ guests: [], rooms: [] })
      setSearching(false)
      return undefined
    }
    let live = true
    setSearching(true)
    get(`/search?q=${encodeURIComponent(dq)}`)
      .then((r) => live && setFound(r))
      .catch(() => live && setFound({ guests: [], rooms: [] }))
      .finally(() => live && setSearching(false))
    return () => {
      live = false
    }
  }, [dq])

  const items = useMemo(() => {
    const needle = q.trim().toLowerCase()
    const match = (s) => !needle || s.toLowerCase().includes(needle)
    const out = []
    NAV.filter((n) => match(n.label)).forEach((n) => out.push({ group: 'Go to', label: n.label, icon: n.icon, run: () => nav(n.to) }))
    ACTIONS.filter((a) => match(a.label)).forEach((a) => out.push({ group: 'Do', label: a.label, hint: a.hint, icon: Plus, run: () => nav(a.to) }))
    found.guests.forEach((g) =>
      out.push({ group: 'Guests', label: g.full_name, hint: g.email, icon: User, run: () => nav(`/guests?focus=${g.guest_id}`) }),
    )
    found.rooms.forEach((r) =>
      out.push({ group: 'Rooms', label: `Room ${r.room_number}`, hint: `${r.type_name}, ${r.status}`, icon: Key, run: () => nav(`/?room=${r.room_id}`) }),
    )
    return out
  }, [q, found, nav])

  useEffect(() => setActive(0), [q, found])
  useEffect(() => {
    listRef.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' })
  }, [active])

  const choose = (item) => {
    if (!item) return
    close()
    item.run()
  }

  const onKeyDown = (e) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      close()
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((a) => Math.min(a + 1, items.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((a) => Math.max(a - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      choose(items[active])
    } else if (e.key === 'Tab') {
      e.preventDefault()
    }
  }

  let lastGroup = null
  return (
    <motion.div
      className="fixed inset-0 z-[85] flex justify-center items-start px-3 pt-[12vh]"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.45, ease: EASE }}
      onKeyDown={onKeyDown}
    >
      <div className="absolute inset-0 backdrop-blur-[3px]" style={{ background: 'var(--scrim)' }} onClick={close} aria-hidden="true" />
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label="Search the desk"
        className="double-rule bg-surface relative w-[min(660px,100%)] flex flex-col"
        style={{ maxHeight: '70dvh', boxShadow: 'var(--shadow)' }}
        initial={{ y: -16, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: -8, opacity: 0 }}
        transition={{ duration: 0.6, ease: EASE }}
      >
        <div className="flex items-center gap-4 px-6 pt-5 pb-4 border-b border-line">
          <MagnifyingGlass size={20} weight="light" className="text-muted" />
          <input
            ref={input}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Go to a page, find a guest or a room"
            aria-label="Search"
            role="combobox"
            aria-expanded="true"
            aria-controls="palette-list"
            aria-activedescendant={items[active] ? `pal-${active}` : undefined}
            className="flex-1 bg-transparent border-0 outline-none text-[18px] font-light text-text placeholder:text-muted min-w-0"
            autoComplete="off"
            spellCheck={false}
          />
          <kbd className="text-[12px] text-muted tracking-[0.08em]">Esc</kbd>
        </div>
        <ul id="palette-list" role="listbox" ref={listRef} data-lenis-prevent className="list-none m-0 p-2 overflow-y-auto thin-scroll">
          {items.length === 0 && (
            <li className="px-4 py-10 text-center text-muted text-[15px]">
              {searching ? 'Looking through the register' : 'Nothing matches that. Try a guest name or a room number.'}
            </li>
          )}
          {items.map((it, i) => {
            const head = it.group !== lastGroup
            lastGroup = it.group
            const Icon = it.icon
            const on = i === active
            return (
              <li key={`${it.group}-${it.label}-${i}`} role="presentation">
                {head && <p className="micro m-0 px-4 pt-4 pb-2">{it.group}</p>}
                <div
                  id={`pal-${i}`}
                  role="option"
                  aria-selected={on}
                  onMouseMove={() => setActive(i)}
                  onClick={() => choose(it)}
                  className={`relative flex items-center gap-3.5 px-4 min-h-[46px] cursor-pointer transition-colors duration-300 ${on ? 'text-bg' : 'text-text'}`}
                >
                  {on && (
                    <motion.span layoutId="pal-active" className="absolute inset-0 bg-text" transition={{ duration: 0.45, ease: EASE }} aria-hidden="true" />
                  )}
                  <Icon size={18} weight="light" className="relative" />
                  <span className="relative flex-1 min-w-0 truncate text-[15.5px]">{it.label}</span>
                  {it.hint && <span className={`relative text-[12.5px] truncate max-w-[40%] ${on ? 'opacity-80' : 'text-muted'}`}>{it.hint}</span>}
                  {on && <ArrowElbowDownLeft size={15} className="relative" />}
                </div>
              </li>
            )
          })}
        </ul>
      </motion.div>
    </motion.div>
  )
}
