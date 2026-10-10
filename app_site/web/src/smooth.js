// smooth.js: inertial scrolling with Lenis. Off for reduced motion and touch screens,
// where native scrolling already feels right. Modals pause it while they are open.
import Lenis from 'lenis'
import { coarsePointer, reduceMotion } from './motion'

let lenis = null
let locks = 0

export function startSmoothScroll() {
  if (lenis || reduceMotion() || coarsePointer()) return lenis
  lenis = new Lenis({ autoRaf: true, lerp: 0.085, wheelMultiplier: 0.95, smoothWheel: true })
  return lenis
}

export function stopSmoothScroll() {
  lenis?.destroy()
  lenis = null
}

export function lockScroll() {
  locks += 1
  lenis?.stop()
  document.documentElement.style.overflow = 'hidden'
}

export function unlockScroll() {
  locks = Math.max(0, locks - 1)
  if (locks === 0) {
    document.documentElement.style.overflow = ''
    lenis?.start()
  }
}

export function scrollToTop() {
  if (lenis) lenis.scrollTo(0, { immediate: true })
  else window.scrollTo(0, 0)
}
