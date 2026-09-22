package com.stackly.pms.controller;

import com.stackly.pms.dto.ApiResponse;
import com.stackly.pms.dto.TaskDtos;
import com.stackly.pms.dto.TaskDtos.TaskResponse;
import com.stackly.pms.entity.User;
import com.stackly.pms.repository.TaskCommentRepository;
import com.stackly.pms.repository.TaskReviewRepository;
import com.stackly.pms.repository.TaskWorkLogRepository;
import com.stackly.pms.service.TaskService;
import jakarta.validation.Valid;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/tasks")
@RequiredArgsConstructor
public class TaskController {
    private final TaskService taskService;
    private final TaskCommentRepository commentRepository;
    private final TaskReviewRepository reviewRepository;
    private final TaskWorkLogRepository workLogRepository;

    public record CommentView(Long id, Long taskId, Long authorId, String body, Instant createdAt) {}
    public record ReviewView(Long id, Long taskId, Long reviewerId, String decision, String comment, Instant createdAt) {}
    public record WorkLogView(Long id, Long taskId, Long userId, LocalDate date, BigDecimal hours, String description) {}

    @GetMapping
    public ApiResponse<List<TaskResponse>> list(
            @AuthenticationPrincipal User user, @RequestParam Long projectId) {
        return ApiResponse.ok(
                "Tasks loaded",
                taskService.visible(user, projectId).stream()
                        .map(task -> TaskResponse.from(task, taskService.computedProgress(task)))
                        .toList());
    }

    @PostMapping
    public ApiResponse<TaskResponse> create(@AuthenticationPrincipal User user, @Valid @RequestBody TaskDtos.CreateParentRequest request) {
        var task = taskService.assignToPoc(
                user, request.projectId(), request.teamId(), request.pocId(), request.title(), request.description(),
                request.priority(), request.dueDate(), request.sprintId());
        return ApiResponse.ok("Task created successfully", TaskResponse.from(task, 0));
    }

    @GetMapping("/{id}")
    public ApiResponse<TaskResponse> get(@PathVariable Long id) {
        var task = taskService.get(id);
        return ApiResponse.ok("Task loaded", TaskResponse.from(task, taskService.computedProgress(task)));
    }

    @PostMapping("/{id}/subtasks")
    public ApiResponse<List<TaskResponse>> subtasks(
            @AuthenticationPrincipal User user,
            @PathVariable Long id,
            @Valid @RequestBody TaskDtos.SubtaskBatchRequest request) {
        var created = request.subtasks().stream()
                .map(item -> taskService.createSubtask(
                        user, id, item.title(), item.description(), item.priority(), item.dueDate(),
                        item.estimatedHours(), item.doneByName(), item.associateId()))
                .map(task -> TaskResponse.from(task, 0))
                .toList();
        return ApiResponse.ok("Subtasks created", created);
    }

    @PatchMapping("/{id}/status")
    public ApiResponse<TaskResponse> status(
            @AuthenticationPrincipal User user, @PathVariable Long id, @Valid @RequestBody TaskDtos.StatusRequest request) {
        var task = taskService.changeStatus(user, id, request.status(), null, request.doneByName());
        return ApiResponse.ok("Status updated", TaskResponse.from(task, taskService.computedProgress(task)));
    }

    @PostMapping("/{id}/submit-review")
    public ApiResponse<TaskResponse> submit(@AuthenticationPrincipal User user, @PathVariable Long id) {
        var task = taskService.submitForReview(user, id);
        return ApiResponse.ok("Submitted for review", TaskResponse.from(task, taskService.computedProgress(task)));
    }

    @PostMapping("/{id}/approve")
    public ApiResponse<TaskResponse> approve(
            @AuthenticationPrincipal User user, @PathVariable Long id, @RequestBody(required = false) TaskDtos.ReviewRequest request) {
        var task = taskService.approve(user, id, request == null ? "Approved" : request.comment());
        return ApiResponse.ok("Task approved", TaskResponse.from(task, 100));
    }

    @PostMapping("/{id}/reject")
    public ApiResponse<TaskResponse> reject(
            @AuthenticationPrincipal User user, @PathVariable Long id, @Valid @RequestBody TaskDtos.ReviewRequest request) {
        var task = taskService.reject(user, id, request.comment());
        return ApiResponse.ok("Changes requested", TaskResponse.from(task, taskService.computedProgress(task)));
    }

    @PostMapping("/{id}/reassign")
    public ApiResponse<TaskResponse> reassign(
            @AuthenticationPrincipal User user, @PathVariable Long id, @Valid @RequestBody TaskDtos.AssignRequest request) {
        var task = taskService.reassign(user, id, request.assigneeId());
        return ApiResponse.ok("Task reassigned", TaskResponse.from(task, taskService.computedProgress(task)));
    }

    @PostMapping("/{id}/comments")
    public ApiResponse<Void> comment(
            @AuthenticationPrincipal User user, @PathVariable Long id, @Valid @RequestBody TaskDtos.CommentRequest request) {
        taskService.addComment(user, id, request.body());
        return ApiResponse.ok("Comment added");
    }

    @PostMapping("/{id}/work-log")
    public ApiResponse<Void> workLog(
            @AuthenticationPrincipal User user, @PathVariable Long id, @Valid @RequestBody TaskDtos.WorkLogRequest request) {
        taskService.addWorkLog(user, id, request.date(), request.hours(), request.description());
        return ApiResponse.ok("Work log saved");
    }

    @GetMapping("/{id}/comments")
    public ApiResponse<List<CommentView>> comments(@AuthenticationPrincipal User user, @PathVariable Long id) {
        taskService.get(id);
        var data = commentRepository.findByTaskIdOrderByCreatedAtAsc(id).stream()
                .map(item -> new CommentView(
                        item.getId(), item.getTask().getId(), item.getAuthor().getId(),
                        item.getBody(), item.getCreatedAt()))
                .toList();
        return ApiResponse.ok("Comments loaded", data);
    }

    @GetMapping("/{id}/reviews")
    public ApiResponse<List<ReviewView>> reviews(@AuthenticationPrincipal User user, @PathVariable Long id) {
        taskService.get(id);
        var data = reviewRepository.findByTaskId(id).stream()
                .map(item -> new ReviewView(
                        item.getId(), item.getTask().getId(), item.getReviewer().getId(),
                        item.getDecision(), item.getComment(), item.getCreatedAt()))
                .toList();
        return ApiResponse.ok("Reviews loaded", data);
    }

    @GetMapping("/{id}/work-logs")
    public ApiResponse<List<WorkLogView>> workLogs(@AuthenticationPrincipal User user, @PathVariable Long id) {
        taskService.get(id);
        var data = workLogRepository.findByTaskId(id).stream()
                .map(item -> new WorkLogView(
                        item.getId(), item.getTask().getId(), item.getUser().getId(),
                        item.getDate(), item.getHours(), item.getDescription()))
                .toList();
        return ApiResponse.ok("Work logs loaded", data);
    }
}
