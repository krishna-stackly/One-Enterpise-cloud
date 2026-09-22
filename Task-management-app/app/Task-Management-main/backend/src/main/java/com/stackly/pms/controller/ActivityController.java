package com.stackly.pms.controller;

import com.stackly.pms.dto.ApiResponse;
import com.stackly.pms.entity.User;
import com.stackly.pms.exception.ApiException;
import com.stackly.pms.repository.ActivityLogRepository;
import com.stackly.pms.service.HierarchyService;
import java.time.Instant;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/activity")
@RequiredArgsConstructor
public class ActivityController {
    private final ActivityLogRepository activityLogRepository;
    private final HierarchyService hierarchyService;

    public record ActivityView(
            Long id, Long userId, String action, String entityType, Long entityId,
            Long projectId, String message, Instant createdAt) {}

    @GetMapping
    public ApiResponse<List<ActivityView>> list(
            @AuthenticationPrincipal User user, @RequestParam Long projectId) {
        hierarchyService.requireAssignment(user, projectId);
        var data = activityLogRepository.findTop20ByProjectIdOrderByCreatedAtDesc(projectId).stream()
                .map(item -> new ActivityView(
                        item.getId(),
                        item.getUser().getId(),
                        item.getAction(),
                        item.getEntityType(),
                        item.getEntityId(),
                        item.getProject().getId(),
                        item.getMessage(),
                        item.getCreatedAt()))
                .toList();
        return ApiResponse.ok("Activity loaded", data);
    }
}