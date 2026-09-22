package com.stackly.pms.controller;

import com.stackly.pms.dto.ApiResponse;
import com.stackly.pms.entity.ProjectAssignment;
import com.stackly.pms.entity.AssignmentType;
import com.stackly.pms.entity.Project;
import com.stackly.pms.entity.Team;
import com.stackly.pms.entity.ProjectStatus;
import com.stackly.pms.entity.Task;
import com.stackly.pms.entity.TaskStatus;
import com.stackly.pms.entity.User;
import com.stackly.pms.exception.ApiException;
import com.stackly.pms.repository.ProjectAssignmentRepository;
import com.stackly.pms.repository.ProjectRepository;
import com.stackly.pms.repository.TaskRepository;
import com.stackly.pms.repository.TeamRepository;
import com.stackly.pms.repository.UserRepository;
import com.stackly.pms.service.HierarchyService;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

@RestController
@RequiredArgsConstructor
public class ProjectTeamController {
    private final ProjectRepository projectRepository;
    private final TeamRepository teamRepository;
    private final ProjectAssignmentRepository assignmentRepository;
    private final TaskRepository taskRepository;
    private final UserRepository userRepository;
    private final HierarchyService hierarchyService;

    public record ProjectView(Long id, String name, String code, String description, String status, String startDate, String dueDate) {}
    public record TeamView(Long id, Long projectId, String name, String description) {}
    public record MemberView(Long id, String firstName, String lastName, String email, String assignmentType) {}
    public record CreateTeamRequest(@NotBlank String name, String description, Long mentorId) {}
    public record CreateProjectRequest(@NotBlank String name, @NotBlank String code, String description, @NotNull LocalDate dueDate) {}

    @PostMapping("/api/projects")
    public ApiResponse<ProjectView> createProject(
            @AuthenticationPrincipal User user, @RequestBody CreateProjectRequest request) {
        hierarchyService.assertCanManageOrg(user);
        Project project = projectRepository.save(Project.builder()
                .name(request.name())
                .code(request.code().toUpperCase())
                .description(request.description())
                .status(ProjectStatus.PLANNING)
                .startDate(LocalDate.now())
                .dueDate(request.dueDate())
                .build());
        assignmentRepository.save(ProjectAssignment.builder()
                .user(user)
                .project(project)
                .assignmentType(AssignmentType.SCRUM_MASTER)
                .build());
        return ApiResponse.ok("Project created",
                new ProjectView(project.getId(), project.getName(), project.getCode(), project.getDescription(), project.getStatus().name(),
                        project.getStartDate() == null ? null : project.getStartDate().toString(),
                        project.getDueDate() == null ? null : project.getDueDate().toString()));
    }

    @GetMapping("/api/projects")
    public ApiResponse<List<ProjectView>> projects(@AuthenticationPrincipal User user) {
        var ids = hierarchyService.assignmentsFor(user).stream().map(item -> item.getProject().getId()).distinct().toList();
        var data = projectRepository.findAllById(ids).stream()
                .map(p -> new ProjectView(p.getId(), p.getName(), p.getCode(), p.getDescription(), p.getStatus().name(),
                        p.getStartDate() == null ? null : p.getStartDate().toString(),
                        p.getDueDate() == null ? null : p.getDueDate().toString()))
                .toList();
        return ApiResponse.ok("Projects loaded", data);
    }

    /**
     * Projects the user is assigned to, with the per-project roll-ups the UI shows on
     * each card (team count, Scrum Master name, progress). Returning these from the
     * backend keeps the projects list correct even though the client-side org cache is
     * hydrated for one project at a time.
     */
    public record ProjectOverviewRow(
            Long id, String name, String code, String description, String status,
            String startDate, String dueDate, long teamCount, String scrumMasterName, int progress) {}

    @GetMapping("/api/projects/overview")
    @Transactional(readOnly = true)
    public ApiResponse<List<ProjectOverviewRow>> projectOverview(@AuthenticationPrincipal User user) {
        List<ProjectAssignment> mine = hierarchyService.assignmentsFor(user);
        List<Long> ids = mine.stream().map(item -> item.getProject().getId()).distinct().toList();
        List<Project> projects = projectRepository.findAllById(ids);

        List<ProjectOverviewRow> rows = new ArrayList<>();
        for (Project project : projects) {
            List<Team> teams = teamRepository.findByProjectId(project.getId());
            List<Task> tasks = taskRepository.findByProjectId(project.getId());
            rows.add(new ProjectOverviewRow(
                    project.getId(),
                    project.getName(),
                    project.getCode(),
                    project.getDescription(),
                    project.getStatus().name(),
                    project.getStartDate() == null ? null : project.getStartDate().toString(),
                    project.getDueDate() == null ? null : project.getDueDate().toString(),
                    teams.size(),
                    scrumMasterName(project.getId()),
                    projectProgressPercent(teams, tasks)));
        }
        rows.sort(java.util.Comparator.comparing(ProjectOverviewRow::name, String.CASE_INSENSITIVE_ORDER));
        return ApiResponse.ok("Project overview loaded", rows);
    }

    private String scrumMasterName(Long projectId) {
        return assignmentRepository.findByProjectIdAndAssignmentType(projectId, AssignmentType.SCRUM_MASTER).stream()
                .findFirst()
                .map(item -> item.getUser().getFirstName() + " " + item.getUser().getLastName())
                .orElse(null);
    }

    /** Average of team progress across the project's teams (0 when there are no teams). */
    private int projectProgressPercent(List<Team> teams, List<Task> tasks) {
        if (teams.isEmpty()) return 0;
        int sum = 0;
        for (Team team : teams) sum += teamProgressPercent(team.getId(), tasks);
        return Math.round((float) sum / teams.size());
    }

    /** Average rolled-up progress over the team's parent tasks (0 when the team has none). */
    private int teamProgressPercent(Long teamId, List<Task> tasks) {
        List<Task> parents = tasks.stream()
                .filter(task -> task.getTeam() != null && teamId.equals(task.getTeam().getId())
                        && task.getParentTask() == null)
                .toList();
        if (parents.isEmpty()) return 0;
        int sum = 0;
        for (Task parent : parents) sum += computedProgressPercent(parent, tasks);
        return Math.round((float) sum / parents.size());
    }

    /** Parent tasks roll up the average of their subtasks; leaves use their own progress. */
    private int computedProgressPercent(Task task, List<Task> tasks) {
        List<Task> children = tasks.stream()
                .filter(child -> child.getParentTask() != null && task.getId().equals(child.getParentTask().getId()))
                .toList();
        if (children.isEmpty()) return leafProgressPercent(task);
        int sum = 0;
        for (Task child : children) sum += computedProgressPercent(child, tasks);
        return Math.round((float) sum / children.size());
    }

    /** Matches the UI's leaf rule: completed is 100, backlog/assigned cap at 15%. */
    private int leafProgressPercent(Task task) {
        TaskStatus status = task.getStatus();
        int percent = task.getProgressPercent() == null ? 0 : task.getProgressPercent();
        if (status == TaskStatus.COMPLETED) return 100;
        if (status == TaskStatus.BACKLOG || status == TaskStatus.ASSIGNED) return Math.min(percent, 15);
        return percent;
    }

    @GetMapping("/api/projects/{id}")
    public ApiResponse<ProjectView> project(@AuthenticationPrincipal User user, @PathVariable Long id) {
        hierarchyService.requireAssignment(user, id);
        Project p = projectRepository.findById(id).orElseThrow(() -> ApiException.notFound("Project not found"));
        return ApiResponse.ok("Project loaded", new ProjectView(p.getId(), p.getName(), p.getCode(), p.getDescription(), p.getStatus().name(),
                p.getStartDate() == null ? null : p.getStartDate().toString(),
                p.getDueDate() == null ? null : p.getDueDate().toString()));
    }

    @GetMapping("/api/projects/{projectId}/teams")
    public ApiResponse<List<TeamView>> teams(@AuthenticationPrincipal User user, @PathVariable Long projectId) {
        hierarchyService.requireAssignment(user, projectId);
        var data = teamRepository.findByProjectId(projectId).stream()
                .map(t -> new TeamView(t.getId(), projectId, t.getName(), t.getDescription()))
                .toList();
        return ApiResponse.ok("Teams loaded", data);
    }

    @PostMapping("/api/projects/{projectId}/teams")
    public ApiResponse<TeamView> createTeam(
            @AuthenticationPrincipal User user, @PathVariable Long projectId, @RequestBody CreateTeamRequest request) {
        var assignment = hierarchyService.requireAssignment(user, projectId);
        if (assignment.getAssignmentType() != AssignmentType.SCRUM_MASTER) {
            throw ApiException.forbidden("Only a Scrum Master can create teams");
        }
        Project project = projectRepository.findById(projectId).orElseThrow(() -> ApiException.notFound("Project not found"));
        Team team = teamRepository.save(Team.builder().project(project).name(request.name()).description(request.description()).build());
        if (request.mentorId() != null) {
            User mentor = userRepository.findById(request.mentorId()).orElseThrow(() -> ApiException.notFound("User not found"));
            assignmentRepository.save(ProjectAssignment.builder()
                    .user(mentor)
                    .project(project)
                    .assignmentType(AssignmentType.MENTOR)
                    .team(team)
                    .build());
        }
        return ApiResponse.ok("Team created", new TeamView(team.getId(), projectId, team.getName(), team.getDescription()));
    }

    @GetMapping("/api/teams/{id}")
    public ApiResponse<TeamView> team(@PathVariable Long id) {
        Team team = teamRepository.findById(id).orElseThrow(() -> ApiException.notFound("Team not found"));
        return ApiResponse.ok("Team loaded", new TeamView(team.getId(), team.getProject().getId(), team.getName(), team.getDescription()));
    }

    @GetMapping("/api/teams/{teamId}/mentors")
    public ApiResponse<List<MemberView>> mentors(@PathVariable Long teamId) {
        return ApiResponse.ok("Mentors loaded", members(teamId, AssignmentType.MENTOR));
    }

    @GetMapping("/api/teams/{teamId}/pocs")
    public ApiResponse<List<MemberView>> pocs(@PathVariable Long teamId) {
        return ApiResponse.ok("POCs loaded", members(teamId, AssignmentType.POC));
    }

    @GetMapping("/api/teams/{teamId}/associates")
    public ApiResponse<List<MemberView>> associates(@PathVariable Long teamId) {
        return ApiResponse.ok("Associates loaded", members(teamId, AssignmentType.ASSOCIATE));
    }

    @GetMapping("/api/pocs/{pocId}/associates")
    public ApiResponse<List<MemberView>> pocAssociates(
            @AuthenticationPrincipal User user, @PathVariable Long pocId, @RequestParam Long projectId) {
        hierarchyService.requireAssignment(user, projectId);
        var data = assignmentRepository
                .findByProjectIdAndPocIdAndAssignmentType(projectId, pocId, AssignmentType.ASSOCIATE)
                .stream()
                .map(item -> new MemberView(
                        item.getUser().getId(),
                        item.getUser().getFirstName(),
                        item.getUser().getLastName(),
                        item.getUser().getEmail(),
                        item.getAssignmentType().name()))
                .toList();
        return ApiResponse.ok("Associates loaded", data);
    }

    @PostMapping("/api/teams/{teamId}/mentors")
    public ApiResponse<MemberView> addMentor(
            @AuthenticationPrincipal User user, @PathVariable Long teamId, @RequestBody Map<String, Long> body) {
        return addAssignment(user, teamId, body.get("userId"), AssignmentType.MENTOR);
    }

    @PostMapping("/api/teams/{teamId}/pocs")
    public ApiResponse<MemberView> addPoc(
            @AuthenticationPrincipal User user, @PathVariable Long teamId, @RequestBody Map<String, Long> body) {
        Team team = teamRepository.findById(teamId).orElseThrow(() -> ApiException.notFound("Team not found"));
        var actorAssignment = hierarchyService.requireAssignment(user, team.getProject().getId());
        boolean mentorOfTeam = actorAssignment.getAssignmentType() == AssignmentType.MENTOR
                && hierarchyService.isMentorOfTeam(user, teamId);
        if (actorAssignment.getAssignmentType() != AssignmentType.SCRUM_MASTER && !mentorOfTeam) {
            throw ApiException.forbidden("Only a Scrum Master or Mentor can assign a POC");
        }
        User target = userRepository.findById(body.get("userId")).orElseThrow(() -> ApiException.notFound("User not found"));
        assignmentRepository.save(ProjectAssignment.builder()
                .user(target)
                .project(team.getProject())
                .assignmentType(AssignmentType.POC)
                .team(team)
                .build());
        return ApiResponse.ok(
                "POC assigned",
                new MemberView(target.getId(), target.getFirstName(), target.getLastName(), target.getEmail(), AssignmentType.POC.name()));
    }

    @PostMapping("/api/teams/{teamId}/associates")
    public ApiResponse<MemberView> addAssociate(
            @AuthenticationPrincipal User user, @PathVariable Long teamId, @RequestBody Map<String, Long> body) {
        Team team = teamRepository.findById(teamId).orElseThrow(() -> ApiException.notFound("Team not found"));
        Long projectId = team.getProject().getId();
        hierarchyService.assertCanAddPeople(user, projectId);
        hierarchyService.assertRoleAssignmentAllowed(user, projectId, AssignmentType.ASSOCIATE, teamId);
        Long pocId = body.get("pocId");
        if (pocId == null) {
            pocId = user.getId();
        }
        hierarchyService.assertAssociatePoc(user, projectId, teamId, pocId);
        User target = userRepository.findById(body.get("userId")).orElseThrow(() -> ApiException.notFound("User not found"));
        User poc = userRepository.findById(pocId).orElseThrow(() -> ApiException.notFound("POC not found"));
        assignmentRepository.save(ProjectAssignment.builder()
                .user(target)
                .project(team.getProject())
                .assignmentType(AssignmentType.ASSOCIATE)
                .team(team)
                .poc(poc)
                .build());
        return ApiResponse.ok(
                "Associate assigned (no app login)",
                new MemberView(target.getId(), target.getFirstName(), target.getLastName(), target.getEmail(), AssignmentType.ASSOCIATE.name()));
    }

    private ApiResponse<MemberView> addAssignment(User actor, Long teamId, Long userId, AssignmentType type) {
        Team team = teamRepository.findById(teamId).orElseThrow(() -> ApiException.notFound("Team not found"));
        var actorAssignment = hierarchyService.requireAssignment(actor, team.getProject().getId());
        if (actorAssignment.getAssignmentType() != AssignmentType.SCRUM_MASTER) {
            throw ApiException.forbidden("Only a Scrum Master can assign Mentors and POCs");
        }
        User target = userRepository.findById(userId).orElseThrow(() -> ApiException.notFound("User not found"));
        assignmentRepository.save(ProjectAssignment.builder()
                .user(target)
                .project(team.getProject())
                .assignmentType(type)
                .team(team)
                .build());
        return ApiResponse.ok(
                type.name() + " assigned",
                new MemberView(target.getId(), target.getFirstName(), target.getLastName(), target.getEmail(), type.name()));
    }

    public record AssignmentRowView(Long id, Long userId, Long projectId, String assignmentType, Long teamId, Long pocId) {}

    @GetMapping("/api/projects/{projectId}/assignments")
    @Transactional(readOnly = true)
    public ApiResponse<List<AssignmentRowView>> assignments(
            @AuthenticationPrincipal User user, @PathVariable Long projectId) {
        hierarchyService.requireAssignment(user, projectId);
        var data = assignmentRepository.findByProjectId(projectId).stream()
                .map(item -> new AssignmentRowView(
                        item.getId(),
                        item.getUser().getId(),
                        item.getProject().getId(),
                        item.getAssignmentType().name(),
                        item.getTeam() == null ? null : item.getTeam().getId(),
                        item.getPoc() == null ? null : item.getPoc().getId()))
                .toList();
        return ApiResponse.ok("Assignments loaded", data);
    }

    /**
     * Removes a person from the project (deletes their project assignment).
     * Does not delete the user account. Incomplete tasks assigned to removed
     * people are unassigned so work is not silently orphaned on a departed member.
     */
    @DeleteMapping("/api/projects/{projectId}/members/{userId}")
    @Transactional
    public ApiResponse<Map<String, Object>> removeMember(
            @AuthenticationPrincipal User actor,
            @PathVariable Long projectId,
            @PathVariable Long userId) {
        hierarchyService.assertCanRemovePeople(actor, projectId);
        List<ProjectAssignment> targets = assignmentRepository.findByUserIdAndProjectId(userId, projectId);
        if (targets.isEmpty()) {
            throw ApiException.notFound("This person is not assigned to this project");
        }
        for (ProjectAssignment target : targets) {
            hierarchyService.assertCanRemoveAssignment(actor, projectId, target);
        }

        Set<Long> removeUserIds = new HashSet<>();
        removeUserIds.add(userId);
        List<ProjectAssignment> toDelete = new ArrayList<>(targets);

        for (ProjectAssignment target : targets) {
            if (target.getAssignmentType() == AssignmentType.POC
                    || target.getAssignmentType() == AssignmentType.MENTOR) {
                List<ProjectAssignment> associates = assignmentRepository.findByProjectIdAndPocIdAndAssignmentType(
                        projectId, userId, AssignmentType.ASSOCIATE);
                for (ProjectAssignment associate : associates) {
                    removeUserIds.add(associate.getUser().getId());
                    toDelete.add(associate);
                }
            }
        }

        List<Task> openTasks = taskRepository.findByAssignedToIdInAndProjectId(removeUserIds, projectId).stream()
                .filter(task -> task.getStatus() != TaskStatus.COMPLETED)
                .toList();
        for (Task task : openTasks) {
            task.setAssignedTo(null);
        }
        taskRepository.saveAll(openTasks);
        assignmentRepository.deleteAll(toDelete);

        return ApiResponse.ok(
                "Person removed from project",
                Map.of(
                        "removedUserIds", removeUserIds,
                        "unassignedTasks", openTasks.size(),
                        "removedAssignments", toDelete.size()));
    }

    @GetMapping("/api/dashboard/{role}")
    public ApiResponse<Map<String, Object>> dashboard(@AuthenticationPrincipal User user, @PathVariable String role, @RequestParam Long projectId) {
        hierarchyService.requireAssignment(user, projectId);
        return ApiResponse.ok("Dashboard loaded", Map.of(
                "role", role,
                "projectId", projectId,
                "userId", user.getId(),
                "message", "Use task and team endpoints for detailed metrics; progress is computed from child tasks."));
    }

    @GetMapping("/api/reports/{type}")
    public ApiResponse<Map<String, Object>> reports(@AuthenticationPrincipal User user, @PathVariable String type, @RequestParam Long projectId) {
        hierarchyService.requireAssignment(user, projectId);
        return ApiResponse.ok("Report loaded", Map.of("type", type, "projectId", projectId));
    }

    private List<MemberView> members(Long teamId, AssignmentType type) {
        return assignmentRepository.findByTeamIdAndAssignmentType(teamId, type).stream()
                .map(item -> new MemberView(
                        item.getUser().getId(),
                        item.getUser().getFirstName(),
                        item.getUser().getLastName(),
                        item.getUser().getEmail(),
                        item.getAssignmentType().name()))
                .toList();
    }
}
