import { useMemo, useState } from 'react'
import { motion } from 'motion/react'
import { PageHeader, SectionTitle, SkeletonRows, ErrorNote, PillTag, SelectInput, Skeleton } from '../components/ui'
import KeyFob from '../components/KeyFob'
import { Gauge, VBars, HBars, Segments } from '../components/charts'
import { useApi } from '../hooks'
import { EASE } from '../motion'
import { dateLabel, dayLabel, inr, monthShort, parseDate, stampLabel, titleCase } from '../format'

function Block({ title, id, children, className = '', delay = 0 }) {
  return (
    <motion.section
      aria-labelledby={id}
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.15 }}
      transition={{ duration: 0.8, ease: EASE, delay }}
      className={`min-w-0 ${className}`}
    >
      <SectionTitle id={id}>{title}</SectionTitle>
      {children}
    </motion.section>
  )
}

const monthName = (ym) => `${monthShort(`${ym}-01`)} ${ym.slice(2, 4)}`

export default function Reports() {
  const { data, error } = useApi('/reports')
  const [guest, setGuest] = useState('')

  const history = useMemo(() => {
    const h = data?.guest_history || []
    return guest ? h.filter((x) => String(x.guest_id) === guest) : h
  }, [data, guest])
  const guestOptions = useMemo(() => {
    const m = new Map()
    ;(data?.guest_history || []).forEach((h) => m.set(h.guest_id, h.full_name))
    return [...m.entries()]
  }, [data])

  if (error && !data) return (<><PageHeader title="Reports" /><ErrorNote error={error} /></>)
  if (!data)
    return (
      <>
        <PageHeader title="Reports" subtitle="Drawn from the database's eight reporting views." />
        <div className="grid lg:grid-cols-2 gap-10">
          <Skeleton style={{ height: 300 }} />
          <SkeletonRows rows={4} />
        </div>
      </>
    )

  const occ = data.occupancy_rate
  const cancelled = data.cancellations.filter((c) => c.reservation_status === 'cancelled').length
  const noShow = data.cancellations.filter((c) => c.reservation_status === 'no_show').length
  const hk = ['pending', 'in_progress', 'done'].map((s) => data.housekeeping_status.filter((t) => t.task_status === s).length)

  return (
    <>
      <PageHeader title="Reports" subtitle="Drawn from the database's eight reporting views, as of this moment." />

      <div className="grid lg:grid-cols-12 gap-x-14 gap-y-16">
        <Block id="r-occ" title="Occupancy" className="lg:col-span-5">
          <Gauge value={occ.occupancy_pct} caption={`${occ.occupied_rooms} of ${occ.total_rooms} rooms occupied`} />
          <h3 className="sc m-0 mt-9 mb-3 text-[20px] text-claret">Rooms free right now</h3>
          {data.vacant_rooms.length === 0 ? (
            <p className="m-0 italic text-muted text-[17px]">Every room is taken or closed.</p>
          ) : (
            <ul className="list-none m-0 p-0 flex flex-wrap gap-x-6 gap-y-4">
              {data.vacant_rooms.map((r) => (
                <li key={r.room_id} className="flex items-center gap-3">
                  <KeyFob number={r.room_number} status="available" size="sm" />
                  <span className="text-[16px] leading-tight">
                    {r.type_name}
                    <span className="block text-[14px] text-muted">sleeps {r.capacity}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Block>

        <Block id="r-cur" title="In the house now" className="lg:col-span-7" delay={0.08}>
          {data.current_occupancy.length === 0 ? (
            <p className="m-0 italic text-muted text-[18px]">Nobody is in house.</p>
          ) : (
            <div className="overflow-x-auto thin-scroll">
              <table className="w-full border-collapse min-w-[520px]">
                <thead>
                  <tr>
                    {['Room', 'Guest', 'Arrived', 'Due out'].map((h) => (
                      <th key={h} className="th">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.current_occupancy.map((o) => (
                    <tr key={o.room_id}>
                      <td className="td">
                        {o.room_number}
                        <span className="text-muted text-[15px]">, {o.type_name}</span>
                      </td>
                      <td className="td">{o.guest_name}</td>
                      <td className="td text-[16px]">{dateLabel(o.actual_check_in)}</td>
                      <td className="td text-[16px]">{dayLabel(o.planned_check_out)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Block>

        <Block id="r-rev" title="Revenue collected by month" className="lg:col-span-7">
          {data.total_revenue.length === 0 ? (
            <p className="m-0 italic text-muted text-[18px]">No payments have been taken yet.</p>
          ) : (
            <VBars data={data.total_revenue} label={(d) => monthName(d.month)} value={(d) => d.revenue_collected} />
          )}
        </Block>

        <Block id="r-svc" title="Service revenue by stay" className="lg:col-span-5" delay={0.08}>
          {data.service_revenue.length === 0 ? (
            <p className="m-0 italic text-muted text-[18px]">No service charges have been raised.</p>
          ) : (
            <HBars data={data.service_revenue} label={(d) => `${d.guest_name}, stay ${d.stay_id}`} value={(d) => d.total_service_revenue} />
          )}
        </Block>

        <Block id="r-can" title="Cancellations and no-shows" className="lg:col-span-5">
          <Segments
            parts={[
              { label: 'Cancelled', value: cancelled, color: 'var(--color-claret-light)' },
              { label: 'No show', value: noShow, color: 'var(--color-muted)' },
            ]}
          />
          <ul className="list-none m-0 mt-6 p-0">
            {data.cancellations.length === 0 && <li className="italic text-muted text-[17px]">Nothing has been cancelled.</li>}
            {data.cancellations.map((c) => (
              <li key={c.reservation_id} className="flex items-center justify-between gap-4 py-3 rule-b">
                <span className="min-w-0">
                  <span className="block text-[17px] truncate">{c.guest_name}</span>
                  <span className="block text-[15px] text-muted">
                    Room {c.room_number}, {dayLabel(c.planned_check_in)} to {dayLabel(c.planned_check_out)}
                  </span>
                </span>
                <PillTag status={c.reservation_status} />
              </li>
            ))}
          </ul>
        </Block>

        <Block id="r-hk" title="Housekeeping status" className="lg:col-span-7" delay={0.08}>
          <Segments
            parts={[
              { label: 'To do', value: hk[0], color: 'var(--color-st-maintenance)' },
              { label: 'In progress', value: hk[1], color: 'var(--color-st-cleaning)' },
              { label: 'Done', value: hk[2], color: 'var(--color-st-available)' },
            ]}
          />
          <div className="overflow-x-auto thin-scroll mt-6">
            <table className="w-full border-collapse min-w-[520px]">
              <thead>
                <tr>
                  {['Room', 'Task', 'Staff', 'Status', 'When'].map((h) => (
                    <th key={h} className="th">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.housekeeping_status.map((t) => (
                  <tr key={t.task_id}>
                    <td className="td">{t.room_number}</td>
                    <td className="td text-[16px]">{t.task_type}</td>
                    <td className="td text-[16px]">{t.assigned_staff || <span className="text-muted">Nobody</span>}</td>
                    <td className="td">
                      <PillTag status={t.task_status} />
                    </td>
                    <td className="td text-[15px] text-muted whitespace-nowrap">{stampLabel(t.completed_at || t.scheduled_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Block>

        <Block id="r-hist" title="Guest history" className="lg:col-span-12">
          <div className="max-w-[360px] mb-6">
            <SelectInput label="Guest" value={guest} onChange={(e) => setGuest(e.target.value)}>
              <option value="">Every guest</option>
              {guestOptions.map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </SelectInput>
          </div>
          {history.length === 0 ? (
            <p className="m-0 italic text-muted text-[18px]">No completed or current stays to show.</p>
          ) : (
            <div className="overflow-x-auto thin-scroll">
              <table className="w-full border-collapse min-w-[720px]">
                <thead>
                  <tr>
                    {['Guest', 'Room', 'Arrived', 'Left', 'Services', 'Invoice total'].map((h, i) => (
                      <th key={h} className="th" style={{ textAlign: i >= 4 ? 'right' : 'left' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {history.map((h) => (
                    <tr key={h.reservation_id}>
                      <td className="td">{h.full_name}</td>
                      <td className="td">{h.room_number}</td>
                      <td className="td text-[16px]">{dateLabel(h.actual_check_in)}</td>
                      <td className="td text-[16px]">{h.actual_check_out ? dateLabel(h.actual_check_out) : <span className="text-muted">In house</span>}</td>
                      <td className="td text-right num">{inr(h.service_spend)}</td>
                      <td className="td text-right num">{Number(h.invoice_total) ? inr(h.invoice_total) : <span className="text-muted">Not yet billed</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Block>
      </div>
    </>
  )
}
