import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { apiBreakDown } from '@/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Textarea } from '@/components/ui/textarea'
import { workAssigneesForLead } from '@/data/selectors'
import { useSession } from '@/stores/auth-store'
import { AssignmentType, Priority, type Task } from '@/types'

type Row = {
  title: string
  description: string
  associateId: string
  priority: 'HIGH' | 'MEDIUM' | 'LOW'
  dueDate: string
  estimatedHours: number
}

function emptyRow(): Row {
  return {
    title: '',
    description: '',
    associateId: '',
    priority: 'MEDIUM',
    dueDate: new Date().toISOString().slice(0, 10),
    estimatedHours: 8,
  }
}

export function BreakDownTaskDialog({
  parent,
  onOpenChange,
}: {
  parent: Task | null
  onOpenChange: (open: boolean) => void
}) {
  const { user, projectId, role } = useSession()
  const [rows, setRows] = useState<Row[]>([])
  const queryClient = useQueryClient()
  const assignees = user ? workAssigneesForLead(user, projectId, parent?.teamId ?? null, role) : []

  useEffect(() => {
    if (!parent) return
    setRows([emptyRow()])
  }, [parent?.id])

  const mutation = useMutation({
    mutationFn: () => apiBreakDown(parent!.id, user!.id, rows),
    onSuccess: () => {
      toast.success('Subtasks created')
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      queryClient.invalidateQueries({ queryKey: ['my-team'] })
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
      onOpenChange(false)
    },
    onError: (error: Error) => toast.error(error.message),
  })

  return (
    <Sheet open={Boolean(parent)} onOpenChange={onOpenChange}>
      <SheetContent className="overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Divide into subtasks</SheetTitle>
          <SheetDescription>
            Parent: {parent?.title}. Assign each piece to{' '}
            {role === AssignmentType.MENTOR
              ? 'yourself, a POC, or an associate.'
              : 'yourself or an associate.'}{' '}
            Associates do not log in — their POC updates their status.
          </SheetDescription>
        </SheetHeader>
        <div className="space-y-6 px-6 pb-8">
          {rows.map((row, index) => (
            <div key={index} className="space-y-3 rounded-xl border p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold">Subtask {index + 1}</p>
                {rows.length > 1 ? (
                  <Button variant="ghost" size="icon" onClick={() => setRows(rows.filter((_, i) => i !== index))}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                ) : null}
              </div>
              <div className="space-y-1.5">
                <Label>Title</Label>
                <Input
                  value={row.title}
                  onChange={(e) => setRows(rows.map((item, i) => (i === index ? { ...item, title: e.target.value } : item)))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Description</Label>
                <Textarea
                  value={row.description}
                  onChange={(e) =>
                    setRows(rows.map((item, i) => (i === index ? { ...item, description: e.target.value } : item)))
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label>Assign to</Label>
                <Select
                  value={row.associateId || (user?.id ?? '__self__')}
                  onValueChange={(value) =>
                    setRows(
                      rows.map((item, i) =>
                        i === index
                          ? { ...item, associateId: value === user?.id ? '' : value }
                          : item,
                      ),
                    )
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select who will do this" />
                  </SelectTrigger>
                  <SelectContent>
                    {assignees.map((person) => (
                      <SelectItem key={person.user.id} value={person.user.id}>
                        {person.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {assignees.length <= 1 ? (
                  <p className="text-xs text-muted-foreground">
                    {role === AssignmentType.MENTOR
                      ? 'No POCs or associates yet. Add them on People or My Team.'
                      : 'No associates yet. Add them on My Team — they will not get a login.'}
                  </p>
                ) : null}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Priority</Label>
                  <Select
                    value={row.priority}
                    onValueChange={(value) =>
                      setRows(rows.map((item, i) => (i === index ? { ...item, priority: value as Row['priority'] } : item)))
                    }
                  >
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
                  <Label>Due date</Label>
                  <Input
                    type="date"
                    value={row.dueDate}
                    onChange={(e) =>
                      setRows(rows.map((item, i) => (i === index ? { ...item, dueDate: e.target.value } : item)))
                    }
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Estimated hours</Label>
                <Input
                  type="number"
                  min={1}
                  value={row.estimatedHours}
                  onChange={(e) =>
                    setRows(
                      rows.map((item, i) =>
                        i === index ? { ...item, estimatedHours: Number(e.target.value) } : item,
                      ),
                    )
                  }
                />
              </div>
            </div>
          ))}
          <Button variant="outline" className="w-full" onClick={() => setRows([...rows, emptyRow()])}>
            <Plus className="h-4 w-4" />
            Add subtask
          </Button>
          <Button
            className="w-full"
            disabled={mutation.isPending || rows.some((row) => !row.title.trim())}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? 'Saving…' : 'Create subtasks'}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
