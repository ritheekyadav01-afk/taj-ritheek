import { useSearchParams } from 'react-router-dom'
import { PageHeader } from '../components/ui'
import BookingForm from '../components/BookingForm'

export default function Book() {
  const [params] = useSearchParams()
  const roomId = params.get('room') ? Number(params.get('room')) : null
  return (
    <>
      <PageHeader
        title="Book a room"
        subtitle="Choose the dates and the party, then a room and a rate. The price follows as you go."
      />
      <BookingForm initial={{ roomId }} />
    </>
  )
}
