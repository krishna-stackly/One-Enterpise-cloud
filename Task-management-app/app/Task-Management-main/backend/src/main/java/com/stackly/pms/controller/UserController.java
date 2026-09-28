package com.stackly.pms.controller;

import com.stackly.pms.dto.ApiResponse;
import com.stackly.pms.entity.AssignmentType;
import com.stackly.pms.entity.ProjectAssignment;
import com.stackly.pms.entity.SystemRole;
import com.stackly.pms.entity.Team;
import com.stackly.pms.entity.User;
import com.stackly.pms.exception.ApiException;
import com.stackly.pms.repository.ProjectAssignmentRepository;
import com.stackly.pms.repository.TeamRepository;
import com.stackly.pms.repository.UserRepository;
import com.stackly.pms.service.HierarchyService;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/users")
@RequiredArgsConstructor
public class UserController {
    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final HierarchyService hierarchyService;
    private final TeamRepository teamRepository;
    private final ProjectAssignmentRepository assignmentRepository;

    public record UserView(Long id, String firstName, String lastName, String email, String title, String systemRole) {}
    public record CreateUserRequest(
            @NotBlank String firstName,
            @NotBlank String lastName,
            @Email @NotBlank String email,
            String title,
            String password,
            @NotNull Long projectId,
            @NotNull AssignmentType assignmentType,
            @NotNull Long teamId,
            Long pocId) {}

    @GetMapping
    public ApiResponse<List<UserView>> list(@AuthenticationPrincipal User actor) {
        hierarchyService.assignmentsFor(actor);
        var data = userRepository.findAll().stream()
                .map(user -> new UserView(user.getId(), user.getFirstName(), user.getLastName(), user.getEmail(), user.getTitle(),
                        user.getSystemRole() == null ? "USER" : user.getSystemRole().name()))
                .toList();
        return ApiResponse.ok("People loaded", data);
    }

    @PostMapping
    public ApiResponse<UserView> create(@AuthenticationPrincipal User actor, @RequestBody CreateUserRequest request) {
        hierarchyService.assertCanAddPeople(actor, request.projectId());
        hierarchyService.assertRoleAssignmentAllowed(actor, request.projectId(), request.assignmentType(), request.teamId());
        if (request.assignmentType() != AssignmentType.MENTOR
                && request.assignmentType() != AssignmentType.POC
                && request.assignmentType() != AssignmentType.ASSOCIATE) {
            throw ApiException.badRequest("Assign Mentor, POC, or Associate when adding a person");
        }
        Team team = teamRepository.findById(request.teamId()).orElseThrow(() -> ApiException.notFound("Team not found"));
        if (!team.getProject().getId().equals(request.projectId())) {
            throw ApiException.badRequest("Team does not belong to this project");
        }

        Long pocId = request.pocId();
        if (request.assignmentType() == AssignmentType.ASSOCIATE) {
            if (pocId == null) {
                ProjectAssignment actorAssignment = hierarchyService.currentAssignment(actor, request.projectId());
                if (actorAssignment.getAssignmentType() == AssignmentType.POC
                        || actorAssignment.getAssignmentType() == AssignmentType.MENTOR) {
                    pocId = actor.getId();
                }
            }
            hierarchyService.assertAssociatePoc(actor, request.projectId(), request.teamId(), pocId);
        } else if (request.assignmentType() != AssignmentType.MENTOR && request.assignmentType() != AssignmentType.POC) {
            throw ApiException.badRequest("Assign Mentor, POC, or Associate when adding a person");
        } else if (request.password() == null || request.password().isBlank()) {
            throw ApiException.badRequest("Password is required for Mentor and POC");
        }

        String email = request.email().trim().toLowerCase();
        User existing = userRepository.findByEmailIgnoreCase(email).orElse(null);
        User user;
        if (existing != null) {
            if (!assignmentRepository.findByUserIdAndProjectId(existing.getId(), request.projectId()).isEmpty()) {
                throw ApiException.badRequest("This person is already a member of this project");
            }
            if (!existing.isEnabled()) {
                existing.setEnabled(true);
                userRepository.save(existing);
            }
            user = existing;
        } else {
            boolean associate = request.assignmentType() == AssignmentType.ASSOCIATE;
            String rawPassword = associate || request.password() == null || request.password().isBlank()
                    ? UUID.randomUUID().toString()
                    : request.password();
            user = userRepository.save(User.builder()
                    .firstName(request.firstName())
                    .lastName(request.lastName())
                    .email(email)
                    .title(request.title() == null || request.title().isBlank()
                            ? request.assignmentType().name()
                            : request.title())
                    .passwordHash(passwordEncoder.encode(rawPassword))
                    .systemRole(SystemRole.USER)
                    .avatarHue((int) (Math.random() * 360))
                    .enabled(true)
                    .build());
        }

        User poc = pocId == null ? null : userRepository.findById(pocId).orElse(null);
        assignmentRepository.save(ProjectAssignment.builder()
                .user(user)
                .project(team.getProject())
                .assignmentType(request.assignmentType())
                .team(team)
                .poc(request.assignmentType() == AssignmentType.ASSOCIATE ? poc : null)
                .build());
        String message = existing != null ? "Person re-added and assigned" : "Person added and assigned";
        if (request.assignmentType() == AssignmentType.ASSOCIATE) {
            message = existing != null
                    ? "Associate re-added (no app login)"
                    : "Associate added (no app login or dashboard)";
        }
        return ApiResponse.ok(
                message,
                new UserView(user.getId(), user.getFirstName(), user.getLastName(), user.getEmail(), user.getTitle(),
                        user.getSystemRole() == null ? "USER" : user.getSystemRole().name()));
    }
}
