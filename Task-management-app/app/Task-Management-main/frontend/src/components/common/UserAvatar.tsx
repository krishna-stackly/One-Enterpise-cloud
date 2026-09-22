import { initials } from '@/lib/utils'
import { cn } from '@/lib/utils'
import type { User } from '@/types'

const hues = [
  'bg-blue-600',
  'bg-indigo-600',
  'bg-teal-600',
  'bg-violet-600',
  'bg-rose-600',
  'bg-amber-600',
  'bg-cyan-700',
  'bg-emerald-600',
]

export function UserAvatar({
  user,
  size = 'md',
  className,
}: {
  user?: User | null
  size?: 'sm' | 'md' | 'lg'
  className?: string
}) {
  const dim = size === 'sm' ? 'h-7 w-7 text-[10px]' : size === 'lg' ? 'h-12 w-12 text-base' : 'h-9 w-9 text-xs'
  if (!user) {
    return (
      <div className={cn('inline-flex items-center justify-center rounded-full bg-slate-200 font-semibold text-slate-500', dim, className)}>
        ?
      </div>
    )
  }
  const color = hues[user.avatarHue % hues.length]
  return (
    <div
      title={`${user.firstName} ${user.lastName}`}
      className={cn('inline-flex items-center justify-center rounded-full font-semibold text-white', dim, color, className)}
    >
      {initials(user.firstName, user.lastName)}
    </div>
  )
}

export function UserChip({ user, subtitle }: { user?: User | null; subtitle?: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <UserAvatar user={user} size="sm" />
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{user ? `${user.firstName} ${user.lastName}` : 'Unassigned'}</p>
        {subtitle ? <p className="truncate text-xs text-muted-foreground">{subtitle}</p> : null}
      </div>
    </div>
  )
}
