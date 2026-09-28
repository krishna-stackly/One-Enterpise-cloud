package com.stackly.pms.repository;

import com.stackly.pms.entity.TaskAttachment;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface TaskAttachmentRepository extends JpaRepository<TaskAttachment, Long> {
    @Query("""
            select a from TaskAttachment a
            join fetch a.task
            join fetch a.uploadedBy
            where a.task.id = :taskId
            order by a.uploadedAt desc
            """)
    List<TaskAttachment> findByTaskIdOrderByUploadedAtDesc(@Param("taskId") Long taskId);

    @Query("""
            select a from TaskAttachment a
            join fetch a.task
            join fetch a.uploadedBy
            where a.storageKey = :storageKey
            """)
    Optional<TaskAttachment> findByStorageKey(@Param("storageKey") String storageKey);
}
