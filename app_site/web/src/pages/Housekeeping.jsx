import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { DndContext, DragOverlay, KeyboardSensor, PointerSensor, TouchSensor, useDraggable, useDroppable, useSensor, useSensors } from '@dnd-kit/core'
import { AnimatePresence, motion } from 'motion/react'
import { PageHeader, SectionTitle, SelectInput, Skeleton, ErrorNote } from '../components/ui'
import KeyFob from '../components/KeyFob'
import Modal from '../components/Modal'
import RuleError from '../components/RuleError'
import { Reveal } from '../components/motion'
import { useApi } from '../hooks'
import { patch, post } from '../api'
import { useData, useToast } from '../store'
import { EASE } from '../motion'
import { stampLabel } from '../format'

const COLUMNS = [
  { id: 'pending', title: 'To do', note: 'Waiting for someone to pick it up' },
  { id: 'in_progress', title: 'In progress', note: 'Being worked on now' },
  { id: 'done', title: 'Done', note: 'Finished rooms go back on sale' },
]
const TASK_TYPES = ['Post-checkout cleaning', 'Daily cleaning', 'Turndown service', 'Deep clean', 'Maintenance check']

function CardBody({ t, onMove, overlay }) {
  const next = t.task_status === 'pending' ? ['in_progress', 'Start'] : t.task_status === 'in_progress' ? ['done', 'Finish'] : ['pending', 'Reopen']
  return (
    <div
      className="bg-surface p-5 flex gap-4 items-start border border-line"
      style={{ boxShadow: overlay ? 'var(--shadow)' : 'none', borderColor: overlay ? 'var(--accent)' : undefined }}
    >
      <span className="rack p-1.5 shrink-0" style={{ ['--hole']: '#070708' }}>
        <span className="relative z-[1] block">
          <KeyFob number={t.room_number} status={t.room_status} size="sm" />
        </span>
      </span>
      <div className="min-w-0 flex-1">
        <p className="m-0 text-[16px] text-strong leading-snug">{t.task_type}</p>
        <p className="m-0 text-[13.5px] text-muted">Room {t.room_number}</p>
        <p className="m-0 text-[13.5px] text-muted">{t.assigned_staff || 'Nobody assigned'}</p>
        <p className="m-0 mt-1.5 text-[12px] text-muted">
          {t.task_status === 'done' && t.completed_at ? `Finished ${stampLabel(t.completed_at)}` : `Set for ${stampLabel(t.scheduled_at)}`}
        </p>
        {!overlay && (
          <button
            type="button"
            className="btn btn-ghost btn-sm mt-4"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => onMove(t, next[0])}
            aria-label={`${next[1]} the task for room ${t.room_number}`}
          >
            {next[1]}
          </button>
        )}
      </div>
    </div>
  )
}

function Card({ t, onMove }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: String(t.task_id), data: { task: t } })
  return (
    <motion.li
      layout="position"
      layoutId={`task-${t.task_id}`}
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: isDragging ? 0.3 : 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.75, ease: EASE }}
      ref={setNodeRef}
      className="list-none touch-manipulation"
      style={{ cursor: 'grab' }}
      {...attributes}
      {...listeners}
    >
      <CardBody t={t} onMove={onMove} />
    </motion.li>
  )
}

function Column({ col, tasks, onMove, i }) {
  const { setNodeRef, isOver } = useDroppable({ id: col.id })
  return (
    <Reveal
      as="section"
      delay={i * 0.08}
      aria-labelledby={`col-${col.id}`}
      className="min-w-0 p-5 border transition-colors duration-500"
      style={{
        background: isOver ? 'color-mix(in srgb, var(--accent) 9%, var(--surface-2))' : 'var(--surface-2)',
        borderColor: isOver ? 'var(--accent)' : 'transparent',
        borderStyle: isOver ? 'dashed' : 'solid',
      }}
    >
      <div className="flex items-baseline justify-between mb-1">
        <h2 id={`col-${col.id}`} className="display m-0 text-[30px] text-strong">
          {col.title}
        </h2>
        <span className="text-[13px] text-muted num">{tasks.length}</span>
      </div>
      <p className="m-0 mb-5 text-[13.5px] text-muted">{col.note}</p>
      <ul ref={setNodeRef} className="list-none m-0 p-0 grid gap-3 content-start" style={{ minHeight: 150 }}>
        <AnimatePresence initial={false}>
          {tasks.map((t) => (
            <Card key={t.task_id} t={t} onMove={onMove} />
          ))}
        </AnimatePresence>
        {tasks.length === 0 && (
          <li className="list-none grid place-items-center text-center text-muted text-[14px] py-9 px-4 border border-dashed border-line-strong">
            {col.id === 'pending' ? 'All clear. New tasks land here.' : col.id === 'in_progress' ? 'Drag a card here to begin.' : 'Finished work collects here.'}
          </li>
        )}
      </ul>
    </Reveal>
  )
}

export default function Housekeeping() {
  const { bump } = useData()
  const toast = useToast()
  const [params, setParams] = useSearchParams()
  const { data, error } = useApi('/housekeeping')
  const [tasks, setTasks] = useState(null)
  const [activeId, setActiveId] = useState(null)
  const [moveErr, setMoveErr] = useState(null)
  const [form, setForm] = useState(null)

  useEffect(() => {
    if (data) setTasks(data.tasks)
  }, [data])
  useEffect(() => {
    if (params.get('new') && data) {
      setForm({ room_id: '', task_type: TASK_TYPES[0], staff_id: '' })
      params.delete('new')
      setParams(params, { replace: true })
    }
  }, [params, data, setParams])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }),
    useSensor(KeyboardSensor),
  )

  const move = async (task, status) => {
    if (task.task_status === status) return
    const before = tasks
    setMoveErr(null)
    // optimistic: the card moves at once; finishing also turns the room's tag back to available
    setTasks((ts) =>
      ts.map((t) => {
        if (t.task_id === task.task_id) return { ...t, task_status: status, completed_at: status === 'done' ? new Date().toISOString().slice(0, 19) : null }
        if (status === 'done' && t.room_id === task.room_id && t.room_status === 'cleaning') return { ...t, room_status: 'available' }
        return t
      }),
    )
    try {
      await patch(`/housekeeping/${task.task_id}`, { status })
      if (status === 'done') toast(`Room ${task.room_number} is free`, `${task.task_type} is finished and the room is back on sale.`)
      bump()
    } catch (e) {
      setTasks(before)
      setMoveErr(e)
    }
  }

  const onDragEnd = ({ active, over }) => {
    setActiveId(null)
    if (!over) return
    const task = tasks.find((t) => String(t.task_id) === String(active.id))
    if (task && over.id !== task.task_status) move(task, String(over.id))
  }

  const by = useMemo(() => {
    const m = { pending: [], in_progress: [], done: [] }
    ;(tasks || []).forEach((t) => m[t.task_status]?.push(t))
    m.done = m.done.sort((a, b) => String(b.completed_at || '').localeCompare(String(a.completed_at || ''))).slice(0, 8)
    return m
  }, [tasks])
  const activeTask = tasks?.find((t) => String(t.task_id) === activeId)

  const createTask = async (e) => {
    e.preventDefault()
    try {
      await post('/housekeeping', { room_id: Number(form.room_id), task_type: form.task_type, staff_id: form.staff_id || null })
      bump()
      toast('Task added', `${form.task_type} is on the board.`)
      setForm(null)
    } catch (err) {
      setForm((f) => ({ ...f, error: err }))
    }
  }

  return (
    <>
      <PageHeader title="The *housekeeping* board" subtitle="Drag a card across the board, or use its button. Finishing a cleaning frees the room for sale.">
        <button className="btn btn-primary" onClick={() => setForm({ room_id: '', task_type: TASK_TYPES[0], staff_id: '' })}>
          New task
        </button>
      </PageHeader>

      {error && !data && <ErrorNote error={error} />}

      {data?.awaiting?.length > 0 && (
        <Reveal as="section" aria-labelledby="await" className="mb-12">
          <SectionTitle id="await">Rooms waiting for a task</SectionTitle>
          <ul className="list-none m-0 p-0 flex flex-wrap gap-x-10 gap-y-4">
            {data.awaiting.map((r) => (
              <li key={r.room_id} className="flex items-center gap-4">
                <span className="rack p-1.5">
                  <span className="relative z-[1] block">
                    <KeyFob number={r.room_number} status="cleaning" size="sm" />
                  </span>
                </span>
                <span className="text-[15px]">Room {r.room_number} needs cleaning</span>
                <button className="btn btn-ghost btn-sm" onClick={() => setForm({ room_id: String(r.room_id), task_type: TASK_TYPES[0], staff_id: '' })}>
                  Add a task
                </button>
              </li>
            ))}
          </ul>
        </Reveal>
      )}

      <RuleError error={moveErr} className="mb-6" />

      {!tasks ? (
        <div className="grid md:grid-cols-3 gap-5">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} style={{ height: 380 }} />
          ))}
        </div>
      ) : (
        <DndContext sensors={sensors} onDragStart={(e) => setActiveId(String(e.active.id))} onDragEnd={onDragEnd} onDragCancel={() => setActiveId(null)}>
          <div className="grid md:grid-cols-3 gap-5 items-start">
            {COLUMNS.map((c, i) => (
              <Column key={c.id} col={c} tasks={by[c.id]} onMove={move} i={i} />
            ))}
          </div>
          <DragOverlay dropAnimation={{ duration: 520, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' }}>
            {activeTask ? (
              <div style={{ transform: 'rotate(1.5deg)', cursor: 'grabbing' }}>
                <CardBody t={activeTask} overlay />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      )}

      <Modal
        open={!!form}
        onClose={() => setForm(null)}
        title="New housekeeping task"
        size="sm"
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => setForm(null)}>
              Cancel
            </button>
            <button className="btn btn-primary" onClick={createTask} disabled={!form?.room_id}>
              Add to the board
            </button>
          </>
        }
      >
        {form && (
          <form onSubmit={createTask} className="grid gap-6" noValidate>
            <SelectInput label="Room" value={form.room_id} onChange={(e) => setForm({ ...form, room_id: e.target.value, error: null })} data-autofocus>
              <option value="">Choose a room</option>
              {(data?.awaiting || []).map((r) => (
                <option key={`a${r.room_id}`} value={r.room_id}>
                  Room {r.room_number} (needs cleaning)
                </option>
              ))}
              <RoomOptions skip={(data?.awaiting || []).map((r) => r.room_id)} />
            </SelectInput>
            <SelectInput label="Task" value={form.task_type} onChange={(e) => setForm({ ...form, task_type: e.target.value })}>
              {TASK_TYPES.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </SelectInput>
            <SelectInput label="Assign to" value={form.staff_id} onChange={(e) => setForm({ ...form, staff_id: e.target.value })}>
              <option value="">Nobody yet</option>
              {(data?.staff || []).map((s) => (
                <option key={s.staff_id} value={s.staff_id}>
                  {s.full_name}, {s.role}
                </option>
              ))}
            </SelectInput>
            <RuleError error={form.error} />
            <button type="submit" className="sr-only">
              Add
            </button>
          </form>
        )}
      </Modal>
    </>
  )
}

function RoomOptions({ skip }) {
  const { data } = useApi('/rooms')
  return (data || [])
    .filter((r) => !skip.includes(r.room_id))
    .map((r) => (
      <option key={r.room_id} value={r.room_id}>
        Room {r.room_number}, {r.type_name}
      </option>
    ))
}
