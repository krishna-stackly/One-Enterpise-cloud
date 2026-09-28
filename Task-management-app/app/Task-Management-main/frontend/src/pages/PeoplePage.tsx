import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, UserMinus } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { toast } from 'sonner'
import { apiRemoveMember, fetchAssignments, fetchUsers } from '@/api'
import { EmptyState, ErrorState } from '@/components/common/EmptyState'
import { PageHeader } from '@/components/common/PageHeader'
import { UserChip } from '@/components/common/UserAvatar'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { assignments as liveAssignments, teams } from '@/data/organization'
import { AddPersonDialog } from '@/features/org/AddPersonDialog'
import { DashboardSkeleton } from '@/features/dashboard/DashboardSkeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useSession } from '@/stores/auth-store'
import { ASSIGNMENT_LABEL, AssignmentType, type User } from '@/types'

export function PeoplePage() {
  const { user, role, projectId, teamId } = useSession()
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [presetRole, setPresetRole] = useState<typeof AssignmentType.POC | typeof AssignmentType.ASSOCIATE | undefined>(
    undefined,
  )
  const [removeTarget, setRemoveTarget] = useState<User | null>(null)
  const [q, setQ] = useState('')
  const canManage = role === AssignmentType.SCRUM_MASTER || role === AssignmentType.MENTOR
  const people = useQuery({ queryKey: ['users'], queryFn: fetchUsers, enabled: canManage })
  const assignmentQuery = useQuery({ queryKey: ['assignments'], queryFn: fetchAssignments, enabled: canManage })

  const remove = useMutation({
    mutationFn: async (target: User) => {
      if (!projectId || !user) throw new Error('No active project')
      await apiRemoveMember({ userId: target.id, projectId, actorId: user.id })
    },
    onSuccess: () => {
      toast.success('Person removed from this project')
      setRemoveTarget(null)
      void queryClient.invalidateQueries({ queryKey: ['users'] })
      void queryClient.invalidateQueries({ queryKey: ['assignments'] })
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      void queryClient.invalidateQueries({ queryKey: ['tasks'] })
      void queryClient.invalidateQueries({ queryKey: ['structure'] })
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const rows = useMemo(() => {
    const list = people.data ?? []
    const query = q.trim().toLowerCase()
    const allAssignments = assignmentQuery.data ?? liveAssignments
    return list
      .filter(
        (person) =>
          !query ||
          `${person.firstName} ${person.lastName}`.toLowerCase().includes(query) ||
          person.email.includes(query) ||
          person.title.toLowerCase().includes(query),
      )
      .map((person) => {
        const personAssignments = allAssignments.filter((item) => item.userId === person.id)
        const inCurrentProject = projectId
          ? personAssignments.filter((item) => item.projectId === projectId)
          : personAssignments
        const roleLabels = [...new Set(inCurrentProject.map((item) => ASSIGNMENT_LABEL[item.assignmentType]))]
        const teamNames = [
          ...new Set(
            inCurrentProject
              .map((item) => (item.teamId ? teams.find((row) => row.id === item.teamId)?.name : undefined))
              .filter((name): name is string => Boolean(name)),
          ),
        ]
        const removableTypes =
          role === AssignmentType.POC
            ? inCurrentProject.filter(
                (item) =>
                  item.assignmentType === AssignmentType.ASSOCIATE && item.pocId === user?.id,
              )
            : role === AssignmentType.MENTOR
            ? inCurrentProject.filter(
                (item) =>
                  (item.assignmentType === AssignmentType.POC ||
                    item.assignmentType === AssignmentType.ASSOCIATE) &&
                  (!teamId || item.teamId === teamId),
              )
            : inCurrentProject.filter((item) => item.assignmentType !== AssignmentType.SCRUM_MASTER)
        const canRemove =
          Boolean(projectId) && person.id !== user?.id && removableTypes.length > 0 && removableTypes.length === inCurrentProject.length
        return { person, roleLabels, teamNames, canRemove }
      })
  }, [people.data, assignmentQuery.data, q, projectId, user?.id, role, teamId])

  if (role === AssignmentType.POC) {
    return <Navigate to="/my-team" replace />
  }

  if (!canManage) {
    return (
      <EmptyState
        title="People are managed by Scrum Masters and Mentors."
        description="POCs manage associates from My Team. Associates cannot sign in."
      />
    )
  }

  if (people.isLoading) return <DashboardSkeleton />
  if (people.isError) return <ErrorState onRetry={() => people.refetch()} />

  return (
    <div>
      <PageHeader
        title="People"
        count={rows.length}
        countNoun="people"
        description={
          role === AssignmentType.MENTOR
            ? 'Add a POC to your team, or add an associate and assign them to yourself or another POC.'
            : 'Scrum Masters and Mentors pick a team first, then add people. POCs add associates from My Team.'
        }
        actions={
          canManage ? (
            role === AssignmentType.MENTOR ? (
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setPresetRole(AssignmentType.POC)
                    setOpen(true)
                  }}
                >
                  <Plus className="h-4 w-4" />
                  Add POC
                </Button>
                <Button
                  onClick={() => {
                    setPresetRole(AssignmentType.ASSOCIATE)
                    setOpen(true)
                  }}
                >
                  <Plus className="h-4 w-4" />
                  Add associate
                </Button>
              </div>
            ) : (
              <Button
                onClick={() => {
                  setPresetRole(undefined)
                  setOpen(true)
                }}
              >
                <Plus className="h-4 w-4" />
                Add person
              </Button>
            )
          ) : null
        }
      />
      <Input
        className="mb-4 max-w-md"
        placeholder="Search by name, email, or title"
        value={q}
        onChange={(event) => setQ(event.target.value)}
      />
      {rows.length === 0 ? (
        <EmptyState title="No people found." description="Add a person and assign their role on a team." />
      ) : (
        <div className="overflow-hidden rounded-xl border-0 bg-card shadow-card">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50/80">
                <TableHead>Person</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Team</TableHead>
                <TableHead className="w-[120px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map(({ person, roleLabels, teamNames, canRemove }) => (
                <TableRow key={person.id}>
                  <TableCell>
                    <UserChip user={person} />
                  </TableCell>
                  <TableCell className="text-muted-foreground">{person.email}</TableCell>
                  <TableCell>{person.title}</TableCell>
                  <TableCell>{roleLabels.length > 0 ? roleLabels.join(', ') : '—'}</TableCell>
                  <TableCell>{teamNames.length > 0 ? teamNames.join(', ') : '—'}</TableCell>
                  <TableCell>
                    {canRemove ? (
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                        onClick={() => setRemoveTarget(person)}
                      >
                        <UserMinus className="h-3.5 w-3.5" />
                        Remove
                      </Button>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      {canManage ? <AddPersonDialog open={open} onOpenChange={setOpen} presetRole={presetRole} /> : null}
      <Dialog open={Boolean(removeTarget)} onOpenChange={(next) => !next && setRemoveTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove from project?</DialogTitle>
            <DialogDescription>
              {removeTarget
                ? `${removeTarget.firstName} ${removeTarget.lastName} will lose their role on this project. Their account stays so they can remain on other projects. Incomplete tasks assigned to them will be unassigned.`
                : null}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRemoveTarget(null)} disabled={remove.isPending}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={!removeTarget || remove.isPending}
              onClick={() => removeTarget && remove.mutate(removeTarget)}
            >
              {remove.isPending ? 'Removing…' : 'Remove'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
