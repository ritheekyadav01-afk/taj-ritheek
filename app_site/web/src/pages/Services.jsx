import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import { PageHeader, SectionTitle, SelectInput, TextInput, Segmented, SkeletonRows, EmptyState, ErrorNote, PillTag } from '../components/ui'
import KeyFob from '../components/KeyFob'
import RuleError from '../components/RuleError'
import { Reveal, Rule } from '../components/motion'
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
      <PageHeader title="Guest *services*" subtitle="Log what a guest has asked for and, if there is a fee, put it on the room account in the same step." />

      <div className="grid grid-cols-[minmax(0,1fr)] xl:grid-cols-[minmax(0,480px)_minmax(0,1fr)] gap-x-20 gap-y-16 items-start">
        <Reveal as="section" aria-labelledby="new-req">
          <SectionTitle id="new-req">New request</SectionTitle>
          {stays.error && !stays.data && <ErrorNote error={stays.error} />}
          {!stays.data ? (
            <SkeletonRows rows={3} height={52} />
          ) : stays.data.length === 0 ? (
            <EmptyState title="Nobody is in house" action={<button className="btn btn-primary" onClick={() => nav('/stays')}>Go to arrivals</button>}>
              Requests belong to a stay. Check a guest in first and they will appear here.
            </EmptyState>
          ) : (
            <form onSubmit={submit} className="grid gap-7" noValidate>
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
                  {CATALOG.map((c) => {
                    const on = name === c.name
                    return (
                      <button
                        key={c.name}
                        type="button"
                        onClick={() => pick(c)}
                        aria-pressed={on}
                        className={`text-[13.5px] px-3.5 min-h-[40px] border transition-colors duration-500 ${on ? 'bg-text text-bg border-text' : 'border-line-strong hover:border-text'}`}
                        style={{ borderRadius: 1 }}
                      >
                        {c.name}
                      </button>
                    )
                  })}
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

              <AnimatePresence initial={false}>
                {charge === 'room' && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.6, ease: EASE }}
                    className="grid sm:grid-cols-[180px_1fr] gap-6"
                  >
                    <TextInput label="Amount in rupees" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" />
                    <TextInput label="Line on the bill" value={desc} onChange={(e) => setDesc(e.target.value)} placeholder={name || 'Same as the request'} />
                  </motion.div>
                )}
              </AnimatePresence>

              <RuleError error={error} />
              <div className="flex flex-wrap items-center gap-5">
                <button type="submit" className="btn btn-primary" disabled={!ready || busy}>
                  {busy ? 'Writing it up' : charge === 'room' ? 'Log and charge' : 'Log the request'}
                </button>
                {chosen && (
                  <span className="text-[13.5px] text-muted">
                    Goes to {chosen.guest}, room {chosen.room}.
                  </span>
                )}
              </div>
            </form>
          )}
        </Reveal>

        <Reveal as="section" aria-labelledby="req-log" delay={0.08}>
          <SectionTitle id="req-log">The request log</SectionTitle>
          <Rule strong />
          {log.error && !log.data && <ErrorNote error={log.error} />}
          {!log.data ? (
            <div className="mt-4">
              <SkeletonRows rows={5} height={56} />
            </div>
          ) : log.data.length === 0 ? (
            <div className="mt-6">
              <EmptyState title="Nothing logged yet">Requests and room charges you record will be listed here, newest first.</EmptyState>
            </div>
          ) : (
            <ul className="list-none m-0 p-0">
              {log.data.map((r, i) => (
                <motion.li
                  key={r.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.8, ease: EASE, delay: Math.min(i, 8) * 0.05 }}
                  className="relative flex items-center gap-5 py-5 border-b border-line"
                >
                  {r.id === fresh && (
                    <motion.span
                      aria-hidden="true"
                      className="absolute inset-0"
                      style={{ background: 'color-mix(in srgb, var(--accent) 16%, transparent)' }}
                      initial={{ opacity: 1 }}
                      animate={{ opacity: 0 }}
                      transition={{ duration: 1.6, ease: EASE, delay: 0.3 }}
                    />
                  )}
                  <KeyFob number={r.room} status="occupied" size="sm" />
                  <div className="relative min-w-0 flex-1">
                    <p className="m-0 text-[16px] text-strong truncate">{r.service}</p>
                    <p className="m-0 text-[13px] text-muted truncate">
                      {r.guest}, {stampLabel(r.requested)}
                    </p>
                  </div>
                  <div className="relative text-right grid gap-1.5 justify-items-end">
                    <p className="m-0 text-[15.5px] num">{Number(r.charged) ? inr(r.charged) : 'No charge'}</p>
                    <PillTag status={r.status} />
                  </div>
                </motion.li>
              ))}
            </ul>
          )}
          <p className="mt-7 text-[14px] text-muted">
            Room charges join the guest's bill at check-out.{' '}
            <Link className="text-text underline underline-offset-4 decoration-accent" to="/billing">
              Open billing
            </Link>
          </p>
        </Reveal>
      </div>
    </>
  )
}
