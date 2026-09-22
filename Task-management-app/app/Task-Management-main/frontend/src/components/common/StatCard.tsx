import type { ReactNode } from 'react'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'

export function StatCard({
  label,
  value,
  hint,
  icon,
  tone = 'neutral',
}: {
  label: string
  value: string | number
  hint?: string
  icon?: ReactNode
  tone?: 'neutral' | 'success' | 'warning' | 'error' | 'info'
}) {
  const tones = {
    neutral: 'text-slate-700 bg-slate-100',
    success: 'text-emerald-700 bg-emerald-100',
    warning: 'text-amber-700 bg-amber-100',
    error: 'text-red-700 bg-red-100',
    info: 'text-sky-700 bg-sky-100',
  }
  const accents = {
    neutral: 'from-slate-50 to-indigo-50/30',
    success: 'from-emerald-50 to-emerald-100/40',
    warning: 'from-amber-50 to-amber-100/40',
    error: 'from-red-50 to-red-100/40',
    info: 'from-indigo-50 to-indigo-100/40',
  }
  return (
    <Card
      className={cn(
        'animate-fade-up border-0 bg-gradient-to-br p-4 shadow-card transition-all duration-200 hover:-translate-y-1 hover:shadow-md hover:border-border border border-transparent hover:border-slate-200',
        accents[tone],
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{label}</p>
          <p className="mt-1.5 text-2xl font-semibold tracking-tight text-slate-900">{value}</p>
          {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
        </div>
        {icon ? (
          <div className={cn('flex h-10 w-10 items-center justify-center rounded-xl', tones[tone])}>{icon}</div>
        ) : null}
      </div>
    </Card>
  )
}
