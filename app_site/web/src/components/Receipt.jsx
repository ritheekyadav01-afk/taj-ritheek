import { useEffect, useState } from 'react'
import { motion } from 'motion/react'
import Monogram from './Monogram'
import WaxSeal from './WaxSeal'
import RuleError from './RuleError'
import { Odometer } from './motion'
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
    <div className="flex items-baseline justify-between gap-6 py-2.5 border-b border-line">
      <span className={`text-[15px] ${muted ? 'text-muted' : ''}`}>{children}</span>
      <span className="text-[15px] num">{amount}</span>
    </div>
  )
}

/**
 * A receipt inside a double rule, with the payment form beneath it.
 * Paying the balance in full presses a silver wax seal onto the paper.
 */
export default function Receipt({ invoice, onChanged }) {
  const { bump } = useData()
  const toast = useToast()
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState('card')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [stamp, setStamp] = useState(false)
  const [latest, setLatest] = useState(null) // the server's answer to our own payment, shown at once
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
    <div className="grid gap-10">
      <article className="double-rule bg-surface relative" aria-label={`Receipt for invoice ${inv.invoice_id}`}>
        <div className="relative p-7 sm:p-11">
          <header className="flex flex-wrap items-start justify-between gap-6 pb-7 mb-7 border-b border-line">
            <div className="flex items-center gap-4">
              <Monogram size={46} />
              <div>
                <p className="display m-0 text-[28px] leading-none text-strong">Taj Ritheek</p>
                <p className="micro m-0 mt-2">Est. 1926</p>
              </div>
            </div>
            <div className="text-right">
              <p className="m-0 text-[13px] text-muted">Invoice {inv.invoice_id}</p>
              <p className="m-0 text-[14px]">{dateLabel(inv.invoice_date)}</p>
              <div className="mt-2">
                <PillTag status={inv.status} />
              </div>
            </div>
          </header>

          <dl className="m-0 grid sm:grid-cols-2 gap-x-10 gap-y-4 mb-9 text-[15px]">
            <div>
              <dt className="text-[12.5px] text-muted">Billed to</dt>
              <dd className="m-0 text-strong">{inv.guest}</dd>
              <dd className="m-0 text-[13.5px] text-muted">{inv.email}</dd>
            </div>
            <div>
              <dt className="text-[12.5px] text-muted">Room</dt>
              <dd className="m-0 text-strong">
                {inv.room}, {inv.room_type}
              </dd>
              <dd className="m-0 text-[13.5px] text-muted">{inv.plan_name}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-[12.5px] text-muted">The stay</dt>
              <dd className="m-0">
                {dayLabel(inv.actual_check_in)} to {inv.actual_check_out ? dayLabel(inv.actual_check_out) : 'in house'}
                {nights ? `, ${plural(nights, 'night')}` : ''}
              </dd>
            </div>
          </dl>

          <div>
            <Line amount={inr(inv.room_charge)}>Room charge at {inr(inv.nightly_rate)} a night</Line>
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
            <div className="flex items-end justify-between gap-6 pt-6">
              <span className="text-[14px] text-muted">Total</span>
              <span className="display text-[44px] leading-none text-strong whitespace-nowrap">
                <Odometer value={inv.total} format={(v) => inr(v)} />
              </span>
            </div>
          </div>

          {inv.payments.length > 0 && (
            <div className="mt-10">
              <p className="display m-0 mb-3 text-[28px] text-strong">Payments received</p>
              {inv.payments.map((p) => (
                <motion.div
                  key={p.payment_id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.7, ease: EASE }}
                  className="flex items-baseline justify-between gap-6 py-2.5 border-b border-line"
                >
                  <span className="text-[14px] text-muted">
                    {stampLabel(p.payment_date)}, {METHOD_NAME[p.payment_method]}
                  </span>
                  <span className="text-[15px] num">{inr(p.amount)}</span>
                </motion.div>
              ))}
              <div className="flex items-baseline justify-between gap-6 pt-4">
                <span className="text-[14px]">Balance due</span>
                <span className="display text-[30px] leading-none text-strong">
                  <Odometer value={inv.balance} format={(v) => inr(v)} />
                </span>
              </div>
            </div>
          )}

          {paid && (
            <div className="mt-10 pt-7 border-t border-line flex items-center justify-between gap-6">
              <p className="m-0 text-[15px] text-muted max-w-[28ch]">Settled in full. Thank you for staying with us.</p>
              <WaxSeal size={120} stamp={stamp} />
            </div>
          )}
        </div>
      </article>

      {!paid && (
        <form onSubmit={pay} className="grid gap-6 max-w-[600px]" noValidate>
          <p className="display m-0 text-[30px] text-strong">Record a payment</p>
          <div className="grid sm:grid-cols-[220px_1fr] gap-6 items-end">
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
