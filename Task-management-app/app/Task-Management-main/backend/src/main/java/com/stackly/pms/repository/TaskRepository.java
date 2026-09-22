package com.stackly.pms.repository;

import com.stackly.pms.entity.Task;
import com.stackly.pms.entity.TaskStatus;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface TaskRepository extends JpaRepository<Task, Long> {
    List<Task> findByProjectId(Long projectId);
    List<Task> findByTeamId(Long teamId);
    List<Task> findByAssignedToIdAndProjectId(Long userId, Long projectId);
    List<Task> findByAssignedToIdInAndProjectId(java.util.Collection<Long> userIds, Long projectId);
    List<Task> findByParentTaskId(Long parentId);
    List<Task> findByProjectIdAndStatus(Long projectId, TaskStatus status);
    List<Task> findBySprintId(Long sprintId);
}
