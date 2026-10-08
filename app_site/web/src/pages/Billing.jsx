import { useEffect, useMemo, useState } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { motion } from 'motion/react'
import { PageHeader, Segmented, SkeletonRows, EmptyState, ErrorNote, PillTag, Skeleton } from '../components/ui'
import Receipt from '../components/Receipt'
import Modal from '../components/Modal'
import { useApi, useMedia } from '../hooks'
import { EASE } from '../motion'
import { dateLabel, inr } from '../format'

const FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'open', label: 'Open' },
  { value: 'partially_paid', label: 'Part paid' },
  { value: 'paid', label: 'Paid' },
]

export default function Billing() {
  const [params, setParams] = useSearchParams()
  const wide = useMedia('(min-width: 1024px)')
  const list = useApi('/invoices')
  const [filter, setFilter] = useState('all')
  const wanted = params.get('invoice') ? Number(params.get('invoice')) : null
  const [sel, setSel] = useState(wanted)
  const [sheet, setSheet] = useState(false)

  const rows = useMemo(() => (list.data || []).filter((i) => filter === 'all' || i.status === filter), [list.data, filter])

  // default selection: the one in the URL, else the first that still owes something, else the newest
  useEffect(() => {
    if (!list.data || sel != null) return
    const first = list.data.find((i) => i.status !== 'paid') || list.data[0]
    if (first) setSel(first.invoice_id)
  }, [list.data, sel])
  useEffect(() => {
    if (wanted && wanted !== sel) setSel(wanted)
  }, [wanted]) // eslint-disable-line react-hooks/exhaustive-deps

  const detail = useApi(sel ? `/invoices/${sel}` : null, { enabled: !!sel })
  const select = (id) => {
    setSel(id)
    setParams({ invoice: id }, { replace: true })
    if (!wide) setSheet(true)
  }

  const receipt = detail.data && detail.data.invoice_id === sel ? <Receipt invoice={detail.data} /> : <Skeleton style={{ height: 540 }} />

  return (
    <>
      <PageHeader title="Billing" subtitle="Every invoice, with its receipt. Payments go through the database's own check against the total." />

      {list.error && !list.data && <ErrorNote error={list.error} />}
      {!list.data ? (
        <SkeletonRows rows={5} />
      ) : list.data.length === 0 ? (
        <EmptyState title="No invoices yet" action={<Link className="btn btn-primary" to="/stays?tab=inhouse">See who is in house</Link>}>
          An invoice is raised when a guest checks out. Check a guest out and their receipt will appear here.
        </EmptyState>
      ) : (
        <div className="grid lg:grid-cols-[minmax(320px,400px)_minmax(0,1fr)] gap-x-14 gap-y-10 items-start">
          <section aria-label="Invoices" className="min-w-0">
            <div className="mb-5">
              <Segmented label="Show" value={filter} onChange={setFilter} options={FILTERS} />
            </div>
            {rows.length === 0 ? (
              <p className="italic text-muted text-[18px] m-0">No invoice has that status.</p>
            ) : (
              <ul className="list-none m-0 p-0">
                {rows.map((i, n) => {
                  const on = i.invoice_id === sel
                  const due = i.total - i.paid
                  return (
                    <motion.li
                      key={i.invoice_id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.55, ease: EASE, delay: Math.min(n, 8) * 0.05 }}
                    >
                      <button
                        type="button"
                        onClick={() => select(i.invoice_id)}
                        aria-current={on ? 'true' : undefined}
                        className="w-full text-left flex items-center justify-between gap-4 py-4 px-4 rule-b transition-colors duration-500 cursor-pointer"
                        style={{
                          background: on ? 'var(--color-vellum)' : 'transparent',
                          borderLeft: `3px solid ${on ? 'var(--color-brass)' : 'transparent'}`,
                          borderTop: 0,
                          borderRight: 0,
                        }}
                      >
                        <span className="min-w-0">
                          <span className="block text-[18px] truncate">
                            {i.guest}
                          </span>
                          <span className="block text-[15px] text-muted">
                            Invoice {i.invoice_id}, room {i.room}, {dateLabel(i.invoice_date)}
                          </span>
                        </span>
                        <span className="text-right shrink-0">
                          <span className="block text-[18px] num">{inr(i.total)}</span>
                          <span className="flex justify-end">
                            <PillTag status={i.status} />
                          </span>
                          {due > 0 && <span className="block text-[14px] text-muted num mt-0.5">{inr(due)} due</span>}
                        </span>
                      </button>
                    </motion.li>
                  )
                })}
              </ul>
            )}
          </section>

          {wide && <section aria-label="Receipt" className="min-w-0">{sel && receipt}</section>}
        </div>
      )}

      {!wide && (
        <Modal open={sheet && !!sel} onClose={() => setSheet(false)} variant="drawer" size="lg" title="Receipt">
          {receipt}
        </Modal>
      )}
    </>
  )
}
