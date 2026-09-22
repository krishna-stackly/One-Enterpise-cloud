import { useMock } from '@/api/client'
import * as real from '@/api/real'
import { wait } from '@/api/client'
import { labels } from '@/data/work'
import { assignments, projects, teams } from '@/data/organization'
import {
  assignmentForUserProject,
  pocCount,
  childrenOf,
  commentsFor,
  computedProgress,
  countByStatus,
  displayName,
  lineageForTask,
  mentorOfTeam,
  pocsOfTeam,
  associatesOf,
  canReviewTask,
  projectProgress,
  projectsForUser,
  scrumMasterOf,
  teamCount,
  teamProgress,
  teamsInProject,
  visibleTasksForAssignment,
} from '@/data/selectors'
import {
  addComment,
  addWorkLog,
  approveTask,
  assignTeamMember,
  createEmployeeRecord,
  createParentTask,
  createProjectRecord,
  createSubtasks,
  createTeamRecord,
  getActivity,
  getAttachments,
  removeProjectMember,
  getComments,
  getNotifications,
  getReviews,
  getTask,
  getTasks,
  getWorkLogs,
  markAllNotificationsRead,
  markNotificationRead,
  rejectTask,
  requestPasswordReset,
  resetPasswordWithToken,
  reassignTask,
  submitForReview,
  updateTaskStatus,
  addAttachmentMeta,
} from '@/data/store'
import { userById, users } from '@/data/users'
import { AssignmentType, type ProjectOverview, type TaskStatus, type User } from '@/types'

export async function apiLogin(email: string, password: string) {
  return wait({ email, password })
}

export async function fetchSessionContext(userId: string, projectId: string) {
  if (!useMock) {
    const session = await real.fetchSession(projectId)
    return {
      user: session.user,
      project: session.projects.find((item) => item.id === projectId) ?? null,
      assignment: session.assignment,
      projects: session.projects,
    }
  }
  return wait({
    user: userById[userId],
    project: projects.find((p) => p.id === projectId),
    assignment: assignmentForUserProject(userId, projectId),
    projects: projectsForUser(userId),
  })
}

export async function fetchScrumMasterDashboard(projectId: string) {
  if (!useMock) return real.fetchScrumMasterDashboard(projectId)
  const tasks = getTasks().filter((task) => task.projectId === projectId)
  const stats = countByStatus(tasks)
  const project = projects.find((item) => item.id === projectId)
  if (!project) throw new Error('Project not found')
  const teamRows = teamsInProject(projectId).map((team) => ({
    ...team,
    progress: teamProgress(team.id),
    mentor: mentorOfTeam(team.id),
    pocs: pocsOfTeam(team.id),
  }))
  const upcoming = [...tasks]
    .filter((task) => task.status !== 'COMPLETED')
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
    .slice(0, 6)
  const blockers = tasks.filter((task) => task.status === 'BLOCKED')
  const activity = getActivity(projectId).slice(0, 8)
  return wait({
    project,
    scrumMaster: scrumMasterOf(projectId),
    progress: projectProgress(projectId),
    stats,
    teamCount: teamCount(projectId),
    pocCount: pocCount(projectId),
    teams: teamRows,
    upcoming,
    blockers,
    activity,
  })
}

export async function fetchMentorDashboard(projectId: string, teamId: string) {
  if (!useMock) return real.fetchMentorDashboard(projectId, teamId)
  const team = teams.find((item) => item.id === teamId)
  if (!team) throw new Error('Team not found')
  const tasks = getTasks().filter((task) => task.teamId === teamId)
  const parents = tasks.filter((task) => task.parentTaskId === null)
  const mentor = mentorOfTeam(teamId)
  const leadPocs = [
    ...(mentor ? [mentor] : []),
    ...pocsOfTeam(teamId).filter((poc) => poc.id !== mentor?.id),
  ]
  const pocs = leadPocs.map((poc) => {
    const pocTasks = parents.filter((task) => task.assignedTo === poc.id)
    const progress =
      pocTasks.length === 0
        ? 0
        : Math.round(pocTasks.reduce((sum, task) => sum + computedProgress(task), 0) / pocTasks.length)
    return {
      poc,
      isMentor: poc.id === mentor?.id,
      taskCount: pocTasks.length,
      progress,
      workload: childrenOfMany(pocTasks.map((task) => task.id)).filter((task) => task.status !== 'COMPLETED').length,
    }
  })
  const myParents = parents.filter((task) => task.assignedTo === mentor?.id)
  return wait({
    team,
    mentor,
    progress: teamProgress(teamId),
    pocCount: leadPocs.length,
    stats: countByStatus(tasks),
    pocs,
    assignedWork: parents,
    myWork: myParents.map((task) => ({
      ...task,
      progress: computedProgress(task),
      children: childrenOf(task.id),
    })),
    reviewQueue: tasks.filter((task) => Boolean(mentor && canReviewTask(AssignmentType.MENTOR, task, mentor.id))),
    upcoming: [...tasks].filter((task) => task.status !== 'COMPLETED').sort((a, b) => a.dueDate.localeCompare(b.dueDate)).slice(0, 6),
    activity: getActivity(projectId).filter((item) => tasks.some((task) => task.id === item.entityId)).slice(0, 8),
  })
}

function childrenOfMany(parentIds: string[]) {
  return getTasks().filter((task) => task.parentTaskId && parentIds.includes(task.parentTaskId))
}

export async function fetchPocDashboard(userId: string, projectId: string) {
  if (!useMock) return real.fetchPocDashboard(userId, projectId)
  const all = getTasks()
  const associateIds = new Set(associatesOf(userId, projectId).map((person) => person.id))
  const isSquadWork = (task: (typeof all)[number]) =>
    task.assignedTo === userId || (task.assignedTo != null && associateIds.has(task.assignedTo))
  const parents = all.filter((task) => {
    if (task.parentTaskId !== null || task.projectId !== projectId) return false
    if (isSquadWork(task)) return true
    return childrenOf(task.id).some(isSquadWork)
  })
  const myTasks = all.filter((task) => task.projectId === projectId && isSquadWork(task))
  const subtasks = myTasks.filter((task) => task.parentTaskId !== null)
  return wait({
    parents: parents.map((task) => ({
      ...task,
      progress: computedProgress(task),
      assignedByUser: userById[task.assignedBy],
      children: childrenOf(task.id).map((child) => ({
        ...child,
        progress: computedProgress(child),
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
    upcoming: [...myTasks].filter((task) => task.status !== 'COMPLETED').sort((a, b) => a.dueDate.localeCompare(b.dueDate)).slice(0, 6),
  })
}

export async function fetchTasks(userId: string, projectId: string) {
  if (!useMock) return real.fetchTasks(userId, projectId)
  const assignment = assignmentForUserProject(userId, projectId)
  return wait(visibleTasksForAssignment(assignment))
}

export async function fetchTaskDetail(id: string) {
  if (!useMock) return real.fetchTaskDetail(id)
  const task = getTask(id)
  if (!task) return wait(null)
  return wait({
    task,
    progress: computedProgress(task),
    lineage: lineageForTask(task),
    children: childrenOf(task.id).map((child) => ({ ...child, progress: computedProgress(child), assignee: userById[child.assignedTo ?? ''] })),
    comments: getComments(id),
    reviews: getReviews(id),
    workLogs: getWorkLogs(id),
    attachments: getAttachments(id),
    activity: getActivity(task.projectId).filter((item) => item.entityId === id || item.entityId === task.parentTaskId),
    parent: task.parentTaskId ? getTask(task.parentTaskId) : null,
    assignee: task.assignedTo ? userById[task.assignedTo] : undefined,
    assigner: userById[task.assignedBy],
  })
}

export async function fetchStructure(projectId: string) {
  if (!useMock) return real.fetchStructure(projectId)
  const project = projects.find((item) => item.id === projectId)
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
  return wait({ project, scrumMaster: scrumMasterOf(projectId), tree })
}

export async function fetchNotifications(userId: string) {
  if (!useMock) return real.fetchNotifications(userId)
  return wait(getNotifications(userId))
}

export async function apiMarkRead(id: string) {
  if (!useMock) return real.apiMarkRead(id)
  markNotificationRead(id)
  return wait(true)
}

export async function apiMarkAllRead(userId: string) {
  if (!useMock) return real.apiMarkAllRead(userId)
  markAllNotificationsRead(userId)
  return wait(true)
}

export async function apiSubmitReview(taskId: string, actor: User) {
  if (!useMock) return real.apiSubmitReview(taskId, actor)
  return wait(submitForReview(taskId, actor))
}

export async function apiUploadAttachment(taskId: string, file: File) {
  if (!useMock) return real.apiUploadAttachment(taskId, file)
  const reader = await new Promise<string>((resolve, reject) => {
    const fr = new FileReader()
    fr.onload = () => resolve(String(fr.result))
    fr.onerror = () => reject(fr.error)
    fr.readAsDataURL(file)
  })
  return wait(
    addAttachmentMeta({
      taskId,
      fileName: file.name,
      fileSize: file.size,
      contentType: file.type || 'image/png',
      url: reader,
      uploadedBy: 'usr_mock',
    }),
  )
}

export async function apiApprove(taskId: string, actor: User, comment: string) {
  if (!useMock) return real.apiApprove(taskId, actor, comment)
  return wait(approveTask(taskId, actor, comment))
}

export async function apiReject(taskId: string, actor: User, comment: string) {
  if (!useMock) return real.apiReject(taskId, actor, comment)
  return wait(rejectTask(taskId, actor, comment))
}

export async function apiStatus(
  taskId: string,
  status: TaskStatus,
  actor: User,
  projectId: string,
  doneByName?: string | null,
) {
  if (!useMock) return real.apiStatus(taskId, status, actor, projectId, doneByName)
  return wait(updateTaskStatus(taskId, status, actor, projectId, doneByName))
}

export async function apiReassignTask(taskId: string, assigneeId: string) {
  if (!useMock) return real.apiReassignTask(taskId, assigneeId)
  const actor = users[0]
  if (!actor) throw new Error('No user')
  return wait(reassignTask(taskId, assigneeId, actor))
}

export async function apiAssignToPoc(input: Parameters<typeof createParentTask>[0]) {
  if (!useMock) return real.apiAssignToPoc(input)
  return wait(createParentTask(input))
}

export async function apiBreakDown(parentId: string, pocId: string, items: Parameters<typeof createSubtasks>[2]) {
  if (!useMock) return real.apiBreakDown(parentId, pocId, items)
  return wait(createSubtasks(parentId, pocId, items))
}

export async function apiAddComment(taskId: string, actor: User, body: string) {
  if (!useMock) return real.apiAddComment(taskId, actor, body)
  return wait(addComment(taskId, actor, body))
}

export async function apiAddWorkLog(...args: Parameters<typeof addWorkLog>) {
  if (!useMock) return real.apiAddWorkLog(...args)
  return wait(addWorkLog(...args))
}

export async function fetchUsers() {
  if (!useMock) return real.fetchUsers()
  return wait(users)
}

export async function fetchLabels() {
  if (!useMock) return real.fetchLabels()
  return wait(labels)
}

export async function fetchProjects() {
  if (!useMock) return real.fetchProjects()
  return wait(projects)
}

export async function fetchProjectOverview(): Promise<ProjectOverview[]> {
  if (!useMock) return real.fetchProjectOverview()
  return projects.map((project) => ({
    id: project.id,
    name: project.name,
    code: project.code,
    description: project.description,
    status: project.status,
    startDate: project.startDate || null,
    dueDate: project.dueDate || null,
    teamCount: teamsInProject(project.id).length,
    scrumMasterName: displayName(scrumMasterOf(project.id)),
    progress: projectProgress(project.id),
  }))
}

export async function fetchTeams(projectId?: string) {
  if (!useMock) return real.fetchTeams(projectId)
  return wait(projectId ? teams.filter((team) => team.projectId === projectId) : teams)
}

export async function fetchAssignments() {
  if (!useMock) return real.fetchAssignments()
  return wait(assignments)
}

export async function fetchComments(taskId: string) {
  if (!useMock) return real.fetchComments(taskId)
  return wait(commentsFor(taskId))
}

export async function apiForgotPassword(email: string) {
  if (!useMock) return real.apiForgotPassword(email)
  return wait(requestPasswordReset(email))
}

export async function apiResetPassword(email: string, token: string, password: string) {
  if (!useMock) return real.apiResetPassword(email, token, password)
  return wait(resetPasswordWithToken(email, token, password))
}

export async function apiChangePassword(...args: Parameters<typeof real.apiChangePassword>) {
  if (!useMock) return real.apiChangePassword(...args)
  throw new Error('Auth requires live API mode')
}

export async function apiCreateProject(...args: Parameters<typeof createProjectRecord>) {
  if (!useMock) {
    const input = args[0]
    return real.apiCreateProject({ name: input.name, code: input.code, description: input.description, dueDate: input.dueDate })
  }
  return wait(createProjectRecord(...args))
}

export async function apiCreateEmployee(...args: Parameters<typeof createEmployeeRecord>) {
  if (!useMock) return real.apiCreateEmployee(...args)
  return wait(createEmployeeRecord(...args))
}

export async function apiCreateTeam(...args: Parameters<typeof createTeamRecord>) {
  if (!useMock) return real.apiCreateTeam(...args)
  return wait(createTeamRecord(...args))
}

export async function apiAssignMember(...args: Parameters<typeof assignTeamMember>) {
  if (!useMock) return real.apiAssignMember(...args)
  return wait(assignTeamMember(...args))
}

export async function apiRemoveMember(input: { userId: string; projectId: string; actorId?: string }) {
  if (!useMock) return real.apiRemoveMember(input)
  if (!input.actorId) throw new Error('Actor required')
  return wait(removeProjectMember({ userId: input.userId, projectId: input.projectId, actorId: input.actorId }))
}

export async function fetchQueries(projectId: string, box: 'inbox' | 'sent' | 'all' = 'inbox') {
  if (!useMock) return real.fetchQueries(projectId, box)
  return wait([])
}

export async function fetchQueryDetail(id: string) {
  if (!useMock) return real.fetchQueryDetail(id)
  throw new Error('Queries require live API mode')
}

export async function apiCreateQuery(input: { projectId: string; teamId: string; subject: string; body: string }) {
  if (!useMock) return real.apiCreateQuery(input)
  throw new Error('Queries require live API mode')
}

export async function apiAssignQuery(id: string, input: { teamId: string; assigneeId?: string | null }) {
  if (!useMock) return real.apiAssignQuery(id, input)
  throw new Error('Queries require live API mode')
}

export async function apiReplyQuery(id: string, body: string) {
  if (!useMock) return real.apiReplyQuery(id, body)
  throw new Error('Queries require live API mode')
}

export async function fetchSprints(projectId: string, teamId?: string) {
  if (!useMock) return real.fetchSprints(projectId, teamId)
  return wait([])
}

export async function apiCreateSprint(...args: Parameters<typeof real.apiCreateSprint>) {
  if (!useMock) return real.apiCreateSprint(...args)
  throw new Error('Sprints require live API mode')
}

export async function apiUpdateSprintStatus(id: string, status: string) {
  if (!useMock) return real.apiUpdateSprintStatus(id, status)
  throw new Error('Sprints require live API mode')
}

export async function apiEditSprint(...args: Parameters<typeof real.apiEditSprint>) {
  if (!useMock) return real.apiEditSprint(...args)
  throw new Error('Sprints require live API mode')
}

export async function apiDeleteSprint(id: string) {
  if (!useMock) return real.apiDeleteSprint(id)
  throw new Error('Sprints require live API mode')
}

export type DashboardRole = AssignmentType
