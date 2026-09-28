import { Badge } from '@/components/ui/badge'
import { PRIORITY_META, PROJECT_STATUS_META, STATUS_META, type Priority, type ProjectStatus, type TaskStatus } from '@/types'
import { cn } from '@/lib/utils'

export function StatusBadge({ status }: { status: TaskStatus }) {
  const meta = STATUS_META[status]
  return (
    <Badge className={cn('gap-1.5 font-medium', meta.className)}>
      <span className={cn('h-1.5 w-1.5 rounded-full', meta.dot)} />
      {meta.label}
    </Badge>
  )
}

export function PriorityBadge({ priority }: { priority: Priority }) {
  const meta = PRIORITY_META[priority]
  return <Badge className={cn('font-medium', meta.className)}>{meta.label}</Badge>
}

export function ProjectStatusBadge({ status }: { status: ProjectStatus }) {
  const meta = PROJECT_STATUS_META[status]
  return <Badge className={cn('font-medium', meta.className)}>{meta.label}</Badge>
}
