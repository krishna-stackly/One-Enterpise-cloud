package com.stackly.pms.repository;

import com.stackly.pms.entity.ActivityLog;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ActivityLogRepository extends JpaRepository<ActivityLog, Long> {
    List<ActivityLog> findTop20ByProjectIdOrderByCreatedAtDesc(Long projectId);
}
