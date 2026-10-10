// The Taj Ritheek crest: a Bodoni "T" inside a fine double silver ring.
export default function Monogram({ size = 48, className = '', title = 'Taj Ritheek crest' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 120 120" role="img" aria-label={title} className={className} style={{ color: 'var(--accent)' }}>
      <circle cx="60" cy="60" r="56" fill="none" stroke="currentColor" strokeWidth="1.4" />
      <circle cx="60" cy="60" r="50.5" fill="none" stroke="currentColor" strokeWidth="0.7" />
      <text x="60" y="80" textAnchor="middle" fontFamily="var(--font-display)" fontSize="58" fontWeight="400" fill="var(--text)">
        T
      </text>
    </svg>
  )
}
