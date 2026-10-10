import { useLayoutEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { PageHeader } from '../components/ui'
import KeyFob from '../components/KeyFob'
import BookingForm from '../components/BookingForm'
import { useApi } from '../hooks'
import { flyFromRemembered } from '../motion'

/** When you arrive from a room's sheet, its key tag flies over and becomes this page's header tag. */
function RoomHeaderTag({ roomId }) {
  const { data } = useApi('/rooms')
  const room = data?.find((r) => r.room_id === roomId)
  const ref = useRef(null)
  useLayoutEffect(() => {
    if (room && ref.current) flyFromRemembered(`room-${roomId}`, ref.current)
  }, [room, roomId])
  if (!room) return <div style={{ width: 124, height: 172 }} aria-hidden="true" />
  return (
    <div className="rack px-6 pt-5 pb-6">
      <div className="relative z-[1]">
        <KeyFob ref={ref} number={room.room_number} status={room.status} size="lg" tilt label={`Booking room ${room.room_number}`} />
      </div>
    </div>
  )
}

export default function Book() {
  const [params] = useSearchParams()
  const roomId = params.get('room') ? Number(params.get('room')) : null
  return (
    <>
      <PageHeader
        title="Book a *room*"
        subtitle="Choose the dates and the party, then a room and a rate. The price follows as you go."
        figure={roomId ? <RoomHeaderTag roomId={roomId} /> : null}
      />
      <BookingForm initial={{ roomId }} />
    </>
  )
}
