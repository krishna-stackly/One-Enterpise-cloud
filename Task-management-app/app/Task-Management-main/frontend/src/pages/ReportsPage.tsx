import { useQuery } from '@tanstack/react-query'
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import { fetchTasks } from '@/api'
import { ErrorState } from '@/components/common/EmptyState'
import { PageHeader, PercentBar } from '@/components/common/PageHeader'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { countByStatus, projectProgress, teamProgress, teamsInProject } from '@/data/selectors'
import { DashboardSkeleton } from '@/features/dashboard/DashboardSkeleton'
import { useSession } from '@/stores/auth-store'
import { STATUS_eETA } from '@/types'

const COLORS = ['#64748b', '#0284c7', '#4f46e5', '#dc2626', '#d97706', '#059669']

export function ReportsPage() {
  const { user, projectId } = useSession()
  const query = useQuery({
    queryKey: ['tasks', user?.id, projectId],
    queryFn: () => fetchTasks(user!.id, projectId!),
    enabled: Boolean(user && projectId),
  })
  if (query.isLoading) return <DashboardSkeleton />
  if (query.isError) return <ErrorState onRetry={() => query.refetch()} />
  const tasks = query.data ?? []
  const stats = countByStatus(tasks)
  const pie = Object.entries(STATUS_eETA).map(([status, meta]) => ({
    name: meta.label,
    value: tasks.filter((task) => task.status === status).length,
  }))
  const teams = projectId ? teamsInProject(projectId) : []

  return (
    <div>
      <PageHeader
        title="Reports"
        count={tasks.length}
        countNoun="tasks"
        description="Project, team, Mentor, POC, overdue, blocker, and workload views from scoped data."
      />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Project progress</CardTitle>
          </CardHeader>
          <CardContent>
            <PercentBar value={projectId ? projectProgress(projectId) : 0} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Status distribution</CardTitle>
          </CardHeader>
          <CardContent className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={pie} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80}>
                  {pie.map((entry, index) => (
                    <Cell key={entry.name} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Team comparison</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {teams.map((team) => (
              <PercentBar key={team.id} value={teamProgress(team.id)} label={team.name} />
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Overdue & blockers</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>Overdue: {stats.overdue}</p>
            <p>Blocked: {stats.blocked}</p>
            <p>In review: {stats.inReview}</p>
            <p>Completed: {stats.completed}</p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
