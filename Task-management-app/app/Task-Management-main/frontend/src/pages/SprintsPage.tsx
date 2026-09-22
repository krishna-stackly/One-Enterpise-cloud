import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { format, parseISO } from 'date-fns'
import { Plus } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { apiCreateSprint, apiDeleteSprint, apiEditSprint, apiUpdateSprintStatus, fetchSprints, fetchTeams } from '@/api'
import { EmptyState, ErrorState } from '@/components/common/EmptyState'
import { PageHeader } from '@/components/common/PageHeader'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { DashboardSkeleton } from '@/features/dashboard/DashboardSkeleton'
import { AssignWorkToPocDialog } from '@/features/tasks/AssignWorkToPocDialog'
import { useSession } from '@/stores/auth-store'
import { AssignmentType, type Sprint } from '@/types'

export function SprintsPage() {
  const { user, role, projectId, teamId } = useSession()
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [assignOpen, setAssignOpen] = useState(false)
  const [selectedSprint, setSelectedSprint] = useState<Sprint | null>(null)
  const [editOpen, setEditOpen] = useState(false)
  const [editForm, setEditForm] = useState({
    teamId: '',
    name: '',
    goal: '',
    startDate: '',
    endDate: '',
  })
  const [deleteTarget, setDeleteTarget] = useState<Sprint | null>(null)
  const [form, setForm] = useState({
    teamId: '',
    name: '',
    goal: '',
    startDate: '',
    endDate: '',
  })

  const teamsQuery = useQuery({
    queryKey: ['teams', projectId],
    queryFn: () => fetchTeams(projectId!),
    enabled: Boolean(projectId),
  })
  const sprintsQuery = useQuery({
    queryKey: ['sprints', projectId, teamId],
    queryFn: () => fetchSprints(projectId!, role === AssignmentType.MENTOR ? teamId ?? undefined : undefined),
    enabled: Boolean(projectId),
  })

  const create = useMutation({
    mutationFn: () =>
      apiCreateSprint({
        projectId: projectId!,
        teamId: form.teamId,
        name: form.name,
        goal: form.goal || undefined,
        startDate: form.startDate,
        endDate: form.endDate,
      }),
    onSuccess: () => {
      toast.success('Sprint plan created')
      setOpen(false)
      setForm({ teamId: '', name: '', goal: '', startDate: '', endDate: '' })
      void queryClient.invalidateQueries({ queryKey: ['sprints'] })
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const activate = useMutation({
    mutationFn: (sprint: Sprint) => apiUpdateSprintStatus(sprint.id, 'ACTIVE'),
    onSuccess: () => {
      toast.success('Sprint activated')
      void queryClient.invalidateQueries({ queryKey: ['sprints'] })
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const edit = useMutation({
    mutationFn: () =>
      apiEditSprint({
        id: selectedSprint!.id,
        projectId: projectId!,
        teamId: editForm.teamId,
        name: editForm.name,
        goal: editForm.goal || undefined,
        startDate: editForm.startDate,
        endDate: editForm.endDate,
      }),
    onSuccess: () => {
      toast.success('Sprint plan updated')
      setEditOpen(false)
      setEditForm({ teamId: '', name: '', goal: '', startDate: '', endDate: '' })
      setSelectedSprint(null)
      void queryClient.invalidateQueries({ queryKey: ['sprints'] })
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const remove = useMutation({
    mutationFn: (sprint: Sprint) => apiDeleteSprint(sprint.id),
    onSuccess: () => {
      toast.success('Sprint plan deleted')
      setDeleteTarget(null)
      setSelectedSprint(null)
      void queryClient.invalidateQueries({ queryKey: ['sprints'] })
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const teams = teamsQuery.data ?? []
  const sprints = sprintsQuery.data ?? []
  const canUse = user && (role === AssignmentType.SCRUM_MASTER || role === AssignmentType.MENTOR)

  if (!projectId) return <DashboardSkeleton />
  if (sprintsQuery.isLoading || teamsQuery.isLoading) return <DashboardSkeleton />
  if (sprintsQuery.isError || teamsQuery.isError) return <ErrorState onRetry={() => { sprintsQuery.refetch(); teamsQuery.refetch() } } />

  return (
    <div className="animate-fade-up space-y-6">
      <PageHeader
        title="Sprint plans"
        count={sprints.length}
        countNoun="sprints"
        description="Group tasks into timeboxed delivery cycles for each team."
        actions={
          user && role === AssignmentType.SCRUM_MASTER ? (
            <Button onClick={() => setOpen(true)}>
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              New sprint plan
            </Button>
          ) : null
        }
      />

      <Card className="border-0 shadow-card">
        <CardHeader className="border-b bg-gradient-to-r from-[#e8ecf4] to-[#eef2ff]">
          <CardTitle className="text-base">Plans</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {sprints.length === 0 ? (
            <EmptyState title="No sprint plans yet." className="py-10" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50/80">
                  <TableHead>Status</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Team</TableHead>
                  <TableHead>Start</TableHead>
                  <TableHead>End</TableHead>
                  {canUse ? <TableHead className="w-[200px]">Actions</TableHead> : null}
                </TableRow>
              </TableHeader>
              <TableBody>
                {sprints.map((sprint, index) => (
                  <TableRow
                    key={sprint.id}
                    className="animate-fade-up transition-colors hover:bg-slate-50/60"
                    style={{ animationDelay: `${Math.min(index, 8) * 35}ms` }}
                  >
                    <TableCell>
                      <span
                        className="inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-semibold"
                        style={{
                          backgroundColor: sprint.status === 'PLANNED' ? '#eef2ff' : sprint.status === 'ACTIVE' ? '#ecfdf5' : '#fef3c7',
                          borderColor: sprint.status === 'PLANNED' ? '#c7d2fe' : sprint.status === 'ACTIVE' ? '#a7f3d0' : '#fde68a',
                        }}
                      >
                        {sprint.status}
                      </span>
                    </TableCell>
                    <TableCell className="font-medium">{sprint.name}</TableCell>
                    <TableCell className="text-muted-foreground">{sprint.teamName}</TableCell>
                    <TableCell className="text-muted-foreground">{format(parseISO(sprint.startDate), 'MMM d, yyyy')}</TableCell>
                    <TableCell className="text-muted-foreground">{format(parseISO(sprint.endDate), 'MMM d, yyyy')}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1.5">
                        {sprint.status === 'PLANNED' ? (
                          <Button size="sm" variant="outline" onClick={() => activate.mutate(sprint)}>
                            Activate
                          </Button>
                        ) : null}
                        {role === AssignmentType.MENTOR ? (
                          <Button
                            size="sm"
                            onClick={() => {
                              setSelectedSprint(sprint)
                              setAssignOpen(true)
                            }}
                          >
                            Assign tasks
                          </Button>
                        ) : null}
                        {role === AssignmentType.SCRUM_MASTER ? (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setSelectedSprint(sprint)
                                setEditForm({
                                  teamId: sprint.teamId,
                                  name: sprint.name,
                                  goal: sprint.goal ?? '',
                                  startDate: sprint.startDate,
                                  endDate: sprint.endDate,
                                })
                                setEditOpen(true)
                              }}
                            >
                              Edit
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                              onClick={() => setDeleteTarget(sprint)}
                            >
                              Delete
                            </Button>
                          </>
                        ) : null}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create sprint plan</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Team</Label>
              <Select value={form.teamId} onValueChange={(value) => setForm((prev) => ({ ...prev, teamId: value }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select team" />
                </SelectTrigger>
                <SelectContent>
                  {teams.map((team) => (
                    <SelectItem key={team.id} value={team.id}>
                      {team.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input value={form.name} onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Goal</Label>
              <Textarea value={form.goal} onChange={(event) => setForm((prev) => ({ ...prev, goal: event.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Start</Label>
                <Input
                  type="date"
                  value={form.startDate}
                  onChange={(event) => setForm((prev) => ({ ...prev, startDate: event.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>End</Label>
                <Input
                  type="date"
                  value={form.endDate}
                  onChange={(event) => setForm((prev) => ({ ...prev, endDate: event.target.value }))}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={!form.teamId || !form.name || !form.startDate || !form.endDate || create.isPending}
              onClick={() => create.mutate()}
            >
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit sprint plan</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Team</Label>
              <Select value={editForm.teamId} onValueChange={(value) => setEditForm((prev) => ({ ...prev, teamId: value }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select team" />
                </SelectTrigger>
                <SelectContent>
                  {teams.map((team) => (
                    <SelectItem key={team.id} value={team.id}>
                      {team.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input value={editForm.name} onChange={(event) => setEditForm((prev) => ({ ...prev, name: event.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Goal</Label>
              <Textarea value={editForm.goal} onChange={(event) => setEditForm((prev) => ({ ...prev, goal: event.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Start</Label>
                <Input
                  type="date"
                  value={editForm.startDate}
                  onChange={(event) => setEditForm((prev) => ({ ...prev, startDate: event.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>End</Label>
                <Input
                  type="date"
                  value={editForm.endDate}
                  onChange={(event) => setEditForm((prev) => ({ ...prev, endDate: event.target.value }))}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={!editForm.teamId || !editForm.name || !editForm.startDate || !editForm.endDate || edit.isPending}
              onClick={() => edit.mutate()}
            >
              Update
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(deleteTarget)} onOpenChange={(next) => !next && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete sprint plan?</DialogTitle>
            <DialogDescription>
              {deleteTarget
                ? `“${deleteTarget.name}” will be permanently deleted. Tasks assigned to this sprint will be unlinked. This cannot be undone.`
                : null}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={remove.isPending}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={!deleteTarget || remove.isPending}
              onClick={() => deleteTarget && remove.mutate(deleteTarget)}
            >
              {remove.isPending ? 'Deleting…' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {assignOpen && selectedSprint && projectId ? (
        <AssignWorkToPocDialog
          open={assignOpen}
          onOpenChange={setAssignOpen}
          teamId={selectedSprint.teamId}
          projectId={projectId}
          sprintId={selectedSprint.id}
        />
      ) : null}
    </div>
  )
}