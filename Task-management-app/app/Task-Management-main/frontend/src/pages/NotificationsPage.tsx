import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { formatDistanceToNow } from 'date-fns'
import { fetchNotifications, apiMarkAllRead, apiMarkRead } from '@/api'
import { EmptyState, ErrorState } from '@/components/common/EmptyState'
import { PageHeader } from '@/components/common/PageHeader'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { DashboardSkeleton } from '@/features/dashboard/DashboardSkeleton'
import { useSession } from '@/stores/auth-store'
import { cn } from '@/lib/utils'

export function NotificationsPage() {
  const { user } = useSession()
  const queryClient = useQueryClient()
  const query = useQuery({
    queryKey: ['notifications', user?.id],
    queryFn: () => fetchNotifications(user!.id),
    enabled: Boolean(user),
  })
  const markAll = useMutation({
    mutationFn: () => apiMarkAllRead(user!.id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  })
  if (query.isLoading) return <DashboardSkeleton />
  if (query.isError) return <ErrorState onRetry={() => query.refetch()} />
  const notes = query.data ?? []

  return (
    <div>
      <PageHeader
        title="Notification center"
        count={notes.length}
        countNoun="notifications"
        description="Alerts follow the Scrum Master → Mentor → POC hierarchy."
        actions={
          <Button variant="outline" onClick={() => markAll.mutate()}>
            Mark all as read
          </Button>
        }
      />
      {notes.length === 0 ? (
        <EmptyState title="No notifications yet." />
      ) : (
        <div className="space-y-2">
          {notes.map((item) => (
            <Card
              key={item.id}
              className={cn('cursor-pointer p-4', !item.read && 'border-primary/30 bg-indigo-50/40')}
              onClick={() => {
                void apiMarkRead(item.id).then(() => queryClient.invalidateQueries({ queryKey: ['notifications'] }))
              }}
            >
              <p className="font-semibold">{item.title}</p>
              <p className="text-sm text-muted-foreground">{item.message}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}
              </p>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
