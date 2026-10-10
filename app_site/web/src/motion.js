// motion.js: the house timing, the opening doors, and shared-element hand-offs.
// Everything here moves with transform and opacity only.

export const EASE = [0.22, 1, 0.36, 1]
export const EASE_DOOR = [0.83, 0, 0.17, 1]
const EASE_CSS = 'cubic-bezier(0.22, 1, 0.36, 1)'

export const reduceMotion = () =>
  typeof window !== 'undefined' &&
  (document.documentElement.classList.contains('reduce-motion') || window.matchMedia('(prefers-reduced-motion: reduce)').matches)

export const coarsePointer = () => typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches

// While the doors are parting, first-screen entrances wait a beat so they play in view.
let introUntil = 0
let introOffset = 0
export const introDelay = () => (typeof performance !== 'undefined' && performance.now() < introUntil ? introOffset : 0)

let opened = false
/**
 * Part the hotel doors painted by index.html. Called once the first real screen
 * (sign-in or the front desk) is mounted underneath, so there is never an empty frame.
 * On a repeat visit in the same session the doors are skipped and the small crest just fades.
 */
export function openDoors() {
  if (opened) return
  opened = true
  const boot = document.getElementById('boot')
  if (!boot) return
  try {
    sessionStorage.setItem('taj-doors', '1')
  } catch {
    /* private mode: the doors simply play again next time */
  }
  const seen = document.documentElement.classList.contains('doors-seen')
  if (seen || reduceMotion()) {
    const a = boot.animate([{ opacity: 1 }, { opacity: 0 }], { duration: seen ? 380 : 450, easing: EASE_CSS, fill: 'forwards' })
    a.onfinish = () => boot.remove()
    return
  }
  introUntil = performance.now() + 1700
  introOffset = 0.42
  const left = boot.querySelector('.boot-l')
  const right = boot.querySelector('.boot-r')
  const seam = boot.querySelector('.boot-seam')
  seam?.animate([{ opacity: 0.55 }, { opacity: 0 }], { duration: 260, fill: 'forwards' })
  const timing = { duration: 980, delay: 180, easing: 'cubic-bezier(0.83, 0, 0.17, 1)', fill: 'forwards' }
  left.animate([{ transform: 'translateX(0)' }, { transform: 'translateX(-101%)' }], timing)
  const last = right.animate([{ transform: 'translateX(0)' }, { transform: 'translateX(101%)' }], timing)
  last.onfinish = () => boot.remove()
}

// ---------------------------------------------------------------- shared elements across routes
const rects = new Map()

/** Remember where an element is on screen before navigating away from it. */
export function rememberRect(key, el) {
  if (!el) return
  rects.set(key, { rect: el.getBoundingClientRect(), at: performance.now() })
}

const easeOutExpo = (t) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t))

/**
 * Fly an element in from a remembered position. A fixed-position clone travels from the old
 * rectangle to wherever the real element is on each frame (the page underneath is still
 * settling), then hands over. Only the clone's transform changes.
 */
export function flyFromRemembered(key, el, { duration = 950, hole = '#070708' } = {}) {
  const hit = rects.get(key)
  rects.delete(key)
  if (!hit || !el || performance.now() - hit.at > 3000 || reduceMotion()) return false
  const first = el.getBoundingClientRect()
  if (!first.width || !first.height) return false
  const clone = el.cloneNode(true)
  clone.removeAttribute('id')
  clone.setAttribute('aria-hidden', 'true')
  Object.assign(clone.style, {
    position: 'fixed',
    left: '0px',
    top: '0px',
    width: `${first.width}px`,
    height: `${first.height}px`,
    margin: '0',
    zIndex: '75',
    pointerEvents: 'none',
    transformOrigin: '0 0',
    willChange: 'transform',
  })
  clone.style.setProperty('--hole', hole)
  document.body.appendChild(clone)
  el.style.visibility = 'hidden'
  const from = hit.rect
  const t0 = performance.now()
  const frame = (now) => {
    const p = Math.min(1, (now - t0) / duration)
    const e = easeOutExpo(p)
    const to = el.getBoundingClientRect()
    const x = from.left + (to.left - from.left) * e
    const y = from.top + (to.top - from.top) * e
    const sx = (from.width + (to.width - from.width) * e) / first.width
    const sy = (from.height + (to.height - from.height) * e) / first.height
    clone.style.transform = `translate(${x}px, ${y}px) scale(${sx}, ${sy})`
    if (p < 1 && el.isConnected) requestAnimationFrame(frame)
    else {
      el.style.visibility = ''
      clone.remove()
    }
  }
  requestAnimationFrame(frame)
  return true
}
