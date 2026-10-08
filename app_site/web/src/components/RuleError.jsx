import { useMemo } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { SealWarning } from '@phosphor-icons/react'
import { EASE } from '../motion'

// What each database rule is called at the desk. The message under it is the
// database's own text, unedited.
const TITLES = {
  overlap: 'This room is already held for those dates',
  capacity: "More guests than the room can hold",
  rate_plan: "That rate plan isn't for this room",
  dates: 'Those dates do not work',
  occupants: 'A booking needs at least one adult',
  overpayment: 'More than the balance due',
  referenced: 'This guest has history on file',
  unique: 'Already on file',
  state: 'Not possible in this state',
  room_state: 'The room is not ready',
  amount: 'Check the amount',
  method: 'Choose a payment method',
  login: 'Staff sign-in',
  network: 'The desk lost its line',
  unavailable: 'The ledger is unreachable',
  required: 'Something is missing',
  email: 'Check the email address',
  invalid: 'Check the details',
  not_found: 'Record not found',
  charge_stay: "The charge belongs to another stay",
  task_room: "The task belongs to another room",
}

let counter = 0
export default function RuleError({ error, className = '' }) {
  const key = useMemo(() => (error ? ++counter : 0), [error])
  return (
    <AnimatePresence initial={false} mode="wait">
      {error && (
        <motion.div
          key={key}
          role="alert"
          className={className}
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.6, ease: EASE }}
          style={{ overflow: 'hidden' }}
        >
          <motion.div
            className="relative flex gap-4 items-start py-4 pr-4 pl-6 my-1"
            style={{ background: 'color-mix(in srgb, #A32B3F 7%, #F2F0EB)', border: '1px solid color-mix(in srgb, #A32B3F 40%, #F2F0EB)' }}
            initial={{ x: 0 }}
            animate={{ x: [0, -4, 3, -2, 0] }}
            transition={{ duration: 0.7, ease: EASE, delay: 0.25 }}
          >
            <motion.span
              aria-hidden="true"
              className="absolute left-0 top-0 bottom-0 w-[3px]"
              style={{ background: 'var(--color-claret-light)', originY: 0 }}
              initial={{ scaleY: 0 }}
              animate={{ scaleY: 1 }}
              transition={{ duration: 0.8, ease: EASE }}
            />
            <motion.span
              style={{ color: 'var(--color-claret-light)' }}
              initial={{ opacity: 0, scale: 0.7 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.7, ease: EASE, delay: 0.1 }}
              className="mt-0.5"
            >
              <SealWarning size={28} weight="light" />
            </motion.span>
            <div className="min-w-0">
              <p className="m-0 font-ui text-[15px] font-medium" style={{ color: 'var(--color-claret-light)' }}>
                {TITLES[error.rule] || 'The desk cannot do that'}
              </p>
              <p className="m-0 mt-1 text-[17px] leading-snug">{error.message}</p>
              {error.status === 409 && error.rule !== 'state' && (
                <p className="m-0 mt-2 font-ui text-[13px] text-muted">Refused by a rule in the database, nothing was saved.</p>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
