import { useEffect, useMemo, useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { motion } from 'motion/react'
import { ArrowRight } from '@phosphor-icons/react'
import { PageHeader, SectionTitle, Skeleton, EmptyState, ErrorNote } from '../components/ui'
import KeyFob, { STATUS } from '../components/KeyFob'
import CountUp from '../components/CountUp'
import RoomPanel from '../components/RoomPanel'
import CheckInModal from '../components/CheckInModal'
import CheckOutModal from '../components/CheckOutModal'
import { useApi } from '../hooks'
import { EASE } from '../motion'
import { dayLabel, greeting, inr, longDate, plural, toISO, today, diffDays } from '../format'

function Stat({ label, children, note, i }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.7, ease: EASE, delay: 0.1 + i * 0.09 }}
      className="px-1 sm:px-6 first:sm:pl-0 py-5"
    >
      <p className="m-0 font-display text-[44px] sm:text-[52px] font-medium text-claret leading-none num whitespace-nowrap">{children}</p>
      <p className="m-0 mt-3 font-ui text-[15px] font-medium">{label}</p>
      {note && <p className="m-0 text-[15px] italic text-muted">{note}</p>}
    </motion.div>
  )
}

function Rack({ board, onOpen }) {
  return (
    <section
      aria-labelledby="rack-title"
      className="relative bg-green text-marble px-5 sm:px-9 pt-8 pb-10"
      style={{ outline: '1px solid var(--color-brass)', outlineOffset: -7 }}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-8 gap-y-3 mb-8">
        <h2 id="rack-title" className="sc m-0 text-[26px] text-marble">
          The key rack
        </h2>
        <ul className="list-none m-0 p-0 flex flex-wrap gap-x-6 gap-y-1" aria-label="Legend">
          {Object.entries(STATUS).map(([k, v]) => (
            <li key={k} className="flex items-center gap-2 font-ui text-[14px] text-marble/90">
              <span aria-hidden="true" style={{ width: 10, height: 10, borderRadius: 9, background: v.color, boxShadow: '0 0 0 1.5px var(--color-brass-soft)' }} />
              {v.label}
            </li>
          ))}
        </ul>
      </div>
      <ul className="list-none m-0 p-0 grid gap-x-3 gap-y-9" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(112px, 1fr))' }}>
        {board.map((r, i) => (
          <li key={r.room_id} className="relative flex flex-col items-center pt-7">
            <span aria-hidden="true" className="absolute left-0 right-0 top-[10px] h-[3px]" style={{ background: 'color-mix(in srgb, #A9833F 70%, #173528)' }} />
            <span aria-hidden="true" className="absolute top-[3px] w-[11px] h-[17px] rounded-b-full" style={{ background: 'var(--color-brass-soft)' }} />
            <motion.div
              initial={{ y: -150, rotate: 7, opacity: 0 }}
              animate={{ y: 0, rotate: 0, opacity: 1 }}
              transition={{ duration: 1.15, ease: EASE, delay: 0.35 + i * 0.12 }}
              style={{ originX: 0.5, originY: 0 }}
            >
              <KeyFob
                layoutId={`fob-${r.room_id}`}
                number={r.room_number}
                status={r.status}
                size="md"
                onClick={() => onOpen(r)}
              />
            </motion.div>
            <p className="m-0 mt-4 font-ui text-[15px] text-marble">{r.type_name}</p>
            <p className="m-0 text-[15px] italic text-brass-soft text-center leading-snug max-w-[130px] min-h-[2.4em]">
              {r.status === 'occupied' && r.guest_name
                ? r.guest_name
                : r.next_arrival
                  ? `Arrival ${dayLabel(r.next_arrival)}`
                  : STATUS[r.status].label}
            </p>
          </li>
        ))}
      </ul>
    </section>
  )
}

export default function FrontDesk() {
  const { data, error, loading } = useApi('/dashboard')
  const [params, setParams] = useSearchParams()
  const nav = useNavigate()
  const [panel, setPanel] = useState(null)
  const [checkIn, setCheckIn] = useState(null)
  const [checkOut, setCheckOut] = useState(null)

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

  return (
    <>
      <PageHeader title={`${greeting()}`} subtitle={longDate(toISO(today()))}>
        <button className="btn btn-primary" onClick={() => nav('/book')}>
          Book a room
          <ArrowRight size={18} weight="light" />
        </button>
        <button className="btn btn-ghost" onClick={() => nav('/timeline')}>
          Open the timeline
        </button>
      </PageHeader>

      {error && !data && <ErrorNote error={error} />}

      <section aria-label="Today at a glance" className="grid grid-cols-2 lg:grid-cols-4 gap-x-2 sm:gap-x-0 lg:divide-x divide-hairline mb-12 rule-b">
        {!stats ? (
          [0, 1, 2, 3].map((i) => (
            <div key={i} className="px-1 sm:px-6 first:sm:pl-0 py-5">
              <Skeleton style={{ height: 52, width: '70%' }} />
              <Skeleton style={{ height: 16, width: '55%', marginTop: 14 }} />
            </div>
          ))
        ) : (
          <>
            <Stat i={0} label="Occupancy" note={`${stats.occupied_rooms} of ${stats.total_rooms} rooms`}>
              <CountUp value={Number(stats.occupancy_pct)} decimals={1} />%
            </Stat>
            <Stat i={1} label="Guests in house" note={`${stats.vacant_rooms} rooms vacant`}>
              <CountUp value={Number(stats.in_house_guests)} />
            </Stat>
            <Stat i={2} label="Arrivals this week" note={data.arrivals[0] ? `Next: ${data.arrivals[0].guest}` : 'Nobody expected'}>
              <CountUp value={Number(stats.arrivals_7d)} />
            </Stat>
            <Stat i={3} label="Balance due" note={`${inr(stats.collected)} collected`}>
              <CountUp value={Number(stats.balance_due)} decimals={2} format={(v) => inr(v)} />
            </Stat>
          </>
        )}
      </section>

      {!data ? (
        <Skeleton style={{ height: 380 }} />
      ) : data.board.length === 0 ? (
        <EmptyState title="The rack is bare" action={<button className="btn btn-primary" onClick={() => nav('/guests')}>Open the guest book</button>}>
          No rooms are on file yet. Add rooms to the database and they will hang here.
        </EmptyState>
      ) : (
        <Rack board={data.board} onOpen={(r) => setPanel(r)} />
      )}

      <div className="grid lg:grid-cols-2 gap-x-16 gap-y-12 mt-14">
        <section aria-labelledby="arr">
          <SectionTitle id="arr">Arriving soon</SectionTitle>
          {!data ? (
            <Skeleton style={{ height: 160 }} />
          ) : data.arrivals.length === 0 ? (
            <p className="italic text-muted text-[18px] m-0">No arrivals are booked. A quiet week for the desk.</p>
          ) : (
            <ul className="list-none m-0 p-0">
              {data.arrivals.map((a, i) => (
                <motion.li
                  key={a.reservation_id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, ease: EASE, delay: 0.5 + i * 0.07 }}
                  className="flex items-center gap-4 py-4 rule-b"
                >
                  <div className="w-[64px] shrink-0">
                    <p className="m-0 font-ui text-[13px] text-muted leading-none">{dayLabel(a.arrives).split(' ')[0]}</p>
                    <p className="m-0 text-[21px] font-semibold leading-tight">{dayLabel(a.arrives).split(' ').slice(1).join(' ')}</p>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="m-0 text-[18px] truncate">{a.guest}</p>
                    <p className="m-0 text-[15px] text-muted">
                      Room {a.room}, {plural(diffDays(a.arrives, a.departs), 'night')}, {plural(a.adults + a.children, 'guest')}
                    </p>
                  </div>
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => setCheckIn({ ...a, id: a.reservation_id, check_in: a.arrives, check_out: a.departs })}
                  >
                    Check in
                  </button>
                </motion.li>
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby="due">
          <SectionTitle id="due">Due out</SectionTitle>
          {!data ? (
            <Skeleton style={{ height: 160 }} />
          ) : data.due_out.length === 0 ? (
            <p className="italic text-muted text-[18px] m-0">Nobody is in house just now.</p>
          ) : (
            <ul className="list-none m-0 p-0">
              {data.due_out.map((d, i) => (
                <motion.li
                  key={d.stay_id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, ease: EASE, delay: 0.5 + i * 0.07 }}
                  className="flex items-center gap-4 py-4 rule-b"
                >
                  <KeyFob number={d.room} status="occupied" size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="m-0 text-[18px] truncate">{d.guest}</p>
                    <p className="m-0 text-[15px]" style={{ color: diffDays(toISO(today()), d.departs) < 0 ? 'var(--color-claret-light)' : 'var(--color-muted)' }}>
                      Room {d.room}, {diffDays(toISO(today()), d.departs) < 0 ? 'was due out' : 'due out'} {dayLabel(d.departs)}
                    </p>
                  </div>
                  <button className="btn btn-ghost btn-sm" onClick={() => setCheckOut({ stay_id: d.stay_id, guest: d.guest, room: d.room })}>
                    Check out
                  </button>
                </motion.li>
              ))}
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
