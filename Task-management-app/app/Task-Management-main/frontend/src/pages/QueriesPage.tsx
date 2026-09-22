import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { formatDistanceToNow } from 'date-fns'
import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { apiAssignQuery, apiCreateQuery, apiReplyQuery, fetchAssignments, fetchQueries, fetchQueryDetail, fetchTeams } from '@/api'
import { EmptyState, ErrorState } from '@/components/common/EmptyState'
import { PageHeader } from '@/components/common/PageHeader'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { queryAssigneesOfTeam, teamsInProject } from '@/data/selectors'
import { DashboardSkeleton } from '@/features/dashboard/DashboardSkeleton'
import { cn } from '@/lib/utils'
import { useSession } from '@/stores/auth-store'
import { AssignmentType, type HierarchyQuery, QueryStatus } from '@/types'

const TEAM_QUEUE = '__queue__'

const raiseHint: Record<AssignmentType, string> = {
  POC: 'Pick the team this query is for. That team’s POCs will verify it and assign a person.',
  MENTOR: 'Pick the team this query is for. That team’s POCs will verify it and assign a person.',
  SCRUM_MASTER: 'Pick the team this query is for. That team’s POCs will verify it and assign a person.',
  ASSOCIATE: 'Associates do not raise queries in the app.',
}

function statusTone(status: string) {
  if (status === QueryStatus.ANSWERED) return 'border-emerald-200 bg-emerald-50 text-emerald-800'
  if (status === QueryStatus.CLOSED) return 'border-slate-200 bg-slate-100 text-slate-700'
  if (status === QueryStatus.UNASSIGNED) return 'border-sky-200 bg-sky-50 text-sky-900'
  return 'border-amber-200 bg-amber-50 text-amber-900'
}

export function QueriesPage() {
  const { user, projectId, role, teamId } = useSession()
  const queryClient = useQueryClient()
  const [box, setBox] = useState<'inbox' | 'sent'>('inbox')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [composeOpen, setComposeOpen] = useState(false)
  const [composeTeamId, setComposeTeamId] = useState('')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [replyBody, setReplyBody] = useState('')
  const [assignTeamId, setAssignTeamId] = useState('')
  const [assignPersonId, setAssignPersonId] = useState(TEAM_QUEUE)

  const canCompose = role != null && role !== AssignmentType.ASSOCIATE
  const canRoute =
    role === AssignmentType.POC || role === AssignmentType.MENTOR || role === AssignmentType.SCRUM_MASTER

  const teamsQuery = useQuery({
    queryKey: ['teams', projectId],
    queryFn: () => fetchTeams(projectId!),
    enabled: Boolean(user && projectId),
  })
  const assignmentQuery = useQuery({
    queryKey: ['assignments'],
    queryFn: fetchAssignments,
    enabled: Boolean(user && projectId),
  })

  const teams = useMemo(
    () => (projectId ? teamsInProject(projectId) : []),
    [projectId, teamsQuery.data, assignmentQuery.data],
  )

  const listQuery = useQuery({
    queryKey: ['queries', projectId, box],
    queryFn: () => fetchQueries(projectId!, box),
    enabled: Boolean(user && projectId),
  })

  const detailQuery = useQuery({
    queryKey: ['query', selectedId],
    queryFn: () => fetchQueryDetail(selectedId!),
    enabled: Boolean(selectedId),
  })

  const selected = detailQuery.data
  const assignCandidates = assignTeamId ? queryAssigneesOfTeam(assignTeamId) : []

  useEffect(() => {
    if (!composeOpen) return
    setComposeTeamId(teamId ?? teams[0]?.id ?? '')
    setSubject('')
    setBody('')
  }, [composeOpen, teamId, teams])

  useEffect(() => {
    if (!selected) return
    setAssignTeamId(selected.teamId ?? '')
    setAssignPersonId(TEAM_QUEUE)
    setReplyBody('')
  }, [selected?.id, selected?.teamId])

  const createMutation = useMutation({
    mutationFn: () =>
      apiCreateQuery({ projectId: projectId!, teamId: composeTeamId, subject, body }),
    onSuccess: () => {
      toast.success('Query sent to the team queue')
      setComposeOpen(false)
      setSubject('')
      setBody('')
      setBox('sent')
      void queryClient.invalidateQueries({ queryKey: ['queries'] })
      void queryClient.invalidateQueries({ queryKey: ['notifications'] })
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const assignMutation = useMutation({
    mutationFn: () =>
      apiAssignQuery(selectedId!, {
        teamId: assignTeamId,
        assigneeId: assignPersonId === TEAM_QUEUE ? null : assignPersonId,
      }),
    onSuccess: () => {
      toast.success(
        assignPersonId === TEAM_QUEUE
          ? 'Query moved to that team’s queue'
          : 'Query assigned',
      )
      void queryClient.invalidateQueries({ queryKey: ['queries'] })
      void queryClient.invalidateQueries({ queryKey: ['query', selectedId] })
      void queryClient.invalidateQueries({ queryKey: ['notifications'] })
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const replyMutation = useMutation({
    mutationFn: () => apiReplyQuery(selectedId!, replyBody),
    onSuccess: () => {
      toast.success('Reply sent')
      setReplyBody('')
      void queryClient.invalidateQueries({ queryKey: ['queries'] })
      void queryClient.invalidateQueries({ queryKey: ['query', selectedId] })
      void queryClient.invalidateQueries({ queryKey: ['notifications'] })
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const canReply = useMemo(
    () => Boolean(selected && user && selected.toUserId === user.id && selected.status === QueryStatus.OPEN),
    [selected, user],
  )
  const canAssignThis = Boolean(
    selected &&
      canRoute &&
      (selected.status === QueryStatus.UNASSIGNED || selected.status === QueryStatus.OPEN),
  )

  if (listQuery.isLoading) return <DashboardSkeleton />
  if (listQuery.isError) return <ErrorState onRetry={() => listQuery.refetch()} />

  const rows = listQuery.data ?? []

  return (
    <div>
      <PageHeader
        title="Queries"
        count={rows.length}
        countHint={`${rows.length} ${box === 'inbox' ? 'in inbox' : 'sent'}`}
        description="Raise a query to a team. That team’s POCs verify it and assign a POC or Associate. If it belongs elsewhere, they reassign the team or person."
        actions={
          canCompose ? (
            <Button onClick={() => setComposeOpen(true)}>New query</Button>
          ) : (
            <p className="text-sm text-muted-foreground">{role ? raiseHint[role] : null}</p>
          )
        }
      />

      <Tabs value={box} onValueChange={(value) => setBox(value as 'inbox' | 'sent')}>
        <TabsList>
          <TabsTrigger value="inbox">Inbox{box === 'inbox' ? ` (${rows.length})` : ''}</TabsTrigger>
          <TabsTrigger value="sent">Sent{box === 'sent' ? ` (${rows.length})` : ''}</TabsTrigger>
        </TabsList>
        <TabsContent value={box}>
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
            <div className="space-y-2">
              {rows.length === 0 ? (
                <EmptyState title={box === 'inbox' ? 'No queries in your inbox.' : 'No sent queries yet.'} />
              ) : (
                rows.map((item) => (
                  <QueryListCard
                    key={item.id}
                    item={item}
                    teamName={teams.find((team) => team.id === item.teamId)?.name}
                    active={item.id === selectedId}
                    onOpen={() => setSelectedId(item.id)}
                    perspective={box}
                  />
                ))
              )}
            </div>

            <div>
              {!selectedId ? (
                <Card className="p-6 text-sm text-muted-foreground">
                  Select a query to view details, assign it, or reply.
                </Card>
              ) : detailQuery.isLoading ? (
                <Card className="p-6 text-sm text-muted-foreground">Loading query…</Card>
              ) : detailQuery.isError || !selected ? (
                <Card className="p-6 text-sm text-muted-foreground">Could not load this query.</Card>
              ) : (
                <Card className="space-y-4 p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h2 className="text-base font-semibold text-slate-900">{selected.subject}</h2>
                      <p className="mt-1 text-sm text-muted-foreground">
                        From {selected.fromUserName} → {selected.toUserName}
                        {teams.find((team) => team.id === selected.teamId)?.name
                          ? ` · ${teams.find((team) => team.id === selected.teamId)?.name}`
                          : ''}
                      </p>
                    </div>
                    <Badge className={cn(statusTone(selected.status))}>{selected.status}</Badge>
                  </div>
                  <p className="whitespace-pre-wrap text-sm leading-6 text-slate-700">{selected.body}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(selected.createdAt), { addSuffix: true })}
                  </p>

                  {selected.status === QueryStatus.UNASSIGNED ? (
                    <p className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-900">
                      This query is in the team queue. A team POC should verify it and assign a POC or Associate
                      before anyone replies.
                    </p>
                  ) : null}

                  {canAssignThis ? (
                    <div className="space-y-3 border-t pt-4">
                      <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
                        Assign or reassign
                      </p>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="space-y-1.5">
                          <Label>Team</Label>
                          <Select
                            value={assignTeamId || undefined}
                            onValueChange={(value) => {
                              setAssignTeamId(value)
                              setAssignPersonId(TEAM_QUEUE)
                            }}
                          >
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
                          <Label>POC or Associate</Label>
                          <Select value={assignPersonId} onValueChange={setAssignPersonId}>
                            <SelectTrigger>
                              <SelectValue placeholder="Team queue" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value={TEAM_QUEUE}>Team queue (unassigned)</SelectItem>
                              {assignCandidates.map((item) => (
                                <SelectItem key={item.user.id} value={item.user.id}>
                                  {item.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        If this belongs on another team, change the team first. Assigning an associate delivers it
                        to their POC (associates have no login).
                      </p>
                      <Button
                        disabled={!assignTeamId || assignMutation.isPending}
                        onClick={() => assignMutation.mutate()}
                      >
                        {selected.status === QueryStatus.UNASSIGNED ? 'Assign' : 'Reassign'}
                      </Button>
                    </div>
                  ) : null}

                  {selected.replies.length > 0 ? (
                    <div className="space-y-3 border-t pt-4">
                      <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">Replies</p>
                      {selected.replies.map((reply) => (
                        <div key={reply.id} className="rounded-lg border bg-slate-50 p-3">
                          <p className="text-sm font-medium text-slate-800">{reply.fromUserName}</p>
                          <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{reply.body}</p>
                          <p className="mt-2 text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(reply.createdAt), { addSuffix: true })}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : null}

                  {canReply ? (
                    <div className="space-y-2 border-t pt-4">
                      <Label htmlFor="reply">Your reply</Label>
                      <Textarea
                        id="reply"
                        value={replyBody}
                        onChange={(e) => setReplyBody(e.target.value)}
                        placeholder="Write your response…"
                        rows={4}
                      />
                      <Button
                        disabled={!replyBody.trim() || replyMutation.isPending}
                        onClick={() => replyMutation.mutate()}
                      >
                        Send reply
                      </Button>
                    </div>
                  ) : null}
                </Card>
              )}
            </div>
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={composeOpen} onOpenChange={setComposeOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New query</DialogTitle>
            <DialogDescription>{role ? raiseHint[role] : 'Select a team, then describe the query.'}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Team</Label>
              <Select value={composeTeamId || undefined} onValueChange={setComposeTeamId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a team" />
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
              <Label htmlFor="subject">Subject</Label>
              <Input id="subject" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Brief subject" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="body">Details</Label>
              <Textarea
                id="body"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Describe your concern or question…"
                rows={5}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setComposeOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={!composeTeamId || !subject.trim() || !body.trim() || createMutation.isPending}
              onClick={() => createMutation.mutate()}
            >
              Send
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function QueryListCard({
  item,
  teamName,
  active,
  onOpen,
  perspective,
}: {
  item: HierarchyQuery
  teamName?: string
  active: boolean
  onOpen: () => void
  perspective: 'inbox' | 'sent'
}) {
  return (
    <Card
      className={cn('cursor-pointer p-4 transition-colors hover:bg-slate-50', active && 'border-primary/40 bg-slate-50')}
      onClick={onOpen}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-semibold text-slate-900">{item.subject}</p>
          <p className="mt-1 truncate text-sm text-muted-foreground">
            {perspective === 'inbox' ? `From ${item.fromUserName}` : `To ${item.toUserName}`}
            {teamName ? ` · ${teamName}` : ''}
          </p>
        </div>
        <Badge className={cn('shrink-0', statusTone(item.status))}>{item.status}</Badge>
      </div>
      <p className="mt-2 line-clamp-2 text-sm text-slate-600">{item.body}</p>
      <p className="mt-2 text-xs text-muted-foreground">
        {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}
      </p>
    </Card>
  )
}
