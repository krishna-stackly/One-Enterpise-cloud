import { Navigate } from 'react-router-dom'
import { LeanDashboard } from '@/features/dashboard/LeanDashboard'
import { useSession } from '@/stores/auth-store'

export function DashboardPage() {
  const { user, projectId } = useSession()
  if (!user || !projectId) return <Navigate to="/login" replace />
  return <LeanDashboard />
}
