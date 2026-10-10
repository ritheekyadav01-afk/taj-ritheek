import { useEffect, useMemo, useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { motion } from 'motion/react'
import { ArrowRight } from '@phosphor-icons/react'
import { SectionTitle, Skeleton, EmptyState, ErrorNote } from '../components/ui'
import KeyFob, { FobLegend, STATUS } from '../components/KeyFob'
import { Display, Odometer, Reveal, Rule, Spotlight } from '../components/motion'
import RoomPanel from '../components/RoomPanel'
import CheckInModal from '../components/CheckInModal'
import CheckOutModal from '../components/CheckOutModal'
import { useApi } from '../hooks'
import { EASE, introDelay } from '../motion'
import { dayLabel, greeting, inr, longDate, plural, toISO, today, diffDays } from '../format'

function Stat({ label, note, i, children }) {
  return (
    <Reveal delay={0.1 + i * 0.08} className="relative px-0 sm:px-7 first:sm:pl-0 py-7">
      {i > 0 && (
        <motion.span
          aria-hidden="true"
          className="hidden lg:block absolute left-0 top-6 bottom-6 w-px bg-line"
          style={{ originY: 0 }}
          initial={{ scaleY: 0 }}
          whileInView={{ scaleY: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 1.2, ease: EASE, delay: 0.3 + i * 0.1 }}
        />
      )}
      <p className="display m-0 text-[46px] sm:text-[58px] leading-none text-strong whitespace-nowrap">{children}</p>
      <p className="m-0 mt-4 text-[14px] text-text">{label}</p>
      {note && <p className="m-0 text-[13px] text-muted">{note}</p>}
    </Reveal>
  )
}

function Rack({ board, onOpen }) {
  const [base] = useState(() => introDelay() + 0.25)
  return (
    <section aria-labelledby="rack-title" className="rack px-5 sm:px-10 pt-10 pb-12">
      <Spotlight />
      <div className="relative z-[1] flex flex-wrap items-end justify-between gap-x-10 gap-y-4 mb-10">
        <Display as="h2" id="rack-title" text="The key rack" className="m-0 text-[34px] sm:text-[40px] text-[#F7F7F5]" inView />
        <FobLegend className="text-[#E3E5E8]" />
      </div>
      <ul className="relative z-[1] list-none m-0 p-0 grid gap-x-3 gap-y-12" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(118px, 1fr))' }}>
        {board.map((r, i) => {
          const d = base + i * 0.13
          return (
            <li key={r.room_id} className="relative flex flex-col items-center pt-8">
              <motion.span
                aria-hidden="true"
                className="rack-rail"
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ duration: 1.0, ease: EASE, delay: base - 0.2 + i * 0.05 }}
              />
              <motion.span
                aria-hidden="true"
                className="rack-peg"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.6, ease: EASE, delay: base + i * 0.05 }}
              />
              <motion.div
                initial={{ y: -210, rotate: 8, opacity: 0 }}
                animate={{ y: 0, opacity: 1, rotate: [8, -5.5, 3, -1.4, 0.55, 0] }}
                transition={{
                  y: { duration: 0.8, ease: EASE, delay: d },
                  opacity: { duration: 0.35, ease: EASE, delay: d },
                  rotate: { duration: 2.1, ease: [0.33, 0, 0.25, 1], delay: d + 0.42, times: [0, 0.2, 0.42, 0.62, 0.82, 1] },
                }}
                style={{ originX: 0.5, originY: 0 }}
              >
                <KeyFob
                  layoutId={`fob-${r.room_id}`}
                  number={r.room_number}
                  status={r.status}
                  size="md"
                  tilt
                  sheen
                  sheenDelay={d + 0.9}
                  onClick={() => onOpen(r)}
                />
              </motion.div>
              <motion.div
                className="text-center"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.8, ease: EASE, delay: d + 0.7 }}
              >
                <p className="m-0 mt-5 text-[14px] text-[#F7F7F5]">{r.type_name}</p>
                <p className="m-0 text-[12.5px] text-[#C3C6CB]">{STATUS[r.status].label}</p>
                <p className="m-0 mt-1 text-[12.5px] text-[#8E9196] leading-snug max-w-[132px] min-h-[2.6em]">
                  {r.status === 'occupied' && r.guest_name ? r.guest_name : r.next_arrival ? `Arrival ${dayLabel(r.next_arrival)}` : ''}
                </p>
              </motion.div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

function ListRow({ i, children }) {
  return (
    <motion.li
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.8, ease: EASE, delay: i * 0.07 }}
      className="flex items-center gap-5 py-5 border-b border-line"
    >
      {children}
    </motion.li>
  )
}

export default function FrontDesk() {
  const { data, error } = useApi('/dashboard')
  const [params, setParams] = useSearchParams()
  const nav = useNavigate()
  const [panel, setPanel] = useState(null)
  const [checkIn, setCheckIn] = useState(null)
  const [checkOut, setCheckOut] = useState(null)
  const [d] = useState(() => introDelay())

  // open a room from the command palette (?room=ID)
  const wanted = params.get('room')
  useEffect(() => {
    if (wanted && data) {
      const r = data.board.find((b) => String(b.room_id) === wanted)
      if (r) setPanel(r)
    }
  }, [wanted, data])

  const closePanel = () => {
    setPanel(null)
    if (params.has('room')) {
      params.delete('room')
      setParams(params, { replace: true })
    }
  }

  const stats = data?.stats
  const live = useMemo(() => (panel && data ? data.board.find((b) => b.room_id === panel.room_id) || panel : null), [panel, data])
  const todayIso = toISO(today())

  return (
    <>
      <header className="grid 2xl:grid-cols-[minmax(0,1fr)_auto] gap-x-12 gap-y-8 items-end pb-10">
        <div>
          <motion.p className="micro m-0 mb-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 1, ease: EASE, delay: d }}>
            {longDate(todayIso)}
          </motion.p>
          <Display text={`${greeting()},|*at the front desk*`} className="m-0 text-[46px] sm:text-[64px] lg:text-[72px] 2xl:text-[80px] text-strong" />
        </div>
        <motion.div
          className="flex flex-wrap gap-3"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, ease: EASE, delay: d + 0.5 }}
        >
          <button className="btn btn-primary" onClick={() => nav('/book')}>
            Book a room
            <ArrowRight size={17} weight="light" />
          </button>
          <button className="btn btn-ghost" onClick={() => nav('/timeline')}>
            Open the timeline
          </button>
        </motion.div>
      </header>
      <Rule />

      {error && !data && <ErrorNote error={error} />}

      <section aria-label="Today at a glance" className="grid grid-cols-2 lg:grid-cols-4 gap-x-6 sm:gap-x-0 mb-14">
        {!stats ? (
          [0, 1, 2, 3].map((i) => (
            <div key={i} className="px-0 sm:px-7 first:sm:pl-0 py-7">
              <Skeleton style={{ height: 52, width: '72%' }} />
              <Skeleton style={{ height: 14, width: '50%', marginTop: 18 }} />
            </div>
          ))
        ) : (
          <>
            <Stat i={0} label="Occupancy" note={`${stats.occupied_rooms} of ${stats.total_rooms} rooms`}>
              <Odometer value={Number(stats.occupancy_pct)} format={(v) => v.toFixed(1)} />
              <span className="text-[32px]">%</span>
            </Stat>
            <Stat i={1} label="Guests in house" note={`${stats.vacant_rooms} rooms vacant`}>
              <Odometer value={Number(stats.in_house_guests)} />
            </Stat>
            <Stat i={2} label="Arrivals this week" note={data.arrivals[0] ? `Next: ${data.arrivals[0].guest}` : 'Nobody expected'}>
              <Odometer value={Number(stats.arrivals_7d)} />
            </Stat>
            <Stat i={3} label="Balance due" note={`${inr(stats.collected)} collected`}>
              <Odometer value={Number(stats.balance_due)} format={(v) => inr(v)} />
            </Stat>
          </>
        )}
      </section>

      {!data ? (
        <Skeleton style={{ height: 420 }} />
      ) : data.board.length === 0 ? (
        <EmptyState title="The rack is bare" action={<button className="btn btn-primary" onClick={() => nav('/guests')}>Open the guest book</button>}>
          No rooms are on file yet. Add rooms to the database and they will hang here.
        </EmptyState>
      ) : (
        <Rack board={data.board} onOpen={(r) => setPanel(r)} />
      )}

      <div className="grid lg:grid-cols-2 gap-x-16 gap-y-14 mt-20">
        <section aria-labelledby="arr">
          <SectionTitle id="arr">Arriving soon</SectionTitle>
          <Rule strong />
          {!data ? (
            <Skeleton style={{ height: 160, marginTop: 16 }} />
          ) : data.arrivals.length === 0 ? (
            <p className="text-muted text-[15.5px] mt-5">No arrivals are booked. A quiet week for the desk.</p>
          ) : (
            <ul className="list-none m-0 p-0">
              {data.arrivals.map((a, i) => (
                <ListRow key={a.reservation_id} i={i}>
                  <div className="w-[70px] shrink-0">
                    <p className="m-0 text-[12px] text-muted leading-none tracking-[0.04em]">{dayLabel(a.arrives).split(' ')[0]}</p>
                    <p className="m-0 mt-1 text-[19px] text-strong leading-tight num">{dayLabel(a.arrives).split(' ').slice(1).join(' ')}</p>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="m-0 text-[16.5px] text-strong truncate">{a.guest}</p>
                    <p className="m-0 text-[13.5px] text-muted">
                      Room {a.room}, {plural(diffDays(a.arrives, a.departs), 'night')}, {plural(a.adults + a.children, 'guest')}
                    </p>
                  </div>
                  <button className="btn btn-ghost btn-sm" onClick={() => setCheckIn({ ...a, id: a.reservation_id, check_in: a.arrives, check_out: a.departs })}>
                    Check in
                  </button>
                </ListRow>
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby="due">
          <SectionTitle id="due">Due out</SectionTitle>
          <Rule strong />
          {!data ? (
            <Skeleton style={{ height: 160, marginTop: 16 }} />
          ) : data.due_out.length === 0 ? (
            <p className="text-muted text-[15.5px] mt-5">Nobody is in house just now.</p>
          ) : (
            <ul className="list-none m-0 p-0">
              {data.due_out.map((x, i) => {
                const late = diffDays(todayIso, x.departs) < 0
                return (
                  <ListRow key={x.stay_id} i={i}>
                    <KeyFob number={x.room} status="occupied" size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="m-0 text-[16.5px] text-strong truncate">{x.guest}</p>
                      <p className={`m-0 text-[13.5px] ${late ? 'text-error-text' : 'text-muted'}`}>
                        Room {x.room}, {late ? 'was due out' : 'due out'} {dayLabel(x.departs)}
                      </p>
                    </div>
                    <button className="btn btn-ghost btn-sm" onClick={() => setCheckOut({ stay_id: x.stay_id, guest: x.guest, room: x.room })}>
                      Check out
                    </button>
                  </ListRow>
                )
              })}
            </ul>
          )}
        </section>
      </div>

      <RoomPanel
        room={live}
        onClose={closePanel}
        onCheckout={(r) => {
          closePanel()
          setCheckOut({ stay_id: r.stay_id, guest: r.guest_name, room: r.room_number })
        }}
      />
      <CheckInModal reservation={checkIn} onClose={() => setCheckIn(null)} />
      <CheckOutModal stay={checkOut} onClose={() => setCheckOut(null)} />
    </>
  )
}
