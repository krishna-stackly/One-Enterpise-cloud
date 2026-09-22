import { describe, expect, it } from 'vitest'
import { assignmentForUserProject, getUser, roleWithTeamLabel, teamRosterBreakdown, workAssigneesForLead } from '@/data/selectors'
import { AssignmentType, Priority, TaskStatus, type Task } from '@/types'
import { allowedStatusMoves, canAssignMentorToPoc, canAssignPocOwnsWork } from '@/data/store'

const baseTask = (overrides: Partial<Task> = {}): Task => ({
  id: 'tsk_x',
  numericId: 1,
  projectId: 'prj_hrms',
  teamId: 'team_be',
  parentTaskId: null,
  title: 'Sample',
  description: '',
  status: TaskStatus.ASSIGNED,
  priority: Priority.MEDIUM,
  assignedTo: 'usr_nikhil',
  assignedBy: 'usr_suresh',
  dueDate: '2026-09-20',
  estimatedHours: 8,
  actualHours: 0,
  progressPercent: 0,
  labelIds: [],
  createdAt: '2026-09-01T00:00:00.000Z',
  updatedAt: '2026-09-01T00:00:00.000Z',
  ...overrides,
})

describe('workflow permissions', () => {
  it('shows team plus role in the header caption', () => {
    expect(roleWithTeamLabel(assignmentForUserProject('usr_nikhil', 'prj_hrms'))).toBe('Backend POC')
    expect(roleWithTeamLabel(assignmentForUserProject('usr_suresh', 'prj_hrms'))).toBe('Backend Mentor')
    expect(roleWithTeamLabel(assignmentForUserProject('usr_rahul', 'prj_hrms'))).toBe('Backend Associate')
    expect(roleWithTeamLabel(assignmentForUserProject('usr_arun', 'prj_hrms'))).toBe('Scrum Master')
  })

  it('counts unique members on a team', () => {
    const roster = teamRosterBreakdown('team_be')
    expect(roster.size).toBeGreaterThanOrEqual(5)
    expect(roster.pocs).toBeGreaterThanOrEqual(2)
    expect(roster.associates).toBeGreaterThanOrEqual(3)
  })
  it('lets a Mentor assign only POCs on their team (or themselves)', () => {
    expect(canAssignMentorToPoc('usr_suresh', 'usr_nikhil', 'team_be')).toBe(true)
    expect(canAssignMentorToPoc('usr_suresh', 'usr_suresh', 'team_be')).toBe(true)
    expect(canAssignMentorToPoc('usr_suresh', 'usr_meera', 'team_be')).toBe(false)
  })

  it('lets a Mentor start work with team POCs, not another POC’s associates', () => {
    const mentor = getUser('usr_suresh')!
    const people = workAssigneesForLead(mentor, 'prj_hrms', 'team_be', AssignmentType.MENTOR)
    expect(people.map((item) => item.user.id)).toEqual(
      expect.arrayContaining(['usr_suresh', 'usr_nikhil', 'usr_anil']),
    )
    expect(people.map((item) => item.user.id)).not.toContain('usr_rahul')
  })

  it('lets a POC start work with themselves and their own associates only', () => {
    const poc = getUser('usr_nikhil')!
    const people = workAssigneesForLead(poc, 'prj_hrms', 'team_be', AssignmentType.POC)
    expect(people.map((item) => item.user.id)).toEqual(
      expect.arrayContaining(['usr_nikhil', 'usr_rahul']),
    )
    expect(people.map((item) => item.user.id)).not.toContain('usr_anil')
  })

  it('lets a POC assign subtasks to their own associates', () => {
    expect(canAssignPocOwnsWork('usr_nikhil', 'usr_nikhil')).toBe(true)
    expect(canAssignPocOwnsWork('usr_nikhil', 'usr_rahul', 'prj_hrms')).toBe(true)
    expect(canAssignPocOwnsWork('usr_nikhil', 'usr_anil', 'prj_hrms')).toBe(false)
  })

  it('lets a POC move assigned work into progress, blocked, or review', () => {
    const assigned = baseTask({ status: TaskStatus.ASSIGNED, assignedTo: 'usr_nikhil', parentTaskId: 'tsk_100' })
    expect(allowedStatusMoves(AssignmentType.POC, assigned, 'usr_nikhil')).toEqual([TaskStatus.IN_PROGRESS])
    const inProgress = baseTask({ status: TaskStatus.IN_PROGRESS, assignedTo: 'usr_nikhil', parentTaskId: 'tsk_100' })
    expect(allowedStatusMoves(AssignmentType.POC, inProgress, 'usr_nikhil')).toEqual([
      TaskStatus.BLOCKED,
      TaskStatus.IN_REVIEW,
    ])
  })

  it('lets a POC review associate work, not their own', () => {
    const associateWork = baseTask({
      status: TaskStatus.IN_REVIEW,
      assignedTo: 'usr_rahul',
      parentTaskId: 'tsk_100',
    })
    expect(allowedStatusMoves(AssignmentType.POC, associateWork, 'usr_nikhil')).toEqual([
      TaskStatus.COMPLETED,
      TaskStatus.REOPENED,
    ])
    const ownWork = baseTask({ status: TaskStatus.IN_REVIEW, assignedTo: 'usr_nikhil', parentTaskId: 'tsk_100' })
    expect(allowedStatusMoves(AssignmentType.POC, ownWork, 'usr_nikhil')).toEqual([])
  })

  it('lets a Mentor review POC work and their own submissions', () => {
    const pocWork = baseTask({ status: TaskStatus.IN_REVIEW, assignedTo: 'usr_nikhil', parentTaskId: 'tsk_100' })
    expect(allowedStatusMoves(AssignmentType.MENTOR, pocWork, 'usr_suresh')).toEqual([
      TaskStatus.COMPLETED,
      TaskStatus.REOPENED,
    ])
    const ownWork = baseTask({ status: TaskStatus.IN_REVIEW, assignedTo: 'usr_suresh', parentTaskId: null })
    expect(allowedStatusMoves(AssignmentType.MENTOR, ownWork, 'usr_suresh')).toEqual([
      TaskStatus.COMPLETED,
      TaskStatus.REOPENED,
    ])
  })

  it('does not let a Scrum Master review', () => {
    const inReview = baseTask({ status: TaskStatus.IN_REVIEW, assignedTo: 'usr_nikhil', parentTaskId: 'tsk_100' })
    expect(allowedStatusMoves(AssignmentType.SCRUM_MASTER, inReview, 'usr_arun')).toEqual([])
  })
})
