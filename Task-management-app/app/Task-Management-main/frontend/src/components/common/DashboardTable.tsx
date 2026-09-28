import { ChevronRight } from 'lucide-react'
import { Fragment as ReactFragment, useState } from 'react'
import { cn } from '@/lib/utils'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

interface DashboardColumn {
  key: string
  header: string
  className?: string
}

interface DashboardRow {
  key: string
  values: Record<string, React.ReactNode>
  detail?: React.ReactNode
  detailTitle?: string
  detailDescription?: string
}

interface DashboardTableProps {
  columns: DashboardColumn[]
  rows: DashboardRow[]
  empty?: { title: string; description?: string }
  ariaLabel?: string
}

export function DashboardTable({ columns, rows, empty, ariaLabel }: DashboardTableProps) {
  const [expandedKey, setExpandedKey] = useState<string | null>(null)

  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-dashed bg-slate-50/60 px-4 py-8 text-center">
        <p className="text-sm font-semibold text-slate-600">{empty?.title ?? 'Nothing to show'}</p>
        {empty?.description ? <p className="mt-1 text-sm text-muted-foreground">{empty.description}</p> : null}
      </div>
    )
  }

  return (
    <div className="w-full overflow-auto rounded-xl border bg-card">
      <Table aria-label={ariaLabel}>
        <TableHeader>
          <TableRow>
            <TableHead aria-hidden="true" className="w-8" />
            {columns.map((column) => (
              <TableHead key={column.key} className={column.className}>
                {column.header}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => {
            const expanded = row.key === expandedKey
            return (
              <ReactFragment key={row.key}>
                <TableRow
                  className="cursor-pointer"
                  onClick={() => setExpandedKey(expanded ? null : row.key)}
                >
                  <TableCell aria-hidden="true">
                    <ChevronRight className={cn('h-4 w-4 text-muted-foreground', expanded && 'rotate-90')} />
                  </TableCell>
                  {columns.map((column) => (
                    <TableCell key={`${row.key}-${column.key}`}>{row.values[column.key] ?? ''}</TableCell>
                  ))}
                </TableRow>
                {expanded ? (
                  <TableRow className="bg-slate-50/60">
                    <TableCell colSpan={columns.length + 1}>
                      <div className="rounded-lg border p-4">
                        {row.detailTitle ? <p className="text-sm font-semibold">{row.detailTitle}</p> : null}
                        {row.detailDescription ? (
                          <p className="mt-1 text-sm text-muted-foreground">{row.detailDescription}</p>
                        ) : null}
                        {row.detail ? <div className="mt-3 space-y-3">{row.detail}</div> : null}
                      </div>
                    </TableCell>
                  </TableRow>
                ) : null}
              </ReactFragment>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}