import { useQuery } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { useState } from 'react'
import { fetchMentorDashboard } from '@/api'
import { DashboardTable } from '@/components/common/DashboardTable'
import { dateCell, progressCell, statusCell, taskCell, userCell } from '@/components/common/DashboardTableCells'
import { EmptyState, ErrorState } from '@/components/common/EmptyState'
import { PageHeader, PercentBar } from '@/components/common/PageHeader'
import { StatCard } from '@/components/common/StatCard'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { displayName } from '@/data/selectors'
import { AssignWorkToPocDialog } from '@/features/tasks/AssignWorkToPocDialog'
import { DashboardSkeleton } from '@/features/dashboard/DashboardSkeleton'
import { TaskReviewActions } from '@/features/tasks/TaskReviewActions'
import { TaskWorkActions } from '@/features/tasks/TaskWorkActions'
import { useSession } from '@/stores/auth-store'
import { AssignmentType } from '@/types'

export function MentorDashboard({ projectId, teamId }: { projectId: string; teamId: string }) {
  const { user } = useSession()
  const [open, setOpen] = useState(false)
  const query = useQuery({
    queryKey: ['dashboard', 'mentor', projectId, teamId],
    queryFn: () => fetchMentorDashboard(projectId, teamId),
  })

  if (query.isLoading) return <DashboardSkeleton />
  if (query.isError || !query.data) {
    return <ErrorState onRetry={() => query.refetch()} title="Unable to load Mentor Dashboard" />
  }

  const data = query.data

  return (
    <div>
      <PageHeader
        eyebrow={data.team.name}
        title="Mentor Dashboard"
        description={`Team-scoped view for ${displayName(data.mentor)}. Assign work to yourself as Mentor / POC or to other POCs.`}
        actions={
          <Button onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4" />
            Assign Work to POC
          </Button>
        }
      />
      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="p-4 sm:col-span-2">
          <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Team progress</p>
          <p className="mt-1.5 text-xl font-semibold">{data.progress}%</p>
          <PercentBar className="mt-3" value={data.progress} label={data.team.name} />
        </Card>
        <StatCard label="POCs" value={data.pocCount} />
        <StatCard label="Active tasks" value={data.stats.inProgress} tone="info" />
        <StatCard label="Completed" value={data.stats.completed} tone="success" />
        <StatCard label="Blocked" value={data.stats.blocked} tone="error" />
        <StatCard label="Overdue" value={data.stats.overdue} tone="warning" />
      </div>
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>My work as POC</CardTitle>
        </CardHeader>
        <CardContent>
          {data.myWork.length === 0 ? (
            <EmptyState title="No work assigned to you yet." description="Assign Work to POC, or choose Myself (Mentor as POC) and update status with who did the work." />
          ) : (
            <DashboardTable
              ariaLabel="My work as POC"
              columns={[
                { key: 'title', header: 'Task' },
                { key: 'progress', header: 'Progress' },
                { key: 'status', header: 'Status' },
                { key: 'due', header: 'Due' },
              ]}
              rows={data.myWork.map((task) => ({
                key: task.id,
                values: {
                  title: taskCell(task),
                  progress: progressCell(task.progress),
                  status: statusCell(task.status),
                  due: dateCell(task.dueDate),
                },
                detailTitle: `${task.title} · Mentor / POC`,
                detailDescription: task.description,
                detail: (
                  <div className="space-y-3">
                    {user ? <TaskWorkActions task={task} user={user} /> : null}
                    {task.children.length > 0 ? (
                      <DashboardTable
                        ariaLabel={`${task.title} subtasks`}
                        columns={[
                          { key: 'title', header: 'Subtask' },
                          { key: 'status', header: 'Status' },
                          { key: 'due', header: 'Due' },
                        ]}
                        rows={task.children.map((child) => ({
                          key: child.id,
                          values: {
                            title: taskCell(child),
                            status: statusCell(child.status),
                            due: dateCell(child.dueDate),
                          },
                          detailTitle: child.title,
                          detailDescription: child.description,
                          detail: user && child.assignedTo === user.id ? <TaskWorkActions task={child} user={user} /> : null,
                        }))}
                      />
                    ) : (
                      <p className="text-sm text-muted-foreground">No subtasks yet — break this down to assign work.</p>
                    )}
                  </div>
                ),
              }))}
            />
          )}
        </CardContent>
      </Card>
      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>Work assigned to POCs</CardTitle>
          </CardHeader>
          <CardContent>
            {data.assignedWork.length === 0 ? (
              <EmptyState title="No tasks assigned yet." description="Assign a parent task to yourself or a POC on your team." />
            ) : (
              <DashboardTable
                ariaLabel="Work assigned to POCs"
                columns={[
                  { key: 'title', header: 'Task' },
                  { key: 'assignee', header: 'POC' },
                  { key: 'progress', header: 'Progress' },
                  { key: 'status', header: 'Status' },
                ]}
                rows={data.assignedWork.map((task) => ({
                  key: task.id,
                  values: {
                    title: taskCell(task),
                    assignee: userCell(
                      task.assignedTo === data.mentor?.id
                        ? data.mentor
                        : data.pocs.find((row) => row.poc.id === task.assignedTo)?.poc,
                    ),
                    progress: progressCell(
                      task.assignedTo === data.mentor?.id
                        ? data.myWork.find((item) => item.id === task.id)?.progress ?? 0
                        : data.pocs.find((row) => row.poc.id === task.assignedTo)?.progress ?? 0,
                    ),
                    status: statusCell(task.status),
                  },
                  detailTitle: task.title,
                  detailDescription: task.description,
                  detail: (
                    <p className="text-sm text-muted-foreground">
                      {task.assignedTo === data.mentor?.id
                        ? 'Myself (Mentor as POC)'
                        : `POC ${displayName(data.pocs.find((row) => row.poc.id === task.assignedTo)?.poc)}`}
                      {' '}· Due {dateCell(task.dueDate)}
                    </p>
                  ),
                }))}
              />
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>POC teams</CardTitle>
          </CardHeader>
          <CardContent>
            {data.pocs.length === 0 ? (
              <EmptyState title="No POCs found." />
            ) : (
              <DashboardTable
                ariaLabel="POC teams"
                columns={[
                  { key: 'name', header: 'POC' },
                  { key: 'tasks', header: 'Parent tasks' },
                  { key: 'active', header: 'Active' },
                  { key: 'progress', header: 'Progress' },
                ]}
                rows={data.pocs.map((row) => ({
                  key: row.poc.id,
                  values: {
                    name: (
                      <span className="text-sm">
                        {displayName(row.poc)}
                        {row.isMentor ? ' (Mentor / POC)' : ''}
                      </span>
                    ),
                    tasks: <span className="text-sm">{row.taskCount}</span>,
                    active: <span className="text-sm">{row.workload}</span>,
                    progress: progressCell(row.progress),
                  },
                  detailTitle: `${displayName(row.poc)} · ${row.isMentor ? 'Mentor / POC' : 'POC'}`,
                  detail: <p className="text-sm text-muted-foreground">{displayName(row.poc)} leads a POC team under you.</p>,
                }))}
              />
            )}
          </CardContent>
        </Card>
      </div>
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Work to review</CardTitle>
        </CardHeader>
        <CardContent>
          {data.reviewQueue.length === 0 ? (
            <EmptyState
              title="Nothing waiting for review."
              description="POC submissions and your own work appear here. Associate work is reviewed by the POC."
            />
          ) : (
            <DashboardTable
              ariaLabel="Work to review"
              columns={[
                { key: 'title', header: 'Task' },
                { key: 'status', header: 'Status' },
              ]}
              rows={data.reviewQueue.map((task) => ({
                key: task.id,
                values: {
                  title: taskCell(task),
                  status: statusCell(task.status),
                },
                detailTitle: task.title,
                detailDescription: task.description,
                detail: (
                  <div className="space-y-3">
                    <p className="text-xs text-muted-foreground">Submitted for your review</p>
                    {user ? <TaskReviewActions task={task} user={user} role={AssignmentType.MENTOR} /> : null}
                  </div>
                ),
              }))}
            />
          )}
        </CardContent>
      </Card>
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Upcoming deadlines</CardTitle>
          </CardHeader>
          <CardContent>
            <DashboardTable
              ariaLabel="Upcoming deadlines"
              columns={[
                { key: 'title', header: 'Task' },
                { key: 'status', header: 'Status' },
                { key: 'due', header: 'Due' },
              ]}
              rows={data.upcoming.map((task) => ({
                key: task.id,
                values: {
                  title: taskCell(task),
                  status: statusCell(task.status),
                  due: dateCell(task.dueDate),
                },
                detailTitle: task.title,
                detailDescription: task.description,
              }))}
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Recent activity</CardTitle>
          </CardHeader>
          <CardContent>
            <DashboardTable
              ariaLabel="Recent activity"
              columns={[
                { key: 'activity', header: 'Activity' },
                { key: 'when', header: 'When' },
              ]}
              rows={data.activity.map((item) => ({
                key: item.id,
                values: {
                  activity: <span className="text-sm">{item.message}</span>,
                  when: dateCell(item.createdAt, 'd MMM yyyy HH:mm'),
                },
                detailTitle: item.action.replaceAll('_', ' '),
                detailDescription: item.message,
              }))}
            />
          </CardContent>
        </Card>
      </div>
      <AssignWorkToPocDialog open={open} onOpenChange={setOpen} teamId={teamId} projectId={projectId} />
    </div>
  )
}
