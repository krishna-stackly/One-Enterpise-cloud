import { useQuery } from '@tanstack/react-query'
import {
  addDays,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  parseISO,
  startOfMonth,
  startOfWeek,
} from 'date-fns'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { fetchTasks } from '@/api'
import { EmptyState, ErrorState } from '@/components/common/EmptyState'
import { PageHeader } from '@/components/common/PageHeader'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { TODAY, isOverdue } from '@/data/selectors'
import { DashboardSkeleton } from '@/features/dashboard/DashboardSkeleton'
import { useSession } from '@/stores/auth-store'
import { cn } from '@/lib/utils'

export function CalendarPage() {
  const { user, projectId } = useSession()
  const [view, setView] = useState<'month' | 'week' | 'day'>('month')
  const [cursor, setCursor] = useState(TODAY)
  const query = useQuery({
    queryKey: ['tasks', user?.id, projectId],
    queryFn: () => fetchTasks(user!.id, projectId!),
    enabled: Boolean(user && projectId),
  })
  const tasks = query.data ?? []
  const days = useMemo(() => {
    if (view === 'day') return [cursor]
    if (view === 'week') return eachDayOfInterval({ start: startOfWeek(cursor), end: endOfWeek(cursor) })
    return eachDayOfInterval({ start: startOfWeek(startOfMonth(cursor)), end: endOfWeek(endOfMonth(cursor)) })
  }, [view, cursor])

  if (query.isLoading) return <DashboardSkeleton />
  if (query.isError) return <ErrorState onRetry={() => query.refetch()} />

  return (
    <div>
      <PageHeader
        title="Calendar"
        count={tasks.length}
        countNoun="tasks"
        description="Deadlines in your authorization scope."
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setCursor(addDays(cursor, view === 'month' ? -30 : view === 'week' ? -7 : -1))}>
              Previous
            </Button>
            <Button variant="outline" onClick={() => setCursor(TODAY)}>
              Today
            </Button>
            <Button variant="outline" onClick={() => setCursor(addDays(cursor, view === 'month' ? 30 : view === 'week' ? 7 : 1))}>
              Next
            </Button>
          </div>
        }
      />
      <Tabs value={view} onValueChange={(value) => setView(value as typeof view)}>
        <TabsList>
          <TabsTrigger value="month">Month</TabsTrigger>
          <TabsTrigger value="week">Week</TabsTrigger>
          <TabsTrigger value="day">Day</TabsTrigger>
        </TabsList>
      </Tabs>
      <div className={cn('mt-4 grid gap-2', view === 'month' ? 'grid-cols-7' : view === 'week' ? 'grid-cols-7' : 'grid-cols-1')}>
        {days.map((day) => {
          const items = tasks.filter((task) => isSameDay(parseISO(task.dueDate), day))
          return (
            <Card key={day.toISOString()} className={cn('min-h-28 p-2', !isSameMonth(day, cursor) && view === 'month' && 'opacity-50')}>
              <p className="text-xs font-semibold">{format(day, view === 'day' ? 'EEEE d MMM' : 'd')}</p>
              <div className="mt-2 space-y-1">
                {items.slice(0, 3).map((task) => (
                  <Link
                    key={task.id}
                    to={`/tasks/${task.id}`}
                    className={cn('block truncate rounded px-1.5 py-0.5 text-[11px]', isOverdue(task) ? 'bg-red-50 text-red-800' : 'bg-indigo-50 text-indigo-800')}
                  >
                    {task.title}
                  </Link>
                ))}
              </div>
            </Card>
          )
        })}
      </div>
      {tasks.length === 0 ? <EmptyState className="mt-6" title="No upcoming tasks." /> : null}
    </div>
  )
}
