import { useState } from 'react'
import { motion } from 'motion/react'
import Monogram from '../components/Monogram'
import RuleError from '../components/RuleError'
import { Display, Spotlight } from '../components/motion'
import { post } from '../api'
import { EASE, introDelay } from '../motion'

/** Staff sign-in, shown only when the server has STAFF_PASSWORD set (public deployments). */
export default function Login({ onDone }) {
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [d] = useState(() => introDelay())

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
    <main className="min-h-[100dvh] grid lg:grid-cols-[1.1fr_1fr] bg-bg">
      <section className="rack relative flex flex-col justify-between px-8 sm:px-14 py-12 min-h-[42dvh]">
        <Spotlight />
        <div className="relative z-[1] flex items-center gap-4">
          <div style={{ color: '#C3C6CB' }}>
            <svg width="44" height="44" viewBox="0 0 120 120" aria-hidden="true">
              <circle cx="60" cy="60" r="56" fill="none" stroke="currentColor" strokeWidth="1.4" />
              <circle cx="60" cy="60" r="50.5" fill="none" stroke="currentColor" strokeWidth="0.7" />
              <text x="60" y="80" textAnchor="middle" fontFamily="var(--font-display)" fontSize="58" fill="#E3E5E8">
                T
              </text>
            </svg>
          </div>
          <p className="micro m-0 text-[#C3C6CB]">Est. 1926</p>
        </div>
        <div className="relative z-[1] py-10">
          <Display text="Taj Ritheek|*the staff entrance*" className="m-0 text-[48px] sm:text-[72px] text-[#F7F7F5]" />
        </div>
        <p className="relative z-[1] m-0 text-[13px] text-[#8E9196]">Front desk, housekeeping and accounts, for members of staff.</p>
      </section>

      <section className="flex items-center justify-center px-6 py-14">
        <motion.form
          onSubmit={submit}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, ease: EASE, delay: d + 0.3 }}
          className="double-rule bg-surface w-[min(440px,100%)] p-9 sm:p-11 grid gap-7"
          aria-labelledby="login-title"
        >
          <div className="grid justify-items-start gap-4">
            <Monogram size={52} />
            <h1 id="login-title" className="display m-0 text-[34px] text-strong">
              Sign in
            </h1>
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
          <button type="submit" className="btn btn-primary btn-block" disabled={busy || !password}>
            {busy ? 'Checking' : 'Enter the front desk'}
          </button>
        </motion.form>
      </section>
    </main>
  )
}
