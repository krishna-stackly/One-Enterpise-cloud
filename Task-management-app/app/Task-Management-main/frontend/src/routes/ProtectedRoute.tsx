import { useRef } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuthStore } from '@/stores/auth-store'

export function ProtectedRoute() {
  const user = useAuthStore((s) => s.user)
  const location = useLocation()
  const _notified = useRef(false)
  void _notified

  if (!user) return <Navigate to="/login" replace state={{ from: location, message: undefined }} />
  return <Outlet />
}
