/**
 * Single API entry for the UI. Live mode talks to Spring Boot + MySQL;
 * mock mode keeps the in-browser seed for offline demos.
 */
import { useMock } from '@/api/client'
import * as mockApi from '@/api/mock'
import * as realApi from '@/api/real'

const api = useMock ? mockApi : realApi

export const fetchTasks = api.fetchTasks
export const fetchScrumMasterDashboard = api.fetchScrumMasterDashboard
export const fetchMentorDashboard = api.fetchMentorDashboard
export const fetchPocDashboard = api.fetchPocDashboard
export const fetchTaskDetail = api.fetchTaskDetail
export const fetchStructure = api.fetchStructure
export const fetchNotifications = api.fetchNotifications
export const apiMarkRead = api.apiMarkRead
export const apiMarkAllRead = api.apiMarkAllRead
export const apiSubmitReview = api.apiSubmitReview
export const apiUploadAttachment = api.apiUploadAttachment
export const apiApprove = api.apiApprove
export const apiReject = api.apiReject
export const apiStatus = api.apiStatus
export const apiReassignTask = api.apiReassignTask
export const apiAssignToPoc = api.apiAssignToPoc
export const apiBreakDown = api.apiBreakDown
export const apiAddComment = api.apiAddComment
export const apiAddWorkLog = api.apiAddWorkLog
export const fetchUsers = api.fetchUsers
export const fetchLabels = api.fetchLabels
export const fetchProjects = api.fetchProjects
export const fetchProjectOverview = api.fetchProjectOverview
export const fetchTeams = api.fetchTeams
export const fetchAssignments = api.fetchAssignments
export const fetchComments = api.fetchComments
export const apiForgotPassword = api.apiForgotPassword
export const apiResetPassword = api.apiResetPassword
export const apiChangePassword = api.apiChangePassword
export const apiCreateProject = api.apiCreateProject
export const apiCreateEmployee = api.apiCreateEmployee
export const apiCreateTeam = api.apiCreateTeam
export const apiAssignMember = api.apiAssignMember
export const apiRemoveMember = api.apiRemoveMember
export const fetchQueries = api.fetchQueries
export const fetchQueryDetail = api.fetchQueryDetail
export const apiCreateQuery = api.apiCreateQuery
export const apiAssignQuery = api.apiAssignQuery
export const apiReplyQuery = api.apiReplyQuery
export const fetchSprints = api.fetchSprints
export const apiCreateSprint = api.apiCreateSprint
export const apiUpdateSprintStatus = api.apiUpdateSprintStatus
export const apiEditSprint = api.apiEditSprint
export const apiDeleteSprint = api.apiDeleteSprint

export { useMock, apiBaseUrl, wait } from '@/api/client'
export { hydrateWorkspace, apiLogin, apiLogout, fetchSession, n } from '@/api/real'
