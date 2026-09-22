import { useMutation, useQueryClient } from '@tanstack/react-query'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import { apiAssignToPoc } from '@/api'
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
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { displayName, pocsOfTeam } from '@/data/selectors'
import { useSession } from '@/stores/auth-store'
import { Priority } from '@/types'

const schema = z.object({
  title: z.string().min(3, 'Title is required'),
  description: z.string().min(8, 'Describe the work'),
  pocId: z.string().min(1, 'Select a POC'),
  priority: z.enum(['HIGH', 'MEDIUM', 'LOW']),
  dueDate: z.string().min(1, 'Due date is required'),
})

type Values = z.infer<typeof schema>

export function AssignWorkToPocDialog({
  open,
  onOpenChange,
  teamId,
  projectId,
  sprintId,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  teamId: string
  projectId: string
  sprintId?: string
}) {
  const { user } = useSession()
  const pocs = pocsOfTeam(teamId)
  const queryClient = useQueryClient()
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: '',
      description: '',
      pocId: user?.id ?? pocs[0]?.id ?? '',
      priority: 'HIGH',
      dueDate: '2026-09-22',
    },
  })
  const mutation = useMutation({
    mutationFn: (values: Values) =>
      apiAssignToPoc({
        projectId,
        teamId,
        title: values.title,
        description: values.description,
        pocId: values.pocId,
        mentorId: user!.id,
        priority: values.priority,
        dueDate: values.dueDate,
        sprintId,
      }),
    onSuccess: (_data, values) => {
      toast.success(values.pocId === user?.id ? 'Work assigned to you as POC' : 'Work assigned to POC')
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
      onOpenChange(false)
      form.reset()
    },
    onError: (error: Error) => toast.error(error.message),
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Assign work to POC</DialogTitle>
          <DialogDescription>
            Assign major work to a POC on your team, or keep it yourself as Mentor / POC and break it down with Done by.
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-3" onSubmit={form.handleSubmit((values) => mutation.mutate(values))}>
          <div className="space-y-1.5">
            <Label htmlFor="title">Title</Label>
            <Input id="title" {...form.register('title')} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" {...form.register('description')} />
          </div>
          <div className="space-y-1.5">
            <Label>POC</Label>
            <Select value={form.watch('pocId')} onValueChange={(value) => form.setValue('pocId', value)}>
              <SelectTrigger>
                <SelectValue placeholder="Select a POC" />
              </SelectTrigger>
              <SelectContent>
                {user ? <SelectItem value={user.id}>Myself (Mentor as POC)</SelectItem> : null}
                {pocs
                  .filter((poc) => poc.id !== user?.id)
                  .map((poc) => (
                    <SelectItem key={poc.id} value={poc.id}>
                      {displayName(poc)}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Priority</Label>
              <Select value={form.watch('priority')} onValueChange={(value) => form.setValue('priority', value as Values['priority'])}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.values(Priority).map((priority) => (
                    <SelectItem key={priority} value={priority}>
                      {priority}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="dueDate">Due date</Label>
              <Input id="dueDate" type="date" {...form.register('dueDate')} />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              Assign work
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}