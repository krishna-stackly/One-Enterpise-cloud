import {
  Priority,
  TaskStatus,
  type Label,
  type Task,
  type TaskAttachment,
  type TaskComment,
  type TaskReview,
  type WorkLog,
} from '@/types'

export const labels: Label[] = [
  { id: 'lbl_api', name: 'api', color: '#1d4ed8' },
  { id: 'lbl_db', name: 'database', color: '#0f766e' },
  { id: 'lbl_ui', name: 'ui', color: '#7c3aed' },
  { id: 'lbl_test', name: 'testing', color: '#c2410c' },
  { id: 'lbl_sec', name: 'security', color: '#be123c' },
  { id: 'lbl_docs', name: 'docs', color: '#475569' },
  { id: 'lbl_infra', name: 'infra', color: '#0369a1' },
  { id: 'lbl_blocked', name: 'blocker', color: '#dc2626' },
]

let numericSeq = 100

function task(partial: Omit<Task, 'numericId'> & { numericId?: number }): Task {
  const numericId = partial.numericId ?? numericSeq++
  if (numericId >= numericSeq) numericSeq = numericId + 1
  return { ...partial, numericId }
}

const employeeModule: Task[] = [
  task({
    id: 'tsk_100',
    numericId: 100,
    projectId: 'prj_hrms',
    teamId: 'team_be',
    parentTaskId: null,
    title: 'Employee Management Module',
    description:
      'Deliver employee master data, CRUD APIs, schema, validation, and automated tests for the HRMS employee domain.',
    status: TaskStatus.IN_PROGRESS,
    priority: Priority.HIGH,
    assignedTo: 'usr_nikhil',
    assignedBy: 'usr_suresh',
    dueDate: '2026-09-22',
    estimatedHours: 120,
    actualHours: 74,
    progressPercent: 0,
    labelIds: ['lbl_api', 'lbl_db'],
    createdAt: '2026-08-18T09:30:00.000Z',
    updatedAt: '2026-09-08T16:10:00.000Z',
  }),
  task({
    id: 'tsk_101',
    numericId: 101,
    projectId: 'prj_hrms',
    teamId: 'team_be',
    parentTaskId: 'tsk_100',
    title: 'Employee CRUD API',
    description: 'REST endpoints for create, read, update, and delete of employee records, including pagination and filters.',
    status: TaskStatus.IN_PROGRESS,
    priority: Priority.HIGH,
    assignedTo: 'usr_rahul',
    doneByName: 'Rahul Sharma',
    assignedBy: 'usr_nikhil',
    dueDate: '2026-09-09',
    estimatedHours: 32,
    actualHours: 24,
    progressPercent: 80,
    labelIds: ['lbl_api'],
    createdAt: '2026-08-19T10:00:00.000Z',
    updatedAt: '2026-09-09T08:15:00.000Z',
  }),
  task({
    id: 'tsk_102',
    numericId: 102,
    projectId: 'prj_hrms',
    teamId: 'team_be',
    parentTaskId: 'tsk_100',
    title: 'Database Schema',
    description: 'Employee, department, and reporting-line tables with indexes, constraints, and Flyway migrations.',
    status: TaskStatus.IN_PROGRESS,
    priority: Priority.HIGH,
    assignedTo: 'usr_priya',
    doneByName: 'Priya Nair',
    assignedBy: 'usr_nikhil',
    dueDate: '2026-09-10',
    estimatedHours: 24,
    actualHours: 16,
    progressPercent: 60,
    labelIds: ['lbl_db'],
    createdAt: '2026-08-19T10:05:00.000Z',
    updatedAt: '2026-09-08T14:00:00.000Z',
  }),
  task({
    id: 'tsk_103',
    numericId: 103,
    projectId: 'prj_hrms',
    teamId: 'team_be',
    parentTaskId: 'tsk_100',
    title: 'Validation',
    description: 'Bean validation for employee payloads including unique email and required employment fields.',
    status: TaskStatus.COMPLETED,
    priority: Priority.MEDIUM,
    assignedTo: 'usr_kiran',
    doneByName: 'Kiran Reddy',
    assignedBy: 'usr_nikhil',
    dueDate: '2026-09-05',
    estimatedHours: 16,
    actualHours: 14,
    progressPercent: 100,
    labelIds: ['lbl_api', 'lbl_sec'],
    createdAt: '2026-08-19T10:10:00.000Z',
    updatedAt: '2026-09-04T17:20:00.000Z',
  }),
  task({
    id: 'tsk_104',
    numericId: 104,
    projectId: 'prj_hrms',
    teamId: 'team_be',
    parentTaskId: 'tsk_100',
    title: 'Unit Tests',
    description: 'Service and controller tests covering CRUD, uniqueness, and authorization on employee APIs.',
    status: TaskStatus.IN_PROGRESS,
    priority: Priority.MEDIUM,
    assignedTo: 'usr_rahul',
    doneByName: 'Rahul Sharma',
    assignedBy: 'usr_nikhil',
    dueDate: '2026-09-12',
    estimatedHours: 20,
    actualHours: 8,
    progressPercent: 40,
    labelIds: ['lbl_test'],
    createdAt: '2026-08-19T10:15:00.000Z',
    updatedAt: '2026-09-08T11:40:00.000Z',
  }),
  task({
    id: 'tsk_105',
    numericId: 105,
    projectId: 'prj_hrms',
    teamId: 'team_be',
    parentTaskId: 'tsk_100',
    title: 'API Documentation',
    description: 'OpenAPI descriptions and example payloads for the employee resource.',
    status: TaskStatus.ASSIGNED,
    priority: Priority.MEDIUM,
    assignedTo: 'usr_rahul',
    doneByName: 'Rahul Sharma',
    assignedBy: 'usr_nikhil',
    dueDate: '2026-09-09',
    estimatedHours: 8,
    actualHours: 1,
    progressPercent: 10,
    labelIds: ['lbl_docs', 'lbl_api'],
    createdAt: '2026-08-25T09:00:00.000Z',
    updatedAt: '2026-09-08T09:00:00.000Z',
  }),
  task({
    id: 'tsk_106',
    numericId: 106,
    projectId: 'prj_hrms',
    teamId: 'team_be',
    parentTaskId: 'tsk_100',
    title: 'Database Optimization',
    description: 'Query plan review for employee listing by department and manager.',
    status: TaskStatus.ASSIGNED,
    priority: Priority.LOW,
    assignedTo: 'usr_rahul',
    doneByName: 'Rahul Sharma',
    assignedBy: 'usr_nikhil',
    dueDate: '2026-09-10',
    estimatedHours: 10,
    actualHours: 0,
    progressPercent: 0,
    labelIds: ['lbl_db'],
    createdAt: '2026-08-28T09:00:00.000Z',
    updatedAt: '2026-08-28T09:00:00.000Z',
  }),
]

type ModuleSpec = {
  id: string
  numericId: number
  teamId: string
  pocId: string
  mentorId: string
  title: string
  description: string
  dueDate: string
  priority: Priority
  status: TaskStatus
  subtasks: {
    id: string
    title: string
    doneByName: string
    status: TaskStatus
    priority: Priority
    progress: number
    dueDate: string
    hours: number
    actual: number
    labels: string[]
    blockedReason?: string
  }[]
}

const modules: ModuleSpec[] = [
  {
    id: 'tsk_110',
    numericId: 110,
    teamId: 'team_be',
    pocId: 'usr_nikhil',
    mentorId: 'usr_suresh',
    title: 'Attendance & Leave Engine',
    description: 'Leave balances, attendance punches, and approval chain.',
    dueDate: '2026-10-03',
    priority: Priority.HIGH,
    status: TaskStatus.IN_PROGRESS,
    subtasks: [
      { id: 'tsk_111', title: 'Leave policy rules', doneByName: 'Priya Nair', status: TaskStatus.IN_REVIEW, priority: Priority.HIGH, progress: 100, dueDate: '2026-09-08', hours: 20, actual: 18, labels: ['lbl_api'] },
      { id: 'tsk_112', title: 'Attendance punch API', doneByName: 'Deepak Joshi', status: TaskStatus.BLOCKED, priority: Priority.HIGH, progress: 45, dueDate: '2026-09-07', hours: 18, actual: 10, labels: ['lbl_api', 'lbl_blocked'], blockedReason: 'Waiting on biometric vendor sandbox credentials.' },
      { id: 'tsk_113', title: 'Balance recalculation job', doneByName: 'Kiran Reddy', status: TaskStatus.IN_PROGRESS, priority: Priority.MEDIUM, progress: 55, dueDate: '2026-09-15', hours: 16, actual: 9, labels: ['lbl_db'] },
    ],
  },
  {
    id: 'tsk_120',
    numericId: 120,
    teamId: 'team_be',
    pocId: 'usr_anil',
    mentorId: 'usr_suresh',
    title: 'Authentication Module',
    description: 'JWT login, refresh rotation, and role-aware authorization filters.',
    dueDate: '2026-09-15',
    priority: Priority.HIGH,
    status: TaskStatus.IN_PROGRESS,
    subtasks: [
      { id: 'tsk_121', title: 'Login & refresh tokens', doneByName: 'Kavya Rao', status: TaskStatus.COMPLETED, priority: Priority.HIGH, progress: 100, dueDate: '2026-09-01', hours: 24, actual: 22, labels: ['lbl_sec'] },
      { id: 'tsk_122', title: 'Permission guards', doneByName: 'Manoj Patel', status: TaskStatus.IN_PROGRESS, priority: Priority.HIGH, progress: 70, dueDate: '2026-09-12', hours: 20, actual: 14, labels: ['lbl_sec'] },
      { id: 'tsk_123', title: 'Password reset flow', doneByName: 'Neha Gupta', status: TaskStatus.ASSIGNED, priority: Priority.MEDIUM, progress: 15, dueDate: '2026-09-18', hours: 12, actual: 2, labels: ['lbl_api'] },
    ],
  },
  {
    id: 'tsk_125',
    numericId: 125,
    teamId: 'team_be',
    pocId: 'usr_suresh',
    mentorId: 'usr_suresh',
    title: 'Notification Service',
    description: 'Mentor / POC workstream: event notifications and email digest for HRMS.',
    dueDate: '2026-10-10',
    priority: Priority.MEDIUM,
    status: TaskStatus.IN_PROGRESS,
    subtasks: [
      { id: 'tsk_126', title: 'Event payload contract', doneByName: 'Ajay Menon', status: TaskStatus.IN_PROGRESS, priority: Priority.MEDIUM, progress: 40, dueDate: '2026-09-18', hours: 16, actual: 6, labels: ['lbl_api'] },
      { id: 'tsk_127', title: 'Email digest job', doneByName: 'Swati Iyer', status: TaskStatus.ASSIGNED, priority: Priority.MEDIUM, progress: 10, dueDate: '2026-09-22', hours: 14, actual: 1, labels: ['lbl_api'] },
      { id: 'tsk_128', title: 'In-app notification store', doneByName: 'Naveen Rao', status: TaskStatus.IN_PROGRESS, priority: Priority.LOW, progress: 25, dueDate: '2026-09-25', hours: 12, actual: 3, labels: ['lbl_db'] },
    ],
  },
  {
    id: 'tsk_130',
    numericId: 130,
    teamId: 'team_fe',
    pocId: 'usr_ananya',
    mentorId: 'usr_meera',
    title: 'Employee Directory UI',
    description: 'Searchable directory, profile drawer, and org filters.',
    dueDate: '2026-09-20',
    priority: Priority.HIGH,
    status: TaskStatus.IN_PROGRESS,
    subtasks: [
      { id: 'tsk_131', title: 'Directory table & filters', doneByName: 'Vikram Singh', status: TaskStatus.IN_PROGRESS, priority: Priority.HIGH, progress: 75, dueDate: '2026-09-11', hours: 22, actual: 16, labels: ['lbl_ui'] },
      { id: 'tsk_132', title: 'Profile drawer', doneByName: 'Sneha Kapoor', status: TaskStatus.IN_REVIEW, priority: Priority.MEDIUM, progress: 100, dueDate: '2026-09-08', hours: 14, actual: 13, labels: ['lbl_ui'] },
      { id: 'tsk_133', title: 'Empty & error states', doneByName: 'Arjun Verma', status: TaskStatus.COMPLETED, priority: Priority.LOW, progress: 100, dueDate: '2026-09-04', hours: 8, actual: 7, labels: ['lbl_ui'] },
    ],
  },
  {
    id: 'tsk_140',
    numericId: 140,
    teamId: 'team_fe',
    pocId: 'usr_dev',
    mentorId: 'usr_meera',
    title: 'Self-Service Portal',
    description: 'Leave apply, timesheet entry, and document download.',
    dueDate: '2026-10-08',
    priority: Priority.MEDIUM,
    status: TaskStatus.IN_PROGRESS,
    subtasks: [
      { id: 'tsk_141', title: 'Leave application form', doneByName: 'Nisha Bansal', status: TaskStatus.IN_PROGRESS, priority: Priority.MEDIUM, progress: 50, dueDate: '2026-09-16', hours: 18, actual: 9, labels: ['lbl_ui'] },
      { id: 'tsk_142', title: 'Timesheet grid', doneByName: 'Rohan Mehta', status: TaskStatus.ASSIGNED, priority: Priority.MEDIUM, progress: 5, dueDate: '2026-09-22', hours: 20, actual: 1, labels: ['lbl_ui'] },
    ],
  },
  {
    id: 'tsk_150',
    numericId: 150,
    teamId: 'team_qa',
    pocId: 'usr_lakshmi',
    mentorId: 'usr_ravi',
    title: 'Employee Module Test Pack',
    description: 'API and UI regression for employee CRUD and validation.',
    dueDate: '2026-09-25',
    priority: Priority.HIGH,
    status: TaskStatus.IN_PROGRESS,
    subtasks: [
      { id: 'tsk_151', title: 'API regression suite', doneByName: 'Aditya Bose', status: TaskStatus.IN_PROGRESS, priority: Priority.HIGH, progress: 85, dueDate: '2026-09-12', hours: 24, actual: 20, labels: ['lbl_test'] },
      { id: 'tsk_152', title: 'Negative validation cases', doneByName: 'Pooja Jain', status: TaskStatus.COMPLETED, priority: Priority.MEDIUM, progress: 100, dueDate: '2026-09-06', hours: 12, actual: 11, labels: ['lbl_test'] },
      { id: 'tsk_153', title: 'UI smoke tests', doneByName: 'Varun Chopra', status: TaskStatus.BLOCKED, priority: Priority.MEDIUM, progress: 30, dueDate: '2026-09-08', hours: 16, actual: 6, labels: ['lbl_test', 'lbl_blocked'], blockedReason: 'Staging frontend not deployed for employee drawer.' },
    ],
  },
  {
    id: 'tsk_160',
    numericId: 160,
    teamId: 'team_qa',
    pocId: 'usr_sanjay',
    mentorId: 'usr_ravi',
    title: 'Release Quality Gates',
    description: 'Performance budget, accessibility, and sign-off checklist.',
    dueDate: '2026-10-01',
    priority: Priority.MEDIUM,
    status: TaskStatus.ASSIGNED,
    subtasks: [
      { id: 'tsk_161', title: 'Lighthouse baseline', doneByName: 'Divya Sen', status: TaskStatus.ASSIGNED, priority: Priority.LOW, progress: 0, dueDate: '2026-09-18', hours: 10, actual: 0, labels: ['lbl_test'] },
      { id: 'tsk_162', title: 'Accessibility audit', doneByName: 'Harish Naik', status: TaskStatus.IN_PROGRESS, priority: Priority.MEDIUM, progress: 35, dueDate: '2026-09-20', hours: 14, actual: 5, labels: ['lbl_test'] },
    ],
  },
  {
    id: 'tsk_170',
    numericId: 170,
    teamId: 'team_do',
    pocId: 'usr_ishita',
    mentorId: 'usr_karthik',
    title: 'Environment Pipeline',
    description: 'Dev, staging, and production compose stacks with secrets.',
    dueDate: '2026-09-18',
    priority: Priority.HIGH,
    status: TaskStatus.IN_PROGRESS,
    subtasks: [
      { id: 'tsk_171', title: 'Compose for staging', doneByName: 'Gaurav Yadav', status: TaskStatus.COMPLETED, priority: Priority.HIGH, progress: 100, dueDate: '2026-09-02', hours: 16, actual: 15, labels: ['lbl_infra'] },
      { id: 'tsk_172', title: 'Flyway in CI', doneByName: 'Tanvi Kulkarni', status: TaskStatus.IN_REVIEW, priority: Priority.HIGH, progress: 100, dueDate: '2026-09-09', hours: 12, actual: 11, labels: ['lbl_infra', 'lbl_db'] },
      { id: 'tsk_173', title: 'Log shipping', doneByName: 'Mohit Saxena', status: TaskStatus.IN_PROGRESS, priority: Priority.MEDIUM, progress: 40, dueDate: '2026-09-17', hours: 14, actual: 6, labels: ['lbl_infra'] },
    ],
  },
  {
    id: 'tsk_180',
    numericId: 180,
    teamId: 'team_do',
    pocId: 'usr_vivek',
    mentorId: 'usr_karthik',
    title: 'Observability Baseline',
    description: 'Health checks, metrics, and uptime alerts.',
    dueDate: '2026-09-28',
    priority: Priority.MEDIUM,
    status: TaskStatus.IN_PROGRESS,
    subtasks: [
      { id: 'tsk_181', title: 'Actuator dashboards', doneByName: 'Asha Fernandes', status: TaskStatus.IN_PROGRESS, priority: Priority.MEDIUM, progress: 62, dueDate: '2026-09-14', hours: 16, actual: 10, labels: ['lbl_infra'] },
      { id: 'tsk_182', title: 'Pager rules', doneByName: 'Ritesh Ghosh', status: TaskStatus.BACKLOG, priority: Priority.LOW, progress: 0, dueDate: '2026-09-25', hours: 8, actual: 0, labels: ['lbl_infra'] },
    ],
  },
  {
    id: 'tsk_200',
    numericId: 200,
    teamId: 'team_an_data',
    pocId: 'usr_dev',
    mentorId: 'usr_leela',
    title: 'Warehouse Ingestion',
    description: 'HR events into the analytics lake.',
    dueDate: '2026-10-15',
    priority: Priority.MEDIUM,
    status: TaskStatus.IN_PROGRESS,
    subtasks: [
      { id: 'tsk_201', title: 'Employee CDC pipeline', doneByName: 'Vikram Singh', status: TaskStatus.IN_PROGRESS, priority: Priority.MEDIUM, progress: 48, dueDate: '2026-09-30', hours: 30, actual: 14, labels: ['lbl_db'] },
    ],
  },
  {
    id: 'tsk_210',
    numericId: 210,
    teamId: 'team_pay_int',
    pocId: 'usr_anil',
    mentorId: 'usr_nikhil',
    title: 'Bank File Export',
    description: 'Salary disbursement file for partner banks.',
    dueDate: '2026-10-12',
    priority: Priority.HIGH,
    status: TaskStatus.ASSIGNED,
    subtasks: [
      { id: 'tsk_211', title: 'NACH format mapping', doneByName: 'Kavya Rao', status: TaskStatus.ASSIGNED, priority: Priority.HIGH, progress: 20, dueDate: '2026-09-24', hours: 22, actual: 4, labels: ['lbl_api'] },
    ],
  },
  {
    id: 'tsk_220',
    numericId: 220,
    teamId: 'team_mob_and',
    pocId: 'usr_fatima',
    mentorId: 'usr_samir',
    title: 'Directory on Android',
    description: 'Mobile employee directory using HRMS APIs.',
    dueDate: '2026-11-20',
    priority: Priority.LOW,
    status: TaskStatus.ASSIGNED,
    subtasks: [
      { id: 'tsk_221', title: 'People search screen', doneByName: 'usr_nikhil', status: TaskStatus.ASSIGNED, priority: Priority.LOW, progress: 5, dueDate: '2026-10-30', hours: 18, actual: 1, labels: ['lbl_ui'] },
    ],
  },
]

function expandModules(specs: ModuleSpec[]): Task[] {
  const result: Task[] = []
  for (const spec of specs) {
    result.push(
      task({
        id: spec.id,
        numericId: spec.numericId,
        projectId: spec.teamId.startsWith('team_an')
          ? 'prj_analytics'
          : spec.teamId.startsWith('team_pay')
            ? 'prj_payroll'
            : spec.teamId.startsWith('team_mob')
              ? 'prj_mobile'
              : 'prj_hrms',
        teamId: spec.teamId,
        parentTaskId: null,
        title: spec.title,
        description: spec.description,
        status: spec.status,
        priority: spec.priority,
        assignedTo: spec.pocId,
        assignedBy: spec.mentorId,
        dueDate: spec.dueDate,
        estimatedHours: spec.subtasks.reduce((sum, item) => sum + item.hours, 0),
        actualHours: spec.subtasks.reduce((sum, item) => sum + item.actual, 0),
        progressPercent: 0,
        labelIds: [],
        createdAt: '2026-08-10T09:00:00.000Z',
        updatedAt: '2026-09-08T09:00:00.000Z',
      }),
    )
    for (const sub of spec.subtasks) {
      result.push(
        task({
          id: sub.id,
          projectId: spec.teamId.startsWith('team_an')
            ? 'prj_analytics'
            : spec.teamId.startsWith('team_pay')
              ? 'prj_payroll'
              : spec.teamId.startsWith('team_mob')
                ? 'prj_mobile'
                : 'prj_hrms',
          teamId: spec.teamId,
          parentTaskId: spec.id,
          title: sub.title,
          description: `${sub.title} as part of ${spec.title}.`,
          status: sub.status,
          priority: sub.priority,
          assignedTo: spec.pocId,
          doneByName: sub.doneByName,
          assignedBy: spec.pocId,
          dueDate: sub.dueDate,
          estimatedHours: sub.hours,
          actualHours: sub.actual,
          progressPercent: sub.progress,
          labelIds: sub.labels,
          createdAt: '2026-08-12T09:00:00.000Z',
          updatedAt: '2026-09-08T12:00:00.000Z',
          blockedReason: sub.blockedReason,
        }),
      )
    }
  }
  return result
}

function extraCompletedFill(): Task[] {
  const packs = [
    ['team_be', 'usr_suresh', 'usr_suresh', 'Ajay Menon'],
    ['team_be', 'usr_nikhil', 'usr_suresh', 'Rahul Sharma'],
    ['team_be', 'usr_nikhil', 'usr_suresh', 'Priya Nair'],
    ['team_fe', 'usr_ananya', 'usr_meera', 'Vikram Singh'],
    ['team_qa', 'usr_lakshmi', 'usr_ravi', 'Aditya Bose'],
    ['team_do', 'usr_ishita', 'usr_karthik', 'Gaurav Yadav'],
  ] as const
  const titles = [
    'Code review checklist',
    'Logging standards',
    'Error catalog',
    'Seed data cleanup',
    'Contract tests',
  ]
  const extra: Task[] = []
  let n = 300
  packs.forEach(([teamId, pocId, mentorId, doneByName], index) => {
    const parentId = `tsk_${n}`
    extra.push(
      task({
        id: parentId,
        numericId: n,
        projectId: 'prj_hrms',
        teamId,
        parentTaskId: null,
        title: `Foundation pack ${index + 1}`,
        description: 'Completed enabling work from earlier sprints.',
        status: TaskStatus.COMPLETED,
        priority: Priority.MEDIUM,
        assignedTo: pocId,
        assignedBy: mentorId,
        dueDate: '2026-08-20',
        estimatedHours: 40,
        actualHours: 38,
        progressPercent: 100,
        labelIds: ['lbl_docs'],
        createdAt: '2026-07-01T09:00:00.000Z',
        updatedAt: '2026-08-20T09:00:00.000Z',
      }),
    )
    n += 1
    titles.forEach((title, tIndex) => {
      extra.push(
        task({
          id: `tsk_${n}`,
          numericId: n,
          projectId: 'prj_hrms',
          teamId,
          parentTaskId: parentId,
          title: `${title} ${index + 1}`,
          description: title,
          status: TaskStatus.COMPLETED,
          priority: tIndex === 0 ? Priority.HIGH : Priority.LOW,
          assignedTo: pocId,
          doneByName,
          assignedBy: pocId,
          dueDate: '2026-08-18',
          estimatedHours: 8,
          actualHours: 7,
          progressPercent: 100,
          labelIds: ['lbl_docs'],
          createdAt: '2026-07-02T09:00:00.000Z',
          updatedAt: '2026-08-18T09:00:00.000Z',
        }),
      )
      n += 1
    })
  })
  return extra
}

export const tasks: Task[] = [...employeeModule, ...expandModules(modules), ...extraCompletedFill()]

export const comments: TaskComment[] = [
  {
    id: 'cmt_1',
    taskId: 'tsk_101',
    authorId: 'usr_nikhil',
    body: 'Please include duplicate email handling before submitting. @Rahul Sharma',
    mentions: [],
    createdAt: '2026-09-07T11:20:00.000Z',
  },
  {
    id: 'cmt_2',
    taskId: 'tsk_101',
    authorId: 'usr_nikhil',
    body: 'CRUD paths are in review locally. Pagination matches the employee directory contract.',
    mentions: [],
    createdAt: '2026-09-08T16:40:00.000Z',
  },
  {
    id: 'cmt_3',
    taskId: 'tsk_112',
    authorId: 'usr_nikhil',
    body: 'Blocked on vendor sandbox. Raised this with @Suresh Iyer and @Nikhil Dharani.',
    mentions: ['usr_suresh', 'usr_nikhil'],
    createdAt: '2026-09-07T09:10:00.000Z',
  },
]

export const attachments: TaskAttachment[] = [
  {
    id: 'att_1',
    taskId: 'tsk_101',
    fileName: 'employee-api-contract.yaml',
    fileSize: 18432,
    contentType: 'application/yaml',
    url: '/files/employee-api-contract.yaml',
    uploadedBy: 'usr_nikhil',
    uploadedAt: '2026-09-08T15:00:00.000Z',
  },
  {
    id: 'att_2',
    taskId: 'tsk_102',
    fileName: 'employee-er-diagram.png',
    fileSize: 245760,
    contentType: 'image/png',
    url: '/files/employee-er-diagram.png',
    uploadedBy: 'usr_nikhil',
    uploadedAt: '2026-09-06T12:00:00.000Z',
  },
]

export const reviews: TaskReview[] = [
  {
    id: 'rev_1',
    taskId: 'tsk_103',
    reviewerId: 'usr_nikhil',
    decision: 'APPROVE',
    comment: 'Validation coverage looks complete, including duplicate email.',
    createdAt: '2026-09-04T17:20:00.000Z',
  },
]

export const workLogs: WorkLog[] = [
  { id: 'wl_1', taskId: 'tsk_101', userId: 'usr_nikhil', date: '2026-09-08', hours: 6, description: 'Implemented update/delete endpoints and filter query params.' },
  { id: 'wl_2', taskId: 'tsk_101', userId: 'usr_nikhil', date: '2026-09-09', hours: 3, description: 'Wired pagination to match directory UI contract.' },
  { id: 'wl_3', taskId: 'tsk_104', userId: 'usr_nikhil', date: '2026-09-08', hours: 2, description: 'Added controller tests for create employee.' },
  { id: 'wl_4', taskId: 'tsk_102', userId: 'usr_nikhil', date: '2026-09-08', hours: 5, description: 'Indexes on email and manager_id; started reporting-line table.' },
]

