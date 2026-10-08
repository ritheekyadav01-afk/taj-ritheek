import { useState } from 'react'
import { motion } from 'motion/react'
import Monogram from '../components/Monogram'
import RuleError from '../components/RuleError'
import { post } from '../api'
import { EASE } from '../motion'

/** Staff sign-in, shown only when the server has STAFF_PASSWORD set (public deployments). */
export default function Login({ onDone }) {
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await post('/login', { password })
      onDone()
    } catch (err) {
      setError(err)
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="min-h-[100dvh] bg-green grid place-items-center px-4 py-10">
      <motion.form
        onSubmit={submit}
        initial={{ opacity: 0, y: 22 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.9, ease: EASE }}
        className="double-rule bg-marble w-[min(440px,100%)] p-9 sm:p-11 grid gap-6"
        aria-labelledby="login-title"
      >
        <div className="grid justify-items-center gap-3 text-center">
          <Monogram size={64} tone="ink" />
          <h1 id="login-title" className="sc m-0 text-[30px] leading-none" style={{ letterSpacing: '0.1em' }}>
            Taj Ritheek
          </h1>
          <p className="m-0 italic text-[17px] text-muted">Est. 1926. Staff entrance.</p>
        </div>
        <div>
          <label className="field-label" htmlFor="pw">
            Staff password
          </label>
          <input
            id="pw"
            className="input"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value)
              setError(null)
            }}
            autoFocus
          />
        </div>
        <RuleError error={error} />
        <button type="submit" className="btn btn-primary w-full" disabled={busy || !password}>
          {busy ? 'Checking' : 'Enter the front desk'}
        </button>
      </motion.form>
    </main>
  )
}
