package com.stackly.pms.service;

import com.stackly.pms.entity.*;
import com.stackly.pms.exception.ApiException;
import com.stackly.pms.repository.*;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.EnumSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class TaskService {
    private final TaskRepository taskRepository;
    private final TaskReviewRepository reviewRepository;
    private final TaskCommentRepository commentRepository;
    private final TaskWorkLogRepository workLogRepository;
    private final UserRepository userRepository;
    private final TeamRepository teamRepository;
    private final SprintRepository sprintRepository;
    private final HierarchyService hierarchyService;
    private final AuditService auditService;

    @Transactional
    public Task assignToPoc(User mentor, Long projectId, Long teamId, Long pocId, String title, String description,
                            Priority priority, LocalDate dueDate, Long sprintId) {
        hierarchyService.assertMentorCanAssignPoc(mentor, teamId, pocId);
        Team team = teamRepository.findById(teamId).orElseThrow(() -> ApiException.notFound("Team not found"));
        if (!team.getProject().getId().equals(projectId)) {
            throw ApiException.badRequest("Team does not belong to project");
        }
        User poc = userRepository.findById(pocId).orElseThrow(() -> ApiException.notFound("POC not found"));
        Sprint sprint = null;
        if (sprintId != null) {
            sprint = sprintRepository
                    .findDetailedById(sprintId)
                    .orElseThrow(() -> ApiException.notFound("Sprint not found"));
            if (!sprint.getTeam().getId().equals(teamId)) {
                throw ApiException.badRequest("Sprint does not belong to this team");
            }
        }
        boolean self = mentor.getId().equals(pocId);
        Task task = taskRepository.save(Task.builder()
                .project(team.getProject())
                .team(team)
                .sprint(sprint)
                .title(title)
                .description(description)
                .status(TaskStatus.ASSIGNED)
                .priority(priority)
                .assignedTo(poc)
                .assignedBy(mentor)
                .dueDate(dueDate)
                .estimatedHours(BigDecimal.ZERO)
                .actualHours(BigDecimal.ZERO)
                .progressPercent(0)
                .build());
        auditService.record(mentor, team.getProject(), "TASK_ASSIGNED", "TASK", task.getId(),
                self
                        ? "Mentor assigned " + title + " to themselves as POC."
                        : "Mentor assigned " + title + " to POC " + poc.displayName() + ".");
        if (!self) {
            auditService.notify(poc, team.getProject(), "NEW_WORK_ASSIGNED", "New task from Mentor",
                    mentor.getFirstName() + " assigned " + title + " to you.", "TASK", task.getId());
        }
        return task;
    }

    @Transactional
    public Task createSubtask(User poc, Long parentId, String title, String description,
                              Priority priority, LocalDate dueDate, BigDecimal estimatedHours, String doneByName) {
        return createSubtask(poc, parentId, title, description, priority, dueDate, estimatedHours, doneByName, null);
    }

    @Transactional
    public Task createSubtask(User poc, Long parentId, String title, String description,
                              Priority priority, LocalDate dueDate, BigDecimal estimatedHours, String doneByName,
                              Long associateId) {
        Task parent = get(parentId);
        if (parent.getParentTask() != null) {
            throw ApiException.badRequest("Subtasks can only be created under a parent task");
        }
        if (!canBreakDown(parent, poc)) {
            throw ApiException.forbidden("You can break down only work on your squad");
        }
        Long workerId = associateId == null ? poc.getId() : associateId;
        hierarchyService.assertCanAssignSquadWork(poc, parent.getProject().getId(), parent.getTeam().getId(), workerId);
        User worker = userRepository.findById(workerId).orElseThrow(() -> ApiException.notFound("Associate not found"));
        String trimmedDoneBy = doneByName == null ? null : doneByName.trim();
        if (trimmedDoneBy != null && trimmedDoneBy.isEmpty()) {
            trimmedDoneBy = null;
        }
        if (trimmedDoneBy == null && !worker.getId().equals(poc.getId())) {
            trimmedDoneBy = worker.displayName();
        }
        Task sub = taskRepository.save(Task.builder()
                .project(parent.getProject())
                .team(parent.getTeam())
                .parentTask(parent)
                .title(title)
                .description(description)
                .status(TaskStatus.ASSIGNED)
                .priority(priority)
                .assignedTo(worker)
                .assignedBy(poc)
                .dueDate(dueDate)
                .estimatedHours(estimatedHours == null ? BigDecimal.ZERO : estimatedHours)
                .actualHours(BigDecimal.ZERO)
                .progressPercent(0)
                .doneByName(trimmedDoneBy)
                .build());
        auditService.record(poc, parent.getProject(), "SUBTASK_ASSIGNED", "TASK", sub.getId(),
                worker.getId().equals(poc.getId())
                        ? (trimmedDoneBy == null
                                ? "POC " + poc.displayName() + " created subtask " + title + "."
                                : "POC " + poc.displayName() + " created subtask " + title + " (done by " + trimmedDoneBy + ").")
                        : "POC " + poc.displayName() + " assigned subtask " + title + " to Associate " + worker.displayName() + ".");
        return sub;
    }

    @Transactional
    public Task changeStatus(User actor, Long taskId, TaskStatus target, Long projectId) {
        return changeStatus(actor, taskId, target, projectId, null);
    }

    @Transactional
    public Task changeStatus(User actor, Long taskId, TaskStatus target, Long projectId, String doneByName) {
        Task task = get(taskId);
        hierarchyService.requireAssignment(actor, projectId == null ? task.getProject().getId() : projectId);
        AssignmentType role = hierarchyService.currentAssignment(actor, task.getProject().getId()).getAssignmentType();
        if (!canMove(role, actor, task, target)) {
            throw ApiException.forbidden("You do not have permission to assign this task");
        }
        task.setStatus(target);
        if (target == TaskStatus.COMPLETED) {
            task.setProgressPercent(100);
        }
        if (doneByName != null) {
            String trimmed = doneByName.trim();
            task.setDoneByName(trimmed.isEmpty() ? null : trimmed);
        } else if (target == TaskStatus.IN_REVIEW
                && (task.getDoneByName() == null || task.getDoneByName().isBlank())
                && task.getAssignedTo() != null) {
            task.setDoneByName(task.getAssignedTo().displayName());
        }
        auditService.record(actor, task.getProject(), "STATUS_CHANGED", "TASK", task.getId(),
                actor.getFirstName() + " changed status to " + target.name().replace('_', ' ') + ".");
        return task;
    }

    @Transactional
    public Task submitForReview(User actor, Long taskId) {
        Task task = get(taskId);
        if (canUpdateWork(actor, task)) {
            return changeStatus(actor, taskId, TaskStatus.IN_REVIEW, task.getProject().getId());
        }
        throw ApiException.forbidden("You can submit only tasks you own or that belong to your associates");
    }

    @Transactional
    public Task approve(User reviewer, Long taskId, String comment) {
        Task task = get(taskId);
        assertReviewer(reviewer, task);
        reviewRepository.save(TaskReview.builder().task(task).reviewer(reviewer).decision("APPROVE").comment(comment).build());
        task.setStatus(TaskStatus.COMPLETED);
        task.setProgressPercent(100);
        auditService.record(reviewer, task.getProject(), "TASK_APPROVED", "TASK", task.getId(),
                reviewer.getFirstName() + " approved " + task.getTitle() + ".");
        if (task.getAssignedTo() != null) {
            auditService.notify(task.getAssignedTo(), task.getProject(), "TASK_APPROVED", "Task approved",
                    reviewer.getFirstName() + " approved " + task.getTitle() + ".", "TASK", task.getId());
        }
        return task;
    }

    @Transactional
    public Task reject(User reviewer, Long taskId, String comment) {
        if (comment == null || comment.isBlank()) {
            throw ApiException.badRequest("Review comment is mandatory when rejecting work");
        }
        Task task = get(taskId);
        assertReviewer(reviewer, task);
        reviewRepository.save(TaskReview.builder().task(task).reviewer(reviewer).decision("REJECT").comment(comment).build());
        task.setStatus(TaskStatus.REOPENED);
        auditService.record(reviewer, task.getProject(), "TASK_REJECTED", "TASK", task.getId(),
                reviewer.getFirstName() + " rejected " + task.getTitle() + ".");
        if (task.getAssignedTo() != null) {
            auditService.notify(task.getAssignedTo(), task.getProject(), "TASK_REJECTED", "Task rejected",
                    reviewer.getFirstName() + " requested changes on " + task.getTitle() + ".", "TASK", task.getId());
        }
        return task;
    }

    /** Reassign parent work Mentor→POC, or subtasks POC→Associate. */
    @Transactional
    public Task reassign(User actor, Long taskId, Long assigneeId) {
        Task task = get(taskId);
        AssignmentType role =
                hierarchyService.currentAssignment(actor, task.getProject().getId()).getAssignmentType();
        if (role != AssignmentType.POC && role != AssignmentType.MENTOR) {
            throw ApiException.forbidden("Only a POC or Mentor can reassign tasks");
        }
        hierarchyService.assertCanAssignSquadWork(
                actor, task.getProject().getId(), task.getTeam().getId(), assigneeId);
        User assignee =
                userRepository.findById(assigneeId).orElseThrow(() -> ApiException.notFound("Assignee not found"));
        task.setAssignedTo(assignee);
        task.setAssignedBy(actor);
        task.setStatus(TaskStatus.ASSIGNED);
        auditService.record(
                actor,
                task.getProject(),
                "TASK_REASSIGNED",
                "TASK",
                task.getId(),
                actor.getFirstName() + " reassigned " + task.getTitle() + " to " + assignee.displayName() + ".");
        if (!actor.getId().equals(assignee.getId())) {
            auditService.notify(
                    assignee,
                    task.getProject(),
                    "TASK_ASSIGNED",
                    "Task reassigned",
                    actor.getFirstName() + " assigned " + task.getTitle() + " to you.",
                    "TASK",
                    task.getId());
        }
        return task;
    }

    @Transactional
    public TaskComment addComment(User actor, Long taskId, String body) {
        Task task = get(taskId);
        TaskComment comment = commentRepository.save(TaskComment.builder().task(task).author(actor).body(body).build());
        auditService.record(actor, task.getProject(), "COMMENT_ADDED", "TASK", task.getId(),
                actor.getFirstName() + " added a comment on " + task.getTitle() + ".");
        return comment;
    }

    @Transactional
    public TaskWorkLog addWorkLog(User actor, Long taskId, LocalDate date, BigDecimal hours, String description) {
        Task task = get(taskId);
        if (task.getAssignedTo() == null || !task.getAssignedTo().getId().equals(actor.getId())) {
            throw ApiException.forbidden("You can log time only on tasks assigned to you");
        }
        TaskWorkLog log = workLogRepository.save(TaskWorkLog.builder()
                .task(task).user(actor).date(date).hours(hours).description(description).build());
        task.setActualHours(task.getActualHours().add(hours));
        return log;
    }

    public Task get(Long id) {
        return taskRepository.findById(id).orElseThrow(() -> ApiException.notFound("Task not found"));
    }

    /** Ensures the actor is assigned to the task's project (can view task artifacts). */
    public void requireVisible(User actor, Task task) {
        hierarchyService.requireAssignment(actor, task.getProject().getId());
    }

    @Transactional(readOnly = true)
    public List<Task> visible(User user, Long projectId) {
        ProjectAssignment assignment = hierarchyService.currentAssignment(user, projectId);
        return switch (assignment.getAssignmentType()) {
            case SCRUM_MASTER -> taskRepository.findByProjectId(projectId);
            case MENTOR -> {
                if (assignment.getTeam() == null) {
                    throw ApiException.badRequest("Mentor assignment is missing a team");
                }
                yield taskRepository.findByTeamId(assignment.getTeam().getId());
            }
            case POC -> taskRepository.findByProjectId(projectId).stream()
                    .filter(task -> belongsToPoc(task, user.getId()))
                    .toList();
            case ASSOCIATE -> List.<Task>of();
        };
    }

    public int computedProgress(Task task) {
        List<Task> children = taskRepository.findByParentTaskId(task.getId());
        if (children.isEmpty()) {
            return task.getStatus() == TaskStatus.COMPLETED ? 100 : task.getProgressPercent();
        }
        return (int) Math.round(children.stream().mapToInt(this::computedProgress).average().orElse(0));
    }

    private boolean canBreakDown(Task parent, User actor) {
        if (belongsToPoc(parent, actor.getId())) {
            return true;
        }
        return parent.getParentTask() == null
                && hierarchyService.isMentorOfTeam(actor, parent.getTeam().getId());
    }

    private boolean belongsToPoc(Task task, Long pocId) {
        if (task.getAssignedTo() != null && task.getAssignedTo().getId().equals(pocId)) return true;
        if (task.getParentTask() != null
                && task.getParentTask().getAssignedTo() != null
                && task.getParentTask().getAssignedTo().getId().equals(pocId)) {
            return true;
        }
        Long projectId = task.getProject().getId();
        if (task.getAssignedTo() != null) {
            User lead = userRepository.findById(pocId).orElse(null);
            if (lead != null && hierarchyService.isAssociateOf(lead, projectId, task.getAssignedTo().getId())) {
                return true;
            }
        }
        return false;
    }

    private boolean canActAsWorker(User actor, Task task) {
        return task.getAssignedTo() != null && task.getAssignedTo().getId().equals(actor.getId());
    }

    /** POC/Mentor updates associate work in the app because associates have no login. */
    private boolean canUpdateWork(User actor, Task task) {
        if (canActAsWorker(actor, task)) {
            return true;
        }
        if (task.getAssignedTo() == null) {
            return false;
        }
        return hierarchyService.isAssociateOf(actor, task.getProject().getId(), task.getAssignedTo().getId());
    }

    private void assertReviewer(User actor, Task task) {
        if (task.getStatus() != TaskStatus.IN_REVIEW) {
            throw ApiException.badRequest("Task is not in review");
        }
        if (!canReview(actor, task)) {
            throw ApiException.forbidden("You can review only work in your reporting chain");
        }
    }

    /**
     * Associate work → POC. POC work → Mentor. Mentor work → Mentor (self). Scrum Master does not review.
     */
    private boolean canReview(User actor, Task task) {
        if (task.getAssignedTo() == null) {
            return false;
        }
        Long projectId = task.getProject().getId();
        AssignmentType role = hierarchyService.currentAssignment(actor, projectId).getAssignmentType();
        if (role == AssignmentType.SCRUM_MASTER || role == AssignmentType.ASSOCIATE) {
            return false;
        }
        User assignee = task.getAssignedTo();
        if (hierarchyService.hasAssociate(actor, projectId, assignee.getId())) {
            return role == AssignmentType.POC || role == AssignmentType.MENTOR;
        }
        if (role != AssignmentType.MENTOR || !hierarchyService.isMentorOfTeam(actor, task.getTeam().getId())) {
            return false;
        }
        if (assignee.getId().equals(actor.getId())) {
            return true;
        }
        return hierarchyService.isPocOnTeam(assignee, task.getTeam().getId());
    }

    private boolean canMove(AssignmentType role, User actor, Task task, TaskStatus target) {
        if (task.getStatus() == TaskStatus.IN_REVIEW) {
            return canReview(actor, task)
                    && (target == TaskStatus.COMPLETED || target == TaskStatus.REOPENED);
        }
        if (canUpdateWork(actor, task)) {
            Map<TaskStatus, Set<TaskStatus>> workerMoves = Map.of(
                    TaskStatus.ASSIGNED, EnumSet.of(TaskStatus.IN_PROGRESS),
                    TaskStatus.IN_PROGRESS, EnumSet.of(TaskStatus.BLOCKED, TaskStatus.IN_REVIEW),
                    TaskStatus.REOPENED, EnumSet.of(TaskStatus.IN_PROGRESS),
                    TaskStatus.BLOCKED, EnumSet.of(TaskStatus.IN_PROGRESS));
            return workerMoves.getOrDefault(task.getStatus(), Set.of()).contains(target);
        }
        if (role == AssignmentType.POC && task.getParentTask() == null) {
            return Set.of(TaskStatus.ASSIGNED, TaskStatus.IN_PROGRESS, TaskStatus.BLOCKED).contains(target);
        }
        if (role == AssignmentType.MENTOR && task.getParentTask() == null) {
            return Set.of(TaskStatus.BACKLOG, TaskStatus.ASSIGNED, TaskStatus.IN_PROGRESS, TaskStatus.BLOCKED)
                    .contains(target);
        }
        return false;
    }
}
