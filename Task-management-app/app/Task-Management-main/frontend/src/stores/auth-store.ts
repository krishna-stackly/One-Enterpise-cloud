import { persist } from 'zustand/middleware'
import { create } from 'zustand'
import { setAccessToken } from '@/api/auth-token'
import { useMock } from '@/api/client'
import {
  apiLogin as realLogin,
  apiLogout as realLogout,
  fetchProjects as fetchRealProjects,
  fetchSession as fetchRealSession,
  hydrateWorkspace,
} from '@/api/real'
import { assignmentForUserProject, projectsForUser } from '@/data/selectors'
import { authenticate, associateLoginBlocked } from '@/data/store'
import type { AssignmentType, ProjectAssignment, User } from '@/types'

interface AuthState {
  user: User | null
  projectId: string | null
  assignment: ProjectAssignment | null
  accessToken: string | null
  refreshToken: string | null
  login: (email: string, password: string) => Promise<{ ok: true } | { ok: false; message: string }>
  logout: () => void
  setProjectId: (projectId: string) => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      projectId: null,
      assignment: null,
      accessToken: null,
      refreshToken: null,
      login: async (email, password) => {
        const cleaned = email.trim().toLowerCase()
        if (!useMock) {
          try {
            const token = await realLogin(cleaned, password)
            setAccessToken(token.accessToken)
            set({ accessToken: token.accessToken, refreshToken: token.refreshToken })
            const projects = await fetchRealProjects()
            if (projects.length === 0) {
              setAccessToken(null)
              set({ accessToken: null, refreshToken: null })
              return { ok: false, message: 'No projects are assigned to your account' }
            }
            const preferred = projects[0]
            const session = await fetchRealSession(preferred.id)
            await hydrateWorkspace(preferred.id)
            set({ user: session.user, projectId: preferred.id, assignment: session.assignment })
            return { ok: true }
          } catch (error) {
            setAccessToken(null)
            set({ accessToken: null, refreshToken: null })
            return {
              ok: false,
              message: error instanceof Error ? error.message : 'Sign in failed',
            }
          }
        }
        const user = authenticate(cleaned, password)
        if (!user) {
          if (associateLoginBlocked(cleaned, password)) {
            return {
              ok: false,
              message: 'Associates do not have app login or a dashboard. Ask your POC to update work.',
            }
          }
          return { ok: false, message: 'Invalid email or password' }
        }
        const projects = projectsForUser(user.id)
        const preferred = projects.find((project) => project.id === 'prj_hrms') ?? projects[0]
        const assignment = preferred?.id ? (assignmentForUserProject(user.id, preferred.id) ?? null) : null
        set({
          user,
          projectId: preferred?.id ?? null,
          assignment,
          accessToken: null,
          refreshToken: null,
        })
        return { ok: true }
      },
      logout: () => {
        const { refreshToken } = get()
        if (!useMock && refreshToken) {
          void realLogout(refreshToken)
        }
        setAccessToken(null)
        set({ user: null, projectId: null, assignment: null, accessToken: null, refreshToken: null })
      },
      setProjectId: (projectId) => {
        const { user } = get()
        if (!user) return
        if (useMock) {
          const next = assignmentForUserProject(user.id, projectId) ?? null
          set({ projectId, assignment: next })
          return
        }
        set({ projectId })
        void fetchRealSession(projectId)
          .then((session) => {
            const currentPassword = get().user?.password ?? ''
            set({
              user: { ...session.user, password: currentPassword },
              assignment: session.assignment,
            })
            return hydrateWorkspace(projectId)
          })
          .catch(() => undefined)
      },
    }),
    {
      name: 'stackly-auth',
      onRehydrateStorage: () => (state) => {
        if (state?.accessToken) setAccessToken(state.accessToken)
      },
    },
  ),
)

export function useSession() {
  const user = useAuthStore((s) => s.user)
  const projectId = useAuthStore((s) => s.projectId)
  const storedAssignment = useAuthStore((s) => s.assignment)
  const assignment =
    storedAssignment ?? (user && projectId ? assignmentForUserProject(user.id, projectId) : undefined)
  return {
    user,
    projectId,
    assignment,
    role: assignment?.assignmentType as AssignmentType | undefined,
    teamId: assignment?.teamId ?? null,
  }
}
