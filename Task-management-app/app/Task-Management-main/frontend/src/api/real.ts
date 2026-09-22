import { http } from '@/api/http'
import { assignments, projectById, setOrgData, teams } from '@/data/organization'
import {
  pocCount,
  childrenOf,
  computedProgress,
  countByStatus,
  lineageForTask,
  mentorOfTeam,
  pocsOfTeam,
  associatesOf,
  canReviewTask,
  projectProgress,
  scrumMasterOf,
  teamCount,
  teamProgress,
  teamsInProject,
} from '@/data/selectors'
import {
  getActivity,
  getTasks,
  mergeComments,
  mergeReviews,
  mergeWorkLogs,
  setActivity,
  setNotifications,
  setTasks,
} from '@/data/store'
import { setUsers } from '@/data/users'
import { userById } from '@/data/users'
import { SystemRole, AssignmentType, type ActivityLog, type AppNotification, type HierarchyQuery, type Priority, type Project, type ProjectAssignment, type ProjectOverview, type QueryStatus, type Sprint, type Task, type TaskAttachment, type TaskComment, type TaskReview, type TaskStatus, type Team, type User, type WorkLog } from '@/types'

/* ------------------------------------------------------------------ */
/* Backend payload types (Long ids, wrapped in ApiResponse)            */
/* ------------------------------------------------------------------ */

interface ApiEnvelope<T> {
  success: boolean
  message: string
  data: T
  errors?: string[] | null
}

interface BackendUser {
  id: number
  firstName: string
  lastName: string
  email: string
  title: string
  systemRole?: string
}

interface BackendProject {
  id: number
  name: string
  code: string
  description: string
  status: string
  startDate?: string | null
  dueDate?: string | null
}

interface BackendTeam {
  id: number
  projectId: number
  name: string
  description: string
}

interface BackendAssignment {
  id: number
  userId: number
  projectId: number
  assignmentType: string
  teamId: number | null
  pocId: number | null
}

interface BackendTask {
  id: number
  projectId: number
  teamId: number
  parentTaskId: number | null
  sprintId?: number | null
  title: string
  description: string
  status: string
  priority: string
  assignedTo: number | null
  assignedBy: number
  dueDate: string
  estimatedHours: number | null
  actualHours: number | null
  progressPercent: number
  doneByName?: string | null
}

interface BackendNotification {
  id: number
  title: string
  message: string
  read: boolean
  type: string
}

interface BackendActivity {
  id: number
  userId: number
  action: string
  entityType: string
  entityId: number | null
  projectId: number
  message: string
  createdAt: string | null
}

interface BackendComment {
  id: number
  taskId: number
  authorId: number
  body: string
  createdAt: string | null
}

interface BackendReview {
  id: number
  taskId: number
  reviewerId: number
  decision: string
  comment: string | null
  createdAt: string | null
}

interface BackendWorkLog {
  id: number
  taskId: number
  userId: number
  date: string
  hours: number | null
  description: string
}

interface BackendAttachment {
  id: number
  taskId: number
  fileName: string
  fileSize: number
  contentType: string
  url: string
  uploadedBy: number
  uploadedAt: string | null
}

interface BackendToken {
  accessToken: string
  refreshToken: string
  tokenType: string
  userId: number
  email: string
  firstName: string
  lastName: string
}

interface BackendSession {
  user: BackendUser
  projects: BackendProject[]
  assignment: {
    assignmentType: string
    teamId: number | null
    pocId: number | null
  } | null
}

/* ------------------------------------------------------------------ */
/* Request helpers                                                      */
/* ------------------------------------------------------------------ */

async function get<T>(url: string, params?: Record<string, unknown>): Promise<T> {
  const res = await http.get<ApiEnvelope<T>>(url, { params })
  if (!res.data.success) throw new Error(res.data.message || 'Request failed')
  return res.data.data
}

async function post<T>(url: string, body?: unknown): Promise<T> {
  const res = await http.post<ApiEnvelope<T>>(url, body)
  if (!res.data.success) throw new Error(res.data.message || 'Request failed')
  return res.data.data
}

async function patch<T>(url: string, body?: unknown): Promise<T> {
  const res = await http.patch<ApiEnvelope<T>>(url, body)
  if (!res.data.success) throw new Error(res.data.message || 'Request failed')
  return res.data.data
}

async function put<T>(url: string, body?: unknown): Promise<T> {
  const res = await http.put<ApiEnvelope<T>>(url, body)
  if (!res.data.success) throw new Error(res.data.message || 'Request failed')
  return res.data.data
}

async function del<T>(url: string): Promise<T> {
  const res = await http.delete<ApiEnvelope<T>>(url)
  if (!res.data.success) throw new Error(res.data.message || 'Request failed')
  return res.data.data
}

/* ------------------------------------------------------------------ */
/* Id mapping: backend Long ids  <->  frontend prefixed string ids      */
/* ------------------------------------------------------------------ */

const uid = (value: number | null | undefined) => (value == null ? null : `usr_${value}`)
const prid = (value: number | null | undefined) => (value == null ? null : `prj_${value}`)
const tid = (value: number | null | undefined) => (value == null ? null : `team_${value}`)
const kid = (value: number | null | undefined) => (value == null ? null : `tsk_${value}`)

/** 'usr_12' | 'tsk_12' | 'team_12' | 'prj_12' -> 12 */
export function n(value: string | null | undefined): number | null {
  if (!value) return null
  const parsed = Number(String(value).split('_').pop())
  return Number.isFinite(parsed) ? parsed : null
}

/* ------------------------------------------------------------------ */
/* Entity mappers                                                       */
/* ------------------------------------------------------------------ */

function mapUser(row: BackendUser): User {
  return {
    id: uid(row.id)!,
    firstName: row.firstName,
    lastName: row.lastName,
    email: row.email,
    title: row.title ?? '',
    systemRole: row.systemRole === 'ADMIN' ? SystemRole.ADMIN : SystemRole.USER,
    avatarHue: (row.id * 47) % 360,
    password: '',
  }
}

function mapProject(row: BackendProject): Project {
  return {
    id: prid(row.id)!,
    name: row.name,
    code: row.code,
    description: row.description ?? '',
    status: row.status as Project['status'],
    startDate: row.startDate ?? '',
    dueDate: row.dueDate ?? '',
    createdAt: row.startDate ? `${row.startDate}T00:00:00.000Z` : new Date().toISOString(),
  }
}

interface BackendProjectOverview {
  id: number
  name: string
  code: string
  description: string
  status: string
  startDate: string | null
  dueDate: string | null
  teamCount: number
  scrumMasterName: string | null
  progress: number
}

function mapProjectOverview(row: BackendProjectOverview): ProjectOverview {
  return {
    id: prid(row.id)!,
    name: row.name,
    code: row.code,
    description: row.description ?? '',
    status: row.status as ProjectOverview['status'],
    startDate: row.startDate,
    dueDate: row.dueDate,
    teamCount: row.teamCount,
    scrumMasterName: row.scrumMasterName,
    progress: row.progress,
  }
}

function mapTeam(row: BackendTeam): Team {
  return {
    id: tid(row.id)!,
    projectId: prid(row.projectId)!,
    name: row.name,
    description: row.description ?? '',
  }
}

function mapAssignment(row: BackendAssignment): ProjectAssignment {
  return {
    id: `as_${row.id}`,
    userId: uid(row.userId)!,
    projectId: prid(row.projectId)!,
    assignmentType: row.assignmentType as AssignmentType,
    teamId: tid(row.teamId),
    pocId: uid(row.pocId),
  }
}

function mapTask(row: BackendTask): Task {
  const stamp = `${row.dueDate}T00:00:00.000Z`
  return {
    id: kid(row.id)!,
    numericId: row.id,
    projectId: prid(row.projectId)!,
    teamId: tid(row.teamId)!,
    parentTaskId: kid(row.parentTaskId),
    sprintId: row.sprintId == null ? null : `spr_${row.sprintId}`,
    title: row.title,
    description: row.description ?? '',
    status: row.status as TaskStatus,
    priority: row.priority as Priority,
    assignedTo: uid(row.assignedTo),
    assignedBy: uid(row.assignedBy) ?? '',
    dueDate: row.dueDate,
    estimatedHours: Number(row.estimatedHours ?? 0),
    actualHours: Number(row.actualHours ?? 0),
    progressPercent: row.progressPercent ?? 0,
    doneByName: row.doneByName ?? null,
    labelIds: [],
    createdAt: stamp,
    updatedAt: stamp,
  }
}

let activeProjectId = ''

function mapNotification(row: BackendNotification, userId: string): AppNotification {
  return {
    id: `ntf_${row.id}`,
    userId,
    type: row.type as AppNotification['type'],
    title: row.title,
    message: row.message,
    entityType: 'TASK',
    entityId: '',
    projectId: activeProjectId,
    read: row.read,
    createdAt: new Date().toISOString(),
  }
}

function mapActivity(row: BackendActivity): ActivityLog {
  const entityPrefix = row.entityType === 'PROJECT' ? 'prj' : row.entityType === 'TEAM' ? 'team' : 'tsk'
  return {
    id: `act_${row.id}`,
    userId: uid(row.userId)!,
    action: row.action,
    entityType: row.entityType,
    entityId: row.entityId == null ? '' : `${entityPrefix}_${row.entityId}`,
    projectId: prid(row.projectId)!,
    message: row.message,
    createdAt: row.createdAt ?? new Date().toISOString(),
  }
}

function mapComment(row: BackendComment): TaskComment {
  return {
    id: `cmt_${row.id}`,
    taskId: kid(row.taskId)!,
    authorId: uid(row.authorId)!,
    body: row.body,
    mentions: [],
    createdAt: row.createdAt ?? new Date().toISOString(),
  }
}

function mapAttachment(row: BackendAttachment): TaskAttachment {
  return {
    id: `att_${row.id}`,
    taskId: kid(row.taskId)!,
    fileName: row.fileName,
    fileSize: row.fileSize,
    contentType: row.contentType,
    url: row.url,
    uploadedBy: uid(row.uploadedBy)!,
    uploadedAt: row.uploadedAt ?? new Date().toISOString(),
  }
}

function mapReview(row: BackendReview): TaskReview {
  return {
    id: `rev_${row.id}`,
    taskId: kid(row.taskId)!,
    reviewerId: uid(row.reviewerId)!,
    decision: row.decision === 'REJECT' ? 'REJECT' : 'APPROVE',
    comment: row.comment ?? '',
    createdAt: row.createdAt ?? new Date().toISOString(),
  }
}

function mapWorkLog(row: BackendWorkLog): WorkLog {
  return {
    id: `log_${row.id}`,
    taskId: kid(row.taskId)!,
    userId: uid(row.userId)!,
    date: row.date,
    hours: Number(row.hours ?? 0),
    description: row.description,
  }
}
/* ------------------------------------------------------------------ */
/* Auth + session + workspace hydration                                 */
/* ------------------------------------------------------------------ */

export async function apiLogin(email: string, password: string): Promise<BackendToken> {
  return post<BackendToken>('/auth/login', { email, password })
}

export async function apiLogout(refreshToken: string): Promise<void> {
  try {
    await post('/auth/logout', { refreshToken })
  } catch {
    /* best-effort — clear local state regardless */
  }
}

export async function fetchSession(
  projectId: string | null,
): Promise<{ user: User; projects: Project[]; assignment: ProjectAssignment | null }> {
  const data = await get<BackendSession>('/session', projectId ? { projectId: n(projectId) } : undefined)
  const row = data.assignment
  const assignment: ProjectAssignment | null =
    row && projectId
      ? {
          id: 'as_session',
          userId: uid(data.user.id)!,
          projectId,
          assignmentType: row.assignmentType as AssignmentType,
          teamId: row.teamId == null ? null : tid(row.teamId),
          pocId: row.pocId == null ? null : uid(row.pocId),
        }
      : null
  return { user: mapUser(data.user), projects: data.projects.map(mapProject), assignment }
}

/**
 * Fetches everything the UI needs for one project from the real API and swaps it
 * into the in-memory stores that the selectors/pages read from. This is what makes
 * the whole app run on real MySQL data without mock seed content.
 */
export async function hydrateWorkspace(projectId: string): Promise<BackendSession> {
  const nProjectId = n(projectId)
  if (!nProjectId) throw new Error('Unknown project')
  activeProjectId = projectId

  const [session, users, teams, assignments, tasks, activity] = await Promise.all([
    get<BackendSession>('/session', { projectId: nProjectId }),
    get<BackendUser[]>('/users'),
    get<BackendTeam[]>(`/projects/${nProjectId}/teams`),
    get<BackendAssignment[]>(`/projects/${nProjectId}/assignments`),
    get<BackendTask[]>('/tasks', { projectId: nProjectId }),
    get<BackendActivity[]>('/activity', { projectId: nProjectId }).catch(() => [] as BackendActivity[]),
  ])

  setUsers(users.map(mapUser))
  setOrgData({
    projects: session.projects.map(mapProject),
    teams: teams.map(mapTeam),
    assignments: assignments.map(mapAssignment),
  })
  setTasks(tasks.map(mapTask))
  setActivity(activity.map(mapActivity))

  const currentUserId = uid(session.user.id) ?? ''
  const notifications = await get<BackendNotification[]>('/notifications').catch(() => [] as BackendNotification[])
  setNotifications(notifications.map((row) => mapNotification(row, currentUserId)))

  return session
}

/** Re-fetches tasks + activity after a task mutation. */
export async function refreshTasks(projectId: string): Promise<void> {
  const nProjectId = n(projectId)
  if (!nProjectId) return
  const [tasks, activity] = await Promise.all([
    get<BackendTask[]>('/tasks', { projectId: nProjectId }),
    get<BackendActivity[]>('/activity', { projectId: nProjectId }).catch(() => [] as BackendActivity[]),
  ])
  setTasks(tasks.map(mapTask))
  setActivity(activity.map(mapActivity))
}

/** Re-fetches people/org data after org mutations (add person, team, assignment). */
export async function refreshOrg(projectId: string): Promise<void> {
  const nProjectId = n(projectId)
  if (!nProjectId) return
  const [users, teams, assignments] = await Promise.all([
    get<BackendUser[]>('/users'),
    get<BackendTeam[]>(`/projects/${nProjectId}/teams`),
    get<BackendAssignment[]>(`/projects/${nProjectId}/assignments`),
  ])
  setUsers(users.map(mapUser))
  const existingProjects = Object.values(projectById)
  setOrgData({
    projects: existingProjects.length > 0 ? existingProjects : [],
    teams: teams.map(mapTeam),
    assignments: assignments.map(mapAssignment),
  })
}
/* ------------------------------------------------------------------ */
/* Fetchers — real API data, hydrated into the store                    */
/* ------------------------------------------------------------------ */

export async function fetchTasks(_userId: string, projectId: string): Promise<Task[]> {
  const nProjectId = n(projectId)
  if (!nProjectId) throw new Error('Unknown project')
  const rows = await get<BackendTask[]>('/tasks', { projectId: nProjectId })
  const mapped = rows.map(mapTask)
  setTasks(mapped)
  return mapped
}

export async function fetchScrumMasterDashboard(projectId: string) {
  await hydrateWorkspace(projectId)
  const all = getTasks()
  const tasks = all.filter((task) => task.projectId === projectId)
  const project = projectById[projectId]
  if (!project) throw new Error('Project not found')
  const teamRows = teamsInProject(projectId).map((team) => ({
    ...team,
    progress: teamProgress(team.id, all),
    mentor: mentorOfTeam(team.id),
    pocs: pocsOfTeam(team.id),
  }))
  const upcoming = [...tasks]
    .filter((task) => task.status !== 'COMPLETED')
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
    .slice(0, 6)
  return {
    project,
    scrumMaster: scrumMasterOf(projectId),
    progress: projectProgress(projectId, all),
    stats: countByStatus(tasks),
    teamCount: teamCount(projectId),
    pocCount: pocCount(projectId),
    teams: teamRows,
    upcoming,
    blockers: tasks.filter((task) => task.status === 'BLOCKED'),
    activity: getActivity(projectId).slice(0, 8),
  }
}

function childrenOfMany(parentIds: string[]) {
  return getTasks().filter((task) => task.parentTaskId !== null && parentIds.includes(task.parentTaskId))
}

export async function fetchMentorDashboard(projectId: string, teamId: string) {
  await hydrateWorkspace(projectId)
  const all = getTasks()
  const team = teams.find((item) => item.id === teamId)
  if (!team) throw new Error('Team not found')
  const tasks = all.filter((task) => task.teamId === teamId)
  const parents = tasks.filter((task) => task.parentTaskId === null)
  const mentor = mentorOfTeam(teamId)
  const leadPocs = [...(mentor ? [mentor] : []), ...pocsOfTeam(teamId).filter((poc) => poc.id !== mentor?.id)]
  const pocs = leadPocs.map((poc) => {
    const pocTasks = parents.filter((task) => task.assignedTo === poc.id)
    const progress =
      pocTasks.length === 0
        ? 0
        : Math.round(pocTasks.reduce((sum, task) => sum + computedProgress(task, all), 0) / pocTasks.length)
    return {
      poc,
      isMentor: poc.id === mentor?.id,
      taskCount: pocTasks.length,
      progress,
      workload: childrenOfMany(pocTasks.map((task) => task.id)).filter((task) => task.status !== 'COMPLETED').length,
    }
  })
  const myParents = parents.filter((task) => task.assignedTo === mentor?.id)
  return {
    team,
    mentor,
    progress: teamProgress(teamId, all),
    pocCount: leadPocs.length,
    stats: countByStatus(tasks),
    pocs,
    assignedWork: parents,
    myWork: myParents.map((task) => ({
      ...task,
      progress: computedProgress(task, all),
      children: childrenOf(task.id, all),
    })),
    reviewQueue: tasks.filter((task) => Boolean(mentor && canReviewTask(AssignmentType.MENTOR, task, mentor.id))),
    upcoming: [...tasks]
      .filter((task) => task.status !== 'COMPLETED')
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
      .slice(0, 6),
    activity: getActivity(projectId).filter((item) => tasks.some((task) => task.id === item.entityId)).slice(0, 8),
  }
}
export async function fetchPocDashboard(userId: string, projectId: string) {
  await hydrateWorkspace(projectId)
  const all = getTasks()
  const associateIds = new Set(associatesOf(userId, projectId).map((person) => person.id))
  const isSquadWork = (task: (typeof all)[number]) =>
    task.assignedTo === userId || (task.assignedTo != null && associateIds.has(task.assignedTo))
  const parents = all.filter((task) => {
    if (task.parentTaskId !== null || task.projectId !== projectId) return false
    if (isSquadWork(task)) return true
    return childrenOf(task.id, all).some(isSquadWork)
  })
  const myTasks = all.filter((task) => task.projectId === projectId && isSquadWork(task))
  const subtasks = myTasks.filter((task) => task.parentTaskId !== null)
  return {
    parents: parents.map((task) => ({
      ...task,
      progress: computedProgress(task, all),
      assignedByUser: userById[task.assignedBy],
      children: childrenOf(task.id, all).map((child) => ({
        ...child,
        progress: computedProgress(child, all),
        assignee: userById[child.assignedTo ?? ''],
      })),
    })),
    pocCount: parents.length,
    stats: countByStatus(myTasks),
    reviewCount: myTasks.filter(
      (task) => task.status === 'IN_REVIEW' && task.assignedTo != null && associateIds.has(task.assignedTo),
    ).length,
    reviewQueue: myTasks.filter(
      (task) => task.status === 'IN_REVIEW' && task.assignedTo != null && associateIds.has(task.assignedTo),
    ),
    myWork: subtasks,
    upcoming: [...myTasks]
      .filter((task) => task.status !== 'COMPLETED')
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
      .slice(0, 6),
  }
}
export async function fetchTaskDetail(id: string) {
  const nTaskId = n(id)
  if (!nTaskId) throw new Error('Unknown task')
  const row = await get<BackendTask>(`/tasks/${nTaskId}`)
  const projectId = prid(row.projectId)!
  if (!projectById[projectId]) {
    await hydrateWorkspace(projectId)
  }
  const [childrenRows, commentRows, reviewRows, workLogRows, attachmentRows] = await Promise.all([
    get<BackendTask[]>('/tasks', { projectId: row.projectId }),
    get<BackendComment[]>(`/tasks/${nTaskId}/comments`).catch(() => [] as BackendComment[]),
    get<BackendReview[]>(`/tasks/${nTaskId}/reviews`).catch(() => [] as BackendReview[]),
    get<BackendWorkLog[]>(`/tasks/${nTaskId}/work-logs`).catch(() => [] as BackendWorkLog[]),
    get<BackendAttachment[]>(`/tasks/${nTaskId}/attachments`).catch(() => [] as BackendAttachment[]),
  ])
  const all = childrenRows.map(mapTask)
  const task = mapTask(row)
  const comments = commentRows.map(mapComment)
  const reviews = reviewRows.map(mapReview)
  const workLogs = workLogRows.map(mapWorkLog)
  const attachments = attachmentRows.map(mapAttachment)
  mergeComments(task.id, comments)
  mergeReviews(task.id, reviews)
  mergeWorkLogs(task.id, workLogs)
  const parent = task.parentTaskId ? all.find((item) => item.id === task.parentTaskId) ?? null : null
  return {
    task,
    progress: computedProgress(task, all),
    lineage: lineageForTask(task, all),
    children: all
      .filter((item) => item.parentTaskId === task.id)
      .map((child) => ({ ...child, progress: computedProgress(child, all), assignee: userById[child.assignedTo ?? ''] })),
    comments,
    reviews,
    workLogs,
    attachments,
    activity: getActivity(task.projectId).filter((item) => item.entityId === task.id || item.entityId === task.parentTaskId),
    parent,
    assignee: task.assignedTo ? userById[task.assignedTo] : undefined,
    assigner: userById[task.assignedBy],
  }
}

export async function fetchStructure(projectId: string) {
  await hydrateWorkspace(projectId)
  const project = projectById[projectId]
  const tree = teamsInProject(projectId).map((team) => {
    const mentor = mentorOfTeam(team.id)
    return {
      team,
      mentor,
      pocs: [
        ...(mentor
          ? [
              {
                poc: mentor,
                roleLabel: 'Mentor / POC',
                associates: associatesOf(mentor.id, projectId),
              },
            ]
          : []),
        ...pocsOfTeam(team.id)
          .filter((poc) => poc.id !== mentor?.id)
          .map((poc) => ({
            poc,
            roleLabel: 'POC',
            associates: associatesOf(poc.id, projectId),
          })),
      ],
    }
  })
  return { project, scrumMaster: scrumMasterOf(projectId), tree }
}
export async function fetchNotifications(userId: string): Promise<AppNotification[]> {
  const rows = await get<BackendNotification[]>('/notifications').catch(() => [] as BackendNotification[])
  const mapped = rows.map((row) => mapNotification(row, userId))
  setNotifications(mapped)
  return mapped
}

export async function apiMarkRead(id: string) {
  const notificationId = n(id)
  if (notificationId) await post(`/notifications/${notificationId}/read`)
  return true
}

export async function apiMarkAllRead(_userId: string) {
  await post('/notifications/read-all')
  return true
}

async function refreshFromTask(row: BackendTask) {
  const projectId = prid(row.projectId)
  if (projectId) await refreshTasks(projectId)
  return mapTask(row)
}

export async function apiSubmitReview(taskId: string, _actor: User) {
  const row = await post<BackendTask>(`/tasks/${n(taskId)}/submit-review`)
  return refreshFromTask(row)
}

export async function apiUploadAttachment(taskId: string, file: File): Promise<TaskAttachment> {
  const nTaskId = n(taskId)
  if (!nTaskId) throw new Error('Unknown task')
  const form = new FormData()
  form.append('file', file)
  const res = await http.post<ApiEnvelope<BackendAttachment>>(`/tasks/${nTaskId}/attachments`, form)
  if (!res.data.success) throw new Error(res.data.message || 'Upload failed')
  return mapAttachment(res.data.data)
}

export async function apiApprove(taskId: string, _actor: User, comment: string) {
  const row = await post<BackendTask>(`/tasks/${n(taskId)}/approve`, { comment })
  return refreshFromTask(row)
}

export async function apiReject(taskId: string, _actor: User, comment: string) {
  const row = await post<BackendTask>(`/tasks/${n(taskId)}/reject`, { comment })
  return refreshFromTask(row)
}

export async function apiStatus(
  taskId: string,
  status: TaskStatus,
  _actor: User,
  projectId: string,
  doneByName?: string | null,
) {
  const body: { status: TaskStatus; doneByName?: string | null } = { status }
  if (doneByName !== undefined) body.doneByName = doneByName
  const row = await patch<BackendTask>(`/tasks/${n(taskId)}/status`, body)
  await refreshTasks(projectId)
  return mapTask(row)
}

export async function apiReassignTask(taskId: string, assigneeId: string) {
  const row = await post<BackendTask>(`/tasks/${n(taskId)}/reassign`, { assigneeId: n(assigneeId) })
  return refreshFromTask(row)
}

export async function apiAssignToPoc(input: {
  projectId: string
  teamId: string
  title: string
  description: string
  pocId: string
  mentorId: string
  priority: Priority
  dueDate: string
  sprintId?: string
}) {
  const row = await post<BackendTask>('/tasks', {
    projectId: n(input.projectId),
    teamId: n(input.teamId),
    title: input.title,
    description: input.description,
    pocId: n(input.pocId),
    priority: input.priority,
    dueDate: input.dueDate,
    sprintId: input.sprintId ? n(input.sprintId) : null,
  })
  return refreshFromTask(row)
}

export async function apiBreakDown(
  parentId: string,
  _pocId: string,
  items: {
    title: string
    description: string
    doneByName?: string
    associateId?: string | null
    priority: Priority
    dueDate: string
    estimatedHours: number
  }[],
) {
  const rows = await post<BackendTask[]>(`/tasks/${n(parentId)}/subtasks`, {
    subtasks: items.map((item) => ({
      title: item.title,
      description: item.description,
      doneByName: item.doneByName || null,
      associateId: item.associateId ? n(item.associateId) : null,
      priority: item.priority,
      dueDate: item.dueDate,
      estimatedHours: item.estimatedHours,
    })),
  })
  const parentRow = rows[0]
  if (parentRow) await refreshTasks(prid(parentRow.projectId)!)
  return rows.map(mapTask)
}

export async function apiAddComment(taskId: string, _actor: User, body: string) {
  await post(`/tasks/${n(taskId)}/comments`, { body })
  const rows = await get<BackendComment[]>(`/tasks/${n(taskId)}/comments`).catch(() => [] as BackendComment[])
  mergeComments(taskId, rows.map(mapComment))
}

export async function apiAddWorkLog(entry: { taskId: string; userId: string; date: string; hours: number; description: string }) {
  await post(`/tasks/${n(entry.taskId)}/work-log`, {
    date: entry.date,
    hours: entry.hours,
    description: entry.description,
  })
  const rows = await get<BackendWorkLog[]>(`/tasks/${n(entry.taskId)}/work-logs`).catch(() => [] as BackendWorkLog[])
  mergeWorkLogs(entry.taskId, rows.map(mapWorkLog))
}
/* ------------------------------------------------------------------ */
/* People / org fetchers and mutations                                  */
/* ------------------------------------------------------------------ */

export async function fetchUsers(): Promise<User[]> {
  const rows = await get<BackendUser[]>('/users')
  const mapped = rows.map(mapUser)
  setUsers(mapped)
  return mapped
}

/** The backend has no labels feature yet — real mode returns an empty set. */
export async function fetchLabels() {
  return []
}

export async function fetchProjects(): Promise<Project[]> {
  const rows = await get<BackendProject[]>('/projects')
  return rows.map(mapProject)
}

export async function fetchTeams(projectId?: string): Promise<Team[]> {
  if (projectId) {
    const nProjectId = n(projectId)
    if (!nProjectId) return []
    const rows = await get<BackendTeam[]>(`/projects/${nProjectId}/teams`)
    return rows.map(mapTeam)
  }
  return [...teams]
}

export async function fetchAssignments(): Promise<ProjectAssignment[]> {
  if (activeProjectId) {
    const nProjectId = n(activeProjectId)
    if (nProjectId) {
      const rows = await get<BackendAssignment[]>(`/projects/${nProjectId}/assignments`)
      return rows.map(mapAssignment)
    }
  }
  return [...assignments]
}

export async function fetchComments(taskId: string): Promise<TaskComment[]> {
  const rows = await get<BackendComment[]>(`/tasks/${n(taskId)}/comments`).catch(() => [] as BackendComment[])
  const mapped = rows.map(mapComment)
  mergeComments(taskId, mapped)
  return mapped
}

export async function apiForgotPassword(email: string) {
  const data = await post<{ sent: boolean; token?: string; email?: string }>('/auth/forgot-password', { email })
  return data ?? { sent: true }
}

export async function apiResetPassword(_email: string, token: string, password: string) {
  await post('/auth/reset-password', { token, password })
  return true
}

export async function apiChangePassword(currentPassword: string, newPassword: string) {
  await post('/auth/change-password', { currentPassword, newPassword })
  return true
}

export async function fetchProjectOverview(): Promise<ProjectOverview[]> {
  const rows = await get<BackendProjectOverview[]>('/projects/overview')
  return rows.map(mapProjectOverview)
}

export async function apiCreateProject(input: { name: string; code: string; description: string; dueDate: string }) {
  const row = await post<BackendProject>('/projects', {
    name: input.name,
    code: input.code,
    description: input.description,
    dueDate: input.dueDate,
  })
  return mapProject(row)
}

export async function apiCreateEmployee(input: {
  firstName: string
  lastName: string
  email: string
  title: string
  password: string
  projectId: string
  assignmentType: AssignmentType
  teamId?: string | null
  pocId?: string | null
}) {
  const row = await post<BackendUser>('/users', {
    firstName: input.firstName,
    lastName: input.lastName,
    email: input.email,
    title: input.title,
    password: input.password,
    projectId: n(input.projectId),
    assignmentType: input.assignmentType,
    teamId: n(input.teamId),
    pocId: n(input.pocId),
  })
  const projectId = input.projectId
  if (projectId) await refreshOrg(projectId).catch(() => undefined)
  return mapUser(row)
}

export async function apiCreateTeam(input: { projectId: string; name: string; description: string; mentorId?: string }) {
  const nProjectId = n(input.projectId)
  if (!nProjectId) throw new Error('Unknown project')
  const row = await post<BackendTeam>(`/projects/${nProjectId}/teams`, {
    name: input.name,
    description: input.description,
    mentorId: input.mentorId ? n(input.mentorId) : undefined,
  })
  await refreshOrg(input.projectId).catch(() => undefined)
  return mapTeam(row)
}

export async function apiAssignMember(input: {
  userId: string
  projectId: string
  teamId: string
  assignmentType: AssignmentType
  pocId?: string | null
}) {
  const nTeamId = n(input.teamId)
  if (!nTeamId) throw new Error('Unknown team')
  const body = { userId: n(input.userId) }
  if (input.assignmentType === 'MENTOR') {
    await post(`/teams/${nTeamId}/mentors`, body)
  } else if (input.assignmentType === 'POC') {
    await post(`/teams/${nTeamId}/pocs`, body)
  } else if (input.assignmentType === 'ASSOCIATE') {
    await post(`/teams/${nTeamId}/associates`, { ...body, pocId: n(input.pocId) })
  } else {
    throw new Error('Assign Mentor, POC, or Associate')
  }
  await refreshOrg(input.projectId).catch(() => undefined)
  return true
}

export async function apiRemoveMember(input: { userId: string; projectId: string }) {
  const nProjectId = n(input.projectId)
  const nUserId = n(input.userId)
  if (!nProjectId || !nUserId) throw new Error('Unknown project or user')
  await del(`/projects/${nProjectId}/members/${nUserId}`)
  await refreshOrg(input.projectId).catch(() => undefined)
  return true
}

interface BackendQuery {
  id: number
  projectId: number
  teamId: number | null
  fromUserId: number
  fromUserName: string
  toUserId: number
  toUserName: string
  subject: string
  body: string
  status: string
  parentQueryId: number | null
  createdAt: string | null
  answeredAt: string | null
  replies?: BackendQuery[] | null
}

const qid = (value: number | null | undefined) => (value == null ? null : `qry_${value}`)

function mapQuery(row: BackendQuery): HierarchyQuery {
  return {
    id: qid(row.id)!,
    projectId: prid(row.projectId)!,
    teamId: tid(row.teamId),
    fromUserId: uid(row.fromUserId)!,
    fromUserName: row.fromUserName,
    toUserId: uid(row.toUserId)!,
    toUserName: row.toUserName,
    subject: row.subject,
    body: row.body,
    status: row.status as QueryStatus,
    parentQueryId: qid(row.parentQueryId),
    createdAt: row.createdAt ?? new Date().toISOString(),
    answeredAt: row.answeredAt,
    replies: (row.replies ?? []).map(mapQuery),
  }
}

export async function fetchQueries(projectId: string, box: 'inbox' | 'sent' | 'all' = 'inbox'): Promise<HierarchyQuery[]> {
  const nProjectId = n(projectId)
  if (!nProjectId) return []
  const rows = await get<BackendQuery[]>('/queries', { projectId: nProjectId, box })
  return rows.map(mapQuery)
}

export async function fetchQueryDetail(id: string): Promise<HierarchyQuery> {
  const row = await get<BackendQuery>(`/queries/${n(id)}`)
  return mapQuery(row)
}

export async function apiCreateQuery(input: {
  projectId: string
  teamId: string
  subject: string
  body: string
}): Promise<HierarchyQuery> {
  const row = await post<BackendQuery>('/queries', {
    projectId: n(input.projectId),
    teamId: n(input.teamId),
    subject: input.subject,
    body: input.body,
  })
  return mapQuery(row)
}

export async function apiAssignQuery(
  id: string,
  input: { teamId: string; assigneeId?: string | null },
): Promise<HierarchyQuery> {
  const row = await post<BackendQuery>(`/queries/${n(id)}/assign`, {
    teamId: n(input.teamId),
    assigneeId: n(input.assigneeId),
  })
  return mapQuery(row)
}

export async function apiReplyQuery(id: string, body: string): Promise<HierarchyQuery> {
  const row = await post<BackendQuery>(`/queries/${n(id)}/reply`, { body })
  return mapQuery(row)
}

interface BackendSprint {
  id: number
  projectId: number
  teamId: number
  teamName: string
  name: string
  goal: string | null
  startDate: string
  endDate: string
  status: string
  createdBy: number
  createdAt: string | null
}

function mapSprint(row: BackendSprint): Sprint {
  return {
    id: `spr_${row.id}`,
    projectId: prid(row.projectId)!,
    teamId: tid(row.teamId)!,
    teamName: row.teamName,
    name: row.name,
    goal: row.goal,
    startDate: row.startDate,
    endDate: row.endDate,
    status: row.status as Sprint['status'],
    createdBy: uid(row.createdBy)!,
    createdAt: row.createdAt ?? new Date().toISOString(),
  }
}

export async function fetchSprints(projectId: string, teamId?: string): Promise<Sprint[]> {
  const nProjectId = n(projectId)
  if (!nProjectId) return []
  const rows = await get<BackendSprint[]>('/sprints', {
    projectId: nProjectId,
    ...(teamId ? { teamId: n(teamId) } : {}),
  })
  return rows.map(mapSprint)
}

export async function apiCreateSprint(input: {
  projectId: string
  teamId: string
  name: string
  goal?: string
  startDate: string
  endDate: string
}): Promise<Sprint> {
  const row = await post<BackendSprint>('/sprints', {
    projectId: n(input.projectId),
    teamId: n(input.teamId),
    name: input.name,
    goal: input.goal,
    startDate: input.startDate,
    endDate: input.endDate,
  })
  return mapSprint(row)
}

export async function apiUpdateSprintStatus(id: string, status: string): Promise<Sprint> {
  const row = await patch<BackendSprint>(`/sprints/${n(id)}/status`, { status })
  return mapSprint(row)
}

export async function apiEditSprint(input: {
  id: string
  projectId: string
  teamId: string
  name: string
  goal?: string
  startDate: string
  endDate: string
}): Promise<Sprint> {
  const row = await put<BackendSprint>(`/sprints/${n(input.id)}`, {
    projectId: n(input.projectId),
    teamId: n(input.teamId),
    name: input.name,
    goal: input.goal,
    startDate: input.startDate,
    endDate: input.endDate,
  })
  return mapSprint(row)
}

export async function apiDeleteSprint(id: string): Promise<void> {
  await del(`/sprints/${n(id)}`)
}