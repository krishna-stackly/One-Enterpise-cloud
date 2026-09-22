import { useQuery } from '@tanstack/react-query'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { fetchStructure } from '@/api'
import { EmptyState, ErrorState } from '@/components/common/EmptyState'
import { Breadcrumbs } from '@/components/common/HierarchyTrail'
import { PageHeader } from '@/components/common/PageHeader'
import { UserAvatar } from '@/components/common/UserAvatar'
import { Card } from '@/components/ui/card'
import { displayName } from '@/data/selectors'
import { DashboardSkeleton } from '@/features/dashboard/DashboardSkeleton'
import { useSession } from '@/stores/auth-store'

export function StructurePage() {
  const { projectId } = useSession()
  const query = useQuery({
    queryKey: ['structure', projectId],
    queryFn: () => fetchStructure(projectId!),
    enabled: Boolean(projectId),
  })

  if (query.isLoading) return <DashboardSkeleton />
  if (query.isError || !query.data?.project) return <ErrorState onRetry={() => query.refetch()} />

  const { project, scrumMaster, tree } = query.data

  return (
    <div>
      <Breadcrumbs items={[{ label: 'Dashboard', to: '/dashboard' }, { label: 'Project structure' }]} />
      <PageHeader
        title="Project structure"
        count={tree.length}
        countNoun="teams"
        description={`${project.name} hierarchy: Scrum Master → Team → Mentor → POC → Associate.`}
      />
      <Card className="p-6">
        <details open className="group">
          <summary className="flex cursor-pointer list-none items-center gap-2 text-lg font-semibold">
            <ChevronDown className="h-4 w-4 group-open:hidden" />
            <span className="hidden group-open:inline">
              <ChevronDown className="h-4 w-4" />
            </span>
            <Link to={`/projects/${project.id}`}>{project.name}</Link>
          </summary>
          <div className="mt-4 ml-4 space-y-4 border-l pl-4">
            <div className="flex items-center gap-3">
              <UserAvatar user={scrumMaster} />
              <div>
                <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Scrum Master</p>
                <p className="font-medium">{displayName(scrumMaster)}</p>
              </div>
            </div>
            {tree.map((node) => (
              <TeamNode key={node.team.id} node={node} />
            ))}
            {tree.length === 0 ? <EmptyState title="No teams found." /> : null}
          </div>
        </details>
      </Card>
    </div>
  )
}

function TeamNode({
  node,
}: {
  node: Awaited<ReturnType<typeof fetchStructure>>['tree'][number]
}) {
  const [open, setOpen] = useState(true)
  return (
    <div>
      <button type="button" className="flex items-center gap-2 font-semibold" onClick={() => setOpen(!open)}>
        {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        <Link to={`/teams/${node.team.id}`} onClick={(e) => e.stopPropagation()}>
          {node.team.name}
        </Link>
      </button>
      {open ? (
        <div className="mt-3 ml-4 space-y-3 border-l pl-4">
          <Link to={`/teams/${node.team.id}`} className="flex items-center gap-3">
            <UserAvatar user={node.mentor} size="sm" />
            <div>
              <p className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">Mentor</p>
              <p className="text-sm">{displayName(node.mentor)}</p>
            </div>
          </Link>
          {node.pocs.map((pocNode) => (
            <PocNode key={pocNode.poc.id} pocNode={pocNode} />
          ))}
        </div>
      ) : null}
    </div>
  )
}

function PocNode({
  pocNode,
}: {
  pocNode: Awaited<ReturnType<typeof fetchStructure>>['tree'][number]['pocs'][number]
}) {
  const [open, setOpen] = useState(true)
  return (
    <div>
      <button type="button" className="flex items-center gap-2" onClick={() => setOpen(!open)}>
        {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        <UserAvatar user={pocNode.poc} size="sm" />
        <div className="text-left">
          <p className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
            {pocNode.roleLabel ?? 'POC'}
          </p>
          <p className="text-sm font-medium">{displayName(pocNode.poc)}</p>
        </div>
      </button>
      {open ? (
        <div className="mt-2 ml-8 space-y-2">
          {(pocNode.associates ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">No associates yet.</p>
          ) : (
            (pocNode.associates ?? []).map((associate) => (
              <div key={associate.id} className="flex items-center gap-2">
                <UserAvatar user={associate} size="sm" />
                <div>
                  <p className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">Associate</p>
                  <p className="text-sm">{displayName(associate)}</p>
                </div>
              </div>
            ))
          )}
        </div>
      ) : null}
    </div>
  )
}