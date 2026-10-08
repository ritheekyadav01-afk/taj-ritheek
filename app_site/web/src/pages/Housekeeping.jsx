import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { DndContext, DragOverlay, KeyboardSensor, PointerSensor, TouchSensor, useDraggable, useDroppable, useSensor, useSensors } from '@dnd-kit/core'
import { AnimatePresence, motion } from 'motion/react'
import { PageHeader, SectionTitle, SelectInput, TextInput, Skeleton, ErrorNote } from '../components/ui'
import KeyFob from '../components/KeyFob'
import Modal from '../components/Modal'
import RuleError from '../components/RuleError'
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
      className="bg-marble p-4 flex gap-4 items-start"
      style={{
        border: '1px solid var(--color-hairline)',
        boxShadow: overlay ? '0 24px 32px -18px color-mix(in srgb, #231A16 65%, transparent)' : '0 6px 10px -8px color-mix(in srgb, #231A16 40%, transparent)',
      }}
    >
      <KeyFob number={t.room_number} status={t.room_status} size="sm" />
      <div className="min-w-0 flex-1">
        <p className="m-0 text-[18px] leading-snug">{t.task_type}</p>
        <p className="m-0 text-[15px] text-muted">Room {t.room_number}</p>
        <p className="m-0 text-[15px] text-muted">{t.assigned_staff || 'Nobody assigned'}</p>
        <p className="m-0 mt-1 font-ui text-[13px] text-muted">
          {t.task_status === 'done' && t.completed_at ? `Finished ${stampLabel(t.completed_at)}` : `Set for ${stampLabel(t.scheduled_at)}`}
        </p>
        {!overlay && (
          <button
            type="button"
            className="btn btn-ghost btn-sm mt-3"
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
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: isDragging ? 0.35 : 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.6, ease: EASE }}
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

function Column({ col, tasks, onMove, activeId }) {
  const { setNodeRef, isOver } = useDroppable({ id: col.id })
  return (
    <section
      aria-labelledby={`col-${col.id}`}
      className="min-w-0 p-4 transition-colors duration-500"
      style={{
        background: isOver ? 'color-mix(in srgb, #E8E3D8 100%, #A9833F 8%)' : 'var(--color-vellum)',
        outline: isOver ? '1.5px dashed var(--color-brass)' : '1.5px dashed transparent',
        outlineOffset: -6,
      }}
    >
      <div className="flex items-baseline justify-between mb-1">
        <h2 id={`col-${col.id}`} className="sc m-0 text-[22px] text-claret">
          {col.title}
        </h2>
        <span className="font-ui text-[14px] text-muted num">{tasks.length}</span>
      </div>
      <p className="m-0 mb-4 text-[15px] italic text-muted">{col.note}</p>
      <ul ref={setNodeRef} className="list-none m-0 p-0 grid gap-3 content-start" style={{ minHeight: 140 }}>
        <AnimatePresence initial={false}>
          {tasks.map((t) => (
            <Card key={t.task_id} t={t} onMove={onMove} />
          ))}
        </AnimatePresence>
        {tasks.length === 0 && (
          <li className="list-none grid place-items-center text-center italic text-muted text-[16px] py-8 px-4" style={{ border: '1px dashed var(--color-muted)' }}>
            {col.id === 'pending' ? 'All clear. New tasks land here.' : col.id === 'in_progress' ? 'Drag a card here to begin.' : 'Finished work collects here.'}
          </li>
        )}
      </ul>
    </section>
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
    // optimistic: the card moves at once; finishing also flips the room's tag to available
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
      <PageHeader title="Housekeeping" subtitle="Drag a card across the board, or use its button. Finishing a cleaning frees the room for sale.">
        <button className="btn btn-primary" onClick={() => setForm({ room_id: '', task_type: TASK_TYPES[0], staff_id: '' })}>
          New task
        </button>
      </PageHeader>

      {error && !data && <ErrorNote error={error} />}

      {data?.awaiting?.length > 0 && (
        <section aria-labelledby="await" className="mb-10">
          <SectionTitle id="await">Rooms waiting for a task</SectionTitle>
          <ul className="list-none m-0 p-0 flex flex-wrap gap-x-8 gap-y-3">
            {data.awaiting.map((r) => (
              <li key={r.room_id} className="flex items-center gap-3">
                <KeyFob number={r.room_number} status="cleaning" size="sm" />
                <span className="text-[17px]">Room {r.room_number} needs cleaning</span>
                <button className="btn btn-ghost btn-sm" onClick={() => setForm({ room_id: String(r.room_id), task_type: TASK_TYPES[0], staff_id: '' })}>
                  Add a task
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <RuleError error={moveErr} className="mb-6" />

      {!tasks ? (
        <div className="grid md:grid-cols-3 gap-5">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} style={{ height: 360 }} />
          ))}
        </div>
      ) : (
        <DndContext sensors={sensors} onDragStart={(e) => setActiveId(String(e.active.id))} onDragEnd={onDragEnd} onDragCancel={() => setActiveId(null)}>
          <div className="grid md:grid-cols-3 gap-5 items-start">
            {COLUMNS.map((c) => (
              <Column key={c.id} col={c} tasks={by[c.id]} onMove={move} activeId={activeId} />
            ))}
          </div>
          <DragOverlay dropAnimation={{ duration: 450, easing: 'cubic-bezier(0.32,0.72,0,1)' }}>
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
          <form onSubmit={createTask} className="grid gap-5" noValidate>
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
