import type { ReactNode } from 'react'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  count,
  countNoun,
  countHint,
}: {
  eyebrow?: string
  title: string
  description?: string
  actions?: ReactNode
  count?: number
  countNoun?: string
  countHint?: string
}) {
  const badge = countHint ?? (count == null ? null : `${count} ${countNoun ?? ''}`.trim())
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div>
        {eyebrow ? (
          <p className="mb-1 text-xs font-semibold tracking-[0.14em] text-primary uppercase">{eyebrow}</p>
        ) : null}
        <h1 className="flex flex-wrap items-center gap-2 text-lg font-semibold tracking-tight text-slate-900">
          <span>{title}</span>
          {badge ? (
            <span className="inline-flex items-center rounded-full border bg-slate-50 px-2.5 py-0.5 text-xs font-semibold text-slate-700">
              {badge}
            </span>
          ) : null}
        </h1>
        {description ? <p className="mt-1 max-w-2xl text-[13px] leading-5 text-muted-foreground">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">{actions}</div> : null}
    </div>
  )
}

export function PercentBar({
  value,
  label,
  className,
}: {
  value: number
  label?: string
  className?: string
}) {
  const tone =
    value >= 80 ? 'bg-success' : value >= 50 ? 'bg-info' : value >= 30 ? 'bg-warning' : 'bg-error'
  return (
    <div className={cn('space-y-1.5', className)}>
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium text-slate-600">{label}</span>
        <span className="font-semibold text-slate-800">{value}%</span>
      </div>
      <Progress value={value} indicatorClassName={tone} />
    </div>
  )
}
