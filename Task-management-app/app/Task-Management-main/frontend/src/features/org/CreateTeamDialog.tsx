import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import { apiCreateTeam, fetchUsers } from '@/api'
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
import { displayName } from '@/data/selectors'

const schema = z.object({
  name: z.string().min(2, 'Team name is required'),
  description: z.string().min(4, 'Describe the team'),
  mentorId: z.string().optional(),
})

type Values = z.infer<typeof schema>

export function CreateTeamDialog({
  open,
  onOpenChange,
  projectId,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  projectId: string
}) {
  const queryClient = useQueryClient()
  const people = useQuery({ queryKey: ['users'], queryFn: fetchUsers })
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', description: '', mentorId: '' },
  })
  const mutation = useMutation({
    mutationFn: (values: Values) =>
      apiCreateTeam({
        projectId,
        name: values.name,
        description: values.description,
        mentorId: values.mentorId || undefined,
      }),
    onSuccess: () => {
      toast.success('Team created. Assign Mentors and POCs next.')
      void queryClient.invalidateQueries({ queryKey: ['teams'] })
      void queryClient.invalidateQueries({ queryKey: ['structure'] })
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      form.reset()
      onOpenChange(false)
    },
    onError: (error: Error) => toast.error(error.message),
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create team</DialogTitle>
          <DialogDescription>Add a team under this project, then assign a Mentor and POCs.</DialogDescription>
        </DialogHeader>
        <form className="space-y-3" onSubmit={form.handleSubmit((values) => mutation.mutate(values))}>
          <div className="space-y-1.5">
            <Label htmlFor="teamName">Name</Label>
            <Input id="teamName" placeholder="Frontend" {...form.register('name')} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="teamDescription">Description</Label>
            <Textarea id="teamDescription" {...form.register('description')} />
          </div>
          <div className="space-y-1.5">
            <Label>Mentor (optional)</Label>
            <Select value={form.watch('mentorId') || undefined} onValueChange={(value) => form.setValue('mentorId', value)}>
              <SelectTrigger>
                <SelectValue placeholder="Assign a Mentor now" />
              </SelectTrigger>
              <SelectContent>
                {(people.data ?? []).map((person) => (
                  <SelectItem key={person.id} value={person.id}>
                    {displayName(person)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              Create team
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
