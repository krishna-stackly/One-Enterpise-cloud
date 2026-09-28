import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useEffect } from 'react'
import type { ReactNode } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { useMock } from '@/api/client'
import { hydrateWorkspace } from '@/api/real'
import { TooltipProvider } from '@/components/ui/tooltip'
import { ForgotPasswordPage } from '@/features/auth/ForgotPasswordPage'
import { LoginPage } from '@/features/auth/LoginPage'
import { ResetPasswordPage } from '@/features/auth/ResetPasswordPage'
import { AppLayout } from '@/layouts/AppLayout'
import { AuthLayout } from '@/layouts/AuthLayout'
import { DashboardPage } from '@/pages/DashboardPage'
import { MyTeamPage } from '@/pages/MyTeamPage'
import { NotificationsPage } from '@/pages/NotificationsPage'
import { PeoplePage } from '@/pages/PeoplePage'
import { ProjectDetailPage, ProjectsPage } from '@/pages/ProjectsPage'
import { QueriesPage } from '@/pages/QueriesPage'
import { ReviewsPage } from '@/pages/ReviewsPage'
import { SettingsPage } from '@/pages/SettingsPage'
import { SprintsPage } from '@/pages/SprintsPage'
import { StructurePage } from '@/pages/StructurePage'
import { TaskDetailPage } from '@/pages/TaskDetailPage'
import { TasksPage } from '@/pages/TasksPage'
import { TeamDetailPage, TeamsPage } from '@/pages/TeamsPage'
import { ProtectedRoute } from '@/routes/ProtectedRoute'
import { useAuthStore } from '@/stores/auth-store'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false },
  },
})

function GuestOnly({ children }: { children: ReactNode }) {
  const user = useAuthStore((s) => s.user)
  if (user) return <Navigate to="/dashboard" replace />
  return children
}

function WorkspaceBootstrap() {
  const user = useAuthStore((s) => s.user)
  const projectId = useAuthStore((s) => s.projectId)
  const userId = user?.id
  useEffect(() => {
    if (useMock || !userId || !projectId) return
    void hydrateWorkspace(projectId).catch(() => undefined)
  }, [userId, projectId])
  return null
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <WorkspaceBootstrap />
      <TooltipProvider>
        <BrowserRouter>
          <Routes>
            <Route element={<AuthLayout />}>
              <Route path="/login" element={<GuestOnly><LoginPage /></GuestOnly>} />
              <Route path="/forgot-password" element={<GuestOnly><ForgotPasswordPage /></GuestOnly>} />
              <Route path="/reset-password" element={<GuestOnly><ResetPasswordPage /></GuestOnly>} />
            </Route>
            <Route element={<ProtectedRoute />}>
              <Route element={<AppLayout />}>
                <Route path="/dashboard" element={<DashboardPage />} />
                <Route path="/sprints" element={<SprintsPage />} />
                <Route path="/structure" element={<StructurePage />} />
                <Route path="/projects" element={<ProjectsPage />} />
                <Route path="/projects/:id" element={<ProjectDetailPage />} />
                <Route path="/teams" element={<TeamsPage />} />
                <Route path="/teams/:id" element={<TeamDetailPage />} />
                <Route path="/people" element={<PeoplePage />} />
                <Route path="/my-team" element={<MyTeamPage />} />
                <Route path="/tasks" element={<TasksPage />} />
                <Route path="/tasks/:id" element={<TaskDetailPage />} />
                <Route path="/reviews" element={<ReviewsPage />} />
                <Route path="/queries" element={<QueriesPage />} />
                <Route path="/notifications" element={<NotificationsPage />} />
                <Route path="/settings" element={<SettingsPage />} />
              </Route>
            </Route>
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  )
}
