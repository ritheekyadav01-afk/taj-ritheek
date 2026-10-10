import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import KeyFob from './KeyFob'
import RuleError from './RuleError'
import { Display, Odometer, Reveal } from './motion'
import { SectionTitle, Segmented, SelectInput, Skeleton, Stepper, TextInput } from './ui'
import { useApi } from '../hooks'
import { post } from '../api'
import { useData, useToast } from '../store'
import { EASE } from '../motion'
import { addDays, dayLabel, diffDays, inr, parseDate, plural, toISO, today } from '../format'

const TAX = 0.05
const validDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(parseDate(s).getTime())

/**
 * One booking form for the Book page and for the timeline drag. Three steps in order
 * (so they carry Roman numerals). Every rule violation comes back from the database as-is.
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
  const path = datesOk ? `/availability?check_in=${ci}&check_out=${co}&adults=${adults}&children=${children}` : null
  const avail = useApi(path, { enabled: datesOk })
  const guests = useApi('/guests')

  const rooms = useMemo(() => {
    let list = avail.data || []
    if (lockRoom && initial.roomId) list = list.filter((r) => r.room_id === initial.roomId)
    return [...list].sort(
      (a, b) => Number(a.booked || a.over_capacity) - Number(b.booked || b.over_capacity) || a.room_number.localeCompare(b.room_number),
    )
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
      setBooked({ id: r.reservation_id, room: room?.room_number, guest: g, ci, co, nights })
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
      <div className="grid place-items-center text-center py-12 gap-8">
        <div className="rack px-14 pt-6 pb-10">
          <motion.div
            className="relative z-[1]"
            initial={{ y: -150, rotate: 7, opacity: 0 }}
            animate={{ y: 0, opacity: 1, rotate: [7, -5, 2.6, -1.1, 0.4, 0] }}
            transition={{ y: { duration: 0.75, ease: EASE }, opacity: { duration: 0.4 }, rotate: { duration: 1.9, ease: 'easeOut', delay: 0.45 } }}
            style={{ originX: 0.5, originY: 0 }}
          >
            <KeyFob number={booked.room} status="available" size="lg" sheen sheenDelay={0.8} />
          </motion.div>
        </div>
        <div>
          <Display as="p" text={`Reserved for *${booked.guest}*`} className="m-0 text-[36px] sm:text-[44px] text-strong" delay={0.3} />
          <motion.p
            className="m-0 mt-4 text-[16px] text-muted"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, ease: EASE, delay: 0.7 }}
          >
            Room {booked.room}, {dayLabel(booked.ci)} to {dayLabel(booked.co)} ({plural(booked.nights, 'night')}). Booking number {booked.id}.
          </motion.p>
        </div>
        <div className="flex flex-wrap gap-3 justify-center">
          <Link className="btn btn-primary" to="/timeline">
            See it on the timeline
          </Link>
          <button className="btn btn-ghost" onClick={() => (onAnother ? onAnother() : setBooked(null))}>
            {onAnother ? 'Close' : 'Book another room'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={submit} className={`grid gap-14 ${compact ? '' : 'xl:grid-cols-[minmax(0,1fr)_360px]'} items-start`} noValidate>
      <div className="grid gap-14 min-w-0">
        <Reveal as="fieldset" className="border-0 p-0 m-0 min-w-0">
          <legend className="p-0 w-full">
            <SectionTitle numeral="I">The stay</SectionTitle>
          </legend>
          <div className="grid sm:grid-cols-2 gap-6">
            <TextInput label="Check-in" type="date" value={ci} onChange={(e) => setCi(e.target.value)} />
            <TextInput
              label="Check-out"
              type="date"
              value={co}
              onChange={(e) => setCo(e.target.value)}
              help={datesOk && nights > 0 ? plural(nights, 'night') : undefined}
            />
          </div>
          <div className="flex flex-wrap gap-x-10 gap-y-5 mt-6">
            <Stepper label="Adults" value={adults} onChange={setAdults} min={1} max={8} />
            <Stepper label="Children" value={children} onChange={setChildren} min={0} max={6} />
          </div>
        </Reveal>

        <Reveal as="fieldset" className="border-0 p-0 m-0 min-w-0" delay={0.05}>
          <legend className="p-0 w-full">
            <SectionTitle numeral="II">{lockRoom ? 'The room' : 'Choose a room and a rate'}</SectionTitle>
          </legend>
          <RuleError error={avail.error} className="mb-5" />
          {avail.loading && !avail.data ? (
            <div className="grid gap-3">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} style={{ height: 92 }} />
              ))}
            </div>
          ) : rooms.length === 0 && !avail.error ? (
            <p className="m-0 text-muted text-[15.5px]">No rooms are open for sale. Rooms under maintenance are not offered.</p>
          ) : (
            <ul className="list-none m-0 p-0 grid gap-3" role="radiogroup" aria-label="Rooms">
              {rooms.map((r, i) => {
                const on = r.room_id === roomId
                const flagged = r.booked || r.over_capacity
                return (
                  <motion.li
                    key={r.room_id}
                    layout="position"
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.75, ease: EASE, delay: Math.min(i, 8) * 0.05 }}
                    className="relative border transition-colors duration-500"
                    style={{
                      borderColor: on ? 'var(--text)' : 'var(--line)',
                      background: on ? 'color-mix(in srgb, var(--text) 4%, var(--surface))' : 'var(--surface)',
                    }}
                  >
                    {on && (
                      <motion.span
                        layoutId="room-choice"
                        className="absolute left-0 top-0 bottom-0 w-[2px] bg-text"
                        transition={{ duration: 0.6, ease: EASE }}
                        aria-hidden="true"
                      />
                    )}
                    <div className="flex items-center gap-5 p-4 sm:p-5 flex-wrap sm:flex-nowrap">
                      <button
                        type="button"
                        role="radio"
                        aria-checked={on}
                        onClick={() => {
                          setRoomId(r.room_id)
                          setPlanId(r.plans[0]?.rate_plan_id ?? null)
                          setError(null)
                        }}
                        className="flex items-center gap-5 text-left min-w-0 basis-full sm:basis-0 sm:flex-1 bg-transparent border-0 p-0 cursor-pointer"
                        style={{ minHeight: 64 }}
                      >
                        <KeyFob number={r.room_number} status={r.status} size="sm" />
                        <span className="min-w-0">
                          <span className="block text-[17px] text-strong leading-tight">
                            Room {r.room_number}, {r.type_name}
                          </span>
                          <span className="block text-[13.5px] text-muted mt-0.5">
                            Sleeps {r.capacity}. {r.description}
                          </span>
                          {flagged && (
                            <span className="block text-[12.5px] mt-1.5 text-error-text">
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
                              className={`text-left px-3.5 py-2 min-h-[48px] border transition-colors duration-500 ${sel ? 'bg-text text-bg border-text' : 'border-line-strong hover:border-text'}`}
                              style={{ borderRadius: 1 }}
                            >
                              <span className="block text-[12.5px] leading-tight opacity-80">{p.plan_name.replace(/^\w+ - /, '')}</span>
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
            <p className="field-help m-0 mt-4">Held and undersized rooms stay selectable on purpose: the database is the final word on every rule.</p>
          )}
        </Reveal>

        <Reveal as="fieldset" className="border-0 p-0 m-0 min-w-0" delay={0.1}>
          <legend className="p-0 w-full">
            <SectionTitle numeral="III">The guest</SectionTitle>
          </legend>
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
          <div className="mt-6">
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
              <div className="grid sm:grid-cols-2 gap-6">
                <TextInput className="sm:col-span-2" label="Full name" value={ng.full_name} onChange={(e) => setNg({ ...ng, full_name: e.target.value })} autoComplete="off" />
                <TextInput label="Email" type="email" value={ng.email} onChange={(e) => setNg({ ...ng, email: e.target.value })} autoComplete="off" />
                <TextInput label="Phone" type="tel" value={ng.phone} onChange={(e) => setNg({ ...ng, phone: e.target.value })} autoComplete="off" help="Optional" />
              </div>
            )}
          </div>
        </Reveal>
      </div>

      <aside className={`double-rule bg-surface p-8 ${compact ? '' : 'xl:sticky xl:top-10'}`} aria-label="Booking estimate">
        <div className="relative grid gap-6">
          <p className="display m-0 text-[30px] text-strong">Booking slip</p>
          <div className="grid gap-1 text-[15px]">
            <p className="m-0 text-strong">{room ? `Room ${room.room_number}, ${room.type_name}` : 'No room chosen yet'}</p>
            <p className="m-0 text-muted">{datesOk && nights > 0 ? `${dayLabel(ci)} to ${dayLabel(co)}` : 'Check the dates'}</p>
            <p className="m-0 text-muted">{plural(adults + children, 'guest')}</p>
          </div>
          <div className="grid gap-2.5 border-t border-line pt-5 text-[14.5px]">
            <div className="flex justify-between gap-4">
              <span>{plan ? `${plural(nights, 'night')} at ${inr(plan.nightly_rate)}` : 'Room charge'}</span>
              <span className="num">{inr(estimate)}</span>
            </div>
            <div className="flex justify-between gap-4 text-muted">
              <span>Tax at 5%</span>
              <span className="num">{inr(tax)}</span>
            </div>
          </div>
          <div className="border-t border-line pt-5">
            <p className="m-0 text-[13px] text-muted">Estimated total</p>
            <p className="display m-0 mt-2 text-[44px] leading-none text-strong whitespace-nowrap">
              <Odometer value={estimate + tax} format={(v) => inr(v)} />
            </p>
            <p className="m-0 mt-3 text-[13px] text-muted">Billed at check-out, together with any services.</p>
          </div>
          <AnimatePresence initial={false}>{error && <RuleError error={error} />}</AnimatePresence>
          <button type="submit" className="btn btn-primary btn-block" disabled={!canSubmit}>
            {busy ? 'Entering it in the register' : 'Confirm booking'}
          </button>
          {!canSubmit && !busy && (
            <p className="field-help m-0 -mt-3">{!roomId ? 'Choose a room and a rate to continue.' : !guestReady ? 'Add the guest to continue.' : ''}</p>
          )}
        </div>
      </aside>
    </form>
  )
}
