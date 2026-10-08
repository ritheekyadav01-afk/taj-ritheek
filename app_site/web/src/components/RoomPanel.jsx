import { useNavigate } from 'react-router-dom'
import { motion } from 'motion/react'
import Modal from './Modal'
import KeyFob from './KeyFob'
import { StatusTag, PillTag, SkeletonRows } from './ui'
import { useApi } from '../hooks'
import { EASE } from '../motion'
import { dayLabel, plural } from '../format'

/** The key fob lifts off the rack and becomes this panel's header (shared layoutId). */
export default function RoomPanel({ room, onClose, onCheckout }) {
  const nav = useNavigate()
  const { data: res } = useApi(room ? `/reservations?q=${encodeURIComponent(room.room_number)}` : null, { enabled: !!room })
  const mine = (res || []).filter((r) => r.room_id === room?.room_id).slice(0, 6)
  const go = (to) => {
    onClose()
    nav(to)
  }
  return (
    <Modal open={!!room} onClose={onClose} variant="drawer" size="md" title={room ? `Room ${room.room_number}` : ''}>
      {room && (
        <div className="grid gap-7">
          <div className="flex items-start gap-7">
            <KeyFob layoutId={`fob-${room.room_id}`} number={room.room_number} status={room.status} size="lg" />
            <div className="pt-2 grid gap-3 min-w-0">
              <StatusTag status={room.status} />
              <p className="m-0 text-[19px]">
                {room.type_name}, sleeps {room.capacity}
              </p>
              {room.guest_name && (
                <p className="m-0 text-[18px]">
                  <span className="font-ui text-[14px] text-muted block">In house</span>
                  {room.guest_name}
                </p>
              )}
              {!room.guest_name && room.next_arrival && (
                <p className="m-0 text-[18px]">
                  <span className="font-ui text-[14px] text-muted block">Next arrival</span>
                  {dayLabel(room.next_arrival)}
                </p>
              )}
            </div>
          </div>

          <motion.div
            className="flex flex-wrap gap-3"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: EASE, delay: 0.25 }}
          >
            {room.status === 'occupied' && room.stay_id && (
              <button className="btn btn-primary" onClick={() => onCheckout?.(room)}>
                Check out {room.guest_name?.split(' ')[0]}
              </button>
            )}
            {room.status === 'available' && (
              <button className="btn btn-primary" onClick={() => go(`/book?room=${room.room_id}`)}>
                Book this room
              </button>
            )}
            {room.status === 'cleaning' && (
              <button className="btn btn-primary" onClick={() => go('/housekeeping')}>
                Open housekeeping
              </button>
            )}
            <button className="btn btn-ghost" onClick={() => go('/timeline')}>
              See on the timeline
            </button>
          </motion.div>

          <section aria-labelledby="room-res">
            <h3 id="room-res" className="sc m-0 mb-3 text-[20px] text-claret">
              Reservations on this room
            </h3>
            {!res ? (
              <SkeletonRows rows={3} height={44} />
            ) : mine.length === 0 ? (
              <p className="m-0 italic text-muted text-[17px]">Nothing on the books yet. The room is free to sell.</p>
            ) : (
              <ul className="list-none m-0 p-0">
                {mine.map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-4 py-3 rule-b">
                    <div className="min-w-0">
                      <p className="m-0 text-[17px] truncate">{r.guest}</p>
                      <p className="m-0 text-[15px] text-muted">
                        {dayLabel(r.check_in)} to {dayLabel(r.check_out)}, {plural(r.nights, 'night')}
                      </p>
                    </div>
                    <PillTag status={r.status} />
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </Modal>
  )
}
