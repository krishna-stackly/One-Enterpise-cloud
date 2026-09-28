import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, CalendarClock, CheckCircle2, Clock3, Layers3, Users } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { fetchScrumMasterDashboard } from '@/api'
import { DashboardTable } from '@/components/common/DashboardTable'
import { dateCell, priorityCell, statusCell, taskCell } from '@/components/common/DashboardTableCells'
import { EmptyState, ErrorState } from '@/components/common/EmptyState'
import { PageHeader, PercentBar } from '@/components/common/PageHeader'
import { StatCard } from '@/components/common/StatCard'
import { ProjectStatusBadge } from '@/components/common/StatusBadge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { displayName } from '@/data/selectors'
import { DashboardSkeleton } from '@/features/dashboard/DashboardSkeleton'
import { format } from 'date-fns'

export function ScrumMasterDashboard({ projectId }: { projectId: string }) {
  const query = useQuery({
    queryKey: ['dashboard', 'scrum-master', projectId],
    queryFn: () => fetchScrumMasterDashboard(projectId),
  })

  if (query.isLoading) return <DashboardSkeleton />
  if (query.isError || !query.data) {
    return <ErrorState onRetry={() => query.refetch()} title="Unable to load Scrum Master Dashboard" />
  }

  const data = query.data
  const project = data.project

  return (
    <div>
      <PageHeader
        eyebrow={project.name}
        title="Scrum Master Dashboard"
        description={`${project.name} · ${displayName(data.scrumMaster)} oversees delivery across every team.`}
      />
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <ProjectStatusBadge status={project.status} />
        <span className="text-sm text-muted-foreground">Due {format(new Date(project.dueDate), 'd MMM yyyy')}</span>
      </div>
      <Card className="mb-6 p-5">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Project progress</p>
            <p className="mt-1 text-xl font-semibold tracking-tight">{data.progress}%</p>
          </div>
          <div className="w-full max-w-md">
            <PercentBar value={data.progress} label="Overall completion from team parent tasks" />
          </div>
        </div>
      </Card>
      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total tasks" value={data.stats.total} icon={<Layers3 className="h-4 w-4" />} tone="info" />
        <StatCard label="Completed" value={data.stats.completed} icon={<CheckCircle2 className="h-4 w-4" />} tone="success" />
        <StatCard label="In Progress" value={data.stats.inProgress} icon={<Clock3 className="h-4 w-4" />} tone="info" />
        <StatCard label="Blocked" value={data.stats.blocked} icon={<AlertTriangle className="h-4 w-4" />} tone="error" />
        <StatCard label="Overdue" value={data.stats.overdue} icon={<CalendarClock className="h-4 w-4" />} tone="warning" />
        <StatCard label="In Review" value={data.stats.inReview} tone="warning" />
        <StatCard label="Teams" value={data.teamCount} icon={<Users className="h-4 w-4" />} />
        <StatCard label="POCs" value={data.pocCount} icon={<Users className="h-4 w-4" />} />
      </div>
      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>Team performance</CardTitle>
          </CardHeader>
          <CardContent>
            {data.teams.length === 0 ? (
              <EmptyState title="No teams found." description="Create teams and assign Mentors to start tracking progress." />
            ) : (
              <>
                <div className="mb-6 h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.teams.map((team) => ({ name: team.name, progress: team.progress }))}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                      <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} />
                      <Tooltip />
                      <Bar dataKey="progress" fill="#1d4ed8" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <DashboardTable
                  ariaLabel="Team performance"
                  columns={[
                    { key: 'name', header: 'Team' },
                    { key: 'mentor', header: 'Mentor' },
                    { key: 'progress', header: 'Progress' },
                    { key: 'pocs', header: 'POCs' },
                  ]}
                  rows={data.teams.map((team) => ({
                    key: team.id,
                    values: {
                      name: (
                        <Link to={`/teams/${team.id}`} className="font-medium hover:text-primary">
                          {team.name}
                        </Link>
                      ),
                      mentor: <span className="text-sm">{displayName(team.mentor)}</span>,
                      progress: <span className="text-sm font-semibold">{team.progress}%</span>,
                      pocs: <span className="text-sm">{team.pocs.length}</span>,
                    },
                    detailTitle: team.name,
                    detailDescription: team.description,
                    detail: (
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        <p className="text-sm">
                          <span className="text-xs font-semibold uppercase text-muted-foreground">Mentor</span>
                          <br />
                          {displayName(team.mentor)}
                        </p>
                        <p className="text-sm">
                          <span className="text-xs font-semibold uppercase text-muted-foreground">POCs</span>
                          <br />
                          {team.pocs.length === 0 ? '—' : team.pocs.map((poc) => displayName(poc)).join(', ')}
                        </p>
                      </div>
                    ),
                  }))}
                />
              </>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Critical blockers</CardTitle>
          </CardHeader>
          <CardContent>
            {data.blockers.length === 0 ? (
              <EmptyState title="No blockers" description="No blocked work in this project." className="py-8" />
            ) : (
              <DashboardTable
                ariaLabel="Critical blockers"
                columns={[
                  { key: 'title', header: 'Task' },
                  { key: 'priority', header: 'Priority' },
                  { key: 'status', header: 'Status' },
                ]}
                rows={data.blockers.map((task) => ({
                  key: task.id,
                  values: {
                    title: taskCell(task),
                    priority: priorityCell(task.priority),
                    status: statusCell(task.status),
                  },
                  detailTitle: task.title,
                  detailDescription: task.blockedReason ?? 'Blocked',
                }))}
              />
            )}
          </CardContent>
        </Card>
      </div>
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
                { key: 'priority', header: 'Priority' },
                { key: 'status', header: 'Status' },
                { key: 'due', header: 'Due' },
              ]}
              rows={data.upcoming.map((task) => ({
                key: task.id,
                values: {
                  title: taskCell(task),
                  priority: priorityCell(task.priority),
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
      <Card className="mt-6">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Project structure</CardTitle>
          <Link to="/structure" className="text-sm font-medium text-primary">
            Open interactive tree
          </Link>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg bg-slate-50 p-4 font-mono text-sm leading-7 text-slate-700">
            <p className="font-sans text-base font-semibold text-slate-900">{project.name}</p>
            <p>├── Scrum Master: {displayName(data.scrumMaster)}</p>
            {data.teams.map((team, index) => {
              const last = index === data.teams.length - 1
              const branch = last ? '└──' : '├──'
              const pipe = last ? '    ' : '│   '
              return (
                <div key={team.id}>
                  <p>
                    {branch} {team.name}
                  </p>
                  <p>
                    {pipe}├── Mentor: {displayName(team.mentor)}
                  </p>
                  {team.pocs.map((poc, pIndex) => (
                    <p key={poc.id}>
                      {pipe}
                      {pIndex === team.pocs.length - 1 ? '└──' : '├──'} POC: {displayName(poc)}
                    </p>
                  ))}
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
