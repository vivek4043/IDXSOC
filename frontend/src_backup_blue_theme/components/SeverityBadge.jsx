export default function SeverityBadge({ severity }) {
  if (!severity) return null
  const s = severity.toUpperCase()
  const classMap = {
    CRITICAL: 'badge badge-critical',
    HIGH:     'badge badge-high',
    MEDIUM:   'badge badge-medium',
    LOW:      'badge badge-low',
    INFO:     'badge badge-info',
  }
  const icons = { CRITICAL: '🔴', HIGH: '🟠', MEDIUM: '🟡', LOW: '🟢', INFO: '🔵' }
  return (
    <span className={classMap[s] || 'badge badge-info'}>
      {icons[s] || '⚪'} {s}
    </span>
  )
}
