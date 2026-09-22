import { PageHeader } from '@/components/common/PageHeader'
import { Card } from '@/components/ui/card'
import { ASSIGNMENT_LABEL } from '@/types'
import { assignmentsForUser, displayName, projectsForUser } from '@/data/selectors'
import { useSession } from '@/stores/auth-store'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PasswordInput } from '@/components/common/PasswordInput'
import { toast } from 'sonner'
import { apiChangePassword } from '@/api'
import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'

export function SettingsPage() {
  const { user } = useSession()
  const [changePwOpen, setChangePwOpen] = useState(false)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')

  const changePw = useMutation({
    mutationFn: () => apiChangePassword(currentPassword, newPassword),
    onSuccess: () => {
      toast.success('Password changed')
      setChangePwOpen(false)
      setCurrentPassword('')
      setNewPassword('')
    },
    onError: (error: Error) => toast.error(error.message),
  })

  if (!user) return null
  const projects = projectsForUser(user.id)
  const assignments = assignmentsForUser(user.id)

  return (
    <div>
      <PageHeader title="Settings" description="System role is separate from project assignments." />
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="p-5">
          <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Profile</p>
          <p className="mt-2 text-lg font-semibold">{displayName(user)}</p>
          <p className="text-sm text-muted-foreground">{user.email}</p>
          <p className="mt-2 text-sm">Global system role: {user.systemRole}</p>
        </Card>
        <Card className="p-5">
          <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Project assignments</p>
          <ul className="mt-3 space-y-2 text-sm">
            {assignments.map((item) => (
              <li key={item.id}>
                {projects.find((project) => project.id === item.projectId)?.name} → {ASSIGNMENT_LABEL[item.assignmentType]}
              </li>
            ))}
          </ul>
        </Card>
        <Card className="p-5">
          <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Change password</p>
          <p className="mt-2 text-sm text-muted-foreground">Update your account password.</p>
          <Button className="mt-3" variant="outline" onClick={() => setChangePwOpen(true)}>
            Change password
          </Button>
        </Card>
      </div>
      <Dialog open={changePwOpen} onOpenChange={setChangePwOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change password</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Current password</Label>
              <PasswordInput value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>New password</Label>
              <PasswordInput value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setChangePwOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={!currentPassword || !newPassword || currentPassword === newPassword || changePw.isPending}
              onClick={() => changePw.mutate()}
            >
              {changePw.isPending ? 'Saving…' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
