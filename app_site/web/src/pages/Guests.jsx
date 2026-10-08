import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { motion } from 'motion/react'
import { MagnifyingGlass, PencilSimple, Trash, ClockCounterClockwise } from '@phosphor-icons/react'
import { PageHeader, TextInput, SkeletonRows, EmptyState, ErrorNote, PillTag } from '../components/ui'
import Modal from '../components/Modal'
import Confirm from '../components/Confirm'
import RuleError from '../components/RuleError'
import { useApi, useDebounced } from '../hooks'
import { del, post, put } from '../api'
import { useData, useToast } from '../store'
import { EASE } from '../motion'
import { dayLabel, inr, plural, initials, dateLabel } from '../format'

const BLANK = { full_name: '', email: '', phone: '' }

function History({ guest, onClose }) {
  const { data, error } = useApi(guest ? `/guests/${guest.guest_id}/stays` : null, { enabled: !!guest })
  return (
    <Modal open={!!guest} onClose={onClose} variant="drawer" size="md" title={guest ? guest.full_name : ''}>
      {guest && (
        <div className="grid gap-6">
          <p className="m-0 text-[17px] text-muted">
            {guest.email}
            {guest.phone ? `, ${guest.phone}` : ''}
          </p>
          <h3 className="sc m-0 text-[22px] text-claret">Stay history</h3>
          {error && <ErrorNote error={error} />}
          {!data ? (
            <SkeletonRows rows={3} height={80} />
          ) : data.length === 0 ? (
            <p className="m-0 italic text-muted text-[18px]">No stays yet. When this guest books, their history starts here.</p>
          ) : (
            <ol className="list-none m-0 p-0 relative" style={{ borderLeft: '1px solid var(--color-brass)', marginLeft: 6 }}>
              {data.map((s, i) => (
                <motion.li
                  key={s.reservation_id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.6, ease: EASE, delay: i * 0.07 }}
                  className="relative pl-7 pb-7"
                >
                  <span aria-hidden="true" className="absolute -left-[5px] top-2 w-[9px] h-[9px] rounded-full bg-brass" />
                  <div className="flex items-center justify-between gap-3">
                    <p className="m-0 text-[19px]">
                      Room {s.room_number}, {s.room_type}
                    </p>
                    <PillTag status={s.status} />
                  </div>
                  <p className="m-0 text-[16px] text-muted">
                    {s.actual_check_in
                      ? `${dateLabel(s.actual_check_in)} to ${s.actual_check_out ? dateLabel(s.actual_check_out) : 'now'}`
                      : `${dayLabel(s.planned_check_in)} to ${dayLabel(s.planned_check_out)} (planned)`}
                  </p>
                  {(Number(s.invoice_total) > 0 || Number(s.service_spend) > 0) && (
                    <p className="m-0 text-[16px] num">
                      Invoice {inr(s.invoice_total)}, services {inr(s.service_spend)}
                    </p>
                  )}
                </motion.li>
              ))}
            </ol>
          )}
        </div>
      )}
    </Modal>
  )
}

export default function Guests() {
  const { bump } = useData()
  const toast = useToast()
  const [params, setParams] = useSearchParams()
  const [q, setQ] = useState('')
  const dq = useDebounced(q.trim(), 200)
  const { data, error } = useApi(`/guests${dq ? `?q=${encodeURIComponent(dq)}` : ''}`)
  const all = useApi('/guests')

  const [form, setForm] = useState(null) // { id?, ...fields, error? }
  const [history, setHistory] = useState(null)
  const [remove, setRemove] = useState(null)

  useEffect(() => {
    if (params.get('new')) {
      setForm({ ...BLANK })
      params.delete('new')
      setParams(params, { replace: true })
    }
  }, [params, setParams])
  useEffect(() => {
    const f = params.get('focus')
    if (f && all.data) {
      const g = all.data.find((x) => String(x.guest_id) === f)
      if (g) setHistory(g)
      params.delete('focus')
      setParams(params, { replace: true })
    }
  }, [params, all.data, setParams])

  const save = async (e) => {
    e?.preventDefault()
    const { id, error: _e, ...fields } = form
    try {
      if (id) {
        await put(`/guests/${id}`, fields)
        toast('Guest updated', `${fields.full_name}'s details are saved.`)
      } else {
        await post('/guests', fields)
        toast('Guest added', `${fields.full_name} is in the guest book.`)
      }
      bump()
      setForm(null)
    } catch (err) {
      setForm((f) => ({ ...f, error: err }))
    }
  }

  const doDelete = async () => {
    await del(`/guests/${remove.guest_id}`)
    bump()
    toast('Guest removed', `${remove.full_name} is no longer in the guest book.`)
    setRemove(null)
  }

  return (
    <>
      <PageHeader title="Guests" subtitle="The guest book. Search it, keep it tidy, and open anyone's stay history.">
        <button className="btn btn-primary" onClick={() => setForm({ ...BLANK })}>
          Add a guest
        </button>
      </PageHeader>

      <div className="relative max-w-[520px] mb-8">
        <TextInput label="Search by name, email or phone" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Start typing" style={{ paddingLeft: 42 }} />
        <MagnifyingGlass size={20} weight="light" className="absolute left-3 bottom-[13px] text-muted pointer-events-none" />
      </div>

      {error && !data && <ErrorNote error={error} />}
      {!data ? (
        <SkeletonRows rows={5} height={64} />
      ) : data.length === 0 ? (
        <EmptyState title={dq ? 'No guest by that name' : 'The guest book is empty'} action={<button className="btn btn-primary" onClick={() => setForm({ ...BLANK, full_name: dq })}>Add a guest</button>}>
          {dq ? 'Check the spelling, or add them as a new guest.' : 'Add the first guest and they will be listed here.'}
        </EmptyState>
      ) : (
        <div className="overflow-x-auto thin-scroll">
          <table className="w-full border-collapse min-w-[720px]">
            <thead>
              <tr>
                {['Guest', 'Email', 'Phone', 'Stays', ''].map((h) => (
                  <th key={h} className="th">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.map((g, i) => (
                <motion.tr
                  key={g.guest_id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.55, ease: EASE, delay: Math.min(i, 10) * 0.04 }}
                >
                  <td className="td">
                    <div className="flex items-center gap-4">
                      <span
                        aria-hidden="true"
                        className="grid place-items-center shrink-0 font-ui text-[14px] font-medium text-brass-soft"
                        style={{ width: 40, height: 40, borderRadius: 99, background: 'var(--color-green)', boxShadow: '0 0 0 1.5px var(--color-brass)' }}
                      >
                        {initials(g.full_name)}
                      </span>
                      <span className="text-[19px]">{g.full_name}</span>
                    </div>
                  </td>
                  <td className="td text-[16px]">{g.email}</td>
                  <td className="td text-[16px] num">{g.phone || <span className="text-muted">Not given</span>}</td>
                  <td className="td text-[16px]">{g.reservations ? plural(g.reservations, 'booking') : <span className="text-muted">None yet</span>}</td>
                  <td className="td">
                    <div className="flex justify-end gap-1">
                      <button className="btn btn-quiet btn-sm" onClick={() => setHistory(g)} aria-label={`Stay history for ${g.full_name}`}>
                        <ClockCounterClockwise size={19} weight="light" />
                        <span className="hidden lg:inline">History</span>
                      </button>
                      <button className="btn btn-quiet btn-sm" onClick={() => setForm({ id: g.guest_id, full_name: g.full_name, email: g.email, phone: g.phone || '' })} aria-label={`Edit ${g.full_name}`}>
                        <PencilSimple size={19} weight="light" />
                        <span className="hidden lg:inline">Edit</span>
                      </button>
                      <button className="btn btn-quiet btn-sm" onClick={() => setRemove(g)} aria-label={`Delete ${g.full_name}`}>
                        <Trash size={19} weight="light" />
                        <span className="hidden lg:inline">Delete</span>
                      </button>
                    </div>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        open={!!form}
        onClose={() => setForm(null)}
        title={form?.id ? 'Edit guest' : 'Add a guest'}
        size="sm"
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => setForm(null)}>
              Cancel
            </button>
            <button className="btn btn-primary" onClick={save} disabled={!form?.full_name?.trim() || !form?.email?.trim()}>
              {form?.id ? 'Save changes' : 'Add guest'}
            </button>
          </>
        }
      >
        {form && (
          <form onSubmit={save} className="grid gap-5" noValidate>
            <TextInput label="Full name" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value, error: null })} data-autofocus autoComplete="off" />
            <TextInput label="Email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value, error: null })} autoComplete="off" />
            <TextInput label="Phone" type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} help="Optional" autoComplete="off" />
            <RuleError error={form.error} />
            <button type="submit" className="sr-only">
              Save
            </button>
          </form>
        )}
      </Modal>

      <Confirm open={!!remove} title="Delete this guest?" confirmLabel="Delete guest" cancelLabel="Keep the guest" onConfirm={doDelete} onClose={() => setRemove(null)}>
        {remove && (
          <p className="m-0">
            {remove.full_name} will be taken out of the guest book. A guest with bookings on record cannot be deleted; the desk will tell you if that applies.
          </p>
        )}
      </Confirm>

      <History guest={history} onClose={() => setHistory(null)} />
    </>
  )
}
