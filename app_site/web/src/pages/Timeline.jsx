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
import { useApi, useMedia } from '../hooks'
import { post } from '../api'
import { useData, useToast } from '../store'
import { EASE } from '../motion'
import { addDays, dateLabel, dayLabel, diffDays, inr, monthLabel, parseDate, plural, shortDate, toISO, today, weekday } from '../format'

const DAYS = 42
const ROW_H = 72
const HEAD_H = 84

const BAR = {
  booked: { bg: 'var(--color-green)', fg: 'var(--color-marble)', label: 'Booked' },
  checked_in: { bg: 'var(--color-brass)', fg: 'var(--color-ink)', label: 'In house' },
  completed: { bg: 'var(--color-muted)', fg: 'var(--color-marble)', label: 'Completed' },
}

export default function Timeline() {
  const { bump } = useData()
  const toast = useToast()
  const narrow = useMedia('(max-width: 640px)')
  const coarse = useMedia('(pointer: coarse)')
  const W = narrow ? 44 : 50
  const LABEL_W = narrow ? 84 : 176

  const [start, setStart] = useState(() => addDays(today(), -3))
  const end = addDays(start, DAYS)
  const { data, error } = useApi(`/timeline?start=${toISO(start)}&end=${toISO(end)}`)

  const [drag, setDrag] = useState(null) // { room_id, a, b, L, R, live }
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
        const lo = Math.min(drag.a, b)
        const hi = Math.max(drag.a, b)
        openBooking(roomId, lo, hi)
      } else {
        setDrag({ room_id: roomId, a: i, b: i, L, R, live: false })
      }
      return
    }
    e.currentTarget.setPointerCapture?.(e.pointerId)
    setDrag({ room_id: roomId, a: i, b: i, L, R, live: true })
  }
  const onPointerMove = (e, roomId) => {
    if (!drag || !drag.live || drag.room_id !== roomId) return
    const i = Math.max(drag.L, Math.min(drag.R, idxFromEvent(e, roomId)))
    if (i !== drag.b) setDrag({ ...drag, b: i })
  }
  const onPointerUp = (e, roomId) => {
    if (!drag || !drag.live || drag.room_id !== roomId) return
    e.currentTarget.releasePointerCapture?.(e.pointerId)
    openBooking(roomId, Math.min(drag.a, drag.b), Math.max(drag.a, drag.b))
  }

  // keyboard: focus a row, arrows move, shift+arrows extend, Enter books, Escape clears
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
  const pendDates = pending
    ? { ci: toISO(dates[Math.min(pending.a, pending.b)]), co: toISO(addDays(dates[Math.max(pending.a, pending.b)], 1)) }
    : null

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

  return (
    <>
      <PageHeader title="Reservation timeline" subtitle="One row for every room. Drag across free nights to start a booking, or click a bar to see the stay.">
        <div className="flex items-center gap-1">
          <button className="btn btn-ghost btn-sm" onClick={() => shift(-14)} aria-label="Earlier two weeks">
            <CaretLeft size={18} />
          </button>
          <button className="btn btn-ghost btn-sm" onClick={() => setStart(addDays(today(), -3))}>
            Today
          </button>
          <button className="btn btn-ghost btn-sm" onClick={() => shift(14)} aria-label="Later two weeks">
            <CaretRight size={18} />
          </button>
        </div>
      </PageHeader>

      <div className="flex flex-wrap items-center justify-between gap-x-8 gap-y-3 mb-5">
        <ul className="list-none m-0 p-0 flex flex-wrap gap-x-6 gap-y-2" aria-label="Legend">
          {Object.values(BAR).map((b) => (
            <li key={b.label} className="flex items-center gap-2 font-ui text-[14px]">
              <span aria-hidden="true" style={{ width: 22, height: 12, background: b.bg, display: 'inline-block' }} />
              {b.label}
            </li>
          ))}
          <li className="flex items-center gap-2 font-ui text-[14px]">
            <span aria-hidden="true" style={{ width: 22, height: 12, border: '1.5px dashed var(--color-claret)', display: 'inline-block' }} />
            Your selection
          </li>
        </ul>
        <p className="m-0 font-ui text-[14px] text-muted">
          {shortDate(toISO(start))} to {dateLabel(toISO(end))}. {coarse ? 'Tap a first night, then a last night.' : 'Keyboard: focus a room, use the arrow keys, Enter to book.'}
        </p>
      </div>
      <p className="sr-only" aria-live="polite">
        {announce}
      </p>

      {error && !data && <ErrorNote error={error} />}
      {!data ? (
        <Skeleton style={{ height: 520 }} />
      ) : (
        <div className="double-rule bg-marble">
          <div className="overflow-x-auto thin-scroll relative m-[5px]">
            <div className="relative" style={{ width: LABEL_W + DAYS * W }}>
              {/* header */}
              <div className="flex sticky top-0 z-20 bg-marble" style={{ height: HEAD_H }}>
                <div className="sticky left-0 z-30 bg-marble shrink-0 flex items-end p-3" style={{ width: LABEL_W, borderRight: '1px solid var(--color-hairline)', borderBottom: '1px solid var(--color-ink)' }}>
                  <span className="font-ui text-[13px] text-muted">Room</span>
                </div>
                <div className="flex-1" style={{ borderBottom: '1px solid var(--color-ink)' }}>
                  <div className="flex" style={{ height: 30 }}>
                    {months.map((m) => (
                      <div key={m.k} className="sc text-[17px] text-claret px-2 truncate" style={{ width: m.n * W, borderRight: '1px solid var(--color-hairline)', lineHeight: '30px' }}>
                        {m.label}
                      </div>
                    ))}
                  </div>
                  <div className="flex">
                    {dates.map((d, i) => {
                      const iso = toISO(d)
                      const isToday = i === todayIdx
                      const weekend = d.getDay() === 0 || d.getDay() === 6
                      return (
                        <div
                          key={iso}
                          className="grid place-items-center text-center"
                          style={{ width: W, height: 54, borderRight: '1px solid var(--color-hairline)', background: weekend ? 'color-mix(in srgb, #E8E3D8 55%, #F2F0EB)' : undefined }}
                        >
                          <span className="font-ui text-[13px] text-muted leading-none">{weekday(iso).slice(0, 3)}</span>
                          <span
                            className="num text-[18px] leading-none w-[30px] h-[30px] grid place-items-center"
                            style={isToday ? { background: 'var(--color-green)', color: 'var(--color-marble)', borderRadius: 99 } : undefined}
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
                <span
                  aria-hidden="true"
                  className="absolute z-10 pointer-events-none"
                  style={{ left: LABEL_W + (todayIdx + 0.5) * W, top: HEAD_H, bottom: 0, width: 0, borderLeft: '1.5px solid var(--color-brass)' }}
                />
              )}

              {/* rows */}
              {data.rooms.map((room, ri) => {
                const rowSel = sel && sel.room_id === room.room_id ? sel : null
                return (
                  <div key={room.room_id} className="flex" style={{ height: ROW_H, borderBottom: '1px solid var(--color-hairline)' }}>
                    <div className="sticky left-0 z-10 bg-marble shrink-0 flex items-center gap-3 px-3" style={{ width: LABEL_W, borderRight: '1px solid var(--color-hairline)' }}>
                      <KeyFob number={room.room_number} status={room.status} size="sm" />
                      {!narrow && (
                        <div className="min-w-0">
                          <p className="m-0 text-[17px] leading-tight whitespace-nowrap">Room {room.room_number}</p>
                          <p className="m-0 font-ui text-[13px] text-muted truncate">{room.type_name}</p>
                        </div>
                      )}
                    </div>
                    <div
                      ref={(el) => (tracks.current[room.room_id] = el)}
                      className="relative select-none outline-none focus-visible:[box-shadow:inset_0_0_0_2px_var(--color-brass)]"
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
                        {dates.map((d, i) => {
                          const weekend = d.getDay() === 0 || d.getDay() === 6
                          return (
                            <div
                              key={i}
                              style={{
                                width: W,
                                borderRight: '1px solid var(--color-hairline)',
                                background: i < todayIdx ? 'color-mix(in srgb, #E8E3D8 80%, #F2F0EB)' : weekend ? 'color-mix(in srgb, #E8E3D8 55%, #F2F0EB)' : undefined,
                              }}
                            />
                          )
                        })}
                      </div>

                      {(barsByRoom[room.room_id] || []).map((b, bi) => {
                        const meta = BAR[b.status] || BAR.completed
                        const l = Math.max((b.ci + 0.5) * W, 0)
                        const r = Math.min((b.co + 0.5) * W, DAYS * W)
                        if (r <= l) return null
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
                            initial={{ clipPath: 'inset(0 100% 0 0)', opacity: 0 }}
                            animate={{ clipPath: 'inset(0 0% 0 0)', opacity: 1 }}
                            transition={{ duration: 0.9, ease: EASE, delay: 0.25 + ri * 0.09 + bi * 0.05 }}
                            whileHover={{ y: -2 }}
                            className="absolute text-left px-3 overflow-hidden cursor-pointer"
                            style={{
                              left: l + 2,
                              width: r - l - 4,
                              top: 11,
                              height: ROW_H - 22,
                              background: meta.bg,
                              color: meta.fg,
                              border: 0,
                              borderRadius: 2,
                              boxShadow: '0 8px 12px -8px color-mix(in srgb, #231A16 55%, transparent)',
                            }}
                            aria-label={`${b.guest}, room ${room.room_number}, ${dayLabel(b.check_in)} to ${dayLabel(b.check_out)}, ${meta.label}`}
                          >
                            <span className="block text-[17px] font-semibold leading-tight truncate">{b.guest}</span>
                            <span className="block font-ui text-[13px] leading-tight truncate" style={{ opacity: 0.92 }}>
                              {plural(diffDays(b.check_in, b.check_out), 'night')}, {meta.label.toLowerCase()}
                            </span>
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
                            top: 11,
                            height: ROW_H - 22,
                            border: '1.5px dashed var(--color-claret)',
                            background: 'color-mix(in srgb, #5A1626 10%, transparent)',
                            borderRadius: 2,
                            transition: 'width .25s cubic-bezier(.32,.72,0,1), left .25s cubic-bezier(.32,.72,0,1)',
                          }}
                        >
                          <span className="font-ui text-[14px] font-medium text-claret whitespace-nowrap px-1">
                            {plural(rowSel.hi - rowSel.lo + 1, 'night')}
                          </span>
                        </motion.div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {data && data.bars.length === 0 && (
        <p className="italic text-muted text-[18px] mt-6">
          No reservations fall in these weeks. Drag across any free nights to make the first booking.
        </p>
      )}

      {/* booking from the drag */}
      <Modal
        open={!!pending && !!pendingRoom}
        onClose={() => setPending(null)}
        title={pendingRoom ? `Book room ${pendingRoom.room_number}` : ''}
        size="xl"
      >
        {pending && pendingRoom && (
          <BookingForm
            compact
            lockRoom
            initial={{ roomId: pending.room_id, checkIn: pendDates.ci, checkOut: pendDates.co }}
            onAnother={() => setPending(null)}
          />
        )}
      </Modal>

      {/* a booking's details */}
      <Modal open={!!bar} onClose={() => setBar(null)} title={bar ? bar.guest : ''} size="sm">
        {bar && (
          <div className="grid gap-5">
            <div className="flex items-center gap-4">
              <KeyFob number={bar.room_number} status={roomOf(bar.room_id)?.status || 'available'} size="sm" />
              <div>
                <p className="m-0 text-[19px]">
                  Room {bar.room_number}, {roomOf(bar.room_id)?.type_name}
                </p>
                <PillTag status={bar.status} />
              </div>
            </div>
            <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-[17px]">
              <dt className="font-ui text-[14px] text-muted self-center">Stay</dt>
              <dd className="m-0">
                {dayLabel(bar.check_in)} to {dayLabel(bar.check_out)}, {plural(diffDays(bar.check_in, bar.check_out), 'night')}
              </dd>
              <dt className="font-ui text-[14px] text-muted self-center">Party</dt>
              <dd className="m-0">
                {plural(bar.adults, 'adult')}
                {bar.children ? `, ${plural(bar.children, 'child', 'children')}` : ''}
              </dd>
              <dt className="font-ui text-[14px] text-muted self-center">Rate</dt>
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
                  <button className="btn btn-claret" onClick={cancelBooking}>
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
              {bar.status === 'completed' && <p className="m-0 italic text-muted text-[17px]">This stay is complete. Its invoice is under Billing.</p>}
            </div>
          </div>
        )}
      </Modal>
      <CheckInModal reservation={checkIn} onClose={() => setCheckIn(null)} />
      <CheckOutModal stay={checkOut} onClose={() => setCheckOut(null)} />
    </>
  )
}
