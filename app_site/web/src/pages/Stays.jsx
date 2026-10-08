import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { motion } from 'motion/react'
import { PageHeader, Segmented, SelectInput, TextInput, SkeletonRows, EmptyState, ErrorNote, PillTag } from '../components/ui'
import KeyFob from '../components/KeyFob'
import CheckInModal from '../components/CheckInModal'
import CheckOutModal from '../components/CheckOutModal'
import Confirm from '../components/Confirm'
import { useApi } from '../hooks'
import { post } from '../api'
import { useData, useToast } from '../store'
import { EASE } from '../motion'
import { dayLabel, diffDays, inr, plural, toISO, today } from '../format'

const TABS = [
  { value: 'arrivals', label: 'Arrivals' },
  { value: 'inhouse', label: 'In house' },
  { value: 'all', label: 'All reservations' },
]

function Row({ i, children }) {
  return (
    <motion.li
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: EASE, delay: Math.min(i, 10) * 0.05 }}
      className="flex items-center gap-4 py-4 rule-b flex-wrap sm:flex-nowrap"
    >
      {children}
    </motion.li>
  )
}

export default function Stays() {
  const [params, setParams] = useSearchParams()
  const tab = params.get('tab') || 'arrivals'
  const setTab = (t) => setParams({ tab: t }, { replace: true })
  const { bump } = useData()
  const toast = useToast()

  const [checkIn, setCheckIn] = useState(null)
  const [checkOut, setCheckOut] = useState(null)
  const [cancel, setCancel] = useState(null)

  const [status, setStatus] = useState('')
  const [q, setQ] = useState('')

  const arrivals = useApi('/reservations?status=booked')
  const inHouse = useApi('/stays/in-house')
  const all = useApi(`/reservations?${status ? `status=${status}&` : ''}${q ? `q=${encodeURIComponent(q)}` : ''}`, { enabled: tab === 'all' })

  const sortedArrivals = useMemo(() => [...(arrivals.data || [])].sort((a, b) => a.check_in.localeCompare(b.check_in)), [arrivals.data])

  const doCancel = async () => {
    await post(`/reservations/${cancel.id}/cancel`)
    bump()
    toast('Booking cancelled', `${cancel.guest}'s booking for room ${cancel.room} is released.`)
    setCancel(null)
  }

  return (
    <>
      <PageHeader title="Check-in and check-out" subtitle="Receive arrivals, keep an eye on the house, and close accounts with the bill in front of you." />

      <div className="mb-8">
        <Segmented label="Show" value={tab} onChange={setTab} options={TABS} />
      </div>

      {tab === 'arrivals' && (
        <section aria-label="Arrivals">
          {arrivals.error && !arrivals.data && <ErrorNote error={arrivals.error} />}
          {!arrivals.data ? (
            <SkeletonRows />
          ) : sortedArrivals.length === 0 ? (
            <EmptyState title="No arrivals waiting" action={<Link className="btn btn-primary" to="/book">Book a room</Link>}>
              Every booked guest has been received. New bookings will appear here.
            </EmptyState>
          ) : (
            <ul className="list-none m-0 p-0">
              {sortedArrivals.map((r, i) => {
                const delta = diffDays(toISO(today()), r.check_in)
                return (
                  <Row key={r.id} i={i}>
                    <KeyFob number={r.room} status="available" size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="m-0 text-[19px] truncate">{r.guest}</p>
                      <p className="m-0 text-[16px] text-muted">
                        Room {r.room}, {r.room_type}. {dayLabel(r.check_in)} to {dayLabel(r.check_out)}, {plural(r.nights, 'night')}, {plural(r.adults + r.children, 'guest')}
                      </p>
                    </div>
                    <span className="font-ui text-[14px] text-muted w-[110px] hidden md:block">
                      {delta === 0 ? 'Arrives today' : delta > 0 ? `In ${plural(delta, 'day')}` : `${plural(-delta, 'day')} late`}
                    </span>
                    <div className="flex gap-2 ml-auto">
                      <button className="btn btn-primary btn-sm" onClick={() => setCheckIn(r)}>
                        Check in
                      </button>
                      <button className="btn btn-quiet btn-sm" onClick={() => setCancel(r)}>
                        Cancel
                      </button>
                    </div>
                  </Row>
                )
              })}
            </ul>
          )}
        </section>
      )}

      {tab === 'inhouse' && (
        <section aria-label="In house">
          {inHouse.error && !inHouse.data && <ErrorNote error={inHouse.error} />}
          {!inHouse.data ? (
            <SkeletonRows />
          ) : inHouse.data.length === 0 ? (
            <EmptyState title="The house is quiet" action={<button className="btn btn-primary" onClick={() => setTab('arrivals')}>See arrivals</button>}>
              Nobody is checked in. When a guest arrives their stay will be listed here with the running bill.
            </EmptyState>
          ) : (
            <ul className="list-none m-0 p-0">
              {inHouse.data.map((s, i) => {
                const sub = s.nights * s.nightly_rate + Number(s.services)
                const total = sub * 1.05
                return (
                  <Row key={s.stay_id} i={i}>
                    <KeyFob number={s.room} status="occupied" size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="m-0 text-[19px] truncate">{s.guest}</p>
                      <p className="m-0 text-[16px] text-muted">
                        Room {s.room}, {s.plan_name}. In since {dayLabel(s.actual_check_in)}, due out {dayLabel(s.planned_check_out)}
                      </p>
                    </div>
                    <div className="text-right mr-2 hidden sm:block">
                      <p className="m-0 font-ui text-[13px] text-muted">Bill so far, with tax</p>
                      <p className="m-0 text-[20px] font-semibold num">{inr(total)}</p>
                      <p className="m-0 text-[14px] text-muted">{plural(s.nights, 'night')}, services {inr(s.services)}</p>
                    </div>
                    <button className="btn btn-primary btn-sm ml-auto sm:ml-0" onClick={() => setCheckOut({ stay_id: s.stay_id, guest: s.guest, room: s.room })}>
                      Preview bill
                    </button>
                  </Row>
                )
              })}
            </ul>
          )}
        </section>
      )}

      {tab === 'all' && (
        <section aria-label="All reservations">
          <div className="grid sm:grid-cols-[1fr_220px] gap-5 mb-6 max-w-[760px]">
            <TextInput label="Find a guest or room" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name or room number" />
            <SelectInput label="Status" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">Every status</option>
              <option value="booked">Booked</option>
              <option value="checked_in">In house</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
              <option value="no_show">No show</option>
            </SelectInput>
          </div>
          {all.error && !all.data && <ErrorNote error={all.error} />}
          {!all.data ? (
            <SkeletonRows rows={6} height={44} />
          ) : all.data.length === 0 ? (
            <EmptyState title="Nothing found">No reservation matches that search. Clear the filters to see them all.</EmptyState>
          ) : (
            <div className="overflow-x-auto thin-scroll">
              <table className="w-full border-collapse min-w-[760px] text-[17px]">
                <thead>
                  <tr>
                    {['Guest', 'Room', 'Dates', 'Nights', 'Party', 'Rate plan', 'Status', ''].map((h) => (
                      <th key={h} className="th">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {all.data.map((r) => (
                    <tr key={r.id}>
                      <td className="td">{r.guest}</td>
                      <td className="td">{r.room}</td>
                      <td className="td whitespace-nowrap">
                        {dayLabel(r.check_in)} to {dayLabel(r.check_out)}
                      </td>
                      <td className="td num">{r.nights}</td>
                      <td className="td num">{r.adults + r.children}</td>
                      <td className="td text-[16px] text-muted">{r.rate_plan}</td>
                      <td className="td">
                        <PillTag status={r.status} />
                      </td>
                      <td className="td text-right whitespace-nowrap">
                        {r.status === 'booked' && (
                          <>
                            <button className="btn btn-ghost btn-sm" onClick={() => setCheckIn(r)}>
                              Check in
                            </button>{' '}
                            <button className="btn btn-quiet btn-sm" onClick={() => setCancel(r)}>
                              Cancel
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      <CheckInModal reservation={checkIn} onClose={() => setCheckIn(null)} />
      <CheckOutModal stay={checkOut} onClose={() => setCheckOut(null)} />
      <Confirm open={!!cancel} title="Cancel this booking?" confirmLabel="Cancel booking" cancelLabel="Keep the booking" onConfirm={doCancel} onClose={() => setCancel(null)}>
        {cancel && (
          <p className="m-0">
            {cancel.guest} in room {cancel.room}, {dayLabel(cancel.check_in)} to {dayLabel(cancel.check_out)}. The room goes back on sale for those nights.
          </p>
        )}
      </Confirm>
    </>
  )
}
