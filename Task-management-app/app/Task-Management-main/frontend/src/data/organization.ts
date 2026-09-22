import {
  AssignmentType,
  ProjectStatus,
  type Project,
  type ProjectAssignment,
  type Team,
} from '@/types'

export const projects: Project[] = [
  {
    id: 'prj_hrms',
    name: 'HRMS',
    code: 'HRMS',
    description:
      'Human Resource Management System covering employee records, attendance, payroll handoff, and self-service.',
    status: ProjectStatus.ACTIVE,
    startDate: '2026-01-13',
    dueDate: '2026-12-18',
    createdAt: '2026-01-08T09:00:00.000Z',
  },
  {
    id: 'prj_analytics',
    name: 'Analytics Platform',
    code: 'ANLT',
    description: 'Cross-product analytics warehouse, metrics catalog, and executive dashboards.',
    status: ProjectStatus.ACTIVE,
    startDate: '2026-03-02',
    dueDate: '2026-11-30',
    createdAt: '2026-02-20T09:00:00.000Z',
  },
  {
    id: 'prj_payroll',
    name: 'Payroll System',
    code: 'PAY',
    description: 'Payroll calculation, statutory filings, and finance integrations.',
    status: ProjectStatus.ACTIVE,
    startDate: '2026-02-16',
    dueDate: '2026-10-30',
    createdAt: '2026-02-10T09:00:00.000Z',
  },
  {
    id: 'prj_mobile',
    name: 'Mobile App',
    code: 'MOBL',
    description: 'Employee mobile experience for leave, timesheets, and directory.',
    status: ProjectStatus.PLANNING,
    startDate: '2026-06-01',
    dueDate: '2027-01-29',
    createdAt: '2026-05-12T09:00:00.000Z',
  },
]

export const teams: Team[] = [
  { id: 'team_fe', projectId: 'prj_hrms', name: 'Frontend', description: 'Web client for HRMS modules' },
  { id: 'team_be', projectId: 'prj_hrms', name: 'Backend', description: 'HRMS services and APIs' },
  { id: 'team_qa', projectId: 'prj_hrms', name: 'QA', description: 'Quality and test automation' },
  { id: 'team_do', projectId: 'prj_hrms', name: 'DevOps', description: 'Delivery, environments, observability' },
  { id: 'team_an_data', projectId: 'prj_analytics', name: 'Data Platform', description: 'Ingestion and warehouse' },
  { id: 'team_an_bi', projectId: 'prj_analytics', name: 'BI', description: 'Dashboards and semantic layer' },
  { id: 'team_pay_core', projectId: 'prj_payroll', name: 'Payroll Core', description: 'Calculation engine' },
  { id: 'team_pay_int', projectId: 'prj_payroll', name: 'Integrations', description: 'Bank and finance connectors' },
  { id: 'team_mob_ios', projectId: 'prj_mobile', name: 'iOS', description: 'Native iOS client' },
  { id: 'team_mob_and', projectId: 'prj_mobile', name: 'Android', description: 'Native Android client' },
]

export const assignments: ProjectAssignment[] = [
  { id: 'as_1', userId: 'usr_arun', projectId: 'prj_hrms', assignmentType: AssignmentType.SCRUM_MASTER, teamId: null, pocId: null },
  { id: 'as_2', userId: 'usr_meera', projectId: 'prj_hrms', assignmentType: AssignmentType.MENTOR, teamId: 'team_fe', pocId: null },
  { id: 'as_3', userId: 'usr_ananya', projectId: 'prj_hrms', assignmentType: AssignmentType.POC, teamId: 'team_fe', pocId: null },
  { id: 'as_4', userId: 'usr_dev', projectId: 'prj_hrms', assignmentType: AssignmentType.POC, teamId: 'team_fe', pocId: null },

  { id: 'as_10', userId: 'usr_suresh', projectId: 'prj_hrms', assignmentType: AssignmentType.MENTOR, teamId: 'team_be', pocId: null },
  { id: 'as_11', userId: 'usr_nikhil', projectId: 'prj_hrms', assignmentType: AssignmentType.POC, teamId: 'team_be', pocId: null },
  { id: 'as_12', userId: 'usr_anil', projectId: 'prj_hrms', assignmentType: AssignmentType.POC, teamId: 'team_be', pocId: null },
  { id: 'as_13', userId: 'usr_rahul', projectId: 'prj_hrms', assignmentType: AssignmentType.ASSOCIATE, teamId: 'team_be', pocId: 'usr_nikhil' },
  { id: 'as_14', userId: 'usr_priya', projectId: 'prj_hrms', assignmentType: AssignmentType.ASSOCIATE, teamId: 'team_be', pocId: 'usr_nikhil' },
  { id: 'as_15', userId: 'usr_kiran', projectId: 'prj_hrms', assignmentType: AssignmentType.ASSOCIATE, teamId: 'team_be', pocId: 'usr_nikhil' },

  { id: 'as_20', userId: 'usr_ravi', projectId: 'prj_hrms', assignmentType: AssignmentType.MENTOR, teamId: 'team_qa', pocId: null },
  { id: 'as_21', userId: 'usr_lakshmi', projectId: 'prj_hrms', assignmentType: AssignmentType.POC, teamId: 'team_qa', pocId: null },
  { id: 'as_22', userId: 'usr_sanjay', projectId: 'prj_hrms', assignmentType: AssignmentType.POC, teamId: 'team_qa', pocId: null },

  { id: 'as_28', userId: 'usr_karthik', projectId: 'prj_hrms', assignmentType: AssignmentType.MENTOR, teamId: 'team_do', pocId: null },
  { id: 'as_29', userId: 'usr_ishita', projectId: 'prj_hrms', assignmentType: AssignmentType.POC, teamId: 'team_do', pocId: null },
  { id: 'as_30', userId: 'usr_vivek', projectId: 'prj_hrms', assignmentType: AssignmentType.POC, teamId: 'team_do', pocId: null },

  { id: 'as_36', userId: 'usr_nikhil', projectId: 'prj_analytics', assignmentType: AssignmentType.SCRUM_MASTER, teamId: null, pocId: null },
  { id: 'as_37', userId: 'usr_leela', projectId: 'prj_analytics', assignmentType: AssignmentType.MENTOR, teamId: 'team_an_data', pocId: null },
  { id: 'as_38', userId: 'usr_dev', projectId: 'prj_analytics', assignmentType: AssignmentType.POC, teamId: 'team_an_data', pocId: null },

  { id: 'as_40', userId: 'usr_nikhil', projectId: 'prj_payroll', assignmentType: AssignmentType.MENTOR, teamId: 'team_pay_int', pocId: null },
  { id: 'as_41', userId: 'usr_omar', projectId: 'prj_payroll', assignmentType: AssignmentType.SCRUM_MASTER, teamId: null, pocId: null },
  { id: 'as_42', userId: 'usr_anil', projectId: 'prj_payroll', assignmentType: AssignmentType.POC, teamId: 'team_pay_int', pocId: null },

  { id: 'as_44', userId: 'usr_fatima', projectId: 'prj_mobile', assignmentType: AssignmentType.POC, teamId: 'team_mob_and', pocId: null },
  { id: 'as_46', userId: 'usr_meera', projectId: 'prj_mobile', assignmentType: AssignmentType.SCRUM_MASTER, teamId: null, pocId: null },
  { id: 'as_47', userId: 'usr_samir', projectId: 'prj_mobile', assignmentType: AssignmentType.MENTOR, teamId: 'team_mob_and', pocId: null },
]

export const projectById = Object.fromEntries(projects.map((p) => [p.id, p])) as Record<string, Project>
export const teamById = Object.fromEntries(teams.map((t) => [t.id, t])) as Record<string, Team>

export function registerProject(project: Project) {
  projects.push(project)
  projectById[project.id] = project
  return project
}

export function registerTeam(team: Team) {
  teams.push(team)
  teamById[team.id] = team
  return team
}

export function registerAssignment(assignment: ProjectAssignment) {
  assignments.push(assignment)
  return assignment
}

/** Replaces the in-memory org data with real backend data (used in live API mode). */
export function setOrgData(input: { projects: Project[]; teams: Team[]; assignments: ProjectAssignment[] }) {
  projects.length = 0
  projects.push(...input.projects)
  teams.length = 0
  teams.push(...input.teams)
  assignments.length = 0
  assignments.push(...input.assignments)
  for (const key of Object.keys(projectById)) delete projectById[key]
  for (const key of Object.keys(teamById)) delete teamById[key]
  for (const project of input.projects) projectById[project.id] = project
  for (const team of input.teams) teamById[team.id] = team
}
