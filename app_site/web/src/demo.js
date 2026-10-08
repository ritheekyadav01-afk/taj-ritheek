// demo.js: the Taj Ritheek API, answered in the browser (GitHub Pages build only).
//
// It mirrors app_site/api/services.py against an in-memory copy of the sample data
// (db/03_sample_data.sql), including the database's own rule messages, so a visitor
// can really book, check in, bill and pay. Nothing is stored: reloading the page
// restores the sample data. The real site (Flask + MySQL) is unaffected by this file.
import { ApiError } from './errors'

const TAX = 0.05
const pad = (n) => String(n).padStart(2, '0')
const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const parse = (s) => {
  const [y, m, d] = String(s).slice(0, 10).split('-').map(Number)
  return new Date(y, m - 1, d)
}
const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)
const diff = (a, b) => Math.round((parse(b) - parse(a)) / 86400000)
const todayD = () => {
  const n = new Date()
  return new Date(n.getFullYear(), n.getMonth(), n.getDate())
}
const T = (n) => iso(addDays(todayD(), n))
const stamp = (d = new Date()) =>
  `${iso(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
const stampAt = (dayOffset, h, m = 0) => `${T(dayOffset)}T${pad(h)}:${pad(m)}:00`
const cents = (n) => Math.round(Number(n) * 100) / 100

function fail(status, rule, message) {
  throw new ApiError(status, { error: rule, message })
}

// ------------------------------------------------------------ the sample data
let db
function seed() {
  db = {
    types: [
      { type_id: 1, type_name: 'Standard', capacity: 2, description: 'Queen bed, city view' },
      { type_id: 2, type_name: 'Deluxe', capacity: 3, description: 'King bed, balcony' },
      { type_id: 3, type_name: 'Suite', capacity: 4, description: 'Separate living area, premium amenities' },
    ],
    rooms: [
      { room_id: 1, room_number: '101', type_id: 1, status: 'available' },
      { room_id: 2, room_number: '102', type_id: 1, status: 'available' },
      { room_id: 3, room_number: '103', type_id: 1, status: 'occupied' },
      { room_id: 4, room_number: '201', type_id: 2, status: 'available' },
      { room_id: 5, room_number: '202', type_id: 2, status: 'occupied' },
      { room_id: 6, room_number: '301', type_id: 3, status: 'available' },
      { room_id: 7, room_number: '302', type_id: 3, status: 'maintenance' },
    ],
    plans: [
      { rate_plan_id: 1, type_id: 1, plan_name: 'Standard - Flexible', nightly_rate: 2500, description: 'Free cancellation up to 24h' },
      { rate_plan_id: 2, type_id: 1, plan_name: 'Standard - Saver', nightly_rate: 2100, description: 'Non-refundable' },
      { rate_plan_id: 3, type_id: 2, plan_name: 'Deluxe - Flexible', nightly_rate: 4200, description: 'Free cancellation up to 24h' },
      { rate_plan_id: 4, type_id: 3, plan_name: 'Suite - Flexible', nightly_rate: 7500, description: 'Free cancellation up to 24h' },
      { rate_plan_id: 5, type_id: 3, plan_name: 'Suite - Breakfast Included', nightly_rate: 8200, description: 'Includes breakfast for all guests' },
    ],
    staff: [
      { staff_id: 1, full_name: 'Lakshmi Devi', role: 'Housekeeping Supervisor' },
      { staff_id: 2, full_name: 'Ravi Kumar', role: 'Housekeeping Staff' },
      { staff_id: 3, full_name: 'Anita Rao', role: 'Room Service Staff' },
    ],
    guests: [
      { guest_id: 1, full_name: 'Arjun Mehta', email: 'arjun.mehta@example.com', phone: '9876500001' },
      { guest_id: 2, full_name: 'Priya Sharma', email: 'priya.sharma@example.com', phone: '9876500002' },
      { guest_id: 3, full_name: 'Karthik Iyer', email: 'karthik.iyer@example.com', phone: '9876500003' },
      { guest_id: 4, full_name: 'Sneha Reddy', email: 'sneha.reddy@example.com', phone: '9876500004' },
      { guest_id: 5, full_name: 'Farhan Ali', email: 'farhan.ali@example.com', phone: '9876500005' },
    ],
    reservations: [
      { id: 1, guest_id: 1, room_id: 3, rate_plan_id: 1, status: 'checked_in', ci: T(-3), co: T(1), adults: 2, children: 0 },
      { id: 2, guest_id: 2, room_id: 4, rate_plan_id: 3, status: 'booked', ci: T(2), co: T(5), adults: 2, children: 1 },
      { id: 3, guest_id: 3, room_id: 1, rate_plan_id: 2, status: 'completed', ci: T(-68), co: T(-66), adults: 1, children: 0 },
      { id: 4, guest_id: 4, room_id: 6, rate_plan_id: 4, status: 'booked', ci: T(7), co: T(10), adults: 3, children: 1 },
      { id: 5, guest_id: 5, room_id: 2, rate_plan_id: 1, status: 'cancelled', ci: T(-13), co: T(-11), adults: 2, children: 0 },
      { id: 6, guest_id: 2, room_id: 5, rate_plan_id: 3, status: 'checked_in', ci: T(-2), co: T(3), adults: 2, children: 0 },
    ],
    stays: [
      { stay_id: 1, reservation_id: 1, check_in: stampAt(-3, 14, 5), check_out: null },
      { stay_id: 2, reservation_id: 3, check_in: stampAt(-68, 13, 40), check_out: stampAt(-66, 11, 15) },
      { stay_id: 3, reservation_id: 6, check_in: stampAt(-2, 15, 20), check_out: null },
    ],
    tasks: [
      { task_id: 1, room_id: 3, stay_id: 1, task_type: 'Daily cleaning', assigned_to: 2, task_status: 'done', scheduled_at: stampAt(-2, 10), completed_at: stampAt(-2, 10, 30) },
      { task_id: 2, room_id: 1, stay_id: null, task_type: 'Post-checkout cleaning', assigned_to: 2, task_status: 'pending', scheduled_at: stampAt(-1, 9), completed_at: null },
      { task_id: 3, room_id: 7, stay_id: null, task_type: 'Maintenance check', assigned_to: 1, task_status: 'in_progress', scheduled_at: stampAt(-1, 8), completed_at: null },
    ],
    requests: [
      { id: 1, stay_id: 1, service_name: 'Room Service - Breakfast', status: 'fulfilled', requested_at: stampAt(-2, 8, 15) },
      { id: 2, stay_id: 1, service_name: 'Extra Towels', status: 'fulfilled', requested_at: stampAt(-2, 17, 40) },
      { id: 3, stay_id: 2, service_name: 'Spa Booking', status: 'fulfilled', requested_at: stampAt(-67, 16, 5) },
    ],
    charges: [
      { charge_id: 1, stay_id: 1, service_request_id: 1, description: 'Breakfast for 2', amount: 600, charged_at: stampAt(-2, 8, 20) },
      { charge_id: 2, stay_id: 1, service_request_id: 2, description: 'Extra towels', amount: 0, charged_at: stampAt(-2, 17, 45) },
      { charge_id: 3, stay_id: 2, service_request_id: 3, description: 'Spa session (60 min)', amount: 2200, charged_at: stampAt(-67, 16, 10) },
    ],
    invoices: [{ invoice_id: 1, stay_id: 2, invoice_date: T(-66), subtotal: 4200, tax: 210, total: 4410, status: 'paid' }],
    payments: [{ payment_id: 1, invoice_id: 1, payment_date: stampAt(-66, 11, 30), amount: 4410, payment_method: 'card', payment_status: 'success' }],
    next: { guest: 6, res: 7, stay: 4, task: 4, req: 4, charge: 4, inv: 2, pay: 2 },
  }
}
seed()

// ------------------------------------------------------------ lookups
const room = (id) => db.rooms.find((r) => r.room_id === id)
const rtype = (id) => db.types.find((t) => t.type_id === id)
const plan = (id) => db.plans.find((p) => p.rate_plan_id === id)
const guest = (id) => db.guests.find((g) => g.guest_id === id)
const resv = (id) => db.reservations.find((r) => r.id === id)
const stayOf = (resId) => db.stays.find((s) => s.reservation_id === resId)
const stay = (id) => db.stays.find((s) => s.stay_id === id)
const typeOfRoom = (r) => rtype(room(r).type_id)
const byRoomNumber = (a, b) => a.room_number.localeCompare(b.room_number)
const paidOn = (invId) =>
  cents(db.payments.filter((p) => p.invoice_id === invId && p.payment_status === 'success').reduce((s, p) => s + p.amount, 0))
const servicesOn = (stayId) => cents(db.charges.filter((c) => c.stay_id === stayId).reduce((s, c) => s + c.amount, 0))
const live = (r) => r.status !== 'cancelled' && r.status !== 'no_show'

function validDate(v, label) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(v || '')) || Number.isNaN(parse(v).getTime())) {
    fail(422, 'dates', `Please give a valid ${label} (YYYY-MM-DD).`)
  }
  return String(v)
}
function whole(v, label, min) {
  const n = Number(v)
  if (!Number.isInteger(n)) fail(422, 'invalid', `Please give a whole number for ${label}.`)
  if (min != null && n < min) fail(422, 'invalid', `${label[0].toUpperCase()}${label.slice(1)} must be at least ${min}.`)
  return n
}
function text(v, label, max, required = true) {
  const s = String(v ?? '').trim()
  if (required && !s) fail(422, 'required', `${label[0].toUpperCase()}${label.slice(1)} is required.`)
  if (s.length > max) fail(422, 'invalid', `${label[0].toUpperCase()}${label.slice(1)} is too long (max ${max} characters).`)
  return s
}

// ------------------------------------------------------------ views
function boardRow(r) {
  const t = rtype(r.type_id)
  const res = db.reservations.find((x) => x.room_id === r.room_id && x.status === 'checked_in' && stayOf(x.id) && !stayOf(x.id).check_out)
  const st = res ? stayOf(res.id) : null
  const next = db.reservations
    .filter((x) => x.room_id === r.room_id && x.status === 'booked' && x.ci >= T(0))
    .map((x) => x.ci)
    .sort()[0]
  return {
    room_id: r.room_id, room_number: r.room_number, type_id: t.type_id, type_name: t.type_name, capacity: t.capacity,
    status: r.status, guest_name: res ? guest(res.guest_id).full_name : null, stay_id: st ? st.stay_id : null,
    next_arrival: next || null,
  }
}

const openStays = () => db.stays.filter((s) => !s.check_out)

function dashboard() {
  const occupied = db.reservations.filter((r) => r.status === 'checked_in').length
  const total = db.rooms.length
  const vacant = db.rooms.filter((r) => r.status === 'available' && !db.reservations.some((x) => x.room_id === r.room_id && x.status === 'checked_in')).length
  const inHouse = openStays().reduce((s, st) => {
    const r = resv(st.reservation_id)
    return s + r.adults + r.children
  }, 0)
  const arrivals7 = db.reservations.filter((r) => r.status === 'booked' && r.ci >= T(0) && r.ci <= T(7)).length
  const collected = cents(db.payments.filter((p) => p.payment_status === 'success').reduce((s, p) => s + p.amount, 0))
  const billed = cents(db.invoices.reduce((s, i) => s + i.total, 0))
  const arrivals = db.reservations
    .filter((r) => r.status === 'booked' && r.ci >= T(0))
    .sort((a, b) => a.ci.localeCompare(b.ci))
    .slice(0, 8)
    .map((r) => ({
      reservation_id: r.id, guest: guest(r.guest_id).full_name, room: room(r.room_id).room_number,
      arrives: r.ci, departs: r.co, adults: r.adults, children: r.children,
    }))
  const dueOut = openStays()
    .map((st) => {
      const r = resv(st.reservation_id)
      return { room_id: r.room_id, room: room(r.room_id).room_number, guest: guest(r.guest_id).full_name, departs: r.co, stay_id: st.stay_id }
    })
    .sort((a, b) => a.departs.localeCompare(b.departs))
  return {
    stats: {
      in_house_guests: inHouse, arrivals_7d: arrivals7, open_tasks: db.tasks.filter((t) => t.task_status !== 'done').length,
      collected, balance_due: cents(billed - collected), occupied_rooms: occupied, total_rooms: total,
      occupancy_pct: Math.round((occupied * 10000) / total) / 100, vacant_rooms: vacant,
    },
    board: [...db.rooms].sort(byRoomNumber).map(boardRow),
    arrivals,
    due_out: dueOut,
  }
}

function timeline(q) {
  const start = validDate(q.get('start') || T(-7), 'start date')
  const end = validDate(q.get('end') || T(45), 'end date')
  if (end <= start) fail(422, 'dates', 'The timeline range must end after it starts.')
  const rooms = [...db.rooms].sort(byRoomNumber).map((r) => ({
    room_id: r.room_id, room_number: r.room_number, type_name: rtype(r.type_id).type_name, capacity: rtype(r.type_id).capacity, status: r.status,
  }))
  const bars = db.reservations
    .filter((r) => live(r) && start < r.co && end > r.ci)
    .sort((a, b) => a.ci.localeCompare(b.ci))
    .map((r) => ({
      id: r.id, room_id: r.room_id, guest_id: r.guest_id, guest: guest(r.guest_id).full_name, check_in: r.ci, check_out: r.co,
      status: r.status, adults: r.adults, children: r.children, plan_name: plan(r.rate_plan_id).plan_name,
      nightly_rate: plan(r.rate_plan_id).nightly_rate, stay_id: stayOf(r.id) ? stayOf(r.id).stay_id : null,
    }))
  return { start, end, rooms, bars }
}

function availability(q) {
  const ci = validDate(q.get('check_in'), 'check-in date')
  const co = validDate(q.get('check_out'), 'check-out date')
  if (co <= ci) fail(422, 'dates', 'Check-out must be after check-in.')
  const party = whole(q.get('adults') ?? 1, 'adults', 1) + whole(q.get('children') ?? 0, 'children', 0)
  const nights = diff(ci, co)
  return db.rooms
    .filter((r) => r.status !== 'maintenance')
    .map((r) => {
      const t = rtype(r.type_id)
      return {
        room_id: r.room_id, room_number: r.room_number, type_id: t.type_id, type_name: t.type_name, capacity: t.capacity,
        description: t.description, status: r.status,
        booked: db.reservations.some((x) => x.room_id === r.room_id && live(x) && ci < x.co && co > x.ci),
        over_capacity: party > t.capacity,
        plans: db.plans.filter((p) => p.type_id === t.type_id).sort((a, b) => a.nightly_rate - b.nightly_rate),
        nights,
      }
    })
    .sort((a, b) => a.capacity - b.capacity || a.room_number.localeCompare(b.room_number))
}

function reservationRow(r) {
  const rm = room(r.room_id)
  return {
    id: r.id, guest_id: r.guest_id, guest: guest(r.guest_id).full_name, room: rm.room_number, room_id: rm.room_id,
    room_type: rtype(rm.type_id).type_name, rate_plan: plan(r.rate_plan_id).plan_name, nightly_rate: plan(r.rate_plan_id).nightly_rate,
    check_in: r.ci, check_out: r.co, nights: diff(r.ci, r.co), adults: r.adults, children: r.children, status: r.status,
  }
}

function createReservation(b) {
  const ci = validDate(b.check_in, 'check-in date')
  const co = validDate(b.check_out, 'check-out date')
  const adults = whole(b.adults ?? 1, 'adults', 1)
  const children = whole(b.children ?? 0, 'children', 0)
  const roomId = whole(b.room_id, 'room')
  const planId = whole(b.rate_plan_id, 'rate plan')
  let gid
  let newGuest = null
  if (b.new_guest && typeof b.new_guest === 'object') {
    newGuest = {
      full_name: text(b.new_guest.full_name, 'guest name', 100),
      email: text(b.new_guest.email, 'email', 100),
      phone: text(b.new_guest.phone, 'phone', 20, false) || null,
    }
  } else if (b.guest_id) gid = whole(b.guest_id, 'guest')
  else fail(422, 'required', 'Choose an existing guest or enter a new one.')
  const rm = room(roomId)
  const pl = plan(planId)
  if (!rm || !pl) fail(422, 'reference', "A referenced record doesn't exist. Check the selection and try again.")
  if (gid && !guest(gid)) fail(422, 'reference', "A referenced record doesn't exist. Check the selection and try again.")
  if (newGuest && db.guests.some((g) => g.email.toLowerCase() === newGuest.email.toLowerCase())) {
    fail(409, 'unique', 'That value must be unique and already exists (for example, an email address already in use).')
  }
  // the three triggers run first, in order, then the CHECK constraints
  if (db.reservations.some((x) => x.room_id === roomId && live(x) && ci < x.co && co > x.ci)) {
    fail(409, 'overlap', 'Room is already booked for an overlapping date range.')
  }
  if (adults + children > rtype(rm.type_id).capacity) fail(409, 'capacity', 'Occupant count exceeds room type capacity.')
  if (pl.type_id !== rm.type_id) fail(409, 'rate_plan', 'Rate plan does not belong to this room type.')
  if (co <= ci) fail(422, 'dates', 'Check-out must be after check-in.')
  // all checks passed: the guest and the reservation are kept together
  if (newGuest) {
    gid = db.next.guest++
    db.guests.push({ guest_id: gid, ...newGuest })
  }
  const id = db.next.res++
  db.reservations.push({ id, guest_id: gid, room_id: roomId, rate_plan_id: planId, status: 'booked', ci, co, adults, children })
  return { reservation_id: id, guest_id: gid }
}

function checkIn(id) {
  const r = resv(id)
  if (!r) fail(404, 'not_found', 'Reservation not found.')
  if (r.status !== 'booked') fail(409, 'state', `Only booked reservations can be checked in (this one is ${r.status.replace('_', ' ')}).`)
  const rm = room(r.room_id)
  if (['occupied', 'maintenance', 'cleaning'].includes(rm.status)) {
    fail(409, 'room_state', `The room is ${rm.status} right now, so the guest can't be checked in yet.`)
  }
  const stay_id = db.next.stay++
  db.stays.push({ stay_id, reservation_id: id, check_in: stamp(), check_out: null })
  r.status = 'checked_in'
  rm.status = 'occupied'
  return { stay_id }
}

function cancel(id) {
  const r = resv(id)
  if (!r) fail(404, 'not_found', 'Reservation not found.')
  if (r.status !== 'booked') fail(409, 'state', `Only booked reservations can be cancelled (this one is ${r.status.replace('_', ' ')}).`)
  r.status = 'cancelled'
  return { ok: true }
}

function inHouse() {
  return openStays()
    .map((st) => {
      const r = resv(st.reservation_id)
      const rm = room(r.room_id)
      const pl = plan(r.rate_plan_id)
      return {
        stay_id: st.stay_id, reservation_id: r.id, guest_id: r.guest_id, guest: guest(r.guest_id).full_name, room_id: rm.room_id,
        room: rm.room_number, room_type: rtype(rm.type_id).type_name, actual_check_in: st.check_in, planned_check_out: r.co,
        plan_name: pl.plan_name, nightly_rate: pl.nightly_rate, adults: r.adults, children: r.children,
        nights: Math.max(diff(st.check_in, T(0)), 1), services: servicesOn(st.stay_id),
      }
    })
    .sort(byRoomNumber2)
}
function byRoomNumber2(a, b) {
  return a.room.localeCompare(b.room)
}

function lines(stayId) {
  return db.charges.filter((c) => c.stay_id === stayId).map((c) => ({ charge_id: c.charge_id, description: c.description, amount: c.amount, charged_at: c.charged_at }))
}

function quote(stayId) {
  const st = stay(stayId)
  if (!st || st.check_out) fail(404, 'not_found', 'This stay was not found or has already been checked out.')
  const r = resv(st.reservation_id)
  const pl = plan(r.rate_plan_id)
  const nights = Math.max(diff(st.check_in, T(0)), 1)
  const room_charge = cents(pl.nightly_rate * nights)
  const services = servicesOn(stayId)
  const subtotal = cents(room_charge + services)
  const tax = cents(subtotal * TAX)
  return { stay_id: stayId, nights, rate: pl.nightly_rate, room_charge, services, subtotal, tax, total: cents(subtotal + tax), lines: lines(stayId) }
}

function checkOut(stayId) {
  const q = quote(stayId)
  const st = stay(stayId)
  const r = resv(st.reservation_id)
  const inv = { invoice_id: db.next.inv++, stay_id: stayId, invoice_date: T(0), subtotal: q.subtotal, tax: q.tax, total: q.total, status: 'open' }
  st.check_out = stamp(new Date(Math.max(Date.now(), parseStamp(st.check_in) + 1000)))
  db.invoices.push(inv)
  r.status = 'completed'
  room(r.room_id).status = 'cleaning'
  return { ...q, invoice_id: inv.invoice_id }
}
function parseStamp(s) {
  const [d, t] = s.split('T')
  const [y, m, dd] = d.split('-').map(Number)
  const [h, mi, se] = t.split(':').map(Number)
  return new Date(y, m - 1, dd, h, mi, se).getTime()
}

function invoiceRows() {
  return [...db.invoices]
    .sort((a, b) => b.invoice_id - a.invoice_id)
    .map((i) => {
      const st = stay(i.stay_id)
      const r = resv(st.reservation_id)
      return {
        invoice_id: i.invoice_id, stay_id: i.stay_id, guest: guest(r.guest_id).full_name, room: room(r.room_id).room_number,
        invoice_date: i.invoice_date, subtotal: i.subtotal, tax: i.tax, total: i.total, paid: paidOn(i.invoice_id), status: i.status,
      }
    })
}

function invoiceDetail(id) {
  const i = db.invoices.find((x) => x.invoice_id === id)
  if (!i) fail(404, 'not_found', 'Invoice not found.')
  const st = stay(i.stay_id)
  const r = resv(st.reservation_id)
  const g = guest(r.guest_id)
  const rm = room(r.room_id)
  const pl = plan(r.rate_plan_id)
  const ln = lines(i.stay_id)
  const payments = db.payments
    .filter((p) => p.invoice_id === id)
    .map((p) => ({ payment_id: p.payment_id, payment_date: p.payment_date, amount: p.amount, payment_method: p.payment_method, payment_status: p.payment_status }))
  const paid = paidOn(id)
  return {
    invoice_id: i.invoice_id, stay_id: i.stay_id, invoice_date: i.invoice_date, subtotal: i.subtotal, tax: i.tax, total: i.total,
    status: i.status, guest_id: g.guest_id, guest: g.full_name, email: g.email, room: rm.room_number, room_type: rtype(rm.type_id).type_name,
    plan_name: pl.plan_name, nightly_rate: pl.nightly_rate, actual_check_in: st.check_in, actual_check_out: st.check_out,
    adults: r.adults, children: r.children, room_charge: cents(i.subtotal - servicesOn(i.stay_id)), lines: ln, payments, paid,
    balance: cents(i.total - paid),
  }
}

function pay(id, b) {
  const i = db.invoices.find((x) => x.invoice_id === id)
  const amount = cents(b.amount)
  if (!Number.isFinite(amount) || String(b.amount ?? '').trim() === '') fail(422, 'amount', 'Please give a valid amount.')
  if (amount <= 0) fail(422, 'amount', 'A payment must be more than zero.')
  if (!['cash', 'card', 'upi', 'netbanking'].includes(b.method)) fail(422, 'method', 'Choose a payment method: cash, card, UPI or net banking.')
  if (!i) fail(404, 'not_found', 'Invoice not found.')
  if (cents(paidOn(id) + amount) > i.total) fail(409, 'overpayment', 'Payment would exceed the invoice total.')
  db.payments.push({
    payment_id: db.next.pay++, invoice_id: id, payment_date: stamp(), amount, payment_method: b.method, payment_status: 'success',
  })
  i.status = paidOn(id) >= i.total ? 'paid' : 'partially_paid'
  return invoiceDetail(id)
}

function logService(b) {
  const stayId = whole(b.stay_id, 'stay')
  const name = text(b.service_name, 'service name', 100)
  const st = stay(stayId)
  if (!st) fail(422, 'reference', "A referenced record doesn't exist. Check the selection and try again.")
  const hasCharge = b.amount !== undefined && b.amount !== null && String(b.amount).trim() !== ''
  let amount = 0
  let desc = ''
  if (hasCharge) {
    amount = cents(b.amount)
    if (!Number.isFinite(amount)) fail(422, 'amount', 'Please give a valid charge amount.')
    desc = text(b.charge_description || name, 'charge description', 255)
    if (amount < 0) fail(422, 'amount', "A charge can't be negative.")   // the request is rolled back with it
  }
  const id = db.next.req++
  db.requests.push({ id, stay_id: stayId, service_name: name, status: hasCharge ? 'fulfilled' : 'requested', requested_at: stamp() })
  if (hasCharge) db.charges.push({ charge_id: db.next.charge++, stay_id: stayId, service_request_id: id, description: desc, amount, charged_at: stamp() })
  return { service_request_id: id, charged: hasCharge }
}

function serviceLog() {
  return [...db.requests]
    .sort((a, b) => b.requested_at.localeCompare(a.requested_at) || b.id - a.id)
    .slice(0, 40)
    .map((q) => {
      const st = stay(q.stay_id)
      const r = resv(st.reservation_id)
      return {
        id: q.id, room: room(r.room_id).room_number, guest: guest(r.guest_id).full_name, service: q.service_name, status: q.status,
        requested: q.requested_at, charged: cents(db.charges.filter((c) => c.service_request_id === q.id).reduce((s, c) => s + c.amount, 0)),
      }
    })
}

function hkTasks() {
  return [...db.tasks]
    .sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at) || a.task_id - b.task_id)
    .map((t) => {
      const rm = room(t.room_id)
      const sf = db.staff.find((s) => s.staff_id === t.assigned_to)
      return {
        task_id: t.task_id, room_id: t.room_id, room_number: rm.room_number, room_status: rm.status, task_type: t.task_type,
        assigned_to: t.assigned_to, assigned_staff: sf ? sf.full_name : null, task_status: t.task_status,
        scheduled_at: t.scheduled_at, completed_at: t.completed_at,
      }
    })
}

function setTask(id, status) {
  const t = db.tasks.find((x) => x.task_id === id)
  if (!['pending', 'in_progress', 'done'].includes(status)) fail(422, 'invalid', 'Task status must be pending, in_progress or done.')
  if (!t) fail(404, 'not_found', 'Task not found.')
  if (t.task_status === status) return { task_id: id, status }
  t.task_status = status
  if (status === 'done') {
    t.completed_at = stamp()
    const rm = room(t.room_id)
    if (rm.status === 'cleaning') rm.status = 'available'
  } else t.completed_at = null
  return { task_id: id, status }
}

function guestRows(q) {
  const needle = (q.get('q') || '').toLowerCase()
  return db.guests
    .filter((g) => !needle || [g.full_name, g.email, g.phone || ''].some((v) => v.toLowerCase().includes(needle)))
    .sort((a, b) => a.full_name.localeCompare(b.full_name))
    .map((g) => ({
      ...g,
      reservations: db.reservations.filter((r) => r.guest_id === g.guest_id).length,
      stays: db.reservations.filter((r) => r.guest_id === g.guest_id && stayOf(r.id)).length,
    }))
}

function guestFields(b) {
  const full_name = text(b.full_name, 'name', 100)
  const email = text(b.email, 'email', 100)
  if (!email.includes('@') || !email.split('@').pop().includes('.')) fail(422, 'email', 'Please give a valid email address.')
  return { full_name, email, phone: text(b.phone, 'phone', 20, false) || null }
}
const emailTaken = (email, exceptId) =>
  db.guests.some((g) => g.guest_id !== exceptId && g.email.toLowerCase() === email.toLowerCase())
const UNIQUE = 'That value must be unique and already exists (for example, an email address already in use).'

function guestStays(id) {
  return db.reservations
    .filter((r) => r.guest_id === id)
    .sort((a, b) => b.ci.localeCompare(a.ci))
    .map((r) => {
      const st = stayOf(r.id)
      const inv = st ? db.invoices.find((i) => i.stay_id === st.stay_id) : null
      return {
        reservation_id: r.id, room_number: room(r.room_id).room_number, room_type: typeOfRoom(r.room_id).type_name, status: r.status,
        planned_check_in: r.ci, planned_check_out: r.co, actual_check_in: st ? st.check_in : null, actual_check_out: st ? st.check_out : null,
        service_spend: st ? servicesOn(st.stay_id) : 0, invoice_total: inv ? inv.total : 0,
      }
    })
}

function reports() {
  const checkedIn = db.reservations.filter((r) => r.status === 'checked_in').length
  const months = {}
  db.payments
    .filter((p) => p.payment_status === 'success')
    .forEach((p) => {
      const m = p.payment_date.slice(0, 7)
      months[m] = cents((months[m] || 0) + p.amount)
    })
  const svc = {}
  db.charges.forEach((c) => {
    svc[c.stay_id] = cents((svc[c.stay_id] || 0) + c.amount)
  })
  const stayGuest = (stayId) => guest(resv(stay(stayId).reservation_id).guest_id)
  return {
    current_occupancy: openStays().map((st) => {
      const r = resv(st.reservation_id)
      const rm = room(r.room_id)
      return {
        room_id: rm.room_id, room_number: rm.room_number, type_name: rtype(rm.type_id).type_name, guest_name: guest(r.guest_id).full_name,
        actual_check_in: st.check_in, planned_check_out: r.co,
      }
    }),
    vacant_rooms: db.rooms
      .filter((r) => r.status === 'available' && !db.reservations.some((x) => x.room_id === r.room_id && x.status === 'checked_in'))
      .map((r) => ({ room_id: r.room_id, room_number: r.room_number, type_name: rtype(r.type_id).type_name, capacity: rtype(r.type_id).capacity })),
    cancellations: db.reservations
      .filter((r) => !live(r))
      .map((r) => ({
        reservation_id: r.id, guest_name: guest(r.guest_id).full_name, room_number: room(r.room_id).room_number,
        planned_check_in: r.ci, planned_check_out: r.co, reservation_status: r.status,
      })),
    housekeeping_status: hkTasks().map((t) => ({
      task_id: t.task_id, room_number: t.room_number, task_type: t.task_type, assigned_staff: t.assigned_staff,
      task_status: t.task_status, scheduled_at: t.scheduled_at, completed_at: t.completed_at,
    })),
    guest_history: db.stays
      .map((st) => {
        const r = resv(st.reservation_id)
        const inv = db.invoices.find((i) => i.stay_id === st.stay_id)
        return {
          guest_id: r.guest_id, full_name: guest(r.guest_id).full_name, reservation_id: r.id, room_number: room(r.room_id).room_number,
          actual_check_in: st.check_in, actual_check_out: st.check_out, service_spend: servicesOn(st.stay_id), invoice_total: inv ? inv.total : 0,
        }
      })
      .sort((a, b) => b.actual_check_in.localeCompare(a.actual_check_in)),
    service_revenue: Object.keys(svc).map((sid) => ({
      stay_id: Number(sid), guest_name: stayGuest(Number(sid)).full_name, total_service_revenue: svc[sid],
    })),
    total_revenue: Object.keys(months).sort().map((m) => ({ month: m, revenue_collected: months[m] })),
    occupancy_rate: {
      occupied_rooms: checkedIn, total_rooms: db.rooms.length, occupancy_pct: Math.round((checkedIn * 10000) / db.rooms.length) / 100,
    },
  }
}

function searchAll(q) {
  const s = (q.get('q') || '').trim().toLowerCase()
  if (!s) return { guests: [], rooms: [] }
  return {
    guests: db.guests
      .filter((g) => g.full_name.toLowerCase().includes(s) || g.email.toLowerCase().includes(s))
      .sort((a, b) => a.full_name.localeCompare(b.full_name))
      .slice(0, 6)
      .map((g) => ({ guest_id: g.guest_id, full_name: g.full_name, email: g.email })),
    rooms: db.rooms
      .filter((r) => r.room_number.toLowerCase().includes(s) || rtype(r.type_id).type_name.toLowerCase().includes(s))
      .sort(byRoomNumber)
      .slice(0, 6)
      .map((r) => ({ room_id: r.room_id, room_number: r.room_number, status: r.status, type_name: rtype(r.type_id).type_name })),
  }
}

// ------------------------------------------------------------ router
export async function demoRequest(path, method = 'GET', body) {
  await new Promise((res) => setTimeout(res, 90 + Math.random() * 110)) // a realistic round trip
  const url = new URL(path, 'http://demo.local')
  const q = url.searchParams
  const parts = url.pathname.replace(/^\/+|\/+$/g, '').split('/')
  const [a, b, c] = parts
  const id = (v) => Number(v)
  const json = (v) => JSON.parse(JSON.stringify(v))
  const m = method.toUpperCase()
  const need = () => {
    if (!body || typeof body !== 'object') fail(422, 'invalid', 'Send the details as a JSON object.')
    return body
  }

  if (m === 'GET') {
    if (a === 'health') return { ok: true }
    if (a === 'session') return { auth_required: false, authenticated: true }
    if (a === 'dashboard') return json(dashboard())
    if (a === 'rooms') return json([...db.rooms].sort(byRoomNumber).map((r) => ({ room_id: r.room_id, room_number: r.room_number, status: r.status, type_name: rtype(r.type_id).type_name, capacity: rtype(r.type_id).capacity })))
    if (a === 'room-types') return json({ types: db.types, plans: db.plans })
    if (a === 'timeline') return json(timeline(q))
    if (a === 'availability') return json(availability(q))
    if (a === 'reservations') {
      const st = q.get('status')
      if (st && !['booked', 'checked_in', 'completed', 'cancelled', 'no_show'].includes(st)) fail(422, 'invalid', 'Unknown reservation status.')
      const needle = (q.get('q') || '').toLowerCase()
      return json(
        db.reservations
          .map(reservationRow)
          .filter((r) => (!st || r.status === st) && (!needle || r.guest.toLowerCase().includes(needle) || r.room.toLowerCase().includes(needle)))
          .sort((x, y) => y.check_in.localeCompare(x.check_in) || y.id - x.id),
      )
    }
    if (a === 'stays' && b === 'in-house') return json(inHouse())
    if (a === 'stays' && c === 'quote') return json(quote(id(b)))
    if (a === 'invoices' && !b) return json(invoiceRows())
    if (a === 'invoices') return json(invoiceDetail(id(b)))
    if (a === 'services') return json(serviceLog())
    if (a === 'housekeeping') {
      const awaiting = db.rooms
        .filter((r) => r.status === 'cleaning' && !db.tasks.some((t) => t.room_id === r.room_id && t.task_status !== 'done'))
        .sort(byRoomNumber)
        .map((r) => ({ room_id: r.room_id, room_number: r.room_number }))
      return json({ tasks: hkTasks(), staff: [...db.staff].sort((x, y) => x.full_name.localeCompare(y.full_name)), awaiting })
    }
    if (a === 'guests' && c === 'stays') return json(guestStays(id(b)))
    if (a === 'guests') return json(guestRows(q))
    if (a === 'reports') return json(reports())
    if (a === 'search') return json(searchAll(q))
  }
  if (m === 'POST') {
    if (a === 'reservations' && !b) return json(createReservation(need()))
    if (a === 'reservations' && c === 'check-in') return json(checkIn(id(b)))
    if (a === 'reservations' && c === 'cancel') return json(cancel(id(b)))
    if (a === 'stays' && c === 'check-out') return json(checkOut(id(b)))
    if (a === 'invoices' && c === 'payments') return json(pay(id(b), need()))
    if (a === 'services') return json(logService(need()))
    if (a === 'housekeeping') {
      const d = need()
      const roomId = whole(d.room_id, 'room')
      if (!room(roomId)) fail(422, 'reference', "A referenced record doesn't exist. Check the selection and try again.")
      const task_id = db.next.task++
      db.tasks.push({
        task_id, room_id: roomId, stay_id: null, task_type: text(d.task_type, 'task type', 50),
        assigned_to: d.staff_id ? whole(d.staff_id, 'staff member') : null, task_status: 'pending', scheduled_at: stamp(), completed_at: null,
      })
      return { task_id }
    }
    if (a === 'guests') {
      const f = guestFields(need())
      if (emailTaken(f.email)) fail(409, 'unique', UNIQUE)
      const guest_id = db.next.guest++
      db.guests.push({ guest_id, ...f })
      return { guest_id }
    }
  }
  if (m === 'PUT' && a === 'guests') {
    const f = guestFields(need())
    if (!guest(id(b))) fail(404, 'not_found', 'Guest not found.')
    if (emailTaken(f.email, id(b))) fail(409, 'unique', UNIQUE)
    Object.assign(guest(id(b)), f)
    return { ok: true }
  }
  if (m === 'DELETE' && a === 'guests') {
    const n = db.reservations.filter((r) => r.guest_id === id(b)).length
    if (n) {
      fail(409, 'referenced', `This guest has ${n} reservation${n !== 1 ? 's' : ''} on record, so they can't be deleted. Their history must stay for the hotel's accounts.`)
    }
    if (!guest(id(b))) fail(404, 'not_found', 'Guest not found.')
    db.guests = db.guests.filter((g) => g.guest_id !== id(b))
    return { ok: true }
  }
  if (m === 'PATCH' && a === 'housekeeping') return json(setTask(id(b), need().status))
  fail(404, 'not_found', 'That page or record does not exist.')
}
