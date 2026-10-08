import { motion } from 'motion/react'
import { useTransform } from 'motion/react'
import { useCountUp } from '../hooks'

export default function CountUp({ value, decimals = 0, format, className, duration = 1.5 }) {
  const { mv } = useCountUp(Number(value) || 0, { duration, decimals })
  const text = useTransform(mv, (v) => (format ? format(v) : v.toFixed(decimals)))
  return <motion.span className={className}>{text}</motion.span>
}
