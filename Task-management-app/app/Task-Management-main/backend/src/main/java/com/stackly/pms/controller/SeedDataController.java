package com.stackly.pms.controller;

import com.stackly.pms.dto.ApiResponse;
import com.stackly.pms.entity.AssignmentType;
import com.stackly.pms.entity.Project;
import com.stackly.pms.entity.ProjectAssignment;
import com.stackly.pms.entity.ProjectStatus;
import com.stackly.pms.entity.SystemRole;
import com.stackly.pms.entity.User;
import com.stackly.pms.repository.ProjectAssignmentRepository;
import com.stackly.pms.repository.ProjectRepository;
import com.stackly.pms.repository.UserRepository;
import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/seed")
@RequiredArgsConstructor
public class SeedDataController {
    private static final String SM_EMAIL = "aerrapothuapurwa@thestackly.com";
    private static final String SM_PASSWORD = "Password@123";
    private static final String DEFAULT_PROJECT_NAME = "OneEnterprise Cloud Platform (Java Enterprise Suite)";
    private static final String DEFAULT_PROJECT_CODE = "OECP";

    private final UserRepository userRepository;
    private final ProjectRepository projectRepository;
    private final ProjectAssignmentRepository assignmentRepository;
    private final PasswordEncoder passwordEncoder;

    /**
     * One-time bootstrap, safe to call repeatedly.
     *
     * Creates the Scrum Master (if missing) and makes sure they are assigned to at
     * least one project as SCRUM_MASTER. The assignment is required: login and every
     * project-scoped endpoint call {@code hierarchyService.requireAssignment}, so a
     * user with no project cannot sign in or create anything.
     *
     * Creates only:
     *   - User: Aerrapothu Apurwa / aerrapothuapurwa@thestackly.com / Password@123 / ADMIN
     *   - Project: "OneEnterprise Cloud Platform (Java Enterprise Suite)" (OECP)
     *   - ProjectAssignment: that user as SCRUM_MASTER on that project
     *
     * No teams, tasks, sprints, or other users are created - those come from the UI.
     */
    @PostMapping("/first-run")
    @Transactional
    public ApiResponse<Map<String, Object>> seedFirstRun() {
        Map<String, Object> data = new LinkedHashMap<>();
        boolean createdUser = false;
        boolean createdProject = false;

        User scrumMaster = userRepository.findByEmailIgnoreCase(SM_EMAIL).orElse(null);
        if (scrumMaster == null) {
            scrumMaster = userRepository.save(User.builder()
                    .firstName("Aerrapothu")
                    .lastName("Apurwa")
                    .email(SM_EMAIL)
                    .passwordHash(passwordEncoder.encode(SM_PASSWORD))
                    .title("Scrum Master")
                    .systemRole(SystemRole.ADMIN)
                    .avatarHue(200)
                    .enabled(true)
                    .build());
            createdUser = true;
        }

        Project project;
        List<ProjectAssignment> existing = assignmentRepository.findByUserId(scrumMaster.getId());
        if (existing.isEmpty()) {
            project = projectRepository.save(Project.builder()
                    .name(DEFAULT_PROJECT_NAME)
                    .code(DEFAULT_PROJECT_CODE)
                    .description("OneEnterprise Cloud Platform - Java Enterprise Suite delivery workspace")
                    .status(ProjectStatus.PLANNING)
                    .startDate(LocalDate.now())
                    .dueDate(LocalDate.now().plusMonths(3))
                    .build());
            assignmentRepository.save(ProjectAssignment.builder()
                    .user(scrumMaster)
                    .project(project)
                    .assignmentType(AssignmentType.SCRUM_MASTER)
                    .build());
            createdProject = true;
        } else {
            project = existing.getFirst().getProject();
        }

        data.put("userId", scrumMaster.getId());
        data.put("email", scrumMaster.getEmail());
        data.put("password", SM_PASSWORD);
        data.put("projectId", project.getId());
        data.put("projectCode", project.getCode());
        data.put("createdUser", createdUser);
        data.put("createdProject", createdProject);

        String message = createdUser || createdProject
                ? "Scrum Master ready"
                : "Already seeded";
        return ApiResponse.ok(message, data);
    }
}