import { useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { fetchTasks } from '@/api'
import { EmptyState, ErrorState } from '@/components/common/EmptyState'
import { PageHeader } from '@/components/common/PageHeader'
import { StatusBadge } from '@/components/common/StatusBadge'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { teamById } from '@/data/organization'
import { workerName } from '@/data/selectors'
import { DashboardSkeleton } from '@/features/dashboard/DashboardSkeleton'
import { TaskWorkActions } from '@/features/tasks/TaskWorkActions'
import { useSession } from '@/stores/auth-store'
import { AssignmentType, TaskStatus, type Task } from '@/types'

export function TasksPage() {
  const { user, role, projectId } = useSession()
  const [q, setQ] = useState('')
  const [status, setStatus] = useState<string>('all')
  const query = useQuery({
    queryKey: ['tasks', user?.id, projectId],
    queryFn: () => fetchTasks(user!.id, projectId!),
    enabled: Boolean(user && projectId),
  })

  const filtered = useMemo(() => {
    let list = query.data ?? []
    if (status !== 'all') list = list.filter((task) => task.status === status)
    if (q.trim()) {
      const needle = q.toLowerCase()
      list = list.filter((task) => task.title.toLowerCase().includes(needle))
    }
    return list
  }, [query.data, status, q])

  if (query.isLoading) return <DashboardSkeleton />
  if (query.isError) return <ErrorState onRetry={() => query.refetch()} />

  return (
    <div className="animate-fade-up space-y-4">
      <PageHeader
        title="Tasks"
        count={filtered.length}
        countNoun="tasks"
        countHint={
          status !== 'all' || q.trim()
            ? `${filtered.length} of ${(query.data ?? []).length} tasks`
            : undefined
        }
        description="Essential task status by team and who is working on each item."
      />
      <div className="flex flex-wrap gap-2">
        <Input className="max-w-xs" placeholder="Search tasks" value={q} onChange={(e) => setQ(e.target.value)} />
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {Object.values(TaskStatus).map((item) => (
              <SelectItem key={item} value={item}>
                {item.replaceAll('_', ' ')}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <MinimalTaskTable
        tasks={filtered}
        showActions={role === AssignmentType.POC || role === AssignmentType.MENTOR}
      />
    </div>
  )
}

function MinimalTaskTable({ tasks, showActions }: { tasks: Task[]; showActions: boolean }) {
  const { user } = useSession()
  if (tasks.length === 0) return <EmptyState title="No tasks yet." className="mt-4" />
  return (
    <div className="overflow-hidden rounded-xl border-0 bg-card shadow-card">
      <Table>
        <TableHeader>
          <TableRow className="bg-slate-50/80">
            <TableHead>Task</TableHead>
            <TableHead>Team</TableHead>
            <TableHead>Working on</TableHead>
            <TableHead>Status</TableHead>
            {showActions ? <TableHead>Update</TableHead> : null}
          </TableRow>
        </TableHeader>
        <TableBody>
          {tasks.map((task) => (
            <TableRow key={task.id} className="transition-colors hover:bg-sky-50/50">
              <TableCell>
                <Link to={`/tasks/${task.id}`} className="font-medium hover:text-primary">
                  {task.title}
                </Link>
              </TableCell>
              <TableCell className="text-muted-foreground">{teamById[task.teamId]?.name ?? '—'}</TableCell>
              <TableCell>{workerName(task)}</TableCell>
              <TableCell>
                <StatusBadge status={task.status} />
              </TableCell>
              {showActions ? <TableCell>{user ? <TaskWorkActions task={task} user={user} /> : null}</TableCell> : null}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
