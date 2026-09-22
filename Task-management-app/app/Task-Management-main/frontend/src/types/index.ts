export const SystemRole = {
  ADMIN: 'ADMIN',
  USER: 'USER',
} as const
export type SystemRole = (typeof SystemRole)[keyof typeof SystemRole]

export const AssignmentType = {
  SCRUM_MASTER: 'SCRUM_MASTER',
  MENTOR: 'MENTOR',
  POC: 'POC',
  ASSOCIATE: 'ASSOCIATE',
} as const
export type AssignmentType = (typeof AssignmentType)[keyof typeof AssignmentType]

export const ProjectStatus = {
  PLANNING: 'PLANNING',
  ACTIVE: 'ACTIVE',
  ON_HOLD: 'ON_HOLD',
  COMPLETED: 'COMPLETED',
} as const
export type ProjectStatus = (typeof ProjectStatus)[keyof typeof ProjectStatus]

export const TaskStatus = {
  BACKLOG: 'BACKLOG',
  ASSIGNED: 'ASSIGNED',
  IN_PROGRESS: 'IN_PROGRESS',
  BLOCKED: 'BLOCKED',
  IN_REVIEW: 'IN_REVIEW',
  COMPLETED: 'COMPLETED',
  REOPENED: 'REOPENED',
} as const
export type TaskStatus = (typeof TaskStatus)[keyof typeof TaskStatus]

export const Priority = {
  HIGH: 'HIGH',
  MEDIUM: 'MEDIUM',
  LOW: 'LOW',
} as const
export type Priority = (typeof Priority)[keyof typeof Priority]

export const ReviewDecision = {
  APPROVE: 'APPROVE',
  REJECT: 'REJECT',
} as const
export type ReviewDecision = (typeof ReviewDecision)[keyof typeof ReviewDecision]

export const NotificationType = {
  TASK_ASSIGNED: 'TASK_ASSIGNED',
  DEADLINE_APPROACHING: 'DEADLINE_APPROACHING',
  TASK_REJECTED: 'TASK_REJECTED',
  TASK_APPROVED: 'TASK_APPROVED',
  COMMENT_ADDED: 'COMMENT_ADDED',
  REVIEW_REQUIRED: 'REVIEW_REQUIRED',
  BLOCKER_REPORTED: 'BLOCKER_REPORTED',
  TASK_OVERDUE: 'TASK_OVERDUE',
  NEW_WORK_ASSIGNED: 'NEW_WORK_ASSIGNED',
  TEAM_DELAY: 'TEAM_DELAY',
  PROJECT_BLOCKER: 'PROJECT_BLOCKER',
  PROGRESS_UPDATE: 'PROGRESS_UPDATE',
  QUERY_RAISED: 'QUERY_RAISED',
  QUERY_ANSWERED: 'QUERY_ANSWERED',
} as const
export type NotificationType = (typeof NotificationType)[keyof typeof NotificationType]

export const QueryStatus = {
  UNASSIGNED: 'UNASSIGNED',
  OPEN: 'OPEN',
  ANSWERED: 'ANSWERED',
  CLOSED: 'CLOSED',
} as const
export type QueryStatus = (typeof QueryStatus)[keyof typeof QueryStatus]

export interface HierarchyQuery {
  id: string
  projectId: string
  teamId: string | null
  fromUserId: string
  fromUserName: string
  toUserId: string
  toUserName: string
  subject: string
  body: string
  status: QueryStatus
  parentQueryId: string | null
  createdAt: string
  answeredAt: string | null
  replies: HierarchyQuery[]
}

export interface User {
  id: string
  firstName: string
  lastName: string
  email: string
  title: string
  systemRole: SystemRole
  avatarHue: number
  password: string
}

export interface Project {
  id: string
  name: string
  code: string
  description: string
  status: ProjectStatus
  startDate: string
  dueDate: string
  createdAt: string
}

export interface Team {
  id: string
  projectId: string
  name: string
  description: string
}

/** One row of the projects list, with server-computed roll-ups per project. */
export interface ProjectOverview {
  id: string
  name: string
  code: string
  description: string
  status: ProjectStatus
  startDate: string | null
  dueDate: string | null
  teamCount: number
  scrumMasterName: string | null
  progress: number
}

export interface ProjectAssignment {
  id: string
  userId: string
  projectId: string
  assignmentType: AssignmentType
  teamId: string | null
  pocId: string | null
}

export interface Label {
  id: string
  name: string
  color: string
}

export interface Task {
  id: string
  numericId: number
  projectId: string
  teamId: string
  parentTaskId: string | null
  sprintId?: string | null
  title: string
  description: string
  status: TaskStatus
  priority: Priority
  assignedTo: string | null
  assignedBy: string
  dueDate: string
  estimatedHours: number
  actualHours: number
  progressPercent: number
  labelIds: string[]
  createdAt: string
  updatedAt: string
  blockedReason?: string
  /** Free-text name of who performed the work. */
  doneByName?: string | null
}

export const SprintStatus = {
  PLANNED: 'PLANNED',
  ACTIVE: 'ACTIVE',
  CLOSED: 'CLOSED',
} as const
export type SprintStatus = (typeof SprintStatus)[keyof typeof SprintStatus]

export interface Sprint {
  id: string
  projectId: string
  teamId: string
  teamName: string
  name: string
  goal: string | null
  startDate: string
  endDate: string
  status: SprintStatus
  createdBy: string
  createdAt: string
}

export interface TaskComment {
  id: string
  taskId: string
  authorId: string
  body: string
  mentions: string[]
  createdAt: string
}

export interface TaskAttachment {
  id: string
  taskId: string
  fileName: string
  fileSize: number
  contentType: string
  url: string
  uploadedBy: string
  uploadedAt: string
}

export interface TaskReview {
  id: string
  taskId: string
  reviewerId: string
  decision: ReviewDecision
  comment: string
  createdAt: string
}

export interface WorkLog {
  id: string
  taskId: string
  userId: string
  date: string
  hours: number
  description: string
}

export interface ActivityLog {
  id: string
  userId: string
  action: string
  entityType: string
  entityId: string
  message: string
  projectId: string
  createdAt: string
  metadata?: Record<string, string>
}

export interface AppNotification {
  id: string
  userId: string
  type: NotificationType
  title: string
  message: string
  entityType: string
  entityId: string
  projectId: string
  read: boolean
  createdAt: string
}

export interface TaskLineage {
  project: Project
  team: Team
  mentor: User | null
  poc: User | null
  task: Task
  parentTask: Task | null
}

export const ASSIGNMENT_LABEL: Record<AssignmentType, string> = {
  SCRUM_MASTER: 'Scrum Master',
  MENTOR: 'Mentor',
  POC: 'POC',
  ASSOCIATE: 'Associate',
}

export const STATUS_META: Record<
  TaskStatus,
  { label: string; className: string; dot: string }
> = {
  BACKLOG: {
    label: 'Backlog',
    className: 'bg-slate-100 text-slate-700 border-slate-200',
    dot: 'bg-status-backlog',
  },
  ASSIGNED: {
    label: 'Assigned',
    className: 'bg-sky-50 text-sky-800 border-sky-200',
    dot: 'bg-status-assigned',
  },
  IN_PROGRESS: {
    label: 'In Progress',
    className: 'bg-indigo-50 text-indigo-800 border-indigo-200',
    dot: 'bg-status-in-progress',
  },
  BLOCKED: {
    label: 'Blocked',
    className: 'bg-red-50 text-red-800 border-red-200',
    dot: 'bg-status-blocked',
  },
  IN_REVIEW: {
    label: 'Under review',
    className: 'bg-amber-50 text-amber-800 border-amber-200',
    dot: 'bg-status-in-review',
  },
  COMPLETED: {
    label: 'Completed',
    className: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    dot: 'bg-status-completed',
  },
  REOPENED: {
    label: 'Change requested',
    className: 'bg-orange-50 text-orange-800 border-orange-200',
    dot: 'bg-status-reopened',
  },
}

/** Statuses shown in v1 filters / dashboards (minimal set). */
export const WORK_STATUSES: TaskStatus[] = [
  TaskStatus.ASSIGNED,
  TaskStatus.IN_PROGRESS,
  TaskStatus.IN_REVIEW,
  TaskStatus.COMPLETED,
  TaskStatus.REOPENED,
]

export const PRIORITY_META: Record<
  Priority,
  { label: string; className: string }
> = {
  HIGH: { label: 'High', className: 'bg-red-50 text-red-700 border-red-200' },
  MEDIUM: {
    label: 'Medium',
    className: 'bg-amber-50 text-amber-800 border-amber-200',
  },
  LOW: { label: 'Low', className: 'bg-sky-50 text-sky-800 border-sky-200' },
}

export const PROJECT_STATUS_META: Record<
  ProjectStatus,
  { label: string; className: string }
> = {
  PLANNING: {
    label: 'Planning',
    className: 'bg-slate-100 text-slate-700 border-slate-200',
  },
  ACTIVE: {
    label: 'Active',
    className: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  },
  ON_HOLD: {
    label: 'On Hold',
    className: 'bg-amber-50 text-amber-800 border-amber-200',
  },
  COMPLETED: {
    label: 'Completed',
    className: 'bg-indigo-50 text-indigo-800 border-indigo-200',
  },
}

export const KANBAN_COLUMNS: TaskStatus[] = [
  'BACKLOG',
  'ASSIGNED',
  'IN_PROGRESS',
  'BLOCKED',
  'IN_REVIEW',
  'COMPLETED',
]
