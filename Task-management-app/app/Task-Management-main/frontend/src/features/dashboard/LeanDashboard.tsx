import { useQuery } from '@tanstack/react-query'
import { CheckCircle2, Clock3, Layers3, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { fetchTasks } from '@/api'
import { EmptyState, ErrorState } from '@/components/common/EmptyState'
import { PageHeader } from '@/components/common/PageHeader'
import { StatCard } from '@/components/common/StatCard'
import { StatusBadge } from '@/components/common/StatusBadge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { teamById } from '@/data/organization'
import { workerName } from '@/data/selectors'
import { DashboardSkeleton } from '@/features/dashboard/DashboardSkeleton'
import { TaskWorkActions } from '@/features/tasks/TaskWorkActions'
import { useSession } from '@/stores/auth-store'
import { AssignmentType, STATUS_META, TaskStatus, WORK_STATUSES, type Task } from '@/types'

const titles: Record<AssignmentType, { title: string; description: string }> = {
  SCRUM_MASTER: {
    title: 'Project overview',
    description: 'Track delivery across teams. Create sprint plans for mentors to pick up.',
  },
  MENTOR: {
    title: 'Team overview',
    description: 'Start a task to divide it into subtasks, or assign the complete task to a POC, an associate, or yourself.',
  },
  POC: {
    title: 'Squad overview',
    description: 'Start a task to divide it into subtasks, or assign the complete task to yourself or one associate.',
  },
  ASSOCIATE: {
    title: 'No dashboard',
    description: 'Associates do not have app access.',
  },
}

export function LeanDashboard() {
  const { user, role, projectId } = useSession()
  const [status, setStatus] = useState('all')

  const query = useQuery({
    queryKey: ['tasks', 'dashboard', user?.id, projectId],
    queryFn: () => fetchTasks(user!.id, projectId!),
    enabled: Boolean(user && projectId),
  })

  const tasks = query.data ?? []

  const filtered = useMemo(() => {
    if (status === 'all') return tasks
    return tasks.filter((task) => task.status === status)
  }, [tasks, status])

  if (!user || !projectId || !role) return null
  if (query.isLoading) return <DashboardSkeleton />
  if (query.isError) return <ErrorState onRetry={() => query.refetch()} title="Unable to load dashboard" />

  const total = tasks.length
  const inProgress = tasks.filter((t) => t.status === TaskStatus.IN_PROGRESS).length
  const underReview = tasks.filter((t) => t.status === TaskStatus.IN_REVIEW).length
  const completed = tasks.filter((t) => t.status === TaskStatus.COMPLETED).length
  const copy = titles[role]

  return (
    <div className="animate-fade-up space-y-6">
      <PageHeader
        eyebrow="Dashboard"
        title={copy.title}
        count={total}
        countNoun="tasks"
        description={copy.description}
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Tasks" value={total} icon={<Layers3 className="h-4 w-4" />} tone="info" />
        <StatCard label="In progress" value={inProgress} icon={<Clock3 className="h-4 w-4" />} tone="warning" />
        <StatCard label="Under review" value={underReview} icon={<Search className="h-4 w-4" />} tone="warning" />
        <StatCard label="Completed" value={completed} icon={<CheckCircle2 className="h-4 w-4" />} tone="success" />
      </div>
      <Card className="animate-fade-up overflow-hidden border-0 shadow-card [animation-delay:80ms]">
        <CardHeader className="space-y-3 border-b bg-gradient-to-r from-sky-50 to-indigo-50">
          <CardTitle className="text-base">Tasks</CardTitle>
          <div className="flex flex-wrap gap-2">
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="w-44 bg-white">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {WORK_STATUSES.map((item) => (
                  <SelectItem key={item} value={item}>
                    {STATUS_META[item].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <EmptyState title="No matching tasks." className="py-10" />
          ) : (
            <TaskOverviewTable
              tasks={filtered}
              showActions={role === AssignmentType.POC || role === AssignmentType.MENTOR}
            />
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function TaskOverviewTable({ tasks, showActions }: { tasks: Task[]; showActions: boolean }) {
  const { user } = useSession()
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Task</TableHead>
          <TableHead>Team</TableHead>
          <TableHead>{showActions ? 'Working on' : 'Member'}</TableHead>
          <TableHead>Status</TableHead>
          {showActions ? <TableHead className="w-[200px]">Update</TableHead> : null}
        </TableRow>
      </TableHeader>
      <TableBody>
        {tasks.slice(0, 50).map((task, index) => {
          const team = teamById[task.teamId]
          return (
            <TableRow
              key={task.id}
              className="animate-fade-up transition-colors hover:bg-sky-50/60"
              style={{ animationDelay: `${Math.min(index, 12) * 30}ms` }}
            >
              <TableCell>
                <Link to={`/tasks/${task.id}`} className="font-medium text-slate-900 hover:text-primary">
                  {task.title}
                </Link>
              </TableCell>
              <TableCell className="text-muted-foreground">{team?.name ?? '—'}</TableCell>
              <TableCell>{workerName(task)}</TableCell>
              <TableCell>
                <StatusBadge status={task.status} />
              </TableCell>
              {showActions ? (
                <TableCell>{user ? <TaskWorkActions task={task} user={user} /> : null}</TableCell>
              ) : null}
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )
}
