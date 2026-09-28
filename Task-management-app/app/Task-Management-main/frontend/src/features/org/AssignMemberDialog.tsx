import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { apiAssignMember, fetchUsers } from '@/api'
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
import { displayName, pocLeadsOfTeam } from '@/data/selectors'
import { useSession } from '@/stores/auth-store'
import { ASSIGNMENT_LABEL, AssignmentType } from '@/types'

export function AssignMemberDialog({
  open,
  onOpenChange,
  projectId,
  teamId,
  allowedTypes,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  projectId: string
  teamId: string
  allowedTypes: AssignmentType[]
}) {
  const queryClient = useQueryClient()
  const { user, role } = useSession()
  const people = useQuery({ queryKey: ['users'], queryFn: fetchUsers })
  const [userId, setUserId] = useState('')
  const [assignmentType, setAssignmentType] = useState<AssignmentType>(allowedTypes[0] ?? AssignmentType.POC)
  const [pocId, setPocId] = useState(user?.id ?? '')
  const pocLeads = pocLeadsOfTeam(teamId)

  useEffect(() => {
    if (!open) return
    setAssignmentType(allowedTypes[0] ?? AssignmentType.POC)
    setUserId('')
    setPocId(user?.id ?? pocLeads[0]?.user.id ?? '')
  }, [open, user?.id])

  const mutation = useMutation({
    mutationFn: () => {
      if (assignmentType === AssignmentType.ASSOCIATE && !pocId) {
        throw new Error('Select the POC this associate reports to')
      }
      return apiAssignMember({
        userId,
        projectId,
        teamId,
        assignmentType,
        pocId: assignmentType === AssignmentType.ASSOCIATE ? pocId : null,
      })
    },
    onSuccess: () => {
      toast.success(
        assignmentType === AssignmentType.ASSOCIATE
          ? 'Associate assigned to the selected POC'
          : `${ASSIGNMENT_LABEL[assignmentType]} assigned`,
      )
      void queryClient.invalidateQueries({ queryKey: ['teams'] })
      void queryClient.invalidateQueries({ queryKey: ['structure'] })
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      void queryClient.invalidateQueries({ queryKey: ['assignments'] })
      onOpenChange(false)
      setUserId('')
    },
    onError: (error: Error) => toast.error(error.message),
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Assign to team</DialogTitle>
          <DialogDescription>
            {role === AssignmentType.MENTOR
              ? 'Assign an existing person as a POC, or as an associate under you or another POC.'
              : 'Assign an existing person as Mentor or POC on this team.'}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Person</Label>
            <Select value={userId || undefined} onValueChange={setUserId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a person" />
              </SelectTrigger>
              <SelectContent>
                {(people.data ?? []).map((person) => (
                  <SelectItem key={person.id} value={person.id}>
                    {displayName(person)} · {person.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Role on this team</Label>
            <Select
              value={assignmentType}
              onValueChange={(value) => {
                const next = value as AssignmentType
                setAssignmentType(next)
                if (next === AssignmentType.ASSOCIATE && !pocId) {
                  setPocId(user?.id ?? pocLeads[0]?.user.id ?? '')
                }
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {allowedTypes.map((type) => (
                  <SelectItem key={type} value={type}>
                    {ASSIGNMENT_LABEL[type]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {assignmentType === AssignmentType.ASSOCIATE ? (
            <div className="space-y-1.5">
              <Label>Reports to (POC)</Label>
              <Select value={pocId || undefined} onValueChange={setPocId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select POC" />
                </SelectTrigger>
                <SelectContent>
                  {pocLeads.map((lead) => (
                    <SelectItem key={lead.user.id} value={lead.user.id}>
                      {lead.user.id === user?.id
                        ? `${displayName(lead.user)} (Me · Mentor / POC)`
                        : lead.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Associates must belong to a POC. You can take them yourself as Mentor / POC.
              </p>
            </div>
          ) : null}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={
              mutation.isPending || !userId || (assignmentType === AssignmentType.ASSOCIATE && !pocId)
            }
            onClick={() => mutation.mutate()}
          >
            Assign
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
