import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'motion/react'
import Modal from './Modal'
import KeyFob from './KeyFob'
import RuleError from './RuleError'
import { SkeletonRows, ErrorNote } from './ui'
import { Odometer } from './motion'
import { get, post } from '../api'
import { useData, useToast } from '../store'
import { EASE } from '../motion'
import { inr, plural } from '../format'

function Row({ children, amount, i }) {
  return (
    <motion.div
      className="flex items-baseline justify-between gap-6 py-2.5 border-b border-line"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.7, ease: EASE, delay: 0.1 + i * 0.06 }}
    >
      <span className="text-[15px]">{children}</span>
      <span className="text-[15px] num">{amount}</span>
    </motion.div>
  )
}

/** Bill preview (nights x rate + services + 5% tax), then one transaction that closes the stay and raises the invoice. */
export default function CheckOutModal({ stay, onClose }) {
  const nav = useNavigate()
  const { bump } = useData()
  const toast = useToast()
  const [quote, setQuote] = useState(null)
  const [loadErr, setLoadErr] = useState(null)
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const [issued, setIssued] = useState(null)
  const id = stay?.stay_id

  useEffect(() => {
    if (!id) return undefined
    setQuote(null)
    setLoadErr(null)
    setError(null)
    setIssued(null)
    let live = true
    get(`/stays/${id}/quote`)
      .then((q) => live && setQuote(q))
      .catch((e) => live && setLoadErr(e))
    return () => {
      live = false
    }
  }, [id])

  const confirm = async () => {
    setBusy(true)
    setError(null)
    try {
      const r = await post(`/stays/${id}/check-out`)
      setIssued(r)
      bump()
      toast('Checked out', `Invoice ${r.invoice_id} has been raised for ${stay.guest}.`)
    } catch (e) {
      setError(e)
    } finally {
      setBusy(false)
    }
  }

  let row = 0
  return (
    <Modal
      open={!!stay}
      onClose={onClose}
      title={issued ? 'Checked out' : 'Check out'}
      size="md"
      footer={
        issued ? (
          <>
            <button className="btn btn-ghost" onClick={onClose}>
              Close
            </button>
            <button
              className="btn btn-primary"
              data-autofocus
              onClick={() => {
                onClose()
                nav(`/billing?invoice=${issued.invoice_id}`)
              }}
            >
              Open the receipt
            </button>
          </>
        ) : (
          <>
            <button className="btn btn-ghost" onClick={onClose}>
              Keep the guest in house
            </button>
            <button className="btn btn-primary" onClick={confirm} disabled={busy || !quote} data-autofocus>
              {busy ? 'Closing the account' : 'Check out and issue invoice'}
            </button>
          </>
        )
      }
    >
      {stay && (
        <div className="grid gap-6">
          <div className="flex items-center gap-5">
            <div className="relative shrink-0" style={{ width: 46, height: 64 }}>
              <KeyFob number={stay.room} status="occupied" size="sm" />
              <motion.div className="absolute inset-0" initial={false} animate={{ opacity: issued ? 1 : 0 }} transition={{ duration: 1.1, ease: EASE }}>
                <KeyFob number={stay.room} status="cleaning" size="sm" />
              </motion.div>
            </div>
            <div>
              <p className="m-0 text-[18px] text-strong leading-tight">{stay.guest}</p>
              <p className="m-0 text-muted text-[14px]">
                Room {stay.room}
                {issued ? ', now with housekeeping' : ''}
              </p>
            </div>
          </div>

          {loadErr && <ErrorNote error={loadErr} />}
          {!quote && !loadErr && <SkeletonRows rows={4} height={34} />}
          {quote && (
            <div className="double-rule p-7">
              <Row i={row++} amount={inr(quote.room_charge)}>
                Room, {plural(quote.nights, 'night')} at {inr(quote.rate)}
              </Row>
              {quote.lines.map((l) => (
                <Row key={l.charge_id} i={row++} amount={inr(l.amount)}>
                  {l.description}
                </Row>
              ))}
              <Row i={row++} amount={inr(quote.subtotal)}>
                Subtotal
              </Row>
              <Row i={row++} amount={inr(quote.tax)}>
                Tax at 5%
              </Row>
              <div className="flex items-end justify-between gap-6 pt-5">
                <span className="text-[14px] text-muted">Total due</span>
                <span className="display text-[40px] text-strong leading-none">
                  <Odometer value={quote.total} format={(v) => inr(v)} />
                </span>
              </div>
            </div>
          )}
          {issued && (
            <motion.p
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, ease: EASE, delay: 0.3 }}
              className="m-0 text-[15px] text-muted"
            >
              The stay is closed, the room is with housekeeping and invoice {issued.invoice_id} is open for payment.
            </motion.p>
          )}
          <RuleError error={error} />
        </div>
      )}
    </Modal>
  )
}
