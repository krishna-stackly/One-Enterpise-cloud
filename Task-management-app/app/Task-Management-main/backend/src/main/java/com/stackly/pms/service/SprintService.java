package com.stackly.pms.service;

import com.stackly.pms.dto.SprintDtos;
import com.stackly.pms.entity.*;
import com.stackly.pms.exception.ApiException;
import com.stackly.pms.repository.ProjectRepository;
import com.stackly.pms.repository.SprintRepository;
import com.stackly.pms.repository.TeamRepository;
import com.stackly.pms.repository.TaskRepository;
import java.time.LocalDate;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class SprintService {
    private final SprintRepository sprintRepository;
    private final ProjectRepository projectRepository;
    private final TeamRepository teamRepository;
    private final HierarchyService hierarchyService;
    private final AuditService auditService;
    private final TaskRepository taskRepository;

    @Transactional
    public Sprint create(
            User actor, Long projectId, Long teamId, String name, String goal, LocalDate start, LocalDate end) {
        ProjectAssignment assignment = hierarchyService.requireAssignment(actor, projectId);
        if (assignment.getAssignmentType() != AssignmentType.SCRUM_MASTER) {
            throw ApiException.forbidden("Only a Scrum Master can create sprint plans");
        }
        if (end.isBefore(start)) {
            throw ApiException.badRequest("Sprint end date must be on or after the start date");
        }
        Project project =
                projectRepository.findById(projectId).orElseThrow(() -> ApiException.notFound("Project not found"));
        Team team = teamRepository.findById(teamId).orElseThrow(() -> ApiException.notFound("Team not found"));
        if (!team.getProject().getId().equals(projectId)) {
            throw ApiException.badRequest("Team does not belong to this project");
        }
        Sprint sprint = sprintRepository.save(Sprint.builder()
                .project(project)
                .team(team)
                .name(name.trim())
                .goal(goal == null || goal.isBlank() ? null : goal.trim())
                .startDate(start)
                .endDate(end)
                .status(SprintStatus.PLANNED)
                .createdBy(actor)
                .build());
        auditService.record(
                actor,
                project,
                "SPRINT_CREATED",
                "SPRINT",
                sprint.getId(),
                actor.getFirstName() + " created sprint plan " + sprint.getName() + " for " + team.getName() + ".");
        // Avoid re-fetch JOIN FETCH on a just-saved managed entity (Hibernate NPE on EntityEntry).
        // Associations used below are already loaded in this transaction.
        sprint.getTeam().getName();
        sprint.getProject().getId();
        sprint.getCreatedBy().getId();
        return sprint;
    }

    @Transactional(readOnly = true)
    public List<Sprint> list(User actor, Long projectId, Long teamId) {
        hierarchyService.requireAssignment(actor, projectId);
        if (teamId != null) {
            return sprintRepository.findDetailedByTeamId(teamId).stream()
                    .filter(item -> item.getProject().getId().equals(projectId))
                    .toList();
        }
        ProjectAssignment assignment = hierarchyService.currentAssignment(actor, projectId);
        if (assignment.getAssignmentType() == AssignmentType.MENTOR) {
            if (assignment.getTeam() == null) {
                throw ApiException.badRequest("Mentor assignment is missing a team");
            }
            return sprintRepository.findDetailedByTeamId(assignment.getTeam().getId());
        }
        return sprintRepository.findDetailedByProjectId(projectId);
    }

    @Transactional
    public Sprint updateStatus(User actor, Long sprintId, SprintStatus status) {
        Sprint sprint = get(sprintId);
        hierarchyService.requireAssignment(actor, sprint.getProject().getId());
        AssignmentType role =
                hierarchyService.currentAssignment(actor, sprint.getProject().getId()).getAssignmentType();
        if (role != AssignmentType.SCRUM_MASTER && role != AssignmentType.MENTOR) {
            throw ApiException.forbidden("Only Scrum Master or Mentor can update sprint status");
        }
        if (role == AssignmentType.MENTOR && !hierarchyService.isMentorOfTeam(actor, sprint.getTeam().getId())) {
            throw ApiException.forbidden("You can update only sprints for your team");
        }
        sprint.setStatus(status);
        return sprint;
    }

    @Transactional
    public Sprint edit(User actor, Long sprintId, SprintDtos.EditRequest request) {
        Sprint sprint = get(sprintId);
        ProjectAssignment assignment = hierarchyService.requireAssignment(actor, sprint.getProject().getId());
        if (assignment.getAssignmentType() != AssignmentType.SCRUM_MASTER) {
            throw ApiException.forbidden("Only a Scrum Master can edit sprint plans");
        }
        if (request.startDate().isAfter(request.endDate())) {
            throw ApiException.badRequest("Sprint end date must be on or after the start date");
        }
        Project project = sprint.getProject();
        if (!project.getId().equals(request.projectId())) {
            throw ApiException.badRequest("Sprint does not belong to this project");
        }
        Team team = teamRepository.findById(request.teamId())
                .orElseThrow(() -> ApiException.notFound("Team not found"));
        if (!team.getProject().getId().equals(request.projectId())) {
            throw ApiException.badRequest("Team does not belong to this project");
        }
        sprint.setTeam(team);
        sprint.setName(request.name().trim());
        sprint.setGoal(request.goal() == null || request.goal().isBlank() ? null : request.goal().trim());
        sprint.setStartDate(request.startDate());
        sprint.setEndDate(request.endDate());
        auditService.record(
                actor,
                project,
                "SPRINT_UPDATED",
                "SPRINT",
                sprint.getId(),
                actor.getFirstName() + " edited sprint plan " + sprint.getName() + " for " + team.getName() + ".");
        return sprint;
    }

    @Transactional
    public void delete(User actor, Long sprintId) {
        Sprint sprint = get(sprintId);
        hierarchyService.requireAssignment(actor, sprint.getProject().getId());
        AssignmentType role =
                hierarchyService.currentAssignment(actor, sprint.getProject().getId()).getAssignmentType();
        if (role != AssignmentType.SCRUM_MASTER) {
            throw ApiException.forbidden("Only a Scrum Master can delete sprint plans");
        }
        Project project = sprint.getProject();
        Team team = sprint.getTeam();
        // Unassign sprint from any tasks that reference it so the FK constraint is not violated.
        List<Task> tasks = taskRepository.findBySprintId(sprintId);
        for (Task task : tasks) {
            task.setSprint(null);
        }
        if (!tasks.isEmpty()) {
            taskRepository.saveAll(tasks);
        }
        sprintRepository.delete(sprint);
        auditService.record(
                actor,
                project,
                "SPRINT_DELETED",
                "SPRINT",
                sprintId,
                actor.getFirstName() + " deleted sprint plan " + sprint.getName() + " for " + team.getName() + ".");
    }

    @Transactional(readOnly = true)
    public Sprint get(Long id) {
        return sprintRepository.findDetailedById(id).orElseThrow(() -> ApiException.notFound("Sprint not found"));
    }
}
