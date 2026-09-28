import { useMutation, useQueryClient } from '@tanstack/react-query'
import { zodResolver } from '@hookform/resolvers/zod'
import { UserPlus, Users } from 'lucide-react'
import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import { apiCreateEmployee } from '@/api'
import { PasswordInput } from '@/components/common/PasswordInput'
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
import { displayName, pocLeadsOfTeam, teamsForActor } from '@/data/selectors'
import { useSession } from '@/stores/auth-store'
import { ASSIGNMENT_LABEL, AssignmentType } from '@/types'
import { cn } from '@/lib/utils'

const schema = z
  .object({
    firstName: z.string().min(1, 'First name is required'),
    lastName: z.string().min(1, 'Last name is required'),
    email: z
      .string()
      .min(1, 'Enter a valid work email')
      .refine((value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value), 'Enter a valid work email'),
    title: z.string().min(2, 'Title is required'),
    password: z.string().optional(),
    assignmentType: z.enum([AssignmentType.MENTOR, AssignmentType.POC, AssignmentType.ASSOCIATE]),
    teamId: z.string().min(1, 'Select a team'),
    pocId: z.string().optional(),
  })
  .superRefine((values, ctx) => {
    if (values.assignmentType !== AssignmentType.ASSOCIATE && (values.password?.length ?? 0) < 8) {
      ctx.addIssue({ code: 'custom', path: ['password'], message: 'Password must be at least 8 characters' })
    }
    if (values.assignmentType === AssignmentType.ASSOCIATE && !values.pocId) {
      ctx.addIssue({ code: 'custom', path: ['pocId'], message: 'Select the POC this associate reports to' })
    }
  })

type Values = z.infer<typeof schema>

type AssignmentTypeValue = (typeof AssignmentType)[keyof typeof AssignmentType]
type AssignableRole = Exclude<AssignmentTypeValue, typeof AssignmentType.SCRUM_MASTER>

function rolesFor(actor: AssignmentTypeValue | undefined): AssignableRole[] {
  if (actor === AssignmentType.POC) return [AssignmentType.ASSOCIATE]
  if (actor === AssignmentType.MENTOR) return [AssignmentType.POC, AssignmentType.ASSOCIATE]
  return [AssignmentType.MENTOR, AssignmentType.POC, AssignmentType.ASSOCIATE]
}

function defaultPocId(
  actorRole: AssignmentTypeValue | undefined,
  assignmentType: AssignableRole,
  actorId: string | undefined,
) {
  if (assignmentType !== AssignmentType.ASSOCIATE) return ''
  if (actorRole === AssignmentType.POC || actorRole === AssignmentType.MENTOR) return actorId ?? ''
  return ''
}

export function AddPersonDialog({
  open,
  onOpenChange,
  presetRole,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  presetRole?: AssignableRole
}) {
  const { role, projectId, teamId, user } = useSession()
  const queryClient = useQueryClient()
  const allowedRoles = rolesFor(role)
  const teams = user && projectId ? teamsForActor(user.id, projectId, role) : []
  const initialRole = (presetRole && allowedRoles.includes(presetRole) ? presetRole : allowedRoles[0]) ?? AssignmentType.ASSOCIATE
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      title: ASSIGNMENT_LABEL[initialRole],
      password: 'Password@123',
      assignmentType: initialRole,
      teamId: teamId ?? (teams[0]?.id ?? ''),
      pocId: defaultPocId(role, initialRole, user?.id),
    },
  })
  const assignmentType = form.watch('assignmentType')
  const selectedTeamId = form.watch('teamId')
  const pocLeads = selectedTeamId ? pocLeadsOfTeam(selectedTeamId) : []
  const isMentor = role === AssignmentType.MENTOR

  useEffect(() => {
    if (!open) return
    const nextRole =
      (presetRole && allowedRoles.includes(presetRole) ? presetRole : allowedRoles[0]) ?? AssignmentType.ASSOCIATE
    form.reset({
      firstName: '',
      lastName: '',
      email: '',
      title: ASSIGNMENT_LABEL[nextRole],
      password: 'Password@123',
      assignmentType: nextRole,
      teamId: teamId ?? (teams[0]?.id ?? ''),
      pocId: defaultPocId(role, nextRole, user?.id),
    })
  }, [open, role, teamId, user?.id, presetRole, form])

  const pickRole = (next: AssignableRole) => {
    form.setValue('assignmentType', next)
    form.setValue('title', ASSIGNMENT_LABEL[next])
    form.setValue('pocId', defaultPocId(role, next, user?.id))
  }

  const mutation = useMutation({
    mutationFn: (values: Values) =>
      apiCreateEmployee({
        firstName: values.firstName,
        lastName: values.lastName,
        email: values.email,
        title: values.title,
        password: values.assignmentType === AssignmentType.ASSOCIATE ? '' : (values.password ?? ''),
        projectId: projectId!,
        assignmentType: values.assignmentType,
        teamId: values.teamId,
        pocId: values.assignmentType === AssignmentType.ASSOCIATE ? (values.pocId ?? null) : null,
      }),
    onSuccess: (_data, values) => {
      toast.success(
        values.assignmentType === AssignmentType.ASSOCIATE
          ? 'Associate added under the selected POC (no app login)'
          : values.assignmentType === AssignmentType.POC
            ? 'POC added to your team'
            : 'Person added and assigned',
      )
      void queryClient.invalidateQueries({ queryKey: ['users'] })
      void queryClient.invalidateQueries({ queryKey: ['assignments'] })
      void queryClient.invalidateQueries({ queryKey: ['teams'] })
      void queryClient.invalidateQueries({ queryKey: ['structure'] })
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      void queryClient.invalidateQueries({ queryKey: ['my-team'] })
      onOpenChange(false)
    },
    onError: (error: Error) => toast.error(error.message),
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isMentor ? 'Add to your team' : 'Add person'}</DialogTitle>
          <DialogDescription>
            {isMentor
              ? 'As Mentor / POC you can add another POC to this team, or add an associate and assign them to yourself or another POC.'
              : 'Pick the team first. Associates then report to a POC on that team. Associates do not get login or a dashboard — the POC updates their work.'}
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-3" onSubmit={form.handleSubmit((values) => mutation.mutate(values))}>
          <div className="space-y-1.5">
            <Label>Team</Label>
            <Select
              value={selectedTeamId || undefined}
              onValueChange={(value) => {
                form.setValue('teamId', value)
                form.setValue('pocId', defaultPocId(role, assignmentType, user?.id))
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a team first" />
              </SelectTrigger>
              <SelectContent>
                {teams.map((team) => (
                  <SelectItem key={team.id} value={team.id}>
                    {team.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {form.formState.errors.teamId ? (
              <p className="text-xs text-error">{form.formState.errors.teamId.message}</p>
            ) : null}
          </div>
          {isMentor ? (
            <div className="grid gap-2">
              <Label>What are you adding?</Label>
              <Button
                type="button"
                variant="outline"
                className={cn(
                  'h-auto justify-start gap-3 py-3 text-left',
                  assignmentType === AssignmentType.POC && 'border-primary bg-primary/5',
                )}
                onClick={() => pickRole(AssignmentType.POC)}
              >
                <UserPlus className="h-4 w-4 shrink-0" />
                <span>
                  <span className="block font-medium">POC on my team</span>
                  <span className="block text-xs font-normal text-muted-foreground">
                    They get login and can have their own associates.
                  </span>
                </span>
              </Button>
              <Button
                type="button"
                variant="outline"
                className={cn(
                  'h-auto justify-start gap-3 py-3 text-left',
                  assignmentType === AssignmentType.ASSOCIATE && 'border-primary bg-primary/5',
                )}
                onClick={() => pickRole(AssignmentType.ASSOCIATE)}
              >
                <Users className="h-4 w-4 shrink-0" />
                <span>
                  <span className="block font-medium">Associate</span>
                  <span className="block text-xs font-normal text-muted-foreground">
                    Assign them to you as Mentor / POC, or to another POC. No login.
                  </span>
                </span>
              </Button>
            </div>
          ) : allowedRoles.length > 1 ? (
            <div className="space-y-1.5">
              <Label>Role</Label>
              <Select value={assignmentType} onValueChange={(value) => pickRole(value as AssignableRole)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a role" />
                </SelectTrigger>
                <SelectContent>
                  {allowedRoles.map((type) => (
                    <SelectItem key={type} value={type}>
                      {ASSIGNMENT_LABEL[type]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="firstName">First name</Label>
              <Input id="firstName" {...form.register('firstName')} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lastName">Last name</Label>
              <Input id="lastName" {...form.register('lastName')} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" {...form.register('email')} />
          </div>
          {assignmentType === AssignmentType.ASSOCIATE && role === AssignmentType.POC ? (
            <p className="text-xs text-muted-foreground">This associate will report to you on the selected team.</p>
          ) : null}
          {assignmentType === AssignmentType.ASSOCIATE && role !== AssignmentType.POC ? (
            <div className="space-y-1.5">
              <Label>Reports to (POC)</Label>
              <Select value={form.watch('pocId') || undefined} onValueChange={(value) => form.setValue('pocId', value)}>
                <SelectTrigger>
                  <SelectValue placeholder={selectedTeamId ? 'Select POC on this team' : 'Select a team first'} />
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
              {form.formState.errors.pocId ? (
                <p className="text-xs text-error">{form.formState.errors.pocId.message}</p>
              ) : selectedTeamId && pocLeads.length === 0 ? (
                <p className="text-xs text-muted-foreground">This team has no POC yet. Add a POC first, or assign the associate to yourself.</p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Every associate must sit under a POC. You can take them yourself as Mentor / POC.
                </p>
              )}
            </div>
          ) : null}
          <div className="space-y-1.5">
            <Label htmlFor="title">Title</Label>
            <Input id="title" {...form.register('title')} />
          </div>
          {assignmentType === AssignmentType.ASSOCIATE ? (
            <p className="rounded-lg border bg-slate-50 px-3 py-2 text-xs text-muted-foreground">
              Associates cannot sign in. Their POC starts, completes, and submits their tasks.
            </p>
          ) : (
            <div className="space-y-1.5">
              <Label htmlFor="password">Temporary password</Label>
              <PasswordInput id="password" {...form.register('password')} />
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={mutation.isPending || !projectId}>
              {assignmentType === AssignmentType.ASSOCIATE
                ? 'Add associate'
                : assignmentType === AssignmentType.POC
                  ? 'Add POC'
                  : 'Add and assign'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
