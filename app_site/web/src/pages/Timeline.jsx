import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'motion/react'
import { CaretLeft, CaretRight } from '@phosphor-icons/react'
import { PageHeader, ErrorNote, Skeleton, PillTag } from '../components/ui'
import KeyFob from '../components/KeyFob'
import Modal from '../components/Modal'
import BookingForm from '../components/BookingForm'
import CheckInModal from '../components/CheckInModal'
import CheckOutModal from '../components/CheckOutModal'
import RuleError from '../components/RuleError'
import { Reveal } from '../components/motion'
import { useApi, useMedia } from '../hooks'
import { post } from '../api'
import { useData, useToast } from '../store'
import { EASE } from '../motion'
import { addDays, dateLabel, dayLabel, diffDays, inr, monthLabel, plural, shortDate, toISO, today, weekday } from '../format'

const DAYS = 42
const ROW_H = 74
const HEAD_H = 86

// Reservation states read by form: booked is outlined, in house is solid ink, completed is hatched.
const BAR = {
  booked: { label: 'Booked' },
  checked_in: { label: 'In house' },
  completed: { label: 'Completed' },
}

let trailSeq = 0

export default function Timeline() {
  const { bump } = useData()
  const toast = useToast()
  const narrow = useMedia('(max-width: 640px)')
  const coarse = useMedia('(pointer: coarse)')
  const W = narrow ? 44 : 50
  const LABEL_W = narrow ? 84 : 180

  const [start, setStart] = useState(() => addDays(today(), -3))
  const end = addDays(start, DAYS)
  const { data, error } = useApi(`/timeline?start=${toISO(start)}&end=${toISO(end)}`)

  const [drag, setDrag] = useState(null) // { room_id, a, b, L, R, live }
  const [trail, setTrail] = useState([]) // silver cells left behind while dragging
  const [pending, setPending] = useState(null) // selection waiting in the booking modal
  const [bar, setBar] = useState(null)
  const [checkIn, setCheckIn] = useState(null)
  const [checkOut, setCheckOut] = useState(null)
  const [cancelErr, setCancelErr] = useState(null)
  const [confirmCancel, setConfirmCancel] = useState(false)
  const [kb, setKb] = useState(null)
  const [announce, setAnnounce] = useState('')
  const tracks = useRef({})
  const todayIdx = diffDays(toISO(start), toISO(today()))

  const dates = useMemo(() => Array.from({ length: DAYS }, (_, i) => addDays(start, i)), [start])
  const months = useMemo(() => {
    const segs = []
    dates.forEach((d) => {
      const k = `${d.getFullYear()}-${d.getMonth()}`
      const last = segs[segs.length - 1]
      if (last && last.k === k) last.n += 1
      else segs.push({ k, n: 1, label: monthLabel(toISO(d)) })
    })
    return segs
  }, [dates])

  const barsByRoom = useMemo(() => {
    const m = {}
    ;(data?.bars || []).forEach((b) => {
      const ci = diffDays(toISO(start), b.check_in)
      const co = diffDays(toISO(start), b.check_out)
      ;(m[b.room_id] ||= []).push({ ...b, ci, co })
    })
    return m
  }, [data, start])

  // free range of nights around a night index in one room
  const limits = useCallback(
    (roomId, a) => {
      let L = Math.max(0, todayIdx)
      let R = DAYS - 1
      ;(barsByRoom[roomId] || []).forEach((b) => {
        if (b.co <= a) L = Math.max(L, b.co)
        if (b.ci > a) R = Math.min(R, b.ci - 1)
      })
      return [L, R]
    },
    [barsByRoom, todayIdx],
  )
  const occupied = (roomId, i) => (barsByRoom[roomId] || []).some((b) => i >= b.ci && i < b.co)

  const idxFromEvent = (e, roomId) => {
    const el = tracks.current[roomId]
    const x = e.clientX - el.getBoundingClientRect().left
    return Math.max(0, Math.min(DAYS - 1, Math.floor(x / W)))
  }

  const leaveTrail = (roomId, from, to) => {
    const step = from < to ? 1 : -1
    const cells = []
    for (let i = from; i !== to + step; i += step) cells.push({ id: ++trailSeq, room_id: roomId, idx: i })
    setTrail((t) => [...t.slice(-40), ...cells])
    const ids = new Set(cells.map((c) => c.id))
    window.setTimeout(() => setTrail((t) => t.filter((c) => !ids.has(c.id))), 1000)
  }

  const openBooking = (roomId, lo, hi) => {
    setPending({ room_id: roomId, a: lo, b: hi })
    setDrag(null)
    setKb(null)
  }

  const onPointerDown = (e, roomId) => {
    if (e.target.closest('[data-bar]') || e.button > 0) return
    const i = idxFromEvent(e, roomId)
    if (i < todayIdx) {
      toast('Those days have passed', 'New bookings start from today.', 'error')
      return
    }
    if (occupied(roomId, i)) return
    const [L, R] = limits(roomId, i)
    if (e.pointerType === 'touch' || coarse) {
      // tap, then tap again to set the last night
      if (drag && drag.room_id === roomId && drag.live === false) {
        const b = Math.max(L, Math.min(R, i))
        openBooking(roomId, Math.min(drag.a, b), Math.max(drag.a, b))
      } else {
        setDrag({ room_id: roomId, a: i, b: i, L, R, live: false })
        leaveTrail(roomId, i, i)
      }
      return
    }
    e.currentTarget.setPointerCapture?.(e.pointerId)
    setDrag({ room_id: roomId, a: i, b: i, L, R, live: true })
    leaveTrail(roomId, i, i)
  }
  const onPointerMove = (e, roomId) => {
    if (!drag || !drag.live || drag.room_id !== roomId) return
    const i = Math.max(drag.L, Math.min(drag.R, idxFromEvent(e, roomId)))
    if (i !== drag.b) {
      leaveTrail(roomId, drag.b + (i > drag.b ? 1 : -1), i)
      setDrag({ ...drag, b: i })
    }
  }
  const onPointerUp = (e, roomId) => {
    if (!drag || !drag.live || drag.room_id !== roomId) return
    e.currentTarget.releasePointerCapture?.(e.pointerId)
    openBooking(roomId, Math.min(drag.a, drag.b), Math.max(drag.a, drag.b))
  }

  // keyboard: focus a room, arrows move, shift+arrows extend, Enter books, Escape clears
  const onKeyDown = (e, roomId) => {
    const base = kb && kb.room_id === roomId ? kb : { room_id: roomId, a: Math.max(0, todayIdx), b: Math.max(0, todayIdx) }
    let next = null
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault()
      const d = e.key === 'ArrowRight' ? 1 : -1
      if (e.shiftKey) next = { ...base, b: Math.max(0, Math.min(DAYS - 1, base.b + d)) }
      else {
        const p = Math.max(0, Math.min(DAYS - 1, base.b + d))
        next = { room_id: roomId, a: p, b: p }
      }
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      if (!kb) {
        setKb(base)
        return
      }
      const lo = Math.min(kb.a, kb.b)
      const hi = Math.max(kb.a, kb.b)
      if (lo < todayIdx) return setAnnounce('Those days have passed.')
      for (let i = lo; i <= hi; i++) if (occupied(roomId, i)) return setAnnounce('Some of those nights are already held.')
      openBooking(roomId, lo, hi)
      return
    } else if (e.key === 'Escape') {
      setKb(null)
      return
    }
    if (next) {
      setKb(next)
      const lo = Math.min(next.a, next.b)
      const hi = Math.max(next.a, next.b)
      setAnnounce(`${dayLabel(toISO(dates[lo]))} to ${dayLabel(toISO(dates[hi]))}, ${plural(hi - lo + 1, 'night')}. Press Enter to book.`)
    }
  }

  useEffect(() => {
    const esc = (e) => e.key === 'Escape' && setDrag((d) => (d && !d.live ? null : d))
    window.addEventListener('keydown', esc)
    return () => window.removeEventListener('keydown', esc)
  }, [])

  const shift = (n) => setStart((s) => addDays(s, n))
  const sel = drag
    ? { room_id: drag.room_id, lo: Math.min(drag.a, drag.b), hi: Math.max(drag.a, drag.b) }
    : pending
      ? { room_id: pending.room_id, lo: Math.min(pending.a, pending.b), hi: Math.max(pending.a, pending.b) }
      : kb
        ? { room_id: kb.room_id, lo: Math.min(kb.a, kb.b), hi: Math.max(kb.a, kb.b) }
        : null

  const pendingRoom = pending && data?.rooms.find((r) => r.room_id === pending.room_id)
  const pendDates = pending ? { ci: toISO(dates[Math.min(pending.a, pending.b)]), co: toISO(addDays(dates[Math.max(pending.a, pending.b)], 1)) } : null

  const cancelBooking = async () => {
    setCancelErr(null)
    try {
      await post(`/reservations/${bar.id}/cancel`)
      bump()
      toast('Booking cancelled', `${bar.guest}'s booking for room ${bar.room_number} is released.`)
      setBar(null)
      setConfirmCancel(false)
    } catch (e) {
      setCancelErr(e)
    }
  }

  const roomOf = (id) => data?.rooms.find((r) => r.room_id === id)
  const cellBg = (d, i) => {
    if (i < todayIdx) return 'color-mix(in srgb, var(--text) 5%, var(--surface))'
    if (d.getDay() === 0 || d.getDay() === 6) return 'color-mix(in srgb, var(--text) 2.5%, var(--surface))'
    return undefined
  }

  return (
    <>
      <PageHeader title="Reservation *timeline*" subtitle="One row for every room. Drag across free nights to start a booking, or open a bar to see the stay.">
        <div className="flex items-center gap-1.5">
          <button className="btn btn-ghost btn-sm btn-icon" onClick={() => shift(-14)} aria-label="Earlier two weeks">
            <CaretLeft size={17} weight="light" />
          </button>
          <button className="btn btn-ghost btn-sm" onClick={() => setStart(addDays(today(), -3))}>
            Today
          </button>
          <button className="btn btn-ghost btn-sm btn-icon" onClick={() => shift(14)} aria-label="Later two weeks">
            <CaretRight size={17} weight="light" />
          </button>
        </div>
      </PageHeader>

      <Reveal className="flex flex-wrap items-center justify-between gap-x-8 gap-y-3 mb-6">
        <ul className="list-none m-0 p-0 flex flex-wrap gap-x-7 gap-y-2" aria-label="Legend">
          {Object.entries(BAR).map(([k, b]) => (
            <li key={k} className="flex items-center gap-2.5 text-[13px]">
              <span aria-hidden="true" className={`bar bar--${k} relative`} style={{ position: 'relative', width: 26, height: 12, display: 'inline-block' }}>
                <span className="bar-fill" />
              </span>
              {b.label}
            </li>
          ))}
          <li className="flex items-center gap-2.5 text-[13px]">
            <span aria-hidden="true" style={{ width: 26, height: 12, border: '1.5px dashed var(--accent)', display: 'inline-block' }} />
            Your selection
          </li>
        </ul>
        <p className="m-0 text-[13px] text-muted">
          {shortDate(toISO(start))} to {dateLabel(toISO(end))}. {coarse ? 'Tap a first night, then a last night.' : 'Keyboard: focus a room, use the arrow keys, Enter to book.'}
        </p>
      </Reveal>
      <p className="sr-only" aria-live="polite">
        {announce}
      </p>

      {error && !data && <ErrorNote error={error} />}
      {!data ? (
        <Skeleton style={{ height: 560 }} />
      ) : (
        <Reveal className="double-rule bg-surface">
          <div className="overflow-x-auto thin-scroll relative m-[5px]">
            <div className="relative" style={{ width: LABEL_W + DAYS * W }}>
              {/* header */}
              <div className="flex sticky top-0 z-20 bg-surface" style={{ height: HEAD_H }}>
                <div className="sticky left-0 z-30 bg-surface shrink-0 flex items-end p-3 border-r border-line border-b border-b-line-strong" style={{ width: LABEL_W }}>
                  <span className="text-[12.5px] text-muted">Room</span>
                </div>
                <div className="flex-1 border-b border-line-strong">
                  <div className="flex" style={{ height: 30 }}>
                    {months.map((m) => (
                      <div key={m.k} className="micro px-2.5 truncate border-r border-line" style={{ width: m.n * W, lineHeight: '30px' }}>
                        {m.label}
                      </div>
                    ))}
                  </div>
                  <div className="flex">
                    {dates.map((d, i) => {
                      const iso = toISO(d)
                      const isToday = i === todayIdx
                      return (
                        <div key={iso} className="grid place-items-center text-center border-r border-line" style={{ width: W, height: 55, background: cellBg(d, i) }}>
                          <span className="text-[11.5px] text-muted leading-none">{weekday(iso).slice(0, 3)}</span>
                          <span
                            className={`num text-[15px] leading-none w-[28px] h-[28px] grid place-items-center ${isToday ? 'bg-text text-bg' : 'text-text'}`}
                            style={isToday ? { borderRadius: 99 } : undefined}
                            aria-label={isToday ? 'Today' : undefined}
                          >
                            {d.getDate()}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>

              {/* today line */}
              {todayIdx >= 0 && todayIdx < DAYS && (
                <motion.span
                  aria-hidden="true"
                  className="absolute z-[5] pointer-events-none w-px bg-accent"
                  style={{ left: LABEL_W + (todayIdx + 0.5) * W, top: HEAD_H, bottom: 0, originY: 0 }}
                  initial={{ scaleY: 0 }}
                  animate={{ scaleY: 1 }}
                  transition={{ duration: 1.3, ease: EASE, delay: 0.3 }}
                />
              )}

              {/* rows */}
              {data.rooms.map((room, ri) => {
                const rowSel = sel && sel.room_id === room.room_id ? sel : null
                return (
                  <div key={room.room_id} className="flex border-b border-line" style={{ height: ROW_H }}>
                    <div className="sticky left-0 z-10 bg-surface shrink-0 flex items-center gap-3.5 px-3 border-r border-line" style={{ width: LABEL_W }}>
                      <KeyFob number={room.room_number} status={room.status} size="sm" />
                      {!narrow && (
                        <div className="min-w-0">
                          <p className="m-0 text-[15px] text-strong leading-tight whitespace-nowrap">Room {room.room_number}</p>
                          <p className="m-0 text-[12.5px] text-muted truncate">{room.type_name}</p>
                        </div>
                      )}
                    </div>
                    <div
                      ref={(el) => (tracks.current[room.room_id] = el)}
                      className="relative select-none outline-none focus-visible:[box-shadow:inset_0_0_0_2px_var(--focus)]"
                      style={{ width: DAYS * W, touchAction: coarse ? 'pan-x pan-y' : 'pan-y', cursor: 'crosshair' }}
                      tabIndex={0}
                      role="group"
                      aria-label={`Room ${room.room_number}. Arrow keys choose nights, Enter books.`}
                      onPointerDown={(e) => onPointerDown(e, room.room_id)}
                      onPointerMove={(e) => onPointerMove(e, room.room_id)}
                      onPointerUp={(e) => onPointerUp(e, room.room_id)}
                      onKeyDown={(e) => onKeyDown(e, room.room_id)}
                      onFocus={() => kb && kb.room_id !== room.room_id && setKb(null)}
                    >
                      <div className="absolute inset-0 flex pointer-events-none" aria-hidden="true">
                        {dates.map((d, i) => (
                          <div key={i} className="border-r border-line" style={{ width: W, background: cellBg(d, i) }} />
                        ))}
                      </div>

                      {trail
                        .filter((t) => t.room_id === room.room_id)
                        .map((t) => (
                          <span key={t.id} className="trail-cell" aria-hidden="true" style={{ left: t.idx * W + 1, width: W - 2, top: 8, height: ROW_H - 16 }} />
                        ))}

                      {(barsByRoom[room.room_id] || []).map((b, bi) => {
                        const meta = BAR[b.status] || BAR.completed
                        const l = Math.max((b.ci + 0.5) * W, 0)
                        const r = Math.min((b.co + 0.5) * W, DAYS * W)
                        if (r <= l) return null
                        const delay = 0.3 + ri * 0.08 + bi * 0.05
                        return (
                          <motion.button
                            key={b.id}
                            type="button"
                            data-bar
                            onClick={() => {
                              setConfirmCancel(false)
                              setCancelErr(null)
                              setBar({ ...b, room_number: room.room_number })
                            }}
                            whileHover={{ y: -2 }}
                            transition={{ duration: 0.5, ease: EASE }}
                            className={`bar bar--${b.status in BAR ? b.status : 'completed'}`}
                            style={{ left: l + 2, width: r - l - 4, top: 12, height: ROW_H - 24 }}
                            aria-label={`${b.guest}, room ${room.room_number}, ${dayLabel(b.check_in)} to ${dayLabel(b.check_out)}, ${meta.label}`}
                          >
                            <motion.span
                              className="bar-fill"
                              initial={{ scaleX: 0 }}
                              animate={{ scaleX: 1 }}
                              transition={{ duration: 1.0, ease: EASE, delay }}
                            />
                            <motion.span
                              className="bar-label"
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              transition={{ duration: 0.6, ease: EASE, delay: delay + 0.55 }}
                            >
                              <span className="block text-[14.5px] font-medium leading-tight truncate">{b.guest}</span>
                              <span className="block text-[12px] leading-tight truncate opacity-80">
                                {plural(diffDays(b.check_in, b.check_out), 'night')}, {meta.label.toLowerCase()}
                              </span>
                            </motion.span>
                          </motion.button>
                        )
                      })}

                      {rowSel && (
                        <motion.div
                          key="ghost"
                          aria-hidden="true"
                          className="absolute pointer-events-none grid place-items-center"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ duration: 0.3, ease: EASE }}
                          style={{
                            left: (rowSel.lo + 0.5) * W + 2,
                            width: (rowSel.hi - rowSel.lo + 1) * W - 4,
                            top: 12,
                            height: ROW_H - 24,
                            border: '1.5px dashed var(--accent)',
                            background: 'color-mix(in srgb, var(--accent) 14%, transparent)',
                            transition: 'width .35s cubic-bezier(0.22,1,0.36,1), left .35s cubic-bezier(0.22,1,0.36,1)',
                          }}
                        >
                          <span className="text-[13px] font-medium text-strong whitespace-nowrap px-1">{plural(rowSel.hi - rowSel.lo + 1, 'night')}</span>
                        </motion.div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </Reveal>
      )}

      {data && data.bars.length === 0 && <p className="text-muted text-[15.5px] mt-6">No reservations fall in these weeks. Drag across any free nights to make the first booking.</p>}

      {/* booking from the drag */}
      <Modal open={!!pending && !!pendingRoom} onClose={() => setPending(null)} title={pendingRoom ? `Book room ${pendingRoom.room_number}` : ''} size="xl">
        {pending && pendingRoom && (
          <BookingForm compact lockRoom initial={{ roomId: pending.room_id, checkIn: pendDates.ci, checkOut: pendDates.co }} onAnother={() => setPending(null)} />
        )}
      </Modal>

      {/* a booking's details */}
      <Modal open={!!bar} onClose={() => setBar(null)} title={bar ? bar.guest : ''} size="sm">
        {bar && (
          <div className="grid gap-6">
            <div className="flex items-center gap-4">
              <KeyFob number={bar.room_number} status={roomOf(bar.room_id)?.status || 'available'} size="sm" />
              <div className="grid gap-1.5">
                <p className="m-0 text-[16px] text-strong">
                  Room {bar.room_number}, {roomOf(bar.room_id)?.type_name}
                </p>
                <PillTag status={bar.status} />
              </div>
            </div>
            <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-7 gap-y-2.5 text-[15px]">
              <dt className="text-[13px] text-muted self-center">Stay</dt>
              <dd className="m-0">
                {dayLabel(bar.check_in)} to {dayLabel(bar.check_out)}, {plural(diffDays(bar.check_in, bar.check_out), 'night')}
              </dd>
              <dt className="text-[13px] text-muted self-center">Party</dt>
              <dd className="m-0">
                {plural(bar.adults, 'adult')}
                {bar.children ? `, ${plural(bar.children, 'child', 'children')}` : ''}
              </dd>
              <dt className="text-[13px] text-muted self-center">Rate</dt>
              <dd className="m-0">
                {bar.plan_name}, {inr(bar.nightly_rate)} a night
              </dd>
            </dl>
            <RuleError error={cancelErr} />
            <div className="flex flex-wrap gap-3">
              {bar.status === 'booked' && !confirmCancel && (
                <>
                  <button
                    className="btn btn-primary"
                    onClick={() => {
                      setCheckIn({ id: bar.id, guest: bar.guest, room: bar.room_number, room_type: roomOf(bar.room_id)?.type_name, check_in: bar.check_in, check_out: bar.check_out })
                      setBar(null)
                    }}
                  >
                    Check in
                  </button>
                  <button className="btn btn-ghost" onClick={() => setConfirmCancel(true)}>
                    Cancel booking
                  </button>
                </>
              )}
              {bar.status === 'booked' && confirmCancel && (
                <>
                  <button className="btn btn-danger" onClick={cancelBooking}>
                    Yes, cancel it
                  </button>
                  <button className="btn btn-ghost" onClick={() => setConfirmCancel(false)}>
                    Keep the booking
                  </button>
                </>
              )}
              {bar.status === 'checked_in' && bar.stay_id && (
                <button
                  className="btn btn-primary"
                  onClick={() => {
                    setCheckOut({ stay_id: bar.stay_id, guest: bar.guest, room: bar.room_number })
                    setBar(null)
                  }}
                >
                  Check out
                </button>
              )}
              {bar.status === 'completed' && <p className="m-0 text-muted text-[15px]">This stay is complete. Its invoice is under Billing.</p>}
            </div>
          </div>
        )}
      </Modal>
      <CheckInModal reservation={checkIn} onClose={() => setCheckIn(null)} />
      <CheckOutModal stay={checkOut} onClose={() => setCheckOut(null)} />
    </>
  )
}
