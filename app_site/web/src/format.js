// format.js: rupees with Indian digit grouping, and local-date helpers.
const NBSP = ' '
const money = new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const whole = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 })

export const inr = (n) => `Rs${NBSP}${money.format(Number(n) || 0)}`
export const inrWhole = (n) => `Rs${NBSP}${whole.format(Math.round(Number(n) || 0))}`
export const num = (n) => whole.format(Number(n) || 0)

export function parseDate(s) {
  if (s instanceof Date) return s
  const [y, m, d] = String(s).slice(0, 10).split('-').map(Number)
  return new Date(y, m - 1, d)
}
export function parseDateTime(s) {
  if (s instanceof Date) return s
  const str = String(s)
  if (str.length <= 10) return parseDate(str)
  const [date, time = '00:00:00'] = str.split('T')
  const [y, m, d] = date.split('-').map(Number)
  const [hh, mm, ss] = time.split(':').map(Number)
  return new Date(y, m - 1, d, hh || 0, mm || 0, ss || 0)
}
export const toISO = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
export const today = () => {
  const n = new Date()
  return new Date(n.getFullYear(), n.getMonth(), n.getDate())
}
export const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)
export const diffDays = (a, b) => Math.round((parseDate(b) - parseDate(a)) / 86400000)

const fDay = new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
const fLong = new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
const fDate = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
const fShort = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' })
const fMonth = new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric' })
const fMonthShort = new Intl.DateTimeFormat('en-GB', { month: 'short' })
const fTime = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false })
const fWeekday = new Intl.DateTimeFormat('en-GB', { weekday: 'short' })

export const dayLabel = (s) => fDay.format(parseDate(s))
export const longDate = (s) => fLong.format(parseDate(s))
export const dateLabel = (s) => fDate.format(parseDate(s))
export const shortDate = (s) => fShort.format(parseDate(s))
export const monthLabel = (s) => fMonth.format(parseDate(s))
export const monthShort = (s) => fMonthShort.format(parseDate(s))
export const weekday = (s) => fWeekday.format(parseDate(s))
export const timeLabel = (s) => fTime.format(parseDateTime(s))
export const stampLabel = (s) => `${dateLabel(s)}, ${timeLabel(s)}`

export const plural = (n, one, many) => `${num(n)} ${Number(n) === 1 ? one : many || one + 's'}`
export const titleCase = (s) => String(s || '').replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase())
export const initials = (name) =>
  String(name || '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase()

export function greeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}
