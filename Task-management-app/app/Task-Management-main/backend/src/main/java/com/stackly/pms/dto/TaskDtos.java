package com.stackly.pms.dto;

import com.stackly.pms.entity.Priority;
import com.stackly.pms.entity.Task;
import com.stackly.pms.entity.TaskStatus;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

public class TaskDtos {
    public record TaskResponse(
            Long id,
            Long projectId,
            Long teamId,
            Long parentTaskId,
            Long sprintId,
            String title,
            String description,
            TaskStatus status,
            Priority priority,
            Long assignedTo,
            Long assignedBy,
            LocalDate dueDate,
            BigDecimal estimatedHours,
            BigDecimal actualHours,
            Integer progressPercent,
            String doneByName) {
        public static TaskResponse from(Task task, int progress) {
            return new TaskResponse(
                    task.getId(),
                    task.getProject().getId(),
                    task.getTeam().getId(),
                    task.getParentTask() == null ? null : task.getParentTask().getId(),
                    task.getSprint() == null ? null : task.getSprint().getId(),
                    task.getTitle(),
                    task.getDescription(),
                    task.getStatus(),
                    task.getPriority(),
                    task.getAssignedTo() == null ? null : task.getAssignedTo().getId(),
                    task.getAssignedBy().getId(),
                    task.getDueDate(),
                    task.getEstimatedHours(),
                    task.getActualHours(),
                    progress,
                    task.getDoneByName());
        }
    }

    public record CreateParentRequest(
            @NotNull Long projectId,
            @NotNull Long teamId,
            @NotBlank String title,
            String description,
            @NotNull Long pocId,
            @NotNull Priority priority,
            @NotNull LocalDate dueDate,
            Long sprintId) {}

    public record CreateSubtaskRequest(
            @NotBlank String title,
            String description,
            String doneByName,
            Long associateId,
            @NotNull Priority priority,
            @NotNull LocalDate dueDate,
            BigDecimal estimatedHours) {}

    public record StatusRequest(@NotNull TaskStatus status, String doneByName) {}

    public record AssignRequest(@NotNull Long assigneeId) {}

    public record ReviewRequest(String comment) {}

    public record CommentRequest(@NotBlank String body) {}

    public record WorkLogRequest(@NotNull LocalDate date, @NotNull BigDecimal hours, @NotBlank String description) {}

    public record SubtaskBatchRequest(@NotEmpty @Valid List<CreateSubtaskRequest> subtasks) {}
}
