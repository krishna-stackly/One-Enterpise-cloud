import { useMutation, useQueryClient } from '@tanstack/react-query'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import { apiCreateProject } from '@/api'
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
import { Textarea } from '@/components/ui/textarea'
import { useAuthStore } from '@/stores/auth-store'

const schema = z.object({
  name: z.string().min(2, 'Project name is required'),
  code: z.string().min(2, 'Code is required').max(8),
  description: z.string().min(8, 'Describe the project'),
  dueDate: z.string().min(1, 'Due date is required'),
})

type Values = z.infer<typeof schema>

export function CreateProjectDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated?: () => void
}) {
  const user = useAuthStore((s) => s.user)
  const setProjectId = useAuthStore((s) => s.setProjectId)
  const queryClient = useQueryClient()
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', code: '', description: '', dueDate: '2026-12-31' },
  })
  const mutation = useMutation({
    mutationFn: (values: Values) =>
      apiCreateProject({
        name: values.name,
        code: values.code,
        description: values.description,
        dueDate: values.dueDate,
        scrumMasterId: user!.id,
      }),
    onSuccess: (project) => {
      toast.success('Project created')
      void queryClient.invalidateQueries({ queryKey: ['projects'] })
      void queryClient.invalidateQueries({ queryKey: ['projects-overview'] })
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      onCreated?.()
      setProjectId(project.id)
      form.reset()
      onOpenChange(false)
    },
    onError: (error: Error) => toast.error(error.message),
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create project</DialogTitle>
          <DialogDescription>
            You become the Scrum Master. Next, add people, create a team, and assign Mentor → POC.
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-3" onSubmit={form.handleSubmit((values) => mutation.mutate(values))}>
          <div className="space-y-1.5">
            <Label htmlFor="name">Name</Label>
            <Input id="name" {...form.register('name')} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="code">Code</Label>
            <Input id="code" placeholder="HRMS" {...form.register('code')} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" {...form.register('description')} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="dueDate">Due date</Label>
            <Input id="dueDate" type="date" {...form.register('dueDate')} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              Create project
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
