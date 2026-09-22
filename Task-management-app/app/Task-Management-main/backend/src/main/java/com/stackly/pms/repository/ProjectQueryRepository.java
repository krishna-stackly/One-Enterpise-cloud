package com.stackly.pms.repository;

import com.stackly.pms.entity.ProjectQuery;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ProjectQueryRepository extends JpaRepository<ProjectQuery, Long> {
    @Query("""
            select q from ProjectQuery q
            join fetch q.fromUser
            join fetch q.toUser
            join fetch q.project
            left join fetch q.team
            where q.id = :id
            """)
    Optional<ProjectQuery> findDetailedById(@Param("id") Long id);

    @Query("""
            select q from ProjectQuery q
            join fetch q.fromUser
            join fetch q.toUser
            join fetch q.project
            left join fetch q.team
            where q.project.id = :projectId
              and q.parentQuery is null
              and (
                    q.toUser.id = :userId
                    or (q.status = com.stackly.pms.entity.QueryStatus.UNASSIGNED and q.team.id in :pocTeamIds)
                  )
            order by q.createdAt desc
            """)
    List<ProjectQuery> findInbox(
            @Param("projectId") Long projectId,
            @Param("userId") Long userId,
            @Param("pocTeamIds") List<Long> pocTeamIds);

    @Query("""
            select q from ProjectQuery q
            join fetch q.fromUser
            join fetch q.toUser
            join fetch q.project
            left join fetch q.team
            where q.project.id = :projectId
              and q.parentQuery is null
            order by q.createdAt desc
            """)
    List<ProjectQuery> findAllInProject(@Param("projectId") Long projectId);

    @Query("""
            select q from ProjectQuery q
            join fetch q.fromUser
            join fetch q.toUser
            join fetch q.project
            left join fetch q.team
            where q.project.id = :projectId
              and q.parentQuery is null
              and q.fromUser.id = :userId
            order by q.createdAt desc
            """)
    List<ProjectQuery> findSent(@Param("projectId") Long projectId, @Param("userId") Long userId);

    @Query("""
            select q from ProjectQuery q
            join fetch q.fromUser
            join fetch q.toUser
            join fetch q.project
            left join fetch q.team
            where q.project.id = :projectId
              and q.parentQuery is null
              and (q.fromUser.id = :userId or q.toUser.id = :userId)
            order by q.createdAt desc
            """)
    List<ProjectQuery> findAllForUser(@Param("projectId") Long projectId, @Param("userId") Long userId);

    @Query("""
            select q from ProjectQuery q
            join fetch q.fromUser
            join fetch q.toUser
            join fetch q.project
            left join fetch q.team
            left join fetch q.parentQuery
            where q.parentQuery.id = :parentId
            order by q.createdAt asc
            """)
    List<ProjectQuery> findReplies(@Param("parentId") Long parentId);
}
