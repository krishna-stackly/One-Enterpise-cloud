import { useQuery } from '@tanstack/react-query'
import { fetchPocDashboard } from '@/api'
import { DashboardTable } from '@/components/common/DashboardTable'
import { dateCell, progressCell, statusCell, taskCell } from '@/components/common/DashboardTableCells'
import { EmptyState, ErrorState } from '@/components/common/EmptyState'
import { PageHeader } from '@/components/common/PageHeader'
import { StatCard } from '@/components/common/StatCard'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { displayName } from '@/data/selectors'
import { DashboardSkeleton } from '@/features/dashboard/DashboardSkeleton'
import { TaskReviewActions } from '@/features/tasks/TaskReviewActions'
import { TaskWorkActions } from '@/features/tasks/TaskWorkActions'
import { useSession } from '@/stores/auth-store'
import { AssignmentType } from '@/types'

export function PocDashboard({ userId, projectId }: { userId: string; projectId: string }) {
  const { user } = useSession()
  const query = useQuery({
    queryKey: ['dashboard', 'poc', userId, projectId],
    queryFn: () => fetchPocDashboard(userId, projectId),
  })

  if (query.isLoading) return <DashboardSkeleton />
  if (query.isError) return <ErrorState onRetry={() => query.refetch()} title="Unable to load POC Dashboard" />

  const data = query.data!

  return (
    <div>
      <PageHeader
        title="POC Dashboard"
        description="Track Mentor-assigned work, update status, and record who did each task by name."
      />
      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Work from Mentor" value={data.parents.length} />
        <StatCard label="Active tasks" value={data.stats.inProgress} tone="info" />
        <StatCard label="Requires review" value={data.reviewCount} tone="warning" />
        <StatCard label="Blocked" value={data.stats.blocked} tone="error" />
        <StatCard label="Overdue" value={data.stats.overdue} tone="warning" />
        <StatCard label="Completed" value={data.stats.completed} tone="success" />
        <StatCard label="Assigned" value={data.stats.assigned} />
      </div>
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Work from Mentor</CardTitle>
        </CardHeader>
        <CardContent>
          {data.parents.length === 0 ? (
            <EmptyState title="No tasks assigned yet." description="When a Mentor assigns work to you, it will appear here." />
          ) : (
            <DashboardTable
              ariaLabel="Parent work assigned by Mentor"
              columns={[
                { key: 'title', header: 'Task' },
                { key: 'doneBy', header: 'Done by' },
                { key: 'progress', header: 'Progress' },
                { key: 'due', header: 'Due' },
                { key: 'status', header: 'Status' },
              ]}
              rows={data.parents.map((item) => ({
                key: item.id,
                values: {
                  title: taskCell(item),
                  doneBy: <span className="text-sm">{item.doneByName?.trim() || '—'}</span>,
                  progress: progressCell(item.progress),
                  due: dateCell(item.dueDate),
                  status: statusCell(item.status),
                },
                detailTitle: `Assigned by ${displayName(item.assignedByUser)} · Mentor`,
                detailDescription: item.description,
                detail: user ? (
                  <div className="space-y-2">
                    {item.doneByName ? (
                      <p className="text-sm text-muted-foreground">Done by: {item.doneByName}</p>
                    ) : null}
                    <TaskWorkActions task={item} user={user} />
                  </div>
                ) : null,
              }))}
            />
          )}
        </CardContent>
      </Card>
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Associate work to review</CardTitle>
          </CardHeader>
          <CardContent>
            {data.reviewQueue.length === 0 ? (
              <EmptyState title="No tasks require review." />
            ) : (
              <DashboardTable
                ariaLabel="Tasks requiring review"
                columns={[
                  { key: 'title', header: 'Task' },
                  { key: 'doneBy', header: 'Done by' },
                  { key: 'status', header: 'Status' },
                ]}
                rows={data.reviewQueue.map((task) => ({
                  key: task.id,
                  values: {
                    title: taskCell(task),
                    doneBy: <span className="text-sm">{task.doneByName?.trim() || '—'}</span>,
                    status: statusCell(task.status),
                  },
                  detailTitle: task.title,
                  detailDescription: task.description,
                  detail: user ? (
                    <div className="space-y-3">
                      {task.doneByName ? (
                        <p className="text-xs text-muted-foreground">Done by {task.doneByName}</p>
                      ) : null}
                      <TaskReviewActions task={task} user={user} role={AssignmentType.POC} />
                    </div>
                  ) : null,
                }))}
              />
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>My work</CardTitle>
          </CardHeader>
          <CardContent>
            {data.myWork.length === 0 && data.parents.length === 0 ? (
              <EmptyState title="No tasks yet." description="Mentor-assigned work and status updates appear here." />
            ) : data.myWork.length === 0 ? (
              <EmptyState title="No additional self-owned tasks." description="Update status on mentor-assigned work above." />
            ) : (
              <DashboardTable
                ariaLabel="My work"
                columns={[
                  { key: 'title', header: 'Task' },
                  { key: 'doneBy', header: 'Done by' },
                  { key: 'status', header: 'Status' },
                  { key: 'due', header: 'Due' },
                ]}
                rows={data.myWork.map((task) => ({
                  key: task.id,
                  values: {
                    title: taskCell(task),
                    doneBy: <span className="text-sm">{task.doneByName?.trim() || '—'}</span>,
                    status: statusCell(task.status),
                    due: dateCell(task.dueDate),
                  },
                  detailTitle: task.title,
                  detailDescription: task.description,
                  detail: user ? <TaskWorkActions task={task} user={user} /> : null,
                }))}
              />
            )}
          </CardContent>
        </Card>
      </div>
      <div className="mt-6">
        <Card>
          <CardHeader>
            <CardTitle>Upcoming deadlines</CardTitle>
          </CardHeader>
          <CardContent>
            <DashboardTable
              ariaLabel="Upcoming deadlines"
              columns={[
                { key: 'title', header: 'Task' },
                { key: 'doneBy', header: 'Done by' },
                { key: 'status', header: 'Status' },
                { key: 'due', header: 'Due' },
              ]}
              rows={data.upcoming.map((task) => ({
                key: task.id,
                values: {
                  title: taskCell(task),
                  doneBy: <span className="text-sm">{task.doneByName?.trim() || '—'}</span>,
                  status: statusCell(task.status),
                  due: dateCell(task.dueDate),
                },
                detailTitle: task.title,
                detailDescription: task.description,
              }))}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
