import { useQuery, useQueryClient } from '@tanstack/react-query'
import { formatDistanceToNow } from 'date-fns'
import {
  Bell,
  CheckCheck,
  ChevronDown,
  FolderKanban,
  GitBranch,
  LayoutDashboard,
  ListChecks,
  LogOut,
  Menu,
  MessageSquareQuote,
  Search,
  Settings,
  Shield,
  Timer,
  UserPlus,
  Users,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { apiMarkAllRead, apiMarkRead, fetchNotifications, fetchProjectOverview, fetchTasks } from '@/api'
import { BrandLogo } from '@/components/common/BrandLogo'
import { UserAvatar } from '@/components/common/UserAvatar'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { projects, teams } from '@/data/organization'
import { displayName, roleWithTeamLabel } from '@/data/selectors'
import { users } from '@/data/users'
import { cn } from '@/lib/utils'
import { useAuthStore, useSession } from '@/stores/auth-store'
import { useUiStore } from '@/stores/ui-store'
import { AssignmentType } from '@/types'

const navByRole: Record<AssignmentType, { to: string; label: string; icon: typeof LayoutDashboard }[]> = {
  SCRUM_MASTER: [
    { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/sprints', label: 'Sprints', icon: Timer },
    { to: '/structure', label: 'Structure', icon: GitBranch },
    { to: '/projects', label: 'Projects', icon: FolderKanban },
    { to: '/teams', label: 'Teams', icon: Users },
    { to: '/people', label: 'People', icon: UserPlus },
    { to: '/tasks', label: 'Tasks', icon: ListChecks },
    { to: '/queries', label: 'Queries', icon: MessageSquareQuote },
    { to: '/settings', label: 'Settings', icon: Settings },
  ],
  MENTOR: [
    { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/sprints', label: 'Sprints', icon: Timer },
    { to: '/structure', label: 'Structure', icon: GitBranch },
    { to: '/teams', label: 'My Team', icon: Users },
    { to: '/people', label: 'People', icon: UserPlus },
    { to: '/tasks', label: 'Tasks', icon: ListChecks },
    { to: '/reviews', label: 'Reviews', icon: CheckCheck },
    { to: '/queries', label: 'Queries', icon: MessageSquareQuote },
  ],
  POC: [
    { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/my-team', label: 'My Team', icon: Users },
    { to: '/tasks', label: 'Tasks', icon: ListChecks },
    { to: '/reviews', label: 'Reviews', icon: CheckCheck },
    { to: '/queries', label: 'Queries', icon: MessageSquareQuote },
  ],
  ASSOCIATE: [],
}

export function AppLayout() {
  const collapsed = useUiStore((s) => s.sidebarCollapsed)
  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <div className={cn('flex min-h-screen flex-col transition-[padding]', collapsed ? 'pl-16' : 'pl-60')}>
        <Header />
        <main className="flex-1 p-4">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

function Sidebar() {
  const { user, role, projectId, assignment } = useSession()
  const collapsed = useUiStore((s) => s.sidebarCollapsed)
  const project = projects.find((item) => item.id === projectId)
  const items = role ? navByRole[role] : []

  return (
    <aside
      className={cn(
        'fixed inset-y-0 left-0 z-40 flex flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-all',
        collapsed ? 'w-16' : 'w-60',
      )}
    >
      <div className={cn('flex h-14 items-center border-b border-sidebar-border px-3', collapsed && 'justify-center px-2')}>
        <BrandLogo compact={collapsed} inverted />
      </div>
      {!collapsed && project ? (
        <div className="border-b border-sidebar-border px-4 py-3">
          <p className="text-[10px] font-semibold tracking-wide text-sidebar-muted uppercase">Current project</p>
          <p className="mt-1 truncate text-sm font-semibold">{project.name}</p>
          <p className="text-xs text-sidebar-muted">{roleWithTeamLabel(assignment)}</p>
        </div>
      ) : null}
      <nav className="flex-1 space-y-0.5 overflow-y-auto p-2">
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[13px] font-medium text-sidebar-muted hover:bg-sidebar-accent hover:text-white',
                collapsed && 'justify-center px-2',
                isActive && 'bg-sidebar-accent text-white',
              )
            }
          >
            <item.icon className="h-4 w-4 shrink-0" />
            {!collapsed ? item.label : null}
          </NavLink>
        ))}
      </nav>
      <div className={cn('border-t border-sidebar-border p-3', collapsed && 'flex justify-center')}>
        <div className="flex items-center gap-2">
          <UserAvatar user={user} size="sm" />
          {!collapsed && user ? (
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{displayName(user)}</p>
              <p className="truncate text-[11px] text-sidebar-muted">{roleWithTeamLabel(assignment)}</p>
            </div>
          ) : null}
        </div>
      </div>
    </aside>
  )
}

function Header() {
  const { user, projectId, assignment } = useSession()
  const setProjectId = useAuthStore((s) => s.setProjectId)
  const logout = useAuthStore((s) => s.logout)
  const toggleSidebar = useUiStore((s) => s.toggleSidebar)
  const navigate = useNavigate()
  const [searchOpen, setSearchOpen] = useState(false)
  const queryClient = useQueryClient()
  // Server-computed list so the switcher shows every assigned project, not just
  // the one currently hydrated into the client org cache.
  const overviewQuery = useQuery({ queryKey: ['projects-overview'], queryFn: fetchProjectOverview })
  const availableProjects = overviewQuery.data ?? []
  const { data: notes = [] } = useQuery({
    queryKey: ['notifications', user?.id],
    queryFn: () => fetchNotifications(user!.id),
    enabled: Boolean(user),
  })
  const unread = notes.filter((item) => !item.read).length

  const roleLabel = roleWithTeamLabel(assignment)

  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-3 border-b bg-white/95 px-3 backdrop-blur">
      <div className="flex shrink-0 items-center">
        <Button variant="ghost" size="icon" onClick={toggleSidebar} aria-label="Toggle sidebar">
          <Menu className="h-4 w-4" />
        </Button>
      </div>
      <button
        type="button"
        onClick={() => setSearchOpen(true)}
        className="flex h-9 min-w-0 flex-1 items-center gap-2 rounded-lg border bg-slate-50 px-3 text-sm text-muted-foreground hover:bg-slate-100 md:max-w-xl"
      >
        <Search className="h-4 w-4 shrink-0" />
        <span className="truncate">Search projects, teams, POCs, tasks</span>
        <kbd className="ml-auto hidden rounded border bg-white px-1.5 text-[10px] font-semibold md:inline">/</kbd>
      </button>
      <div className="ml-auto flex shrink-0 items-center gap-1.5 sm:gap-2">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="gap-2 px-2 sm:px-3">
            <Shield className="h-4 w-4 text-primary" />
            <span className="hidden max-w-40 truncate sm:inline">
              {availableProjects.find((p) => p.id === projectId)?.name ?? 'Project'}
            </span>
            <ChevronDown className="h-3.5 w-3.5 opacity-60" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          <DropdownMenuLabel>Switch project</DropdownMenuLabel>
          {availableProjects.map((project) => {
            return (
              <DropdownMenuItem key={project.id} onClick={() => setProjectId(project.id)}>
                <div>
                  <p className="font-medium">{project.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {project.code} · {project.scrumMasterName ?? '—'}
                  </p>
                </div>
              </DropdownMenuItem>
            )
          })}
        </DropdownMenuContent>
      </DropdownMenu>
      <div className="hidden max-w-56 items-center truncate rounded-full border bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-700 sm:flex">
        {roleLabel}
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="relative" aria-label="Notifications">
            <Bell className="h-4 w-4" />
            {unread > 0 ? (
              <span className="absolute top-1.5 right-1.5 h-4 min-w-4 rounded-full bg-error px-1 text-[10px] leading-4 font-bold text-white">
                {unread}
              </span>
            ) : null}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-96">
          <div className="flex items-center justify-between px-2 py-1.5">
            <DropdownMenuLabel className="p-0">Notifications</DropdownMenuLabel>
            <button
              type="button"
              className="text-xs font-medium text-primary"
              onClick={() => {
                if (user) {
                  void apiMarkAllRead(user.id).then(() =>
                    queryClient.invalidateQueries({ queryKey: ['notifications'] }),
                  )
                }
              }}
            >
              Mark all as read
            </button>
          </div>
          <DropdownMenuSeparator />
          {notes.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">No notifications yet.</p>
          ) : (
            notes.slice(0, 6).map((item) => (
              <DropdownMenuItem
                key={item.id}
                className="items-start"
                onClick={() => {
                  void apiMarkRead(item.id).then(() => queryClient.invalidateQueries({ queryKey: ['notifications'] }))
                  if (item.entityType === 'TASK') navigate(`/tasks/${item.entityId}`)
                }}
              >
                <div className={cn('w-full', !item.read && 'font-medium')}>
                  <p className="text-sm">{item.title}</p>
                  <p className="text-xs text-muted-foreground">{item.message}</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}
                  </p>
                </div>
              </DropdownMenuItem>
            ))
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => navigate('/notifications')}>Open notification center</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="gap-2 px-2">
            <UserAvatar user={user} size="sm" />
            <ChevronDown className="h-3.5 w-3.5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>
            {user ? displayName(user) : 'Account'}
            <p className="font-normal text-muted-foreground">{user?.email}</p>
            <p className="font-normal text-muted-foreground">{roleLabel}</p>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => navigate('/settings')}>Settings</DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => {
              logout()
              navigate('/login')
            }}
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      </div>
      <GlobalSearch open={searchOpen} onOpenChange={setSearchOpen} />
    </header>
  )
}

function GlobalSearch({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { user, projectId, role } = useSession()
  const [q, setQ] = useState('')
  const navigate = useNavigate()
  const { data: tasks = [] } = useQuery({
    queryKey: ['tasks', user?.id, projectId],
    queryFn: () => fetchTasks(user!.id, projectId!),
    enabled: Boolean(user && projectId && open),
  })

  const results = useMemo(() => {
    const query = q.trim().toLowerCase()
    if (!query) {
      return {
        projects: projects.slice(0, 4),
        teams: teams.filter((team) => team.projectId === projectId).slice(0, 4),
        people: users.slice(0, 4),
        tasks: tasks.slice(0, 4),
      }
    }
    return {
      projects: projects.filter((p) => p.name.toLowerCase().includes(query) || p.code.toLowerCase().includes(query)),
      teams: teams.filter((t) => t.name.toLowerCase().includes(query)),
      people: users.filter(
        (u) => `${u.firstName} ${u.lastName}`.toLowerCase().includes(query) || u.email.includes(query),
      ),
      tasks: tasks.filter(
        (t) =>
          t.title.toLowerCase().includes(query) ||
          t.description.toLowerCase().includes(query) ||
          String(t.numericId).includes(query),
      ),
    }
  }, [q, tasks, projectId])

  function go(path: string) {
    onOpenChange(false)
    navigate(path)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl p-0">
        <DialogHeader className="px-4 pt-4">
          <DialogTitle>Global search</DialogTitle>
        </DialogHeader>
        <div className="px-4">
          <Input
            autoFocus
            placeholder="Search by name, email, or task ID"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <div className="max-h-96 space-y-3 overflow-auto px-4 pb-4">
          <SearchGroup
            title="Projects"
            empty="No projects assigned."
            items={results.projects.map((p) => ({ id: p.id, label: p.name, hint: p.code, to: `/projects/${p.id}` }))}
            onPick={go}
          />
          <SearchGroup
            title="Teams"
            empty="No teams found."
            items={results.teams.map((t) => ({ id: t.id, label: t.name, hint: t.description, to: `/teams/${t.id}` }))}
            onPick={go}
          />
          <SearchGroup
            title="People"
            empty="No people found."
            items={results.people.map((u) => ({
              id: u.id,
              label: `${u.firstName} ${u.lastName}`,
              hint: u.title,
              to: role === AssignmentType.POC ? '/my-team' : '/people',
            }))}
            onPick={go}
          />
          <SearchGroup
            title="Tasks"
            empty="No tasks assigned yet."
            items={results.tasks.map((t) => ({
              id: t.id,
              label: t.title,
              hint: `#${t.numericId}`,
              to: `/tasks/${t.id}`,
            }))}
            onPick={go}
          />
        </div>
      </DialogContent>
    </Dialog>
  )
}

function SearchGroup({
  title,
  items,
  onPick,
  empty,
}: {
  title: string
  items: { id: string; label: string; hint?: string; to: string }[]
  onPick: (to: string) => void
  empty: string
}) {
  return (
    <div>
      <p className="mb-1 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">{title}</p>
      {items.length === 0 ? <p className="text-sm text-muted-foreground">{empty}</p> : null}
      {items.slice(0, 5).map((item) => (
        <button
          key={item.id}
          type="button"
          className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted"
          onClick={() => onPick(item.to)}
        >
          <span>{item.label}</span>
          <span className="text-xs text-muted-foreground">{item.hint}</span>
        </button>
      ))}
    </div>
  )
}
