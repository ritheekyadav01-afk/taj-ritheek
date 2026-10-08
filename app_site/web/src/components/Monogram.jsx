// The Taj Ritheek crest: a double-ruled shield carrying a Bodoni "T". Drawn as the brand mark.
export default function Monogram({ size = 56, tone = 'brass', className = '' }) {
  const stroke = tone === 'brass' ? 'var(--color-brass)' : 'var(--color-ink)'
  const fill = tone === 'brass' ? 'var(--color-brass-soft)' : 'var(--color-ink)'
  return (
    <svg
      width={size}
      height={size * 1.12}
      viewBox="0 0 64 72"
      role="img"
      aria-label="Taj Ritheek crest"
      className={className}
    >
      <path
        d="M6 6 H58 V38 C58 54 46 64 32 69 C18 64 6 54 6 38 Z"
        fill="none"
        stroke={stroke}
        strokeWidth="1.6"
      />
      <path
        d="M10.5 10.5 H53.5 V38 C53.5 51 44 59.5 32 63.8 C20 59.5 10.5 51 10.5 38 Z"
        fill="none"
        stroke={stroke}
        strokeWidth="0.9"
      />
      <path d="M28 14 L32 9 L36 14" fill="none" stroke={stroke} strokeWidth="1" />
      <text
        x="32"
        y="46"
        textAnchor="middle"
        fontFamily="var(--font-display)"
        fontSize="34"
        fontWeight="700"
        fill={fill}
      >
        T
      </text>
    </svg>
  )
}
