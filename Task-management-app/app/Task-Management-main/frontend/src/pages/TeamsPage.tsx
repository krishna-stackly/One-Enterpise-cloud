import { useQuery } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { fetchTeams } from '@/api'
import { EmptyState, ErrorState } from '@/components/common/EmptyState'
import { PageHeader, PercentBar } from '@/components/common/PageHeader'
import { UserAvatar, UserChip } from '@/components/common/UserAvatar'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  displayName,
  mentorOfTeam,
  pocLeadsOfTeam,
  associatesOf,
  teamProgress,
  teamRosterBreakdown,
} from '@/data/selectors'
import { DashboardSkeleton } from '@/features/dashboard/DashboardSkeleton'
import { AddPersonDialog } from '@/features/org/AddPersonDialog'
import { AssignMemberDialog } from '@/features/org/AssignMemberDialog'
import { CreateTeamDialog } from '@/features/org/CreateTeamDialog'
import { useSession } from '@/stores/auth-store'
import { AssignmentType, SystemRole } from '@/types'

export function TeamsPage() {
  const { projectId, role, teamId, user } = useSession()
  const [open, setOpen] = useState(false)
  const query = useQuery({
    queryKey: ['teams', projectId],
    queryFn: () => fetchTeams(projectId ?? undefined),
    enabled: Boolean(projectId),
  })
  const canCreate = role === AssignmentType.SCRUM_MASTER || user?.systemRole === SystemRole.ADMIN
  if (query.isLoading) return <DashboardSkeleton />
  if (query.isError) return <ErrorState onRetry={() => query.refetch()} />
  const list =
    role === AssignmentType.MENTOR && teamId
      ? (query.data ?? []).filter((team) => team.id === teamId)
      : (query.data ?? [])

  return (
    <div>
      <PageHeader
        title={role === AssignmentType.MENTOR ? 'My Team' : 'Teams'}
        count={list.length}
        countNoun="teams"
        description={
          role === AssignmentType.MENTOR
            ? 'You are Mentor / POC of this team. Add another POC, or add associates and assign them to a POC.'
            : 'Mentor → POC → Associate.'
        }
        actions={
          canCreate && projectId ? (
            <Button onClick={() => setOpen(true)}>
              <Plus className="h-4 w-4" />
              Create team
            </Button>
          ) : null
        }
      />
      {list.length === 0 ? (
        <EmptyState title="No teams found." />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {list.map((team) => {
            const roster = teamRosterBreakdown(team.id)
            return (
            <Link key={team.id} to={`/teams/${team.id}`}>
              <Card className="p-5 hover:bg-slate-50">
                <p className="text-lg font-semibold">{team.name}</p>
                <p className="text-sm text-muted-foreground">{team.description}</p>
                <p className="mt-3 text-sm">Mentor: {displayName(mentorOfTeam(team.id))}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Team size: {roster.size}
                  {roster.size > 0
                    ? ` · ${roster.mentors} mentor${roster.mentors === 1 ? '' : 's'} · ${roster.pocs} POC${roster.pocs === 1 ? '' : 's'} · ${roster.associates} associate${roster.associates === 1 ? '' : 's'}`
                    : ''}
                </p>
                <PercentBar className="mt-3" value={teamProgress(team.id)} />
              </Card>
            </Link>
            )
          })}
        </div>
      )}
      {projectId ? <CreateTeamDialog open={open} onOpenChange={setOpen} projectId={projectId} /> : null}
    </div>
  )
}

export function TeamDetailPage() {
  const { id } = useParams()
  const { role, user } = useSession()
  const [assignOpen, setAssignOpen] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [presetRole, setPresetRole] = useState<typeof AssignmentType.POC | typeof AssignmentType.ASSOCIATE | undefined>()
  const teamQuery = useQuery({ queryKey: ['teams'], queryFn: () => fetchTeams() })
  const team = teamQuery.data?.find((item) => item.id === id)
  if (teamQuery.isLoading) return <DashboardSkeleton />
  if (!team) return <EmptyState title="Team not found" />
  const mentor = mentorOfTeam(team.id)
  const pocLeads = pocLeadsOfTeam(team.id)
  const roster = teamRosterBreakdown(team.id)
  const canAssign =
    role === AssignmentType.SCRUM_MASTER || role === AssignmentType.MENTOR || user?.systemRole === SystemRole.ADMIN
  const allowedTypes =
    role === AssignmentType.MENTOR
      ? [AssignmentType.POC, AssignmentType.ASSOCIATE]
      : [AssignmentType.MENTOR, AssignmentType.POC]

  return (
    <div>
      <PageHeader
        title={team.name}
        count={roster.size}
        countNoun="members"
        description={team.description}
        actions={
          canAssign ? (
            <div className="flex flex-wrap gap-2">
              {role === AssignmentType.MENTOR ? (
                <>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setPresetRole(AssignmentType.POC)
                      setAddOpen(true)
                    }}
                  >
                    <Plus className="h-4 w-4" />
                    Add POC
                  </Button>
                  <Button
                    onClick={() => {
                      setPresetRole(AssignmentType.ASSOCIATE)
                      setAddOpen(true)
                    }}
                  >
                    <Plus className="h-4 w-4" />
                    Add associate
                  </Button>
                </>
              ) : null}
              <Button variant={role === AssignmentType.MENTOR ? 'outline' : 'default'} onClick={() => setAssignOpen(true)}>
                <Plus className="h-4 w-4" />
                Assign existing
              </Button>
            </div>
          ) : null
        }
      />
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="p-5">
          <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Mentor</p>
          <div className="mt-3">
            <UserChip user={mentor} subtitle="Team Mentor" />
          </div>
          <PercentBar className="mt-4" value={teamProgress(team.id)} label="Team progress" />
        </Card>
        <Card className="p-5 lg:col-span-2">
          <p className="mb-4 text-sm font-semibold">Hierarchy</p>
          <div className="space-y-4">
            {pocLeads.map((lead) => (
              <div key={lead.user.id} className="rounded-xl border p-4">
                <div className="flex items-center gap-2">
                  <UserAvatar user={lead.user} size="sm" />
                  <div>
                    <p className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                      {lead.isMentor ? 'Mentor / POC' : 'POC'}
                    </p>
                    <p className="font-medium">{displayName(lead.user)}</p>
                  </div>
                </div>
                <div className="mt-3 space-y-2">
                  {associatesOf(lead.user.id, team.projectId).length === 0 ? (
                    <p className="text-xs text-muted-foreground">No associates.</p>
                  ) : (
                    associatesOf(lead.user.id, team.projectId).map((associate) => (
                      <div key={associate.id} className="flex items-center gap-2 pl-2">
                        <UserAvatar user={associate} size="sm" />
                        <div>
                          <p className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                            Associate
                          </p>
                          <p className="text-sm">{displayName(associate)}</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            ))}
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            {roster.size} members · {pocLeads.length} POC leads · {roster.associates} associates
          </p>
        </Card>
      </div>
      <AssignMemberDialog
        open={assignOpen}
        onOpenChange={setAssignOpen}
        projectId={team.projectId}
        teamId={team.id}
        allowedTypes={allowedTypes}
      />
      {role === AssignmentType.MENTOR ? (
        <AddPersonDialog open={addOpen} onOpenChange={setAddOpen} presetRole={presetRole} />
      ) : null}
    </div>
  )
}
