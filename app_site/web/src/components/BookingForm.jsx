import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import KeyFob from './KeyFob'
import RuleError from './RuleError'
import CountUp from './CountUp'
import { Segmented, SelectInput, Skeleton, Stepper, TextInput } from './ui'
import { useApi } from '../hooks'
import { post } from '../api'
import { useData, useToast } from '../store'
import { EASE } from '../motion'
import { addDays, dayLabel, diffDays, inr, parseDate, plural, toISO, today } from '../format'

const TAX = 0.05
const validDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(parseDate(s).getTime())

/**
 * One booking form for the Book page and for the timeline drag.
 * Every rule violation comes back from the database and is shown as-is.
 */
export default function BookingForm({ initial = {}, lockRoom = false, onBooked, onAnother, compact = false }) {
  const { bump } = useData()
  const toast = useToast()
  const [ci, setCi] = useState(initial.checkIn || toISO(addDays(today(), 1)))
  const [co, setCo] = useState(initial.checkOut || toISO(addDays(today(), 3)))
  const [adults, setAdults] = useState(2)
  const [children, setChildren] = useState(0)
  const [roomId, setRoomId] = useState(initial.roomId || null)
  const [planId, setPlanId] = useState(null)
  const [mode, setMode] = useState('existing')
  const [guestId, setGuestId] = useState('')
  const [ng, setNg] = useState({ full_name: '', email: '', phone: '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [booked, setBooked] = useState(null)

  const datesOk = validDate(ci) && validDate(co)
  const path = datesOk
    ? `/availability?check_in=${ci}&check_out=${co}&adults=${adults}&children=${children}`
    : null
  const avail = useApi(path, { enabled: datesOk })
  const guests = useApi('/guests')

  const rooms = useMemo(() => {
    let list = avail.data || []
    if (lockRoom && initial.roomId) list = list.filter((r) => r.room_id === initial.roomId)
    return [...list].sort((a, b) => Number(a.booked || a.over_capacity) - Number(b.booked || b.over_capacity) || a.room_number.localeCompare(b.room_number))
  }, [avail.data, lockRoom, initial.roomId])

  const room = rooms.find((r) => r.room_id === roomId)
  const plan = room?.plans.find((p) => p.rate_plan_id === planId)
  const nights = datesOk ? diffDays(ci, co) : 0

  // keep the plan consistent with the chosen room
  useEffect(() => {
    if (room && !room.plans.some((p) => p.rate_plan_id === planId)) setPlanId(room.plans[0]?.rate_plan_id ?? null)
  }, [room, planId])

  const estimate = plan && nights > 0 ? plan.nightly_rate * nights : 0
  const tax = estimate * TAX
  const guestReady = mode === 'existing' ? !!guestId : ng.full_name.trim() && ng.email.trim()
  const canSubmit = roomId && planId && guestReady && !busy

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const body = {
        room_id: roomId,
        rate_plan_id: planId,
        check_in: ci,
        check_out: co,
        adults,
        children,
        ...(mode === 'existing' ? { guest_id: Number(guestId) } : { new_guest: ng }),
      }
      const r = await post('/reservations', body)
      const g = mode === 'existing' ? guests.data?.find((x) => String(x.guest_id) === String(guestId))?.full_name : ng.full_name
      setBooked({ id: r.reservation_id, room: room?.room_number, guest: g, ci, co, nights, status: room?.status })
      bump()
      toast('Booking confirmed', `Room ${room?.room_number} for ${g}, ${dayLabel(ci)} to ${dayLabel(co)}.`)
      onBooked?.(r)
    } catch (err) {
      setError(err)
    } finally {
      setBusy(false)
    }
  }

  if (booked) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: EASE }}
        className="grid place-items-center text-center py-10 gap-6"
      >
        <motion.div
          initial={{ y: -90, rotate: 6, opacity: 0 }}
          animate={{ y: 0, rotate: 0, opacity: 1 }}
          transition={{ duration: 1.1, ease: EASE }}
          style={{ originX: 0.5, originY: 0 }}
        >
          <KeyFob number={booked.room} status="available" size="lg" />
        </motion.div>
        <div>
          <p className="font-display text-[34px] text-claret m-0">Reserved for {booked.guest}</p>
          <p className="m-0 mt-3 text-[19px] italic text-muted">
            Room {booked.room}, {dayLabel(booked.ci)} to {dayLabel(booked.co)} ({plural(booked.nights, 'night')}). Booking number {booked.id}.
          </p>
        </div>
        <div className="flex flex-wrap gap-3 justify-center">
          <Link className="btn btn-primary" to="/timeline">
            See it on the timeline
          </Link>
          <button className="btn btn-ghost" onClick={() => (onAnother ? onAnother() : setBooked(null))}>
            {onAnother ? 'Close' : 'Book another room'}
          </button>
        </div>
      </motion.div>
    )
  }

  return (
    <form onSubmit={submit} className={`grid gap-10 ${compact ? '' : 'xl:grid-cols-[minmax(0,1fr)_340px]'} items-start`} noValidate>
      <div className="grid gap-10 min-w-0">
        <fieldset className="border-0 p-0 m-0 min-w-0">
          <legend className="sc text-[22px] text-claret mb-4 p-0">The stay</legend>
          <div className="grid sm:grid-cols-2 gap-5">
            <TextInput label="Check-in" type="date" value={ci} onChange={(e) => setCi(e.target.value)} />
            <TextInput
              label="Check-out"
              type="date"
              value={co}
              onChange={(e) => setCo(e.target.value)}
              help={datesOk && nights > 0 ? plural(nights, 'night') : undefined}
            />
          </div>
          <div className="flex flex-wrap gap-x-10 gap-y-4 mt-5">
            <Stepper label="Adults" value={adults} onChange={setAdults} min={1} max={8} />
            <Stepper label="Children" value={children} onChange={setChildren} min={0} max={6} />
          </div>
        </fieldset>

        <fieldset className="border-0 p-0 m-0 min-w-0">
          <legend className="sc text-[22px] text-claret mb-4 p-0">{lockRoom ? 'The room' : 'Choose a room and a rate'}</legend>
          <RuleError error={avail.error} className="mb-4" />
          {avail.loading && !avail.data ? (
            <div className="grid gap-3">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} style={{ height: 84 }} />
              ))}
            </div>
          ) : rooms.length === 0 && !avail.error ? (
            <p className="m-0 italic text-muted text-[18px]">No rooms are open for sale. Rooms under maintenance are not offered.</p>
          ) : (
            <ul className="list-none m-0 p-0 grid gap-3" role="radiogroup" aria-label="Rooms">
              {rooms.map((r, i) => {
                const on = r.room_id === roomId
                const flagged = r.booked || r.over_capacity
                return (
                  <motion.li
                    key={r.room_id}
                    layout="position"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.55, ease: EASE, delay: Math.min(i, 8) * 0.05 }}
                    className="relative"
                    style={{
                      border: `1px solid ${on ? 'var(--color-brass)' : 'var(--color-hairline)'}`,
                      background: on ? 'var(--color-vellum)' : 'transparent',
                      transition: 'background-color .5s, border-color .5s',
                    }}
                  >
                    <div className="flex items-center gap-4 p-4 flex-wrap sm:flex-nowrap">
                      <button
                        type="button"
                        role="radio"
                        aria-checked={on}
                        onClick={() => {
                          setRoomId(r.room_id)
                          setPlanId(r.plans[0]?.rate_plan_id ?? null)
                          setError(null)
                        }}
                        className="flex items-center gap-4 text-left min-w-0 flex-1 bg-transparent border-0 p-0 cursor-pointer"
                        style={{ minHeight: 64 }}
                      >
                        <KeyFob number={r.room_number} status={r.status} size="sm" />
                        <span className="min-w-0">
                          <span className="block text-[19px] leading-tight">
                            Room {r.room_number}, {r.type_name}
                          </span>
                          <span className="block text-[15px] text-muted">
                            Sleeps {r.capacity}. {r.description}
                          </span>
                          {flagged && (
                            <span className="block font-ui text-[14px] mt-1" style={{ color: 'var(--color-claret-light)' }}>
                              {r.booked ? 'Held for these dates' : ''}
                              {r.booked && r.over_capacity ? ', and ' : ''}
                              {r.over_capacity ? `Too small for ${adults + children} guests` : ''}
                            </span>
                          )}
                        </span>
                      </button>
                      <div className="flex flex-wrap gap-2 sm:justify-end">
                        {r.plans.map((p) => {
                          const sel = on && p.rate_plan_id === planId
                          return (
                            <button
                              type="button"
                              key={p.rate_plan_id}
                              onClick={() => {
                                setRoomId(r.room_id)
                                setPlanId(p.rate_plan_id)
                                setError(null)
                              }}
                              aria-pressed={sel}
                              title={p.description}
                              className="font-ui text-left px-3 py-2 min-h-[44px] transition-colors duration-500"
                              style={{
                                border: `1px solid ${sel ? 'var(--color-green)' : 'var(--color-ink)'}`,
                                background: sel ? 'var(--color-green)' : 'transparent',
                                color: sel ? 'var(--color-marble)' : 'var(--color-ink)',
                                borderRadius: 2,
                              }}
                            >
                              <span className="block text-[14px] leading-tight">{p.plan_name.replace(/^\w+ - /, '')}</span>
                              <span className="block text-[14px] num">{inr(p.nightly_rate)} a night</span>
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  </motion.li>
                )
              })}
            </ul>
          )}
          {rooms.some((r) => r.booked || r.over_capacity) && (
            <p className="field-help m-0 mt-3">
              Held and undersized rooms stay selectable on purpose: the database is the final word on every rule.
            </p>
          )}
        </fieldset>

        <fieldset className="border-0 p-0 m-0 min-w-0">
          <legend className="sc text-[22px] text-claret mb-4 p-0">The guest</legend>
          <Segmented
            label="Guest"
            value={mode}
            onChange={(v) => {
              setMode(v)
              setError(null)
            }}
            options={[
              { value: 'existing', label: 'On file' },
              { value: 'new', label: 'New guest' },
            ]}
          />
          <div className="mt-5">
            {mode === 'existing' ? (
              <SelectInput label="Guest on file" value={guestId} onChange={(e) => setGuestId(e.target.value)}>
                <option value="">Choose a guest</option>
                {(guests.data || []).map((g) => (
                  <option key={g.guest_id} value={g.guest_id}>
                    {g.full_name} ({g.email})
                  </option>
                ))}
              </SelectInput>
            ) : (
              <div className="grid sm:grid-cols-2 gap-5">
                <TextInput className="sm:col-span-2" label="Full name" value={ng.full_name} onChange={(e) => setNg({ ...ng, full_name: e.target.value })} autoComplete="off" />
                <TextInput label="Email" type="email" value={ng.email} onChange={(e) => setNg({ ...ng, email: e.target.value })} autoComplete="off" />
                <TextInput label="Phone" type="tel" value={ng.phone} onChange={(e) => setNg({ ...ng, phone: e.target.value })} autoComplete="off" help="Optional" />
              </div>
            )}
          </div>
        </fieldset>
      </div>

      <aside
        className={`double-rule bg-vellum p-7 ${compact ? '' : 'xl:sticky xl:top-8'}`}
        aria-label="Booking estimate"
      >
        <div className="relative grid gap-5">
          <h3 className="sc m-0 text-[22px] text-claret">Booking slip</h3>
          <div className="grid gap-1 text-[17px]">
            <p className="m-0">{room ? `Room ${room.room_number}, ${room.type_name}` : 'No room chosen yet'}</p>
            <p className="m-0 text-muted">
              {datesOk && nights > 0 ? `${dayLabel(ci)} to ${dayLabel(co)}` : 'Check the dates'}
            </p>
            <p className="m-0 text-muted">{plural(adults + children, 'guest')}</p>
          </div>
          <div className="grid gap-2 rule-t pt-4 text-[17px]">
            <div className="flex justify-between gap-4">
              <span>{plan ? `${plural(nights, 'night')} at ${inr(plan.nightly_rate)}` : 'Room charge'}</span>
              <span className="num">{inr(estimate)}</span>
            </div>
            <div className="flex justify-between gap-4 text-muted">
              <span>Tax at 5%</span>
              <span className="num">{inr(tax)}</span>
            </div>
          </div>
          <div className="rule-t pt-4">
            <p className="m-0 font-ui text-[14px] text-muted">Estimated total</p>
            <p className="m-0 font-display text-[40px] font-medium text-claret num leading-tight whitespace-nowrap">
              <CountUp value={estimate + tax} decimals={2} format={(v) => inr(v)} duration={0.7} />
            </p>
            <p className="m-0 mt-1 text-[15px] italic text-muted">Billed at check-out, together with any services.</p>
          </div>
          <AnimatePresence initial={false}>{error && <RuleError error={error} />}</AnimatePresence>
          <button type="submit" className="btn btn-primary w-full" disabled={!canSubmit}>
            {busy ? 'Entering it in the register' : 'Confirm booking'}
          </button>
          {!canSubmit && !busy && (
            <p className="field-help m-0 -mt-2">
              {!roomId ? 'Choose a room and a rate to continue.' : !guestReady ? 'Add the guest to continue.' : ''}
            </p>
          )}
        </div>
      </aside>
    </form>
  )
}
