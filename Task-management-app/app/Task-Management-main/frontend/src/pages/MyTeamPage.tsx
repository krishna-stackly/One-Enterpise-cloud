import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, UserMinus } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { toast } from 'sonner'
import { apiRemoveMember, fetchAssignments, fetchPocDashboard, fetchUsers } from '@/api'
import { EmptyState, ErrorState } from '@/components/common/EmptyState'
import { PageHeader } from '@/components/common/PageHeader'
import { StatusBadge } from '@/components/common/StatusBadge'
import { UserChip } from '@/components/common/UserAvatar'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { DashboardSkeleton } from '@/features/dashboard/DashboardSkeleton'
import { AddPersonDialog } from '@/features/org/AddPersonDialog'
import { TaskWorkActions } from '@/features/tasks/TaskWorkActions'
import { assignments as liveAssignments } from '@/data/organization'
import { associatesOf, displayName, workerName } from '@/data/selectors'
import { useSession } from '@/stores/auth-store'
import { AssignmentType, type User } from '@/types'

export function MyTeamPage() {
  const { user, role, projectId } = useSession()
  const userId = user?.id
  const queryClient = useQueryClient()
  const [addOpen, setAddOpen] = useState(false)
  const [removeTarget, setRemoveTarget] = useState<User | null>(null)

  const query = useQuery({
    queryKey: ['my-team', userId, projectId],
    queryFn: () => fetchPocDashboard(userId!, projectId!),
    enabled: Boolean(userId && projectId),
  })
  const peopleQuery = useQuery({
    queryKey: ['users'],
    queryFn: fetchUsers,
    enabled: Boolean(userId && projectId),
  })
  const assignmentQuery = useQuery({
    queryKey: ['assignments'],
    queryFn: fetchAssignments,
    enabled: Boolean(userId && projectId),
  })

  const associates = useMemo(() => {
    if (!userId || !projectId) return []
    return associatesOf(userId, projectId)
  }, [userId, projectId, peopleQuery.data, assignmentQuery.data])

  const remove = useMutation({
    mutationFn: async (target: User) => {
      if (!projectId || !user) throw new Error('No active project')
      await apiRemoveMember({ userId: target.id, projectId, actorId: user.id })
    },
    onSuccess: () => {
      toast.success('Associate removed from your team')
      setRemoveTarget(null)
      void queryClient.invalidateQueries({ queryKey: ['users'] })
      void queryClient.invalidateQueries({ queryKey: ['assignments'] })
      void queryClient.invalidateQueries({ queryKey: ['my-team'] })
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      void queryClient.invalidateQueries({ queryKey: ['tasks'] })
    },
    onError: (error: Error) => toast.error(error.message),
  })

  if (role && role !== AssignmentType.POC) {
    return <Navigate to="/teams" replace />
  }

  if (query.isLoading) return <DashboardSkeleton />
  if (query.isError || !query.data) {
    return <ErrorState onRetry={() => query.refetch()} title="Unable to load your team" />
  }

  const data = query.data
  const parents = data.parents ?? []
  const allAssignments = assignmentQuery.data ?? liveAssignments

  return (
    <div className="space-y-6">
      <PageHeader
        title="My team"
        count={associates.length + (user ? 1 : 0)}
        countNoun="members"
        description="Manage your associates and assign work. Start a task to split it into subtasks, or give the whole task to one person."
        actions={
          <Button onClick={() => setAddOpen(true)}>
            <Plus className="h-4 w-4" />
            Add associate
          </Button>
        }
      />

      <div className="overflow-hidden rounded-xl border-0 bg-card shadow-card">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50/80">
              <TableHead>Person</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Email</TableHead>
              <TableHead className="w-[120px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {user ? (
              <TableRow>
                <TableCell>
                  <UserChip user={user} />
                </TableCell>
                <TableCell>POC</TableCell>
                <TableCell className="text-muted-foreground">{user.email}</TableCell>
                <TableCell>
                  <span className="text-xs text-muted-foreground">You</span>
                </TableCell>
              </TableRow>
            ) : null}
            {associates.map((person) => {
              const canRemove = allAssignments.some(
                (item) =>
                  item.userId === person.id &&
                  item.projectId === projectId &&
                  item.assignmentType === AssignmentType.ASSOCIATE &&
                  item.pocId === userId,
              )
              return (
                <TableRow key={person.id}>
                  <TableCell>
                    <UserChip user={person} />
                  </TableCell>
                  <TableCell>Associate</TableCell>
                  <TableCell className="text-muted-foreground">{person.email}</TableCell>
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
              )
            })}
          </TableBody>
        </Table>
      </div>
      {associates.length === 0 ? (
        <EmptyState
          title="No associates on your team yet."
          description="Add an associate, then assign work to them when you start a task."
        />
      ) : null}

      <div>
        <h2 className="mb-3 text-base font-semibold text-slate-900">Assign work</h2>
        {parents.length === 0 ? (
          <EmptyState
            title="No parent tasks yet."
            description="When a Mentor assigns a parent task to you, click Start to divide it into subtasks or assign the whole task to one person."
          />
        ) : (
          <div className="space-y-4">
            {parents.map((task) => (
              <Card key={task.id}>
                <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
                  <div>
                    <CardTitle className="text-base">{task.title}</CardTitle>
                    <p className="mt-1 text-sm text-muted-foreground">{task.description}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span>Working on: {workerName(task)}</span>
                      <StatusBadge status={task.status} />
                    </div>
                  </div>
                  {user ? <TaskWorkActions task={task} user={user} /> : null}
                </CardHeader>
                <CardContent className="space-y-3">
                  {(task.children ?? []).length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      Click Start to divide this into subtasks, or assign the complete task to yourself or one associate.
                    </p>
                  ) : (
                    (task.children ?? []).map((child) => (
                      <div key={child.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3">
                        <div>
                          <p className="text-sm font-medium">{child.title}</p>
                          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                            <span>
                              Working on:{' '}
                              {'assignee' in child && child.assignee
                                ? displayName(child.assignee as User)
                                : workerName(child)}
                            </span>
                            <StatusBadge status={child.status} />
                          </div>
                        </div>
                        {user ? <TaskWorkActions task={child} user={user} /> : null}
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <AddPersonDialog open={addOpen} onOpenChange={setAddOpen} />
      <Dialog open={Boolean(removeTarget)} onOpenChange={(next) => !next && setRemoveTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove associate?</DialogTitle>
            <DialogDescription>
              {removeTarget
                ? `${removeTarget.firstName} ${removeTarget.lastName} will be removed from your team. Incomplete tasks assigned to them will be unassigned.`
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
