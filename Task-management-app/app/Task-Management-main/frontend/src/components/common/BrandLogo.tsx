import logo from '@/assets/stackly-logo.png'
import { cn } from '@/lib/utils'

export function BrandMark({ className }: { className?: string }) {
  return (
    <img
      src={logo}
      alt=""
      aria-hidden
      className={cn('h-8 w-8 shrink-0 object-cover object-left', className)}
    />
  )
}

export function BrandLogo({
  compact = false,
  inverted = false,
}: {
  compact?: boolean
  inverted?: boolean
}) {
  if (compact) {
    return (
      <span
        className={cn(
          'flex h-9 w-9 items-center justify-center overflow-hidden rounded-lg',
          inverted && 'bg-white',
        )}
        title="Stackly"
      >
        <img src={logo} alt="Stackly" className="h-7 w-7 object-cover object-left" />
      </span>
    )
  }

  return (
    <div className="flex min-w-0 items-center gap-3">
      <span className={cn('inline-flex shrink-0 items-center rounded-md px-1.5 py-1', inverted && 'bg-white')}>
        <img src={logo} alt="Stackly" className="h-8 w-auto max-w-[168px] object-contain object-left" />
      </span>
      <p className={cn('truncate text-sm leading-none', inverted ? 'text-slate-400' : 'text-muted-foreground')}>
        Task Management
      </p>
    </div>
  )
}
