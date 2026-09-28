import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { fetchTasks } from '@/api'
import { EmptyState, ErrorState } from '@/components/common/EmptyState'
import { PageHeader } from '@/components/common/PageHeader'
import { StatusBadge } from '@/components/common/StatusBadge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { canReviewTask, displayName, getUser } from '@/data/selectors'
import { DashboardSkeleton } from '@/features/dashboard/DashboardSkeleton'
import { useSession } from '@/stores/auth-store'
import { AssignmentType } from '@/types'

export function ReviewsPage() {
  const { user, projectId, role } = useSession()
  const query = useQuery({
    queryKey: ['tasks', user?.id, projectId],
    queryFn: () => fetchTasks(user!.id, projectId!),
    enabled: Boolean(user && projectId),
  })
  if (query.isLoading) return <DashboardSkeleton />
  if (query.isError) return <ErrorState onRetry={() => query.refetch()} />
  if (role === AssignmentType.SCRUM_MASTER) {
    return (
      <EmptyState
        title="Scrum Masters do not review work."
        description="Associate work is reviewed by the POC. POC work is reviewed by the Mentor. Mentors review their own submissions."
      />
    )
  }
  if (role !== AssignmentType.POC && role !== AssignmentType.MENTOR) {
    return <EmptyState title="Reviews are managed by the POC or Mentor." />
  }
  const queue = (query.data ?? []).filter((task) => Boolean(user && canReviewTask(role, task, user.id)))
  return (
    <div>
      <PageHeader
        title="Reviews"
        count={queue.length}
        countNoun="reviews"
        description="Associate work is reviewed by you as POC. POC work is reviewed by the Mentor. Mentors approve their own submissions."
      />
      {queue.length === 0 ? (
        <EmptyState title="No tasks require review." />
      ) : (
        <div className="space-y-3">
          {queue.map((task) => (
            <Card key={task.id} className="flex items-center justify-between p-4">
              <div>
                <p className="font-semibold">{task.title}</p>
                <p className="text-sm text-muted-foreground">Assignee {displayName(getUser(task.assignedTo))}</p>
              </div>
              <div className="flex items-center gap-3">
                <StatusBadge status={task.status} />
                <Button asChild>
                  <Link to={`/tasks/${task.id}`}>Open review</Link>
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
