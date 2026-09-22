import {
  DndContext,
  PointerSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { apiStatus, fetchTasks } from '@/api'
import { EmptyState, ErrorState } from '@/components/common/EmptyState'
import { PageHeader } from '@/components/common/PageHeader'
import { PriorityBadge } from '@/components/common/StatusBadge'
import { Card } from '@/components/ui/card'
import { allowedStatusMoves } from '@/data/store'
import { DashboardSkeleton } from '@/features/dashboard/DashboardSkeleton'
import { useSession } from '@/stores/auth-store'
import { KANBAN_COLUMNS, STATUS_META, type Task, type TaskStatus } from '@/types'

export function KanbanPage() {
  const { user, projectId, role } = useSession()
  const queryClient = useQueryClient()
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))
  const query = useQuery({
    queryKey: ['tasks', user?.id, projectId],
    queryFn: () => fetchTasks(user!.id, projectId!),
    enabled: Boolean(user && projectId),
  })
  const mutation = useMutation({
    mutationFn: ({ task, status }: { task: Task; status: TaskStatus }) =>
      apiStatus(task.id, status, user!, task.projectId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tasks'] }),
    onError: (error: Error) => toast.error(error.message),
  })

  if (query.isLoading) return <DashboardSkeleton />
  if (query.isError) return <ErrorState onRetry={() => query.refetch()} />

  const tasks = query.data ?? []

  function onDragEnd(event: DragEndEvent) {
    const taskId = String(event.active.id)
    const overId = event.over?.id ? String(event.over.id) : null
    if (!overId || !user || !role) return
    const task = tasks.find((item) => item.id === taskId)
    if (!task) return
    const target = (KANBAN_COLUMNS as string[]).includes(overId) ? (overId as TaskStatus) : null
    if (!target || target === task.status) return
    const allowed = allowedStatusMoves(role, task, user.id)
    if (!allowed.includes(target)) {
      toast.error('You cannot move this task into that status')
      return
    }
    mutation.mutate({ task, status: target })
  }

  return (
    <div>
      <PageHeader
        title="Kanban"
        count={tasks.length}
        countNoun="tasks"
        description="Drag only into statuses your assignment allows."
      />
      <DndContext sensors={sensors} collisionDetection={closestCorners} onDragEnd={onDragEnd}>
        <div className="grid auto-cols-[minmax(240px,1fr)] grid-flow-col gap-3 overflow-x-auto pb-4">
          {KANBAN_COLUMNS.map((status) => (
            <KanbanColumn key={status} status={status} tasks={tasks.filter((task) => task.status === status)} />
          ))}
        </div>
      </DndContext>
    </div>
  )
}

function KanbanColumn({ status, tasks }: { status: TaskStatus; tasks: Task[] }) {
  const { setNodeRef } = useDroppable({ id: status })
  return (
    <div ref={setNodeRef} className="min-h-[70vh] rounded-xl border bg-slate-50/80 p-3">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-semibold">{STATUS_META[status].label}</p>
        <span className="text-xs text-muted-foreground">{tasks.length}</span>
      </div>
      <SortableContext items={tasks.map((task) => task.id)} strategy={verticalListSortingStrategy}>
        <div className="space-y-2">
          {tasks.length === 0 ? <EmptyState title="No tasks" className="py-8" /> : null}
          {tasks.map((task) => (
            <KanbanCard key={task.id} task={task} />
          ))}
        </div>
      </SortableContext>
    </div>
  )
}

function KanbanCard({ task }: { task: Task }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: task.id })
  return (
    <Card
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className="cursor-grab p-3 active:cursor-grabbing"
      {...attributes}
      {...listeners}
    >
      <Link to={`/tasks/${task.id}`} className="text-sm font-semibold hover:text-primary" onClick={(e) => e.stopPropagation()}>
        {task.title}
      </Link>
      <div className="mt-2 flex items-center justify-between">
        <PriorityBadge priority={task.priority} />
        <span className="text-[11px] text-muted-foreground">#{task.numericId}</span>
      </div>
    </Card>
  )
}
