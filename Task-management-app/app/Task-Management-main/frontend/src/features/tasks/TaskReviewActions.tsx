import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { toast } from 'sonner'
import { apiApprove, apiReject } from '@/api'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { canReviewTask } from '@/data/selectors'
import { AssignmentType, type Task, type User } from '@/types'

export function TaskReviewActions({
  task,
  user,
  role,
}: {
  task: Task
  user: User
  role: AssignmentType
}) {
  const [note, setNote] = useState('')
  const queryClient = useQueryClient()
  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    void queryClient.invalidateQueries({ queryKey: ['my-team'] })
    void queryClient.invalidateQueries({ queryKey: ['tasks'] })
    void queryClient.invalidateQueries({ queryKey: ['task', task.id] })
  }

  const canReview = canReviewTask(role, task, user.id)

  const approve = useMutation({
    mutationFn: () => apiApprove(task.id, user, note.trim() || 'Approved'),
    onSuccess: () => {
      toast.success('Task approved')
      invalidate()
    },
    onError: (error: Error) => toast.error(error.message),
  })
  const reject = useMutation({
    mutationFn: () => apiReject(task.id, user, note),
    onSuccess: () => {
      toast.success('Changes requested')
      setNote('')
      invalidate()
    },
    onError: (error: Error) => toast.error(error.message),
  })

  if (!canReview) return null

  return (
    <div className="space-y-2" onClick={(event) => event.stopPropagation()}>
      <Textarea
        placeholder="Comment required when requesting changes"
        value={note}
        onChange={(event) => setNote(event.target.value)}
      />
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={() => reject.mutate()} disabled={reject.isPending}>
          Request Changes
        </Button>
        <Button variant="success" size="sm" onClick={() => approve.mutate()} disabled={approve.isPending}>
          Approve
        </Button>
      </div>
    </div>
  )
}
