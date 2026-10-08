import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'motion/react'
import { PageHeader, SectionTitle, SelectInput, TextInput, Segmented, SkeletonRows, EmptyState, ErrorNote, PillTag } from '../components/ui'
import KeyFob from '../components/KeyFob'
import RuleError from '../components/RuleError'
import { useApi } from '../hooks'
import { post } from '../api'
import { useData, useToast } from '../store'
import { EASE } from '../motion'
import { inr, stampLabel } from '../format'

// Suggested prices are a convenience for the desk; the amount is always editable.
const CATALOG = [
  { name: 'Room service, breakfast', price: 650 },
  { name: 'Laundry and pressing', price: 420 },
  { name: 'Spa treatment', price: 2200 },
  { name: 'Minibar', price: 380 },
  { name: 'Airport transfer', price: 1800 },
  { name: 'Late check-out', price: 1500 },
  { name: 'Extra towels', price: 0 },
]

export default function Services() {
  const nav = useNavigate()
  const { bump } = useData()
  const toast = useToast()
  const stays = useApi('/stays/in-house')
  const log = useApi('/services')

  const [stayId, setStayId] = useState('')
  const [name, setName] = useState('')
  const [charge, setCharge] = useState('room')
  const [amount, setAmount] = useState('')
  const [desc, setDesc] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [fresh, setFresh] = useState(null)

  useEffect(() => {
    if (!stayId && stays.data?.length) setStayId(String(stays.data[0].stay_id))
  }, [stays.data, stayId])

  const pick = (c) => {
    setName(c.name)
    setAmount(c.price ? String(c.price) : '')
    setCharge(c.price ? 'room' : 'none')
    setError(null)
  }

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const body = { stay_id: Number(stayId), service_name: name }
      if (charge === 'room') {
        body.amount = amount
        body.charge_description = desc || name
      }
      const r = await post('/services', body)
      setFresh(r.service_request_id)
      bump()
      const stay = stays.data?.find((s) => String(s.stay_id) === stayId)
      toast(charge === 'room' ? 'Charged to the room' : 'Request logged', `${name} for ${stay?.guest}${charge === 'room' ? `, ${inr(amount)}` : ''}.`)
      setName('')
      setAmount('')
      setDesc('')
    } catch (err) {
      setError(err)
    } finally {
      setBusy(false)
    }
  }

  const chosen = stays.data?.find((s) => String(s.stay_id) === stayId)
  const ready = stayId && name.trim() && (charge === 'none' || amount !== '')

  return (
    <>
      <PageHeader title="Guest services" subtitle="Log what a guest has asked for and, if there is a fee, put it on the room account in the same step." />

      <div className="grid grid-cols-[minmax(0,1fr)] xl:grid-cols-[minmax(0,460px)_minmax(0,1fr)] gap-x-16 gap-y-14 items-start">
        <section aria-labelledby="new-req">
          <SectionTitle id="new-req">New request</SectionTitle>
          {stays.error && !stays.data && <ErrorNote error={stays.error} />}
          {!stays.data ? (
            <SkeletonRows rows={3} height={52} />
          ) : stays.data.length === 0 ? (
            <EmptyState title="Nobody is in house" action={<button className="btn btn-primary" onClick={() => nav('/stays')}>Go to arrivals</button>}>
              Requests belong to a stay. Check a guest in first and they will appear here.
            </EmptyState>
          ) : (
            <form onSubmit={submit} className="grid gap-6" noValidate>
              <SelectInput label="Guest and room" value={stayId} onChange={(e) => setStayId(e.target.value)}>
                {stays.data.map((s) => (
                  <option key={s.stay_id} value={s.stay_id}>
                    Room {s.room}, {s.guest}
                  </option>
                ))}
              </SelectInput>

              <div>
                <span className="field-label">Common requests</span>
                <div className="flex flex-wrap gap-2">
                  {CATALOG.map((c) => (
                    <button
                      key={c.name}
                      type="button"
                      onClick={() => pick(c)}
                      aria-pressed={name === c.name}
                      className="font-ui text-[14px] px-3 min-h-[40px] transition-colors duration-500"
                      style={{
                        border: '1px solid var(--color-ink)',
                        borderRadius: 2,
                        background: name === c.name ? 'var(--color-green)' : 'transparent',
                        color: name === c.name ? 'var(--color-marble)' : 'var(--color-ink)',
                      }}
                    >
                      {c.name}
                    </button>
                  ))}
                </div>
              </div>

              <TextInput label="What was asked for" value={name} onChange={(e) => setName(e.target.value)} placeholder="Choose above or type your own" />

              <Segmented
                label="Fee"
                value={charge}
                onChange={setCharge}
                options={[
                  { value: 'room', label: 'Charge to the room' },
                  { value: 'none', label: 'No charge' },
                ]}
              />

              {charge === 'room' && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, ease: EASE }}
                  className="grid sm:grid-cols-[170px_1fr] gap-5"
                >
                  <TextInput label="Amount in rupees" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" />
                  <TextInput label="Line on the bill" value={desc} onChange={(e) => setDesc(e.target.value)} placeholder={name || 'Same as the request'} />
                </motion.div>
              )}

              <RuleError error={error} />
              <div className="flex flex-wrap items-center gap-4">
                <button type="submit" className="btn btn-primary" disabled={!ready || busy}>
                  {busy ? 'Writing it up' : charge === 'room' ? 'Log and charge' : 'Log the request'}
                </button>
                {chosen && <span className="text-[16px] italic text-muted">Goes to {chosen.guest}, room {chosen.room}.</span>}
              </div>
            </form>
          )}
        </section>

        <section aria-labelledby="req-log">
          <SectionTitle id="req-log">The request log</SectionTitle>
          {log.error && !log.data && <ErrorNote error={log.error} />}
          {!log.data ? (
            <SkeletonRows rows={5} height={52} />
          ) : log.data.length === 0 ? (
            <EmptyState title="Nothing logged yet">Requests and room charges you record will be listed here, newest first.</EmptyState>
          ) : (
            <ul className="list-none m-0 p-0">
              {log.data.map((r, i) => (
                <motion.li
                  key={r.id}
                  initial={{ opacity: 0, y: 10, backgroundColor: r.id === fresh ? 'rgba(169,131,63,0.22)' : 'rgba(0,0,0,0)' }}
                  animate={{ opacity: 1, y: 0, backgroundColor: 'rgba(0,0,0,0)' }}
                  transition={{ duration: 0.9, ease: EASE, delay: Math.min(i, 8) * 0.04 }}
                  className="flex items-center gap-4 py-4 px-2 rule-b"
                >
                  <KeyFob number={r.room} status="occupied" size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="m-0 text-[18px] truncate">{r.service}</p>
                    <p className="m-0 text-[15px] text-muted truncate">
                      {r.guest}, {stampLabel(r.requested)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="m-0 text-[18px] num">{Number(r.charged) ? inr(r.charged) : 'No charge'}</p>
                    <PillTag status={r.status} />
                  </div>
                </motion.li>
              ))}
            </ul>
          )}
          <p className="mt-6 text-[16px] text-muted">
            Room charges join the guest's bill at check-out. <Link className="underline underline-offset-4 decoration-brass" to="/billing">Open billing</Link>
          </p>
        </section>
      </div>
    </>
  )
}
