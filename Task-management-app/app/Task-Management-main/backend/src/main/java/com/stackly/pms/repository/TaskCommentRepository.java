package com.stackly.pms.repository;

import com.stackly.pms.entity.TaskComment;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface TaskCommentRepository extends JpaRepository<TaskComment, Long> {
    List<TaskComment> findByTaskIdOrderByIdDesc(Long taskId);
    List<TaskComment> findByTaskIdOrderByCreatedAtAsc(Long taskId);
}
