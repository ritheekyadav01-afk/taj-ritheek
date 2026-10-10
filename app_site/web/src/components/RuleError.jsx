import { useMemo } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { SealWarning } from '@phosphor-icons/react'
import { EASE } from '../motion'

// What each database rule is called at the desk. The message under it is the
// database's own text, unedited.
const TITLES = {
  overlap: 'This room is already held for those dates',
  capacity: 'More guests than the room can hold',
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
  charge_stay: 'The charge belongs to another stay',
  task_room: 'The task belongs to another room',
}

let counter = 0

/** A rejection: the red rule draws down the left edge and the database's words fade in beside it. */
export default function RuleError({ error, className = '' }) {
  const key = useMemo(() => (error ? ++counter : 0), [error])
  return (
    <AnimatePresence initial={false} mode="wait">
      {error && (
        <motion.div
          key={key}
          role="alert"
          className={className}
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.6, ease: EASE }}
        >
          <div className="relative flex gap-4 items-start py-4 pr-4 pl-6 my-1" style={{ background: 'var(--error-wash)', border: '1px solid var(--error-line)' }}>
            <motion.span
              aria-hidden="true"
              className="absolute left-0 top-0 bottom-0 w-[3px] bg-error"
              style={{ originY: 0 }}
              initial={{ scaleY: 0 }}
              animate={{ scaleY: 1 }}
              transition={{ duration: 0.9, ease: EASE }}
            />
            <SealWarning size={26} weight="light" className="text-error shrink-0 mt-0.5" />
            <div className="min-w-0">
              <p className="m-0 text-[14.5px] font-medium text-error-text">{TITLES[error.rule] || 'The desk cannot do that'}</p>
              <motion.p
                className="m-0 mt-1 text-[15.5px] leading-snug text-text"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.7, ease: EASE, delay: 0.25 }}
              >
                {error.message}
              </motion.p>
              {error.status === 409 && error.rule !== 'state' && (
                <p className="m-0 mt-2 text-[12.5px] text-muted">Refused by a rule in the database. Nothing was saved.</p>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
