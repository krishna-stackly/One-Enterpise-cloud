package com.stackly.pms.repository;

import com.stackly.pms.entity.AssignmentType;
import com.stackly.pms.entity.ProjectAssignment;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ProjectAssignmentRepository extends JpaRepository<ProjectAssignment, Long> {
    List<ProjectAssignment> findByUserId(Long userId);
    List<ProjectAssignment> findByUserIdAndProjectId(Long userId, Long projectId);
    List<ProjectAssignment> findByProjectId(Long projectId);
    List<ProjectAssignment> findByProjectIdAndAssignmentType(Long projectId, AssignmentType type);
    List<ProjectAssignment> findByTeamIdAndAssignmentType(Long teamId, AssignmentType type);
    List<ProjectAssignment> findByTeamId(Long teamId);
    List<ProjectAssignment> findByProjectIdAndPocIdAndAssignmentType(Long projectId, Long pocId, AssignmentType type);
    Optional<ProjectAssignment> findFirstByUserIdAndProjectId(Long userId, Long projectId);
}
