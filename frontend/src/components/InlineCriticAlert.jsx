import { AlertTriangle } from 'lucide-react'

export default function InlineCriticAlert({ message, className = '' }) {
  if (!message) return null

  return (
    <div className={`flex items-start gap-3 p-4 rounded-xl bg-amber-500/5 border border-amber-500/10 ${className}`}>
      <AlertTriangle size={18} className="text-amber-500/70 mt-0.5 shrink-0" />
      <p className="text-sm text-amber-200/70 leading-relaxed">
        <span className="font-semibold mr-1">CRITIC NOTE:</span>
        <span>{message}</span>
      </p>
    </div>
  )
}
