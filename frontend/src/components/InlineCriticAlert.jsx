import { AlertTriangle } from 'lucide-react'

export default function InlineCriticAlert({ message, className = '', attached = false }) {
  if (!message) return null
  const shellClass = attached
    ? 'flex items-start gap-3 border-t border-amber-500/20 bg-amber-500/5 px-6 py-4 rounded-b-2xl'
    : 'flex items-start gap-3 p-4 rounded-xl bg-amber-500/5 border border-amber-500/10'

  return (
    <div className={`${shellClass} ${className}`}>
      <AlertTriangle size={18} className="text-amber-500/70 mt-0.5 shrink-0" />
      <p className="text-sm text-amber-200/70 leading-relaxed">
        <span className="font-semibold mr-1">CRITIC NOTE:</span>
        <span>{message}</span>
      </p>
    </div>
  )
}
