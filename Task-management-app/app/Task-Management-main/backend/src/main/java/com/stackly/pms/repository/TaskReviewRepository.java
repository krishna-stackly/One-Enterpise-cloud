package com.stackly.pms.repository;

import com.stackly.pms.entity.TaskReview;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface TaskReviewRepository extends JpaRepository<TaskReview, Long> {
    List<TaskReview> findByTaskId(Long taskId);
}
