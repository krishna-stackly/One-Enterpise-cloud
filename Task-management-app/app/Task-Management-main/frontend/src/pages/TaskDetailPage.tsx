import { useQuery, useQueryClient } from '@tanstack/react-query'
import { format, parseISO } from 'date-fns'
import { useState, type ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { apiAddComment, apiAddWorkLog, fetchTaskDetail } from '@/api'
import { EmptyState, ErrorState } from '@/components/common/EmptyState'
import { HierarchyTrail } from '@/components/common/HierarchyTrail'
import { PageHeader, PercentBar } from '@/components/common/PageHeader'
import { PriorityBadge, StatusBadge } from '@/components/common/StatusBadge'
import { UserChip } from '@/components/common/UserAvatar'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { displayName, getUser, canReviewTask } from '@/data/selectors'
import { DashboardSkeleton } from '@/features/dashboard/DashboardSkeleton'
import { TaskReviewActions } from '@/features/tasks/TaskReviewActions'
import { TaskWorkActions } from '@/features/tasks/TaskWorkActions'
import { useSession } from '@/stores/auth-store'

export function TaskDetailPage() {
  const { id } = useParams()
  const { user, role } = useSession()
  const queryClient = useQueryClient()
  const [comment, setComment] = useState('')
  const [hours, setHours] = useState('2')
  const [logNote, setLogNote] = useState('')
  const query = useQuery({
    queryKey: ['task', id],
    queryFn: () => fetchTaskDetail(id!),
    enabled: Boolean(id),
  })

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['task', id] })
    void queryClient.invalidateQueries({ queryKey: ['tasks'] })
    void queryClient.invalidateQueries({ queryKey: ['dashboard'] })
  }

  if (query.isLoading) return <DashboardSkeleton />
  if (query.isError) return <ErrorState onRetry={() => query.refetch()} />
  if (!query.data) return <EmptyState title="Task not found" />

  const { task, lineage, children, comments, workLogs, activity, assignee, assigner, reviews, progress } =
    query.data
  const canReview = Boolean(user && role) && canReviewTask(role, task, user!.id)

  return (
    <div>
      <PageHeader
        eyebrow={`Task #${task.numericId}`}
        title={task.title}
        description={task.description}
        actions={
          <>
            {user ? <TaskWorkActions task={task} user={user} /> : null}
          </>
        }
      />
      <HierarchyTrail lineage={lineage} className="mb-6" />
      <div className="mb-6 grid gap-4 lg:grid-cols-4">
        <Meta label="Status" value={<StatusBadge status={task.status} />} />
        <Meta label="Priority" value={<PriorityBadge priority={task.priority} />} />
        <Meta label="Due date" value={format(parseISO(task.dueDate), 'd MMM yyyy')} />
        <Meta label="Progress" value={`${progress}%`} />
        <Meta label="Project" value={lineage.project.name} />
        <Meta label="Team" value={lineage.team.name} />
        <Meta label="Mentor" value={displayName(lineage.mentor ?? undefined)} />
        <Meta label="POC" value={displayName(lineage.poc ?? undefined)} />
        <Meta label="Done by" value={task.doneByName?.trim() || '—'} />
        <Meta label="Assigned by" value={displayName(assigner)} />
        <Meta label="Estimated hours" value={`${task.estimatedHours}h`} />
        <Meta label="Actual hours" value={`${task.actualHours}h`} />
      </div>
      <PercentBar className="mb-6" value={progress} label="Derived from child subtasks when present" />
      <Tabs defaultValue="subtasks">
        <TabsList>
          <TabsTrigger value="subtasks">Subtasks</TabsTrigger>
          <TabsTrigger value="comments">Comments</TabsTrigger>
          <TabsTrigger value="logs">Work Logs</TabsTrigger>
          <TabsTrigger value="review">Review</TabsTrigger>
          <TabsTrigger value="activity">Activity History</TabsTrigger>
        </TabsList>
        <TabsContent value="subtasks">
          <Card>
            <CardContent className="pt-5 space-y-2">
              {children.length === 0 ? (
                <EmptyState title="No subtasks" description="POC decomposition will appear here." />
              ) : (
                children.map((child) => (
                  <Link key={child.id} to={`/tasks/${child.id}`} className="flex items-center justify-between rounded-lg border p-3">
                    <div>
                      <p className="font-medium">{child.title}</p>
                      <p className="text-xs text-muted-foreground">{displayName(child.assignee)}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-semibold">{child.progress}%</span>
                      <StatusBadge status={child.status} />
                    </div>
                  </Link>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="comments">
          <Card>
            <CardContent className="space-y-4 pt-5">
              {comments.length === 0 ? <EmptyState title="No comments yet." /> : null}
              {comments.map((item) => (
                <div key={item.id} className="rounded-lg border p-3">
                  <UserChip user={getUser(item.authorId)} subtitle={format(new Date(item.createdAt), 'd MMM yyyy HH:mm')} />
                  <p className="mt-2 text-sm">{item.body}</p>
                </div>
              ))}
              <Textarea placeholder="Write a comment. Use names to mention teammates." value={comment} onChange={(e) => setComment(e.target.value)} />
              <Button
                onClick={() => {
                  if (!comment.trim() || !user) return
                  void apiAddComment(task.id, user, comment).then(() => {
                    setComment('')
                    invalidate()
                    toast.success('Comment added')
                  })
                }}
              >
                Add comment
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="logs">
          <Card>
            <CardContent className="space-y-3 pt-5">
              {workLogs.map((log) => (
                <div key={log.id} className="rounded-lg border p-3 text-sm">
                  <p className="font-medium">
                    {displayName(getUser(log.userId))} · {log.hours}h · {log.date}
                  </p>
                  <p className="text-muted-foreground">{log.description}</p>
                </div>
              ))}
              {role && task.assignedTo === user?.id ? (
                <div className="grid gap-2 md:grid-cols-[100px_1fr_auto]">
                  <Input type="number" value={hours} onChange={(e) => setHours(e.target.value)} />
                  <Input placeholder="What did you work on?" value={logNote} onChange={(e) => setLogNote(e.target.value)} />
                  <Button
                    onClick={() => {
                      if (!user) return
                      void apiAddWorkLog({
                        taskId: task.id,
                        userId: user.id,
                        date: '2026-09-09',
                        hours: Number(hours),
                        description: logNote,
                      }).then(() => {
                        setLogNote('')
                        invalidate()
                        toast.success('Work log saved')
                      })
                    }}
                  >
                    Log time
                  </Button>
                </div>
              ) : null}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="review">
          <Card>
            <CardHeader>
            <CardTitle>Review</CardTitle>
          </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm">Assignee: {displayName(assignee)}</p>
              {reviews.map((review) => (
                <div key={review.id} className="rounded-lg border p-3 text-sm">
                  <p className="font-semibold">{review.decision}</p>
                  <p>{review.comment}</p>
                </div>
              ))}
              {canReview && user && role ? (
                <TaskReviewActions task={task} user={user} role={role} />
              ) : (
                <p className="text-sm text-muted-foreground">
                  Associate work is reviewed by the POC. POC work is reviewed by the Mentor. Mentors review their
                  own submissions. Scrum Masters do not review.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="activity">
          <Card>
            <CardContent className="space-y-3 pt-5">
              {activity.map((item) => (
                <p key={item.id} className="text-sm">
                  {item.message}
                </p>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

function Meta({ label, value }: { label: string; value: ReactNode }) {
  return (
    <Card className="p-3">
      <p className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">{label}</p>
      <div className="mt-1 text-sm font-medium">{value}</div>
    </Card>
  )
}

