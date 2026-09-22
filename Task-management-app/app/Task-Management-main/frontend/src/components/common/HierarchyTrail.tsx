import { ChevronRight } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { UserAvatar } from '@/components/common/UserAvatar'
import type { TaskLineage } from '@/types'
import { cn } from '@/lib/utils'

function Node({
  label,
  value,
  to,
  avatar,
}: {
  label: string
  value: string
  to?: string
  avatar?: ReactNode
}) {
  const inner = (
    <div className="flex min-w-0 items-center gap-2 rounded-lg border bg-white px-3 py-2 shadow-sm">
      {avatar}
      <div className="min-w-0">
        <p className="text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">{label}</p>
        <p className="truncate text-sm font-semibold text-slate-800">{value}</p>
      </div>
    </div>
  )
  if (!to) return inner
  return (
    <Link to={to} className="min-w-0 hover:opacity-90">
      {inner}
    </Link>
  )
}

export function HierarchyTrail({ lineage, className }: { lineage: TaskLineage; className?: string }) {
  const items = [
    {
      label: 'Project',
      value: lineage.project.name,
      to: `/projects/${lineage.project.id}`,
    },
    {
      label: 'Team',
      value: lineage.team.name,
      to: `/teams/${lineage.team.id}`,
    },
    {
      label: 'Mentor',
      value: lineage.mentor ? `${lineage.mentor.firstName} ${lineage.mentor.lastName}` : 'Unassigned',
      avatar: <UserAvatar user={lineage.mentor} size="sm" />,
    },
    {
      label: 'POC',
      value: lineage.poc ? `${lineage.poc.firstName} ${lineage.poc.lastName}` : 'Unassigned',
      avatar: <UserAvatar user={lineage.poc} size="sm" />,
    },
    {
      label: 'Task',
      value: lineage.task.title,
    },
  ]

  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      {items.map((item, index) => (
        <div key={`${item.label}-${item.value}`} className="flex items-center gap-2">
          {index > 0 ? <ChevronRight className="h-4 w-4 text-slate-400" /> : null}
          <Node label={item.label} value={item.value} to={item.to} avatar={item.avatar} />
        </div>
      ))}
    </div>
  )
}

export function Breadcrumbs({ items }: { items: { label: string; to?: string }[] }) {
  return (
    <nav className="mb-4 flex flex-wrap items-center gap-1 text-sm text-muted-foreground">
      {items.map((item, index) => (
        <span key={`${item.label}-${index}`} className="flex items-center gap-1">
          {index > 0 ? <ChevronRight className="h-3.5 w-3.5" /> : null}
          {item.to ? (
            <Link to={item.to} className="hover:text-foreground">
              {item.label}
            </Link>
          ) : (
            <span className="font-medium text-foreground">{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  )
}
