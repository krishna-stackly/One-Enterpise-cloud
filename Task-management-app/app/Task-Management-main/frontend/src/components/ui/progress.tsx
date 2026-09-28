import type { HTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

function Progress({
  value = 0,
  className,
  indicatorClassName,
  ...props
}: HTMLAttributes<HTMLDivElement> & { value?: number; indicatorClassName?: string }) {
  const clamped = Math.max(0, Math.min(100, value))
  return (
    <div className={cn('h-2 w-full overflow-hidden rounded-full bg-slate-100', className)} {...props}>
      <div
        className={cn('h-full rounded-full bg-primary transition-all', indicatorClassName)}
        style={{ width: `${clamped}%` }}
      />
    </div>
  )
}

export { Progress }
