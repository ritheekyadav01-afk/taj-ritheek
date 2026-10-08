import { useEffect, useState } from 'react'
import { motion } from 'motion/react'
import Modal from './Modal'
import KeyFob from './KeyFob'
import RuleError from './RuleError'
import { post } from '../api'
import { useData, useToast } from '../store'
import { EASE } from '../motion'
import { dayLabel, diffDays, plural, toISO, today } from '../format'

/** Confirm a check-in, then play the hand-over: the fob changes from green to brass. */
export default function CheckInModal({ reservation, onClose, onDone }) {
  const { bump } = useData()
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [done, setDone] = useState(false)
  const r = reservation

  useEffect(() => {
    if (r) {
      setBusy(false)
      setError(null)
      setDone(false)
    }
  }, [r])

  const confirm = async () => {
    setBusy(true)
    setError(null)
    try {
      await post(`/reservations/${r.id ?? r.reservation_id}/check-in`)
      setDone(true)
      bump()
      onDone?.()
    } catch (e) {
      setError(e)
      toast('Check-in refused', e.message, 'error')
    } finally {
      setBusy(false)
    }
  }

  const guest = r?.guest
  const room = r?.room
  const early = r ? diffDays(toISO(today()), r.check_in ?? r.arrives) : 0
  const checkIn = r?.check_in ?? r?.arrives
  const checkOut = r?.check_out ?? r?.departs

  return (
    <Modal
      open={!!r}
      onClose={onClose}
      title={done ? `Welcome, ${guest?.split(' ')[0]}` : 'Check in'}
      size="sm"
      footer={
        done ? (
          <button className="btn btn-primary" onClick={onClose} data-autofocus>
            Done
          </button>
        ) : (
          <>
            <button className="btn btn-ghost" onClick={onClose}>
              Not now
            </button>
            <button className="btn btn-primary" onClick={confirm} disabled={busy} data-autofocus>
              {busy ? 'Handing over the key' : 'Check in'}
            </button>
          </>
        )
      }
    >
      {r && (
        <div className="grid gap-5">
          <div className="grid place-items-center pt-2 pb-1" style={{ minHeight: 190 }}>
            <div className="relative" style={{ width: 94, height: 132 }}>
              <motion.div
                className="absolute inset-0"
                initial={false}
                animate={{ opacity: done ? 0 : 1 }}
                transition={{ duration: 0.9, ease: EASE }}
              >
                <KeyFob number={room} status="available" />
              </motion.div>
              <motion.div
                className="absolute inset-0"
                initial={false}
                animate={{ opacity: done ? 1 : 0, rotate: done ? 0 : 5 }}
                transition={{ duration: 1.1, ease: EASE }}
                style={{ originX: 0.5, originY: '8px' }}
              >
                <KeyFob number={room} status="occupied" />
              </motion.div>
              {done && (
                <svg viewBox="0 0 40 40" width="38" height="38" className="absolute -right-5 -bottom-2" aria-hidden="true">
                  <circle cx="20" cy="20" r="18" fill="var(--color-marble)" stroke="var(--color-st-available)" strokeWidth="1.5" />
                  <motion.path
                    d="M11 21 L18 28 L30 13"
                    fill="none"
                    stroke="var(--color-st-available)"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 0.8, ease: EASE, delay: 0.5 }}
                  />
                </svg>
              )}
            </div>
          </div>
          {done ? (
            <p className="m-0 text-center text-[18px] italic text-muted">
              Room {room} is now occupied. The key is on {guest}'s account until check-out.
            </p>
          ) : (
            <>
              <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-[17px]">
                <dt className="font-ui text-[14px] text-muted self-center">Guest</dt>
                <dd className="m-0">{guest}</dd>
                <dt className="font-ui text-[14px] text-muted self-center">Room</dt>
                <dd className="m-0">
                  {room}
                  {r.room_type ? `, ${r.room_type}` : ''}
                </dd>
                <dt className="font-ui text-[14px] text-muted self-center">Stay</dt>
                <dd className="m-0">
                  {dayLabel(checkIn)} to {dayLabel(checkOut)} ({plural(diffDays(checkIn, checkOut), 'night')})
                </dd>
              </dl>
              {early > 0 && (
                <p className="m-0 text-[16px] italic text-muted">
                  This booking arrives in {plural(early, 'day')}. You can still check the guest in early.
                </p>
              )}
              <RuleError error={error} />
            </>
          )}
        </div>
      )}
    </Modal>
  )
}
