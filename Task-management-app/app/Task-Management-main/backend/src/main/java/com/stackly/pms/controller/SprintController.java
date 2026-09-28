package com.stackly.pms.controller;

import com.stackly.pms.dto.ApiResponse;
import com.stackly.pms.dto.SprintDtos;
import com.stackly.pms.entity.Sprint;
import com.stackly.pms.entity.SprintStatus;
import com.stackly.pms.entity.User;
import com.stackly.pms.service.SprintService;
import jakarta.validation.Valid;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Locale;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/sprints")
@RequiredArgsConstructor
public class SprintController {
    private final SprintService sprintService;

    public record SprintView(
            Long id,
            Long projectId,
            Long teamId,
            String teamName,
            String name,
            String goal,
            LocalDate startDate,
            LocalDate endDate,
            String status,
            Long createdBy,
            Instant createdAt) {
        static SprintView from(Sprint sprint) {
            return new SprintView(
                    sprint.getId(),
                    sprint.getProject().getId(),
                    sprint.getTeam().getId(),
                    sprint.getTeam().getName(),
                    sprint.getName(),
                    sprint.getGoal(),
                    sprint.getStartDate(),
                    sprint.getEndDate(),
                    sprint.getStatus().name(),
                    sprint.getCreatedBy().getId(),
                    sprint.getCreatedAt());
        }
    }

    @GetMapping
    public ApiResponse<List<SprintView>> list(
            @AuthenticationPrincipal User user,
            @RequestParam Long projectId,
            @RequestParam(required = false) Long teamId) {
        return ApiResponse.ok(
                "Sprints loaded",
                sprintService.list(user, projectId, teamId).stream().map(SprintView::from).toList());
    }

    @PostMapping
    public ApiResponse<SprintView> create(
            @AuthenticationPrincipal User user, @Valid @RequestBody SprintDtos.CreateRequest request) {
        Sprint sprint = sprintService.create(
                user,
                request.projectId(),
                request.teamId(),
                request.name(),
                request.goal(),
                request.startDate(),
                request.endDate());
        return ApiResponse.ok("Sprint created", SprintView.from(sprint));
    }

    @PatchMapping("/{id}/status")
    public ApiResponse<SprintView> status(
            @AuthenticationPrincipal User user,
            @PathVariable Long id,
            @Valid @RequestBody SprintDtos.StatusRequest request) {
        SprintStatus status = SprintStatus.valueOf(request.status().trim().toUpperCase(Locale.ROOT));
        return ApiResponse.ok("Sprint updated", SprintView.from(sprintService.updateStatus(user, id, status)));
    }

    @PutMapping("/{id}")
    public ApiResponse<SprintView> edit(
            @AuthenticationPrincipal User user,
            @PathVariable Long id,
            @Valid @RequestBody SprintDtos.EditRequest request) {
        Sprint sprint = sprintService.edit(user, id, request);
        return ApiResponse.ok("Sprint updated", SprintView.from(sprint));
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> delete(@AuthenticationPrincipal User user, @PathVariable Long id) {
        sprintService.delete(user, id);
        return ApiResponse.ok("Sprint deleted", null);
    }
}
