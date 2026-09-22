import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { fetchProjectOverview, fetchStructure } from '@/api'
import { EmptyState, ErrorState } from '@/components/common/EmptyState'
import { PageHeader, PercentBar } from '@/components/common/PageHeader'
import { ProjectStatusBadge } from '@/components/common/StatusBadge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { projectProgress, scrumMasterOf, displayName, teamsInProject } from '@/data/selectors'
import { DashboardSkeleton } from '@/features/dashboard/DashboardSkeleton'
import { CreateProjectDialog } from '@/features/org/CreateProjectDialog'
import { StructurePage } from '@/pages/StructurePage'
import { useSession } from '@/stores/auth-store'
import { AssignmentType, SystemRole } from '@/types'

export function ProjectsPage() {
  const { user, role } = useSession()
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  // Overview comes from the backend with per-project roll-ups, so the list is
  // correct for every assigned project regardless of which one is hydrated.
  const query = useQuery({ queryKey: ['projects-overview'], queryFn: fetchProjectOverview })
  const canCreate = role === AssignmentType.SCRUM_MASTER || user?.systemRole === SystemRole.ADMIN
  if (query.isLoading) return <DashboardSkeleton />
  if (query.isError) return <ErrorState onRetry={() => query.refetch()} />
  const list = query.data ?? []

  return (
    <div>
      <PageHeader
        title="Projects"
        count={list.length}
        countNoun="projects"
        description="Projects you are assigned to. Roles are per project, not global."
        actions={
          canCreate ? (
            <Button onClick={() => setOpen(true)}>
              <Plus className="h-4 w-4" />
              Create project
            </Button>
          ) : null
        }
      />
      {list.length === 0 ? (
        <EmptyState title="No projects assigned." />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {list.map((project) => (
            <Link key={project.id} to={`/projects/${project.id}`}>
              <Card className="h-full p-5 hover:bg-slate-50">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-lg font-semibold">{project.name}</p>
                    <p className="text-xs text-muted-foreground">{project.code}</p>
                  </div>
                  <ProjectStatusBadge status={project.status} />
                </div>
                <p className="mt-3 text-sm text-muted-foreground">{project.description}</p>
                <PercentBar className="mt-4" value={project.progress} label="Progress" />
                <p className="mt-3 text-xs text-muted-foreground">
                  Scrum Master: {project.scrumMasterName ?? '—'} · {project.teamCount} teams
                </p>
              </Card>
            </Link>
          ))}
        </div>
      )}
      <CreateProjectDialog
        open={open}
        onOpenChange={setOpen}
        onCreated={() => void queryClient.invalidateQueries({ queryKey: ['projects-overview'] })}
      />
    </div>
  )
}

export function ProjectDetailPage() {
  const { id } = useParams()
  const query = useQuery({
    queryKey: ['structure', id],
    queryFn: () => fetchStructure(id!),
    enabled: Boolean(id),
  })
  if (query.isLoading) return <DashboardSkeleton />
  if (query.isError || !query.data?.project) return <ErrorState onRetry={() => query.refetch()} />
  const { project } = query.data

  return (
    <div>
      <PageHeader title={project.name} description={project.description} />
      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="members">Members</TabsTrigger>
          <TabsTrigger value="structure">Structure</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>
        <TabsContent value="overview">
          <Card className="p-5">
            <ProjectStatusBadge status={project.status} />
            <PercentBar className="mt-4" value={projectProgress(project.id)} label="Project progress" />
            <p className="mt-4 text-sm">Scrum Master: {displayName(query.data.scrumMaster)}</p>
          </Card>
        </TabsContent>
        <TabsContent value="members">
          <Card className="p-5">
            {query.data.tree.map((node) => (
              <div key={node.team.id} className="mb-4">
                <p className="font-semibold">{node.team.name}</p>
                <p className="text-sm text-muted-foreground">Mentor {displayName(node.mentor)}</p>
              </div>
            ))}
          </Card>
        </TabsContent>
        <TabsContent value="structure">
          <StructurePage />
        </TabsContent>
        <TabsContent value="analytics">
          <Card className="p-5">
            <PercentBar value={projectProgress(project.id)} label="Roll-up from teams" />
          </Card>
        </TabsContent>
        <TabsContent value="settings">
          <Card className="p-5 text-sm text-muted-foreground">
            Project settings are available to the Scrum Master. Hierarchy changes are audited.
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
