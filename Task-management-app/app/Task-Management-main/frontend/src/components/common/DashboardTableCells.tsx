import { format, parseISO } from 'date-fns'
import { Link } from 'react-router-dom'
import { displayName } from '@/data/selectors'
import type { Priority, ProjectStatus, TaskStatus, User } from '@/types'

/* ---- compact cell formatters shared across dashboards ---- */

export function taskCell(task: { id: string; title: string }) {
  return (
    <Link to={`/tasks/${task.id}`} className="font-medium hover:text-primary">
      {task.title}
    </Link>
  )
}

export function statusCell(status: TaskStatus) {
  return <span className="text-sm">{status.replaceAll('_', ' ')}</span>
}

export function priorityCell(priority: Priority) {
  return <span className="text-sm">{priority}</span>
}

export function projectStatusCell(status: ProjectStatus) {
  return <span className="text-sm">{status.replaceAll('_', ' ')}</span>
}

export function userCell(user: User | null | undefined) {
  return <span className="text-sm">{displayName(user ?? undefined)}</span>
}

export function dateCell(date: string, pattern = 'd MMM yyyy') {
  return <span className="text-sm text-muted-foreground">{format(parseISO(date), pattern)}</span>
}

export function progressCell(value: number) {
  return <span className="text-sm font-semibold">{value}%</span>
}