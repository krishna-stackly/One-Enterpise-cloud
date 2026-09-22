package com.stackly.pms.controller;

import com.stackly.pms.dto.ApiResponse;
import com.stackly.pms.entity.ProjectAssignment;
import com.stackly.pms.entity.User;
import com.stackly.pms.repository.ProjectRepository;
import com.stackly.pms.service.HierarchyService;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Session bootstrap for the SPA: current user, their projects, and (optionally)
 * the role assignment for a specific project.
 */
@RestController
@RequiredArgsConstructor
public class SessionController {
    private static final List<String> RANK = List.of("SCRUM_MASTER", "MENTOR", "POC", "ASSOCIATE");

    private final HierarchyService hierarchyService;
    private final ProjectRepository projectRepository;

    public record SessionUser(Long id, String firstName, String lastName, String email, String title, String systemRole) {}
    public record SessionProject(Long id, String name, String code, String description, String status, String startDate, String dueDate) {}
    public record SessionAssignment(String assignmentType, Long teamId, Long pocId) {}

    @GetMapping("/api/session")
    public ApiResponse<Map<String, Object>> session(
            @AuthenticationPrincipal User user, @RequestParam(required = false) Long projectId) {
        List<ProjectAssignment> assignments = hierarchyService.assignmentsFor(user);
        List<Long> projectIds = assignments.stream().map(item -> item.getProject().getId()).distinct().toList();
        List<SessionProject> projects = projectRepository.findAllById(projectIds).stream()
                .map(p -> new SessionProject(
                        p.getId(), p.getName(), p.getCode(), p.getDescription(), p.getStatus().name(),
                        p.getStartDate() == null ? null : p.getStartDate().toString(),
                        p.getDueDate() == null ? null : p.getDueDate().toString()))
                .toList();

        SessionAssignment assignment = null;
        if (projectId != null) {
            ProjectAssignment current = assignments.stream()
                    .filter(item -> item.getProject().getId().equals(projectId))
                    .min(java.util.Comparator.comparingInt(item -> RANK.indexOf(item.getAssignmentType().name())))
                    .orElse(null);
            if (current != null) {
                assignment = new SessionAssignment(
                        current.getAssignmentType().name(),
                        current.getTeam() == null ? null : current.getTeam().getId(),
                        current.getPoc() == null ? null : current.getPoc().getId());
            }
        }

        Map<String, Object> data = new HashMap<>();
        data.put("user", new SessionUser(
                user.getId(), user.getFirstName(), user.getLastName(), user.getEmail(), user.getTitle(),
                user.getSystemRole() == null ? "USER" : user.getSystemRole().name()));
        data.put("projects", projects);
        data.put("assignment", assignment);
        return ApiResponse.ok("Session loaded", data);
    }
}