package com.stackly.pms.repository;

import com.stackly.pms.entity.Sprint;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface SprintRepository extends JpaRepository<Sprint, Long> {
    @Query("""
            select s from Sprint s
            join fetch s.project
            join fetch s.team
            join fetch s.createdBy
            where s.project.id = :projectId
            order by s.startDate desc
            """)
    List<Sprint> findDetailedByProjectId(@Param("projectId") Long projectId);

    @Query("""
            select s from Sprint s
            join fetch s.project
            join fetch s.team
            join fetch s.createdBy
            where s.team.id = :teamId
            order by s.startDate desc
            """)
    List<Sprint> findDetailedByTeamId(@Param("teamId") Long teamId);

    @Query("""
            select s from Sprint s
            join fetch s.project
            join fetch s.team
            join fetch s.createdBy
            where s.id = :id
            """)
    Optional<Sprint> findDetailedById(@Param("id") Long id);
}
