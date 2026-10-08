import { useEffect, useState } from 'react'
import { motion } from 'motion/react'
import Monogram from './Monogram'
import WaxSeal from './WaxSeal'
import RuleError from './RuleError'
import CountUp from './CountUp'
import { Segmented, TextInput, PillTag } from './ui'
import { post } from '../api'
import { useData, useToast } from '../store'
import { EASE } from '../motion'
import { dateLabel, dayLabel, inr, plural, stampLabel, diffDays } from '../format'

const METHODS = [
  { value: 'cash', label: 'Cash' },
  { value: 'card', label: 'Card' },
  { value: 'upi', label: 'UPI' },
  { value: 'netbanking', label: 'Net banking' },
]
const METHOD_NAME = { cash: 'Cash', card: 'Card', upi: 'UPI', netbanking: 'Net banking' }

function Line({ children, amount, muted }) {
  return (
    <div className="flex items-baseline justify-between gap-6 py-2 rule-b">
      <span className={`text-[17px] ${muted ? 'text-muted' : ''}`}>{children}</span>
      <span className="text-[17px] num">{amount}</span>
    </div>
  )
}

/** A receipt in a double-rule frame, with the payment form beneath it. Paying in full stamps a wax seal. */
export default function Receipt({ invoice, onChanged }) {
  const { bump } = useData()
  const toast = useToast()
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState('card')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [stamp, setStamp] = useState(false)
  const [latest, setLatest] = useState(null)   // the server's answer to our own payment, shown at once
  const inv = latest && latest.invoice_id === invoice.invoice_id && latest.paid >= invoice.paid ? latest : invoice

  useEffect(() => {
    setStamp(false)
    setLatest(null)
    setError(null)
  }, [invoice.invoice_id])
  useEffect(() => {
    setAmount(inv.balance > 0 ? String(inv.balance.toFixed(2)) : '')
  }, [inv.invoice_id, inv.balance]) // eslint-disable-line react-hooks/exhaustive-deps

  const pay = async (e) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const updated = await post(`/invoices/${inv.invoice_id}/payments`, { amount, method })
      setLatest(updated)
      bump()
      onChanged?.(updated)
      if (updated.status === 'paid') {
        setStamp(true)
        toast('Paid in full', `Invoice ${inv.invoice_id} for ${inv.guest} is settled.`)
      } else {
        toast('Payment recorded', `${inr(amount)} by ${METHOD_NAME[method].toLowerCase()}. ${inr(updated.balance)} still due.`)
      }
    } catch (err) {
      setError(err)
    } finally {
      setBusy(false)
    }
  }

  const paid = inv.status === 'paid'
  const nights = inv.actual_check_out ? Math.max(diffDays(inv.actual_check_in, inv.actual_check_out), 1) : null

  return (
    <div className="grid gap-8">
      <article className="double-rule bg-marble relative" aria-label={`Receipt for invoice ${inv.invoice_id}`}>
        <div className="relative p-7 sm:p-10">
          <header className="flex items-start justify-between gap-6 pb-6 mb-6 rule-b">
            <div className="flex items-center gap-4">
              <Monogram size={46} tone="ink" />
              <div>
                <p className="sc m-0 text-[24px] leading-none" style={{ letterSpacing: '0.1em' }}>
                  Taj Ritheek
                </p>
                <p className="m-0 mt-1.5 italic text-[15px] text-muted leading-none">Est. 1926</p>
              </div>
            </div>
            <div className="text-right">
              <p className="sc m-0 text-[20px] text-claret">Invoice {inv.invoice_id}</p>
              <p className="m-0 text-[15px] text-muted">{dateLabel(inv.invoice_date)}</p>
              <div className="mt-1">
                <PillTag status={inv.status} />
              </div>
            </div>
          </header>

          <dl className="m-0 grid sm:grid-cols-2 gap-x-8 gap-y-3 mb-8 text-[17px]">
            <div>
              <dt className="font-ui text-[13px] text-muted">Billed to</dt>
              <dd className="m-0">{inv.guest}</dd>
              <dd className="m-0 text-[15px] text-muted">{inv.email}</dd>
            </div>
            <div>
              <dt className="font-ui text-[13px] text-muted">Room</dt>
              <dd className="m-0">
                {inv.room}, {inv.room_type}
              </dd>
              <dd className="m-0 text-[15px] text-muted">{inv.plan_name}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="font-ui text-[13px] text-muted">The stay</dt>
              <dd className="m-0">
                {dayLabel(inv.actual_check_in)} to {inv.actual_check_out ? dayLabel(inv.actual_check_out) : 'in house'}
                {nights ? `, ${plural(nights, 'night')}` : ''}
              </dd>
            </div>
          </dl>

          <div>
            <Line amount={inr(inv.room_charge)}>
              Room charge at {inr(inv.nightly_rate)} a night
            </Line>
            {inv.lines.map((l) => (
              <Line key={l.charge_id} amount={inr(l.amount)}>
                {l.description}
              </Line>
            ))}
            <Line muted amount={inr(inv.subtotal)}>
              Subtotal
            </Line>
            <Line muted amount={inr(inv.tax)}>
              Tax at 5%
            </Line>
            <div className="flex items-baseline justify-between gap-6 pt-5">
              <span className="sc text-[22px] text-claret">Total</span>
              <span className="font-display text-[40px] font-medium text-claret num whitespace-nowrap">{inr(inv.total)}</span>
            </div>
          </div>

          {inv.payments.length > 0 && (
            <div className="mt-8">
              <h3 className="sc m-0 mb-2 text-[20px] text-claret">Payments received</h3>
              {inv.payments.map((p) => (
                <motion.div
                  key={p.payment_id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.6, ease: EASE }}
                  className="flex items-baseline justify-between gap-6 py-2 rule-b"
                >
                  <span className="text-[16px] text-muted">
                    {stampLabel(p.payment_date)}, {METHOD_NAME[p.payment_method]}
                  </span>
                  <span className="text-[17px] num">{inr(p.amount)}</span>
                </motion.div>
              ))}
              <div className="flex items-baseline justify-between gap-6 pt-3">
                <span className="font-ui text-[15px] font-medium">Balance due</span>
                <span className="text-[22px] font-semibold num">
                  <CountUp value={inv.balance} decimals={2} format={(v) => inr(v)} duration={0.8} />
                </span>
              </div>
            </div>
          )}

          {paid && (
            <div className="mt-8 pt-6 rule-t flex items-center justify-between gap-6">
              <p className="m-0 italic text-[18px] text-muted max-w-[26ch]">Settled in full. Thank you for staying with us.</p>
              <WaxSeal size={118} stamp={stamp} />
            </div>
          )}
        </div>
      </article>

      {!paid && (
        <form onSubmit={pay} className="grid gap-5 max-w-[560px]" noValidate>
          <h3 className="sc m-0 text-[22px] text-claret">Record a payment</h3>
          <div className="grid sm:grid-cols-[210px_1fr] gap-5 items-end">
            <TextInput label={`Amount, up to ${inr(inv.balance)}`} inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
            <Segmented label="Method" value={method} onChange={setMethod} options={METHODS} />
          </div>
          <RuleError error={error} />
          <div>
            <button type="submit" className="btn btn-primary" disabled={busy || !amount}>
              {busy ? 'Recording' : 'Record payment'}
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
