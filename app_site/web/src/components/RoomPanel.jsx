import { useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'motion/react'
import Modal from './Modal'
import KeyFob from './KeyFob'
import { StatusTag, PillTag, SkeletonRows } from './ui'
import { useApi } from '../hooks'
import { EASE, rememberRect } from '../motion'
import { dayLabel, plural } from '../format'

/** A room's side sheet. "Book this room" hands the tag over to the booking page's header. */
export default function RoomPanel({ room, onClose, onCheckout }) {
  const nav = useNavigate()
  const fobRef = useRef(null)
  const { data: res } = useApi(room ? `/reservations?q=${encodeURIComponent(room.room_number)}` : null, { enabled: !!room })
  const mine = (res || []).filter((r) => r.room_id === room?.room_id).slice(0, 6)
  const go = (to) => {
    onClose()
    nav(to)
  }
  const book = () => {
    rememberRect(`room-${room.room_id}`, fobRef.current)
    go(`/book?room=${room.room_id}`)
  }
  return (
    <Modal open={!!room} onClose={onClose} variant="drawer" size="md" title={room ? `Room ${room.room_number}` : ''}>
      {room && (
        <div className="grid gap-9">
          <div className="flex items-start gap-7">
            <div className="rack px-6 pt-5 pb-6 shrink-0">
              <div className="relative z-[1]">
                <KeyFob ref={fobRef} layoutId={`fob-${room.room_id}`} number={room.room_number} status={room.status} size="lg" tilt />
              </div>
            </div>
            <div className="pt-2 grid gap-3 min-w-0">
              <StatusTag status={room.status} />
              <p className="m-0 text-[17px]">
                {room.type_name}, sleeps {room.capacity}
              </p>
              {room.guest_name && (
                <p className="m-0 text-[16px]">
                  <span className="text-[12.5px] text-muted block">In house</span>
                  {room.guest_name}
                </p>
              )}
              {!room.guest_name && room.next_arrival && (
                <p className="m-0 text-[16px]">
                  <span className="text-[12.5px] text-muted block">Next arrival</span>
                  {dayLabel(room.next_arrival)}
                </p>
              )}
            </div>
          </div>

          <motion.div
            className="flex flex-wrap gap-3"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: EASE, delay: 0.3 }}
          >
            {room.status === 'occupied' && room.stay_id && (
              <button className="btn btn-primary" onClick={() => onCheckout?.(room)}>
                Check out {room.guest_name?.split(' ')[0]}
              </button>
            )}
            {room.status === 'available' && (
              <button className="btn btn-primary" onClick={book}>
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
            <h3 id="room-res" className="display m-0 mb-4 text-[28px] text-strong">
              Reservations on this room
            </h3>
            {!res ? (
              <SkeletonRows rows={3} height={46} />
            ) : mine.length === 0 ? (
              <p className="m-0 text-muted text-[15px]">Nothing on the books yet. The room is free to sell.</p>
            ) : (
              <ul className="list-none m-0 p-0">
                {mine.map((r, i) => (
                  <motion.li
                    key={r.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.7, ease: EASE, delay: 0.2 + i * 0.06 }}
                    className="flex items-center justify-between gap-4 py-3.5 border-b border-line"
                  >
                    <div className="min-w-0">
                      <p className="m-0 text-[15.5px] truncate">{r.guest}</p>
                      <p className="m-0 text-[13.5px] text-muted">
                        {dayLabel(r.check_in)} to {dayLabel(r.check_out)}, {plural(r.nights, 'night')}
                      </p>
                    </div>
                    <PillTag status={r.status} />
                  </motion.li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </Modal>
  )
}
