import { assignments, projectById, projects, teamById, teams } from '@/data/organization'
import { userById, users } from '@/data/users'
import { comments, labels, tasks as seedTasks } from '@/data/work'
import {
  ASSIGNMENT_LABEL,
  AssignmentType,
  TaskStatus,
  type AssignmentType as AssignmentTypeValue,
  type Project,
  type ProjectAssignment,
  type Task,
  type TaskLineage,
  type User,
} from '@/types'
import { isAfter, parseISO, startOfDay } from 'date-fns'

/** Start of the current day — used for overdue checks. */
export const TODAY = startOfDay(new Date())

export function getUser(id: string | null | undefined) {
  if (!id) return undefined
  return userById[id]
}

export function displayName(user: User | undefined) {
  if (!user) return 'Unassigned'
  return `${user.firstName} ${user.lastName}`
}

/** Who is doing the work: assigned associate/POC, else the recorded done-by name. */
export function workerName(task: { assignedTo: string | null; doneByName?: string | null }) {
  const assignee = getUser(task.assignedTo)
  if (assignee) return displayName(assignee)
  const recorded = task.doneByName?.trim()
  return recorded || 'Unassigned'
}

export function assignmentsForUser(userId: string) {
  return assignments.filter((item) => item.userId === userId)
}

export function assignmentForUserProject(userId: string, projectId: string) {
  const matches = assignments.filter((item) => item.userId === userId && item.projectId === projectId)
  const rank: AssignmentTypeValue[] = [
    AssignmentType.SCRUM_MASTER,
    AssignmentType.MENTOR,
    AssignmentType.POC,
    AssignmentType.ASSOCIATE,
  ]
  return [...matches].sort((a, b) => rank.indexOf(a.assignmentType) - rank.indexOf(b.assignmentType))[0]
}

export function projectsForUser(userId: string): Project[] {
  const ids = new Set(assignmentsForUser(userId).map((item) => item.projectId))
  return projects.filter((project) => ids.has(project.id))
}

export function teamsInProject(projectId: string) {
  return teams.filter((team) => team.projectId === projectId)
}

export function scrumMasterOf(projectId: string) {
  const row = assignments.find(
    (item) => item.projectId === projectId && item.assignmentType === AssignmentType.SCRUM_MASTER,
  )
  return row ? getUser(row.userId) : undefined
}

export function mentorOfTeam(teamId: string) {
  const row = assignments.find(
    (item) => item.teamId === teamId && item.assignmentType === AssignmentType.MENTOR,
  )
  return row ? getUser(row.userId) : undefined
}

export function pocsOfTeam(teamId: string) {
  return assignments
    .filter((item) => item.teamId === teamId && item.assignmentType === AssignmentType.POC)
    .map((item) => getUser(item.userId))
    .filter((user): user is User => Boolean(user))
}

/** Header caption: "Backend POC", "Backend Mentor", "Scrum Master". */
export function roleWithTeamLabel(assignment?: ProjectAssignment | null) {
  if (!assignment) return 'Unassigned'
  const role = ASSIGNMENT_LABEL[assignment.assignmentType]
  const team = assignment.teamId ? teamById[assignment.teamId] : undefined
  return team ? `${team.name} ${role}` : role
}

export function teamRosterSize(teamId: string) {
  return new Set(assignments.filter((item) => item.teamId === teamId).map((item) => item.userId)).size
}

export function teamRosterBreakdown(teamId: string) {
  const rows = assignments.filter((item) => item.teamId === teamId)
  return {
    size: new Set(rows.map((item) => item.userId)).size,
    mentors: rows.filter((item) => item.assignmentType === AssignmentType.MENTOR).length,
    pocs: rows.filter((item) => item.assignmentType === AssignmentType.POC).length,
    associates: rows.filter((item) => item.assignmentType === AssignmentType.ASSOCIATE).length,
  }
}

/** Who should review IN_REVIEW work: associate → POC, POC → Mentor, Mentor → self. Scrum Masters never review. */
export function canReviewTask(
  role: AssignmentTypeValue | undefined,
  task: { status: string; assignedTo: string | null; projectId: string; teamId: string },
  actorId: string,
) {
  if (!role || task.status !== TaskStatus.IN_REVIEW || !task.assignedTo) return false
  if (role === AssignmentType.SCRUM_MASTER) return false
  const ownAssociate = associatesOf(actorId, task.projectId).some((item) => item.id === task.assignedTo)
  if (ownAssociate) {
    return role === AssignmentType.POC || role === AssignmentType.MENTOR
  }
  if (role !== AssignmentType.MENTOR) return false
  if (mentorOfTeam(task.teamId)?.id !== actorId) return false
  if (task.assignedTo === actorId) return true
  return assignmentForUserProject(task.assignedTo, task.projectId)?.assignmentType === AssignmentType.POC
}

export function associatesOf(pocId: string, projectId?: string | null) {
  return assignments
    .filter(
      (item) =>
        item.assignmentType === AssignmentType.ASSOCIATE &&
        item.pocId === pocId &&
        (!projectId || item.projectId === projectId),
    )
    .map((item) => getUser(item.userId))
    .filter((user): user is User => Boolean(user))
}

export function workAssigneesForLead(
  actor: User,
  projectId: string | null,
  teamId: string | null,
  role: AssignmentTypeValue | undefined,
) {
  const people: { user: User; label: string }[] = [
    {
      user: actor,
      label: role === AssignmentType.MENTOR ? `${displayName(actor)} (Me · Mentor / POC)` : `${displayName(actor)} (Me)`,
    },
  ]
  const seen = new Set<string>([actor.id])
  if (role === AssignmentType.MENTOR && teamId) {
    for (const poc of pocsOfTeam(teamId)) {
      if (seen.has(poc.id)) continue
      seen.add(poc.id)
      people.push({ user: poc, label: `${displayName(poc)} · POC` })
    }
  }
  if (projectId) {
    for (const person of associatesOf(actor.id, projectId)) {
      if (seen.has(person.id)) continue
      seen.add(person.id)
      people.push({ user: person, label: `${displayName(person)} · Associate` })
    }
  }
  return people
}

export function associatesOfTeam(teamId: string) {
  return assignments
    .filter((item) => item.teamId === teamId && item.assignmentType === AssignmentType.ASSOCIATE)
    .map((item) => getUser(item.userId))
    .filter((user): user is User => Boolean(user))
}

export function canUserSignIn(userId: string) {
  const rows = assignmentsForUser(userId)
  return rows.some((item) => item.assignmentType !== AssignmentType.ASSOCIATE)
}

/** POC-style leads on a team: the Mentor (as POC of their own workstream) plus other POCs. */
export function teamsForActor(userId: string, projectId: string, role?: AssignmentTypeValue) {
  const all = teamsInProject(projectId)
  if (role === AssignmentType.SCRUM_MASTER) return all
  const mine = new Set(
    assignments
      .filter((item) => item.userId === userId && item.projectId === projectId && item.teamId)
      .map((item) => item.teamId as string),
  )
  return all.filter((team) => mine.has(team.id))
}

export function queryAssigneesOfTeam(teamId: string) {
  const leads = pocLeadsOfTeam(teamId)
  const associates = associatesOfTeam(teamId)
  return [
    ...leads.map((lead) => ({
      user: lead.user,
      label: lead.isMentor ? `${displayName(lead.user)} · Mentor / POC` : `${displayName(lead.user)} · POC`,
    })),
    ...associates.map((person) => ({
      user: person,
      label: `${displayName(person)} · Associate (POC updates work)`,
    })),
  ]
}

export function pocLeadsOfTeam(teamId: string) {
  const mentor = mentorOfTeam(teamId)
  const leads: { user: User; label: string; isMentor: boolean }[] = []
  if (mentor) {
    leads.push({ user: mentor, label: `${displayName(mentor)} (Mentor / POC)`, isMentor: true })
  }
  for (const poc of pocsOfTeam(teamId)) {
    if (poc.id === mentor?.id) continue
    leads.push({ user: poc, label: displayName(poc), isMentor: false })
  }
  return leads
}

export function childrenOf(taskId: string, allTasks: Task[] = seedTasks) {
  return allTasks.filter((task) => task.parentTaskId === taskId)
}

export function isParentTask(task: Task, allTasks: Task[] = seedTasks) {
  return task.parentTaskId === null || childrenOf(task.id, allTasks).length > 0
}

export function leafProgress(task: Task) {
  if (task.status === TaskStatus.COMPLETED) return 100
  if (task.status === TaskStatus.BACKLOG || task.status === TaskStatus.ASSIGNED) {
    return Math.min(task.progressPercent, 15)
  }
  return task.progressPercent
}

export function computedProgress(task: Task, allTasks: Task[] = seedTasks): number {
  const children = childrenOf(task.id, allTasks)
  if (children.length === 0) return leafProgress(task)
  const total = children.reduce((sum, child) => sum + computedProgress(child, allTasks), 0)
  return Math.round(total / children.length)
}

export function teamProgress(teamId: string, allTasks: Task[] = seedTasks) {
  const parents = allTasks.filter((task) => task.teamId === teamId && task.parentTaskId === null)
  if (parents.length === 0) return 0
  return Math.round(parents.reduce((sum, task) => sum + computedProgress(task, allTasks), 0) / parents.length)
}

export function projectProgress(projectId: string, allTasks: Task[] = seedTasks) {
  const projectTeams = teamsInProject(projectId)
  if (projectTeams.length === 0) return 0
  return Math.round(
    projectTeams.reduce((sum, team) => sum + teamProgress(team.id, allTasks), 0) / projectTeams.length,
  )
}

export function isOverdue(task: Task) {
  if (task.status === TaskStatus.COMPLETED) return false
  return isAfter(TODAY, parseISO(task.dueDate))
}

export function countByStatus(list: Task[]) {
  return {
    total: list.length,
    completed: list.filter((task) => task.status === TaskStatus.COMPLETED).length,
    inProgress: list.filter((task) => task.status === TaskStatus.IN_PROGRESS).length,
    blocked: list.filter((task) => task.status === TaskStatus.BLOCKED).length,
    overdue: list.filter((task) => isOverdue(task)).length,
    inReview: list.filter((task) => task.status === TaskStatus.IN_REVIEW).length,
    assigned: list.filter((task) => task.status === TaskStatus.ASSIGNED).length,
    backlog: list.filter((task) => task.status === TaskStatus.BACKLOG).length,
    reopened: list.filter((task) => task.status === TaskStatus.REOPENED).length,
  }
}

export function visibleTasksForAssignment(
  assignment: ProjectAssignment | undefined,
  allTasks: Task[] = seedTasks,
) {
  if (!assignment) return []
  if (assignment.assignmentType === AssignmentType.SCRUM_MASTER) {
    return allTasks.filter((task) => task.projectId === assignment.projectId)
  }
  if (assignment.assignmentType === AssignmentType.MENTOR && assignment.teamId) {
    return allTasks.filter((task) => task.teamId === assignment.teamId)
  }
  if (assignment.assignmentType === AssignmentType.POC) {
    const associateIds = new Set(associatesOf(assignment.userId, assignment.projectId).map((item) => item.id))
    return allTasks.filter(
      (task) =>
        task.projectId === assignment.projectId &&
        (task.assignedTo === assignment.userId ||
          (task.assignedTo != null && associateIds.has(task.assignedTo)) ||
          (task.parentTaskId
            ? allTasks.find((parent) => parent.id === task.parentTaskId)?.assignedTo === assignment.userId
            : false)),
    )
  }
  return []
}

export function lineageForTask(task: Task, allTasks: Task[] = seedTasks): TaskLineage {
  const project = projectById[task.projectId]
  const team = teamById[task.teamId]
  const mentor = mentorOfTeam(task.teamId) ?? null
  const parentTask = task.parentTaskId ? (allTasks.find((item) => item.id === task.parentTaskId) ?? null) : null
  const pocUser = parentTask
    ? (getUser(parentTask.assignedTo) ?? null)
    : task.parentTaskId === null
      ? (getUser(task.assignedTo) ?? null)
      : null
  return {
    project,
    team,
    mentor,
    poc: pocUser,
    task,
    parentTask,
  }
}

export function labelById(id: string) {
  return labels.find((label) => label.id === id)
}

export function commentsFor(taskId: string) {
  return comments.filter((item) => item.taskId === taskId)
}

export function pocCount(projectId: string) {
  return assignments.filter(
    (item) => item.projectId === projectId && item.assignmentType === AssignmentType.POC,
  ).length
}

export function teamCount(projectId: string) {
  return teamsInProject(projectId).length
}

export { teams, projects, assignments, users }
