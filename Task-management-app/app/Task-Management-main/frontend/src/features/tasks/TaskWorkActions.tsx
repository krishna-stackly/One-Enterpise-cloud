import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ListTree, UserRound } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { apiReassignTask, apiStatus } from '@/api'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { associatesOf, displayName, workAssigneesForLead } from '@/data/selectors'
import { BreakDownTaskDialog } from '@/features/tasks/BreakDownTaskDialog'
import { useSession } from '@/stores/auth-store'
import { AssignmentType, TaskStatus, type Task, type User } from '@/types'

function canManageWork(
  task: Task,
  user: User,
  role: AssignmentType | undefined,
  projectId: string | null,
  teamId: string | null,
) {
  if (task.assignedTo === user.id) return true
  if (role !== AssignmentType.POC && role !== AssignmentType.MENTOR) return false
  if (associatesOf(user.id, projectId).some((item) => item.id === task.assignedTo)) return true
  if (task.parentTaskId !== null) return false
  if (projectId && task.projectId !== projectId) return false
  if (teamId && task.teamId !== teamId) return false
  return true
}

export function TaskWorkActions({ task, user }: { task: Task; user: User }) {
  const { role, projectId, teamId } = useSession()
  const queryClient = useQueryClient()
  const [startOpen, setStartOpen] = useState(false)
  const [breakDownOpen, setBreakDownOpen] = useState(false)
  const [startStep, setStartStep] = useState<'choose' | 'assign'>('choose')
  const [workerId, setWorkerId] = useState(task.assignedTo ?? user.id)
  const allowed = canManageWork(task, user, role, projectId, teamId)
  const isSquadLead = role === AssignmentType.POC || role === AssignmentType.MENTOR
  const teamWorkers = isSquadLead ? workAssigneesForLead(user, projectId, task.teamId, role) : []
  const canSplit = isSquadLead && task.parentTaskId === null

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    void queryClient.invalidateQueries({ queryKey: ['my-team'] })
    void queryClient.invalidateQueries({ queryKey: ['tasks'] })
    void queryClient.invalidateQueries({ queryKey: ['task', task.id] })
  }

  const start = useMutation({
    mutationFn: async () => {
      const assigneeId = isSquadLead ? workerId : (task.assignedTo ?? user.id)
      const worker = teamWorkers.find((person) => person.user.id === assigneeId)?.user ?? user
      const name = displayName(worker)
      if (isSquadLead && assigneeId !== task.assignedTo) {
        await apiReassignTask(task.id, assigneeId)
      }
      await apiStatus(task.id, TaskStatus.IN_PROGRESS, user, task.projectId, name)
    },
    onSuccess: () => {
      toast.success('Task assigned and started')
      setStartOpen(false)
      invalidate()
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const submit = useMutation({
    mutationFn: () => apiStatus(task.id, TaskStatus.IN_REVIEW, user, task.projectId),
    onSuccess: () => {
      toast.success('Submitted for review')
      invalidate()
    },
    onError: (error: Error) => toast.error(error.message),
  })

  if (!allowed) return null

  if (task.status === TaskStatus.ASSIGNED || task.status === TaskStatus.REOPENED) {
    return (
      <div className="flex flex-wrap gap-1.5" onClick={(event) => event.stopPropagation()}>
        <Button
          size="sm"
          onClick={() => {
            const current =
              task.assignedTo && teamWorkers.some((person) => person.user.id === task.assignedTo)
                ? task.assignedTo
                : user.id
            setWorkerId(current)
            setStartStep(canSplit ? 'choose' : 'assign')
            setStartOpen(true)
          }}
        >
          Start
        </Button>
        <Dialog open={startOpen} onOpenChange={setStartOpen}>
          <DialogContent className="sm:max-w-lg">
            {startStep === 'choose' ? (
              <>
                <DialogHeader>
                  <DialogTitle>How do you want to start this task?</DialogTitle>
                  <DialogDescription>
                    {role === AssignmentType.MENTOR
                      ? 'Split it across POCs and associates, or give the whole task to one person, including yourself.'
                      : 'Split it across your team, or give the whole task to one person, including yourself.'}
                  </DialogDescription>
                </DialogHeader>
                <div className="grid min-w-0 gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="h-auto w-full items-start justify-start gap-3 whitespace-normal py-3 text-left"
                    onClick={() => {
                      setStartOpen(false)
                      setBreakDownOpen(true)
                    }}
                  >
                    <ListTree className="mt-0.5 h-4 w-4 shrink-0" />
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium">Divide into subtasks</span>
                      <span className="mt-0.5 block text-xs font-normal text-muted-foreground">
                        {role === AssignmentType.MENTOR
                          ? 'Break this work up and assign each piece to a POC, an associate, or yourself.'
                          : 'Break this work up and assign each piece to someone on your team.'}
                      </span>
                    </span>
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-auto w-full items-start justify-start gap-3 whitespace-normal py-3 text-left"
                    onClick={() => setStartStep('assign')}
                  >
                    <UserRound className="mt-0.5 h-4 w-4 shrink-0" />
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium">Assign the complete task to one person</span>
                      <span className="mt-0.5 block text-xs font-normal text-muted-foreground">
                        {role === AssignmentType.MENTOR
                          ? 'Give the whole task to yourself, a POC, or one of your associates.'
                          : 'Give the whole task to yourself or one associate.'}
                      </span>
                    </span>
                  </Button>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setStartOpen(false)}>
                    Cancel
                  </Button>
                </DialogFooter>
              </>
            ) : (
              <>
                <DialogHeader>
                  <DialogTitle>Assign the complete task</DialogTitle>
                  <DialogDescription>
                    {role === AssignmentType.MENTOR
                      ? 'Pick who will own this whole task: a POC, an associate, or yourself.'
                      : isSquadLead
                        ? 'Pick who will own this whole task: an associate, or yourself.'
                        : 'Start this task. The assigned person is already on the work.'}
                  </DialogDescription>
                </DialogHeader>
                {isSquadLead ? (
                  <div className="space-y-2">
                    <Label>Assign to</Label>
                    <Select value={workerId} onValueChange={setWorkerId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select who will work on this" />
                      </SelectTrigger>
                      <SelectContent>
                        {teamWorkers.map((person) => (
                          <SelectItem key={person.user.id} value={person.user.id}>
                            {person.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {teamWorkers.length <= 1 ? (
                      <p className="text-xs text-muted-foreground">
                        {role === AssignmentType.MENTOR
                          ? 'No POCs or associates yet. Add them on People or My Team.'
                          : 'No associates yet. Add them on My Team if you want to assign this to someone else.'}
                      </p>
                    ) : null}
                  </div>
                ) : null}
                <DialogFooter>
                  {canSplit ? (
                    <Button variant="ghost" onClick={() => setStartStep('choose')} disabled={start.isPending}>
                      Back
                    </Button>
                  ) : null}
                  <Button variant="outline" onClick={() => setStartOpen(false)} disabled={start.isPending}>
                    Cancel
                  </Button>
                  <Button
                    onClick={() => start.mutate()}
                    disabled={start.isPending || (isSquadLead && !workerId)}
                  >
                    {start.isPending ? 'Saving…' : 'Assign and start'}
                  </Button>
                </DialogFooter>
              </>
            )}
          </DialogContent>
        </Dialog>
        {canSplit ? (
          <BreakDownTaskDialog parent={breakDownOpen ? task : null} onOpenChange={setBreakDownOpen} />
        ) : null}
      </div>
    )
  }

  if (task.status === TaskStatus.IN_PROGRESS) {
    return (
      <div className="flex flex-wrap gap-1.5" onClick={(event) => event.stopPropagation()}>
        <Button size="sm" onClick={() => submit.mutate()} disabled={submit.isPending}>
          {submit.isPending ? 'Submitting…' : 'Submit for review'}
        </Button>
      </div>
    )
  }

  return null
}
