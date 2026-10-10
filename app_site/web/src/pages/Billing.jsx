import { useEffect, useMemo, useState } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { motion } from 'motion/react'
import { PageHeader, Segmented, SkeletonRows, EmptyState, ErrorNote, PillTag, Skeleton } from '../components/ui'
import Receipt from '../components/Receipt'
import Modal from '../components/Modal'
import { Reveal } from '../components/motion'
import { useApi, useMedia } from '../hooks'
import { EASE } from '../motion'
import { dateLabel, inr } from '../format'

const FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'open', label: 'Open' },
  { value: 'partially_paid', label: 'Part paid' },
  { value: 'paid', label: 'Paid' },
]

/** The receipt slides out of a slot like a sheet of paper (a mask and a transform, nothing else). */
function PaperSlot({ children }) {
  return (
    <div className="paper-slot pt-[2px]">
      <div className="paper-mask">
        <motion.div initial={{ y: '-100%' }} animate={{ y: '0%' }} transition={{ duration: 1.15, ease: EASE }}>
          {children}
        </motion.div>
      </div>
    </div>
  )
}

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

  const ready = detail.data && detail.data.invoice_id === sel
  const receipt = ready ? (
    <PaperSlot key={sel}>
      <Receipt invoice={detail.data} />
    </PaperSlot>
  ) : (
    <Skeleton style={{ height: 560 }} />
  )

  return (
    <>
      <PageHeader title="*Billing*" subtitle="Every invoice, with its receipt. Payments go through the database's own check against the total." />

      {list.error && !list.data && <ErrorNote error={list.error} />}
      {!list.data ? (
        <SkeletonRows rows={5} />
      ) : list.data.length === 0 ? (
        <EmptyState title="No invoices yet" action={<Link className="btn btn-primary" to="/stays?tab=inhouse">See who is in house</Link>}>
          An invoice is raised when a guest checks out. Check a guest out and their receipt will appear here.
        </EmptyState>
      ) : (
        <div className="grid lg:grid-cols-[minmax(320px,400px)_minmax(0,1fr)] gap-x-16 gap-y-12 items-start">
          <Reveal as="section" aria-label="Invoices" className="min-w-0">
            <div className="mb-6">
              <Segmented label="Show" value={filter} onChange={setFilter} options={FILTERS} />
            </div>
            {rows.length === 0 ? (
              <p className="text-muted text-[15px] m-0">No invoice has that status.</p>
            ) : (
              <ul className="list-none m-0 p-0 border-t border-line-strong">
                {rows.map((i, n) => {
                  const on = i.invoice_id === sel
                  const due = i.total - i.paid
                  return (
                    <motion.li
                      key={i.invoice_id}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.75, ease: EASE, delay: Math.min(n, 8) * 0.05 }}
                      className="relative"
                    >
                      {on && (
                        <motion.span layoutId="invoice-active" className="absolute left-0 top-0 bottom-0 w-[2px] bg-text" transition={{ duration: 0.6, ease: EASE }} aria-hidden="true" />
                      )}
                      <button
                        type="button"
                        onClick={() => select(i.invoice_id)}
                        aria-current={on ? 'true' : undefined}
                        className={`w-full text-left flex items-center justify-between gap-4 py-5 pl-5 pr-3 border-b border-line transition-colors duration-500 cursor-pointer ${on ? 'bg-surface-2' : 'hover:bg-surface-2'}`}
                      >
                        <span className="min-w-0">
                          <span className="block text-[16px] text-strong truncate">{i.guest}</span>
                          <span className="block text-[13px] text-muted">
                            Invoice {i.invoice_id}, room {i.room}, {dateLabel(i.invoice_date)}
                          </span>
                        </span>
                        <span className="text-right shrink-0 grid gap-1.5 justify-items-end">
                          <span className="block text-[15.5px] num text-strong">{inr(i.total)}</span>
                          <PillTag status={i.status} />
                          {due > 0 && <span className="block text-[12.5px] text-muted num">{inr(due)} due</span>}
                        </span>
                      </button>
                    </motion.li>
                  )
                })}
              </ul>
            )}
          </Reveal>

          {wide && (
            <section aria-label="Receipt" className="min-w-0">
              {sel && receipt}
            </section>
          )}
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
