import { Outlet } from 'react-router-dom'
import { BrandLogo } from '@/components/common/BrandLogo'

export function AuthLayout() {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden overflow-hidden bg-sidebar text-sidebar-foreground lg:flex lg:flex-col lg:justify-between p-8">
        <BrandLogo inverted />
        <div className="max-w-md space-y-4">
          <p className="text-xl font-semibold tracking-tight">Work that follows a clear chain of responsibility.</p>
          <ol className="space-y-2 text-[13px] leading-5 text-sidebar-muted">
            <li className="rounded-lg border border-sidebar-border bg-sidebar-accent/60 px-3 py-2.5">Scrum Master oversees the project</li>
            <li className="rounded-lg border border-sidebar-border bg-sidebar-accent/60 px-3 py-2.5">Mentor is also POC of their team — they can work themselves or assign other POCs</li>
            <li className="rounded-lg border border-sidebar-border bg-sidebar-accent/60 px-3 py-2.5">Mentor assigns work to POCs; POCs assign associates and update their work</li>
            <li className="rounded-lg border border-sidebar-border bg-sidebar-accent/60 px-3 py-2.5">Associate work → POC reviews · POC work → Mentor reviews · Mentor reviews their own work</li>
          </ol>
        </div>
        <p className="text-[11px] text-sidebar-muted">Never display Project Lead, Team Lead, or Employee in the product UI.</p>
      </div>
      <div className="flex items-center justify-center bg-background p-6">
        <div className="w-full max-w-sm">
          <div className="mb-6 lg:hidden">
            <BrandLogo />
          </div>
          <Outlet />
        </div>
      </div>
    </div>
  )
}
