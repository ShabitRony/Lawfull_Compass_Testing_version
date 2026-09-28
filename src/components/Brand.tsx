import { Compass } from 'lucide-react'

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className="brand" aria-label="Lawful Compass">
      <span className="brand-mark"><Compass size={21} strokeWidth={1.8} /></span>
      {!compact && <span>Lawful <strong>Compass</strong></span>}
    </div>
  )
}
