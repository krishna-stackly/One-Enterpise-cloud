package com.stackly.pms.repository;

import com.stackly.pms.entity.TaskWorkLog;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface TaskWorkLogRepository extends JpaRepository<TaskWorkLog, Long> {
    List<TaskWorkLog> findByTaskId(Long taskId);
}
