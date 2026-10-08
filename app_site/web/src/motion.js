// motion.js: the house easing. Slow, no bounce, no overshoot.
export const EASE = [0.32, 0.72, 0, 1]
export const fadeUp = {
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
  transition: { duration: 0.6, ease: EASE },
}
export const stagger = (i, step = 0.06, base = 0) => ({ duration: 0.6, ease: EASE, delay: base + i * step })
