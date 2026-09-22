import { activityLogs as seedActivity } from '@/data/activity'
import { notifications as seedNotifications } from '@/data/activity'
import { assignments, registerAssignment, registerProject, registerTeam } from '@/data/organization'
import {
  childrenOf,
  computedProgress,
  pocsOfTeam,
  associatesOf,
  canReviewTask,
  canUserSignIn,
} from '@/data/selectors'
import { registerUser, updateUserPassword, userByEmail, userById } from '@/data/users'
import {
  attachments as seedAttachments,
  comments as seedComments,
  reviews as seedReviews,
  tasks as seedTasks,
  workLogs as seedWorkLogs,
} from '@/data/work'
import {
  AssignmentType,
  ProjectStatus,
  SystemRole,
  TaskStatus,
  type ActivityLog,
  type AppNotification,
  type Priority,
  type Project,
  type Task,
  type TaskAttachment,
  type TaskComment,
  type TaskReview,
  type TaskStatus as TaskStatusValue,
  type Team,
  type User,
  type WorkLog,
} from '@/types'

let tasks = [...seedTasks]
let comments = [...seedComments]
let reviews = [...seedReviews]
let workLogs = [...seedWorkLogs]
let attachments = [...seedAttachments]
let activity = [...seedActivity]
let notifications = [...seedNotifications]
let idCounter = 1000

function nextId(prefix: string) {
  idCounter += 1
  return `${prefix}_${idCounter}`
}

function nowIso() {
  return new Date().toISOString()
}

function log(entry: Omit<ActivityLog, 'id' | 'createdAt'> & { createdAt?: string }) {
  activity = [
    {
      id: nextId('act'),
      createdAt: entry.createdAt ?? nowIso(),
      ...entry,
    },
    ...activity,
  ]
}

export function getTasks() {
  return tasks
}

export function getTask(id: string) {
  return tasks.find((task) => task.id === id)
}

export function getComments(taskId: string) {
  return comments.filter((item) => item.taskId === taskId)
}

export function getReviews(taskId: string) {
  return reviews.filter((item) => item.taskId === taskId)
}

export function getWorkLogs(taskId?: string) {
  return taskId ? workLogs.filter((item) => item.taskId === taskId) : workLogs
}

export function getAttachments(taskId: string) {
  return attachments.filter((item) => item.taskId === taskId)
}

export function getActivity(projectId?: string) {
  return projectId ? activity.filter((item) => item.projectId === projectId) : activity
}

export function getNotifications(userId: string) {
  return notifications.filter((item) => item.userId === userId)
}

/* ---- hydration helpers: swap in real backend data (live API mode) ---- */

export function setTasks(next: Task[]) {
  tasks = [...next]
}

export function setActivity(next: ActivityLog[]) {
  activity = [...next]
}

export function setNotifications(next: AppNotification[]) {
  notifications = [...next]
}

export function mergeComments(taskId: string, next: TaskComment[]) {
  const others = comments.filter((item) => item.taskId !== taskId)
  comments = [...others, ...next]
}

export function mergeReviews(taskId: string, next: TaskReview[]) {
  const others = reviews.filter((item) => item.taskId !== taskId)
  reviews = [...others, ...next]
}

export function mergeWorkLogs(taskId: string, next: WorkLog[]) {
  const others = workLogs.filter((item) => item.taskId !== taskId)
  workLogs = [...others, ...next]
}

export function authenticate(email: string, password: string): User | null {
  const user = userByEmail[email.toLowerCase()]
  if (!user || user.password !== password) return null
  if (!canUserSignIn(user.id)) return null
  return user
}

export function associateLoginBlocked(email: string, password: string) {
  const user = userByEmail[email.toLowerCase()]
  return Boolean(user && user.password === password && !canUserSignIn(user.id))
}

export function canAssignMentorToPoc(mentorId: string, pocId: string, teamId: string) {
  const mentor = assignments.find(
    (item) => item.userId === mentorId && item.teamId === teamId && item.assignmentType === AssignmentType.MENTOR,
  )
  if (!mentor) return false
  if (mentorId === pocId) return true
  return pocsOfTeam(teamId).some((poc) => poc.id === pocId)
}

export function canAssignPocOwnsWork(pocId: string, assigneeId: string, projectId?: string) {
  if (pocId === assigneeId) return true
  return associatesOf(pocId, projectId).some((item) => item.id === assigneeId)
}

const workerTransitions: Record<string, TaskStatusValue[]> = {
  [TaskStatus.ASSIGNED]: [TaskStatus.IN_PROGRESS],
  [TaskStatus.IN_PROGRESS]: [TaskStatus.BLOCKED, TaskStatus.IN_REVIEW],
  [TaskStatus.REOPENED]: [TaskStatus.IN_PROGRESS],
  [TaskStatus.BLOCKED]: [TaskStatus.IN_PROGRESS],
}

export function allowedStatusMoves(role: AssignmentType, task: Task, actorId: string): TaskStatusValue[] {
  if (task.status === TaskStatus.IN_REVIEW) {
    return canReviewTask(role, task, actorId) ? [TaskStatus.COMPLETED, TaskStatus.REOPENED] : []
  }
  const isAssignee = task.assignedTo === actorId
  const managesAssociate = associatesOf(actorId, task.projectId).some((item) => item.id === task.assignedTo)
  if (isAssignee || managesAssociate) {
    return workerTransitions[task.status] ?? []
  }
  if (role === AssignmentType.POC && task.parentTaskId === null) {
    return [TaskStatus.ASSIGNED, TaskStatus.IN_PROGRESS, TaskStatus.BLOCKED]
  }
  if (role === AssignmentType.MENTOR && task.parentTaskId === null) {
    return [TaskStatus.BACKLOG, TaskStatus.ASSIGNED, TaskStatus.IN_PROGRESS, TaskStatus.BLOCKED]
  }
  return []
}

export function updateTaskStatus(
  taskId: string,
  status: TaskStatusValue,
  actor: User,
  projectId: string,
  doneByName?: string | null,
) {
  tasks = tasks.map((task) =>
    task.id === taskId
      ? {
          ...task,
          status,
          progressPercent: status === TaskStatus.COMPLETED ? 100 : task.progressPercent,
          doneByName:
            doneByName === undefined
              ? task.doneByName
              : doneByName?.trim()
                ? doneByName.trim()
                : null,
          updatedAt: nowIso(),
        }
      : task,
  )
  log({
    userId: actor.id,
    action: 'STATUS_CHANGED',
    entityType: 'TASK',
    entityId: taskId,
    projectId,
    message: `${actor.firstName} changed status to ${status.replaceAll('_', ' ')}.`,
  })
  return getTask(taskId)
}

export function reassignTask(taskId: string, assigneeId: string, actor: User) {
  const assignee = userById[assigneeId]
  if (!assignee) throw new Error('Assignee not found')
  tasks = tasks.map((task) =>
    task.id === taskId
      ? {
          ...task,
          assignedTo: assigneeId,
          assignedBy: actor.id,
          status: TaskStatus.ASSIGNED,
          doneByName: `${assignee.firstName} ${assignee.lastName}`,
          updatedAt: nowIso(),
        }
      : task,
  )
  log({
    userId: actor.id,
    action: 'TASK_REASSIGNED',
    entityType: 'TASK',
    entityId: taskId,
    projectId: getTask(taskId)?.projectId ?? '',
    message: `${actor.firstName} assigned ${getTask(taskId)?.title ?? 'task'} to ${assignee.firstName} ${assignee.lastName}.`,
  })
  return getTask(taskId)
}

export function submitForReview(taskId: string, actor: User) {
  const task = getTask(taskId)
  if (!task) throw new Error('Task not found')
  return updateTaskStatus(taskId, TaskStatus.IN_REVIEW, actor, task.projectId)
}

export function approveTask(taskId: string, actor: User, comment: string) {
  const task = getTask(taskId)
  if (!task) throw new Error('Task not found')
  reviews = [
    {
      id: nextId('rev'),
      taskId,
      reviewerId: actor.id,
      decision: 'APPROVE',
      comment,
      createdAt: nowIso(),
    },
    ...reviews,
  ]
  log({
    userId: actor.id,
    action: 'TASK_APPROVED',
    entityType: 'TASK',
    entityId: taskId,
    projectId: task.projectId,
    message: `${actor.firstName} approved ${task.title}.`,
  })
  notifications = [
    {
      id: nextId('ntf'),
      userId: task.assignedTo ?? actor.id,
      type: 'TASK_APPROVED',
      title: 'Task approved',
      message: `${actor.firstName} approved ${task.title}.`,
      entityType: 'TASK',
      entityId: taskId,
      projectId: task.projectId,
      read: false,
      createdAt: nowIso(),
    },
    ...notifications,
  ]
  return updateTaskStatus(taskId, TaskStatus.COMPLETED, actor, task.projectId)
}

export function rejectTask(taskId: string, actor: User, comment: string) {
  if (!comment.trim()) throw new Error('Review comment is required when rejecting work')
  const task = getTask(taskId)
  if (!task) throw new Error('Task not found')
  reviews = [
    {
      id: nextId('rev'),
      taskId,
      reviewerId: actor.id,
      decision: 'REJECT',
      comment,
      createdAt: nowIso(),
    },
    ...reviews,
  ]
  log({
    userId: actor.id,
    action: 'TASK_REJECTED',
    entityType: 'TASK',
    entityId: taskId,
    projectId: task.projectId,
    message: `${actor.firstName} rejected ${task.title}.`,
  })
  notifications = [
    {
      id: nextId('ntf'),
      userId: task.assignedTo ?? actor.id,
      type: 'TASK_REJECTED',
      title: 'Task rejected',
      message: `${actor.firstName} requested changes on ${task.title}.`,
      entityType: 'TASK',
      entityId: taskId,
      projectId: task.projectId,
      read: false,
      createdAt: nowIso(),
    },
    ...notifications,
  ]
  return updateTaskStatus(taskId, TaskStatus.REOPENED, actor, task.projectId)
}

export function addComment(taskId: string, actor: User, body: string, mentions: string[] = []) {
  const task = getTask(taskId)
  if (!task) throw new Error('Task not found')
  const item: TaskComment = {
    id: nextId('cmt'),
    taskId,
    authorId: actor.id,
    body,
    mentions,
    createdAt: nowIso(),
  }
  comments = [item, ...comments]
  log({
    userId: actor.id,
    action: 'COMMENT_ADDED',
    entityType: 'TASK',
    entityId: taskId,
    projectId: task.projectId,
    message: `${actor.firstName} added a comment on ${task.title}.`,
  })
  return item
}

export function addWorkLog(entry: Omit<WorkLog, 'id'>) {
  const item: WorkLog = { ...entry, id: nextId('wl') }
  workLogs = [item, ...workLogs]
  const task = getTask(entry.taskId)
  if (task) {
    tasks = tasks.map((row) =>
      row.id === task.id ? { ...row, actualHours: row.actualHours + entry.hours } : row,
    )
  }
  return item
}

export function createParentTask(input: {
  projectId: string
  teamId: string
  title: string
  description: string
  pocId: string
  mentorId: string
  priority: Priority
  dueDate: string
  labelIds?: string[]
}) {
  if (!canAssignMentorToPoc(input.mentorId, input.pocId, input.teamId)) {
    throw new Error('You do not have permission to assign this task')
  }
  const item: Task = {
    id: nextId('tsk'),
    numericId: 8000 + idCounter,
    projectId: input.projectId,
    teamId: input.teamId,
    parentTaskId: null,
    title: input.title,
    description: input.description,
    status: TaskStatus.ASSIGNED,
    priority: input.priority,
    assignedTo: input.pocId,
    assignedBy: input.mentorId,
    dueDate: input.dueDate,
    estimatedHours: 0,
    actualHours: 0,
    progressPercent: 0,
    labelIds: input.labelIds ?? [],
    createdAt: nowIso(),
    updatedAt: nowIso(),
  }
  tasks = [item, ...tasks]
  const self = input.mentorId === input.pocId
  log({
    userId: input.mentorId,
    action: 'TASK_ASSIGNED',
    entityType: 'TASK',
    entityId: item.id,
    projectId: input.projectId,
    message: self
      ? `Mentor assigned ${item.title} to themselves as POC.`
      : `Mentor assigned ${item.title} to a POC.`,
  })
  return item
}

export function createSubtasks(
  parentId: string,
  pocId: string,
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
  const parent = getTask(parentId)
  if (!parent) throw new Error('Parent task not found')
  const parentOnSquad =
    !parent.assignedTo ||
    parent.assignedTo === pocId ||
    canAssignPocOwnsWork(pocId, parent.assignedTo, parent.projectId) ||
    canAssignMentorToPoc(pocId, parent.assignedTo, parent.teamId)
  if (!parentOnSquad) {
    throw new Error('You can break down only work on your squad')
  }
  const created: Task[] = []
  for (const item of items) {
    const associateId = item.associateId?.trim() || ''
    if (
      associateId &&
      !canAssignPocOwnsWork(pocId, associateId, parent.projectId) &&
      !canAssignMentorToPoc(pocId, associateId, parent.teamId)
    ) {
      throw new Error('Assign this work to yourself, a POC on your team, or your associates')
    }
    const workerId = associateId || pocId
    const associateUser = associateId ? (userById[associateId] ?? null) : null
    const doneBy =
      item.doneByName?.trim() ||
      (associateUser ? `${associateUser.firstName} ${associateUser.lastName}` : null)
    const sub: Task = {
      id: nextId('tsk'),
      numericId: 8000 + idCounter,
      projectId: parent.projectId,
      teamId: parent.teamId,
      parentTaskId: parent.id,
      title: item.title,
      description: item.description,
      status: TaskStatus.ASSIGNED,
      priority: item.priority,
      assignedTo: workerId,
      assignedBy: pocId,
      dueDate: item.dueDate,
      estimatedHours: item.estimatedHours,
      actualHours: 0,
      progressPercent: 0,
      doneByName: doneBy,
      labelIds: [],
      createdAt: nowIso(),
      updatedAt: nowIso(),
    }
    created.push(sub)
    log({
      userId: pocId,
      action: 'SUBTASK_ASSIGNED',
      entityType: 'TASK',
      entityId: sub.id,
      projectId: parent.projectId,
      message: associateUser
        ? `POC assigned subtask ${sub.title} to Associate ${associateUser.firstName} ${associateUser.lastName}.`
        : `POC created subtask ${sub.title}.`,
    })
  }
  tasks = [...created, ...tasks]
  return created
}

function attachImages(
  taskId: string,
  uploadedBy: string,
  images: { fileName: string; url: string; contentType: string; fileSize: number }[],
) {
  for (const image of images) {
    addAttachmentMeta({
      taskId,
      fileName: image.fileName,
      fileSize: image.fileSize,
      contentType: image.contentType,
      url: image.url,
      uploadedBy,
    })
  }
}

export function markNotificationRead(id: string) {
  notifications = notifications.map((item) => (item.id === id ? { ...item, read: true } : item))
}

export function markAllNotificationsRead(userId: string) {
  notifications = notifications.map((item) => (item.userId === userId ? { ...item, read: true } : item))
}

export function progressOf(taskId: string) {
  const task = getTask(taskId)
  if (!task) return 0
  return computedProgress(task, tasks)
}

export function childTasks(taskId: string) {
  return childrenOf(taskId, tasks)
}

export function addAttachmentMeta(item: Omit<TaskAttachment, 'id' | 'uploadedAt'> & { uploadedAt?: string }) {
  const row: TaskAttachment = {
    ...item,
    id: nextId('att'),
    uploadedAt: item.uploadedAt ?? nowIso(),
  }
  attachments = [row, ...attachments]
  return row
}

let resetTokens: { email: string; token: string }[] = []

export function requestPasswordReset(email: string) {
  const user = userByEmail[email.trim().toLowerCase()]
  if (!user) return { sent: true }
  const token = `RESET-${user.id.slice(-6).toUpperCase()}`
  resetTokens = [{ email: user.email, token }, ...resetTokens.filter((item) => item.email !== user.email)]
  return { sent: true, token, email: user.email }
}

export function resetPasswordWithToken(email: string, token: string, password: string) {
  const match = resetTokens.find(
    (item) => item.email.toLowerCase() === email.trim().toLowerCase() && item.token === token,
  )
  if (!match) throw new Error('Invalid reset token')
  const ok = updateUserPassword(email, password)
  if (!ok) throw new Error('Account not found')
  resetTokens = resetTokens.filter((item) => item.token !== token)
  return true
}

export function createProjectRecord(input: {
  name: string
  code: string
  description: string
  dueDate: string
  scrumMasterId: string
}): Project {
  const project = registerProject({
    id: nextId('prj'),
    name: input.name,
    code: input.code.toUpperCase(),
    description: input.description,
    status: ProjectStatus.PLANNING,
    startDate: new Date().toISOString().slice(0, 10),
    dueDate: input.dueDate,
    createdAt: nowIso(),
  })
  registerAssignment({
    id: nextId('as'),
    userId: input.scrumMasterId,
    projectId: project.id,
    assignmentType: AssignmentType.SCRUM_MASTER,
    teamId: null,
    pocId: null,
  })
  return project
}

export function createEmployeeRecord(input: {
  firstName: string
  lastName: string
  email: string
  title: string
  password: string
  projectId: string
  assignmentType: AssignmentType
  teamId?: string | null
  pocId?: string | null
}): User {
  const email = input.email.trim().toLowerCase()
  if (input.assignmentType === AssignmentType.SCRUM_MASTER) {
    throw new Error('Assign Mentor, POC, or Associate when adding a person')
  }
  if (!input.teamId) throw new Error('Select a team')
  if (input.assignmentType !== AssignmentType.ASSOCIATE && !input.password) {
    throw new Error('Password is required for Mentor and POC')
  }
  const existing = userByEmail[email]
  let user: User
  if (existing) {
    // Remove hard-deletes assignments but keeps the account; re-add attaches membership again.
    if (assignments.some((item) => item.userId === existing.id && item.projectId === input.projectId)) {
      throw new Error('This person is already a member of this project')
    }
    user = existing
  } else {
    user = registerUser({
      id: nextId('usr'),
      firstName: input.firstName,
      lastName: input.lastName,
      email,
      title: input.title,
      systemRole: SystemRole.USER,
      avatarHue: Math.floor(Math.random() * 360),
      password: input.assignmentType === AssignmentType.ASSOCIATE ? '!no-login' : input.password,
    })
  }
  assignTeamMember({
    userId: user.id,
    projectId: input.projectId,
    teamId: input.teamId,
    assignmentType: input.assignmentType,
    pocId: input.pocId ?? null,
  })
  return user
}

export function createTeamRecord(input: {
  projectId: string
  name: string
  description: string
  mentorId?: string
}): Team {
  const team = registerTeam({
    id: nextId('team'),
    projectId: input.projectId,
    name: input.name,
    description: input.description,
  })
  if (input.mentorId) {
    assignTeamMember({
      userId: input.mentorId,
      projectId: input.projectId,
      teamId: team.id,
      assignmentType: AssignmentType.MENTOR,
    })
  }
  return team
}

export function assignTeamMember(input: {
  userId: string
  projectId: string
  teamId: string
  assignmentType: AssignmentType
  pocId?: string | null
}) {
  if (
    assignments.some(
      (item) =>
        item.userId === input.userId &&
        item.projectId === input.projectId &&
        item.teamId === input.teamId &&
        item.assignmentType === input.assignmentType,
    )
  ) {
    throw new Error('This person is already assigned in this role on the team')
  }
  return registerAssignment({
    id: nextId('as'),
    userId: input.userId,
    projectId: input.projectId,
    teamId: input.teamId,
    assignmentType: input.assignmentType,
    pocId: input.assignmentType === AssignmentType.ASSOCIATE ? (input.pocId ?? null) : null,
  })
}

/** Removes project membership. Does not delete the user account. */
export function removeProjectMember(input: { userId: string; projectId: string; actorId: string }) {
  const targets = assignments.filter(
    (item) => item.userId === input.userId && item.projectId === input.projectId,
  )
  if (targets.length === 0) throw new Error('This person is not assigned to this project')
  if (input.userId === input.actorId) throw new Error('You cannot remove yourself from the project')
  if (targets.some((item) => item.assignmentType === AssignmentType.SCRUM_MASTER)) {
    throw new Error('Cannot remove the Scrum Master from the project')
  }

  const removeUserIds = new Set<string>([input.userId])

  for (let i = assignments.length - 1; i >= 0; i -= 1) {
    const row = assignments[i]
    if (row.projectId === input.projectId && removeUserIds.has(row.userId)) {
      if (row.assignmentType === AssignmentType.SCRUM_MASTER) continue
      assignments.splice(i, 1)
    }
  }

  const allTasks = getTasks()
  for (const task of allTasks) {
    if (
      task.projectId === input.projectId &&
      task.assignedTo &&
      removeUserIds.has(task.assignedTo) &&
      task.status !== TaskStatus.COMPLETED
    ) {
      task.assignedTo = null
    }
  }
  setTasks([...allTasks])
  return true
}
