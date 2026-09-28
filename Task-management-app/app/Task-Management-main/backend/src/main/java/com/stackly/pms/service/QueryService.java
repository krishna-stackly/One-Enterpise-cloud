package com.stackly.pms.service;

import com.stackly.pms.entity.AssignmentType;
import com.stackly.pms.entity.Project;
import com.stackly.pms.entity.ProjectAssignment;
import com.stackly.pms.entity.ProjectQuery;
import com.stackly.pms.entity.QueryStatus;
import com.stackly.pms.entity.Team;
import com.stackly.pms.entity.User;
import com.stackly.pms.exception.ApiException;
import com.stackly.pms.repository.ProjectAssignmentRepository;
import com.stackly.pms.repository.ProjectQueryRepository;
import com.stackly.pms.repository.ProjectRepository;
import com.stackly.pms.repository.TeamRepository;
import com.stackly.pms.repository.UserRepository;
import java.time.Instant;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class QueryService {
    private final ProjectQueryRepository queryRepository;
    private final ProjectRepository projectRepository;
    private final TeamRepository teamRepository;
    private final ProjectAssignmentRepository assignmentRepository;
    private final UserRepository userRepository;
    private final HierarchyService hierarchyService;
    private final AuditService auditService;

    @Transactional
    public ProjectQuery create(User actor, Long projectId, Long teamId, String subject, String body) {
        hierarchyService.requireAssignment(actor, projectId);
        Project project = projectRepository.findById(projectId)
                .orElseThrow(() -> ApiException.notFound("Project not found"));
        Team team = teamRepository.findById(teamId).orElseThrow(() -> ApiException.notFound("Team not found"));
        if (!team.getProject().getId().equals(projectId)) {
            throw ApiException.badRequest("Team does not belong to this project");
        }
        User from = userRepository.findById(actor.getId())
                .orElseThrow(() -> ApiException.notFound("User not found"));
        User queueOwner = hierarchyService.defaultTeamQueueOwner(teamId);

        ProjectQuery query = queryRepository.save(ProjectQuery.builder()
                .project(project)
                .team(team)
                .fromUser(from)
                .toUser(queueOwner)
                .subject(subject.trim())
                .body(body.trim())
                .status(QueryStatus.UNASSIGNED)
                .build());

        auditService.record(from, project, "QUERY_RAISED", "QUERY", query.getId(),
                from.getFirstName() + " raised a query for team " + team.getName() + ": " + query.getSubject());
        notifyTeamPocs(teamId, project, from, query);
        return query;
    }

    @Transactional
    public ProjectQuery assign(User actor, Long id, Long teamId, Long assigneeId) {
        ProjectQuery query = queryRepository.findDetailedById(id)
                .orElseThrow(() -> ApiException.notFound("Query not found"));
        if (query.getParentQuery() != null) {
            throw ApiException.badRequest("Assign only the original query");
        }
        if (query.getStatus() == QueryStatus.CLOSED || query.getStatus() == QueryStatus.ANSWERED) {
            throw ApiException.badRequest("This query is already closed");
        }
        Long projectId = query.getProject().getId();
        Long currentTeamId = query.getTeam() == null ? null : query.getTeam().getId();
        boolean recipient = query.getToUser().getId().equals(actor.getId());
        if (!recipient) {
            hierarchyService.assertCanRouteQuery(actor, projectId, currentTeamId);
        }

        Team team = teamRepository.findById(teamId).orElseThrow(() -> ApiException.notFound("Team not found"));
        if (!team.getProject().getId().equals(projectId)) {
            throw ApiException.badRequest("Team does not belong to this project");
        }

        User recipientUser;
        QueryStatus nextStatus;
        if (assigneeId == null) {
            recipientUser = hierarchyService.defaultTeamQueueOwner(teamId);
            nextStatus = QueryStatus.UNASSIGNED;
        } else {
            recipientUser = hierarchyService.loginRecipientForMember(projectId, teamId, assigneeId);
            nextStatus = QueryStatus.OPEN;
        }

        query.setTeam(team);
        query.setToUser(recipientUser);
        query.setStatus(nextStatus);
        queryRepository.save(query);

        auditService.record(actor, query.getProject(), "QUERY_RAISED", "QUERY", query.getId(),
                actor.getFirstName() + " assigned query \"" + query.getSubject() + "\" to "
                        + recipientUser.displayName() + ".");
        if (!recipientUser.getId().equals(actor.getId())) {
            auditService.notify(recipientUser, query.getProject(), "QUERY_RAISED", "Query assigned",
                    actor.getFirstName() + " assigned a query to you: " + query.getSubject(), "QUERY", query.getId());
        }
        if (nextStatus == QueryStatus.UNASSIGNED) {
            notifyTeamPocs(teamId, query.getProject(), actor, query);
        }
        return query;
    }

    @Transactional(readOnly = true)
    public List<ProjectQuery> list(User actor, Long projectId, String box) {
        hierarchyService.requireAssignment(actor, projectId);
        String normalized = box == null || box.isBlank() ? "inbox" : box.trim().toLowerCase();
        if (normalized.equals("inbox")
                && hierarchyService.currentAssignment(actor, projectId).getAssignmentType() == AssignmentType.SCRUM_MASTER) {
            return queryRepository.findAllInProject(projectId);
        }
        List<Long> pocTeamIds = hierarchyService.pocTeamIds(actor, projectId);
        if (pocTeamIds.isEmpty()) {
            pocTeamIds = List.of(-1L);
        }
        return switch (normalized) {
            case "sent" -> queryRepository.findSent(projectId, actor.getId());
            case "all" -> queryRepository.findAllForUser(projectId, actor.getId());
            default -> queryRepository.findInbox(projectId, actor.getId(), pocTeamIds);
        };
    }

    @Transactional(readOnly = true)
    public ProjectQuery get(User actor, Long id) {
        ProjectQuery query = queryRepository.findDetailedById(id)
                .orElseThrow(() -> ApiException.notFound("Query not found"));
        assertParticipant(actor, query);
        return query;
    }

    @Transactional(readOnly = true)
    public List<ProjectQuery> replies(Long parentId) {
        return queryRepository.findReplies(parentId);
    }

    @Transactional
    public ProjectQuery reply(User actor, Long id, String body) {
        ProjectQuery parent = queryRepository.findDetailedById(id)
                .orElseThrow(() -> ApiException.notFound("Query not found"));
        if (parent.getParentQuery() != null) {
            throw ApiException.badRequest("Reply only on the original query");
        }
        if (parent.getStatus() == QueryStatus.UNASSIGNED) {
            throw ApiException.badRequest("Assign this query to a POC or Associate before replying");
        }
        if (!parent.getToUser().getId().equals(actor.getId())) {
            throw ApiException.forbidden("Only the recipient can reply to this query");
        }
        if (parent.getStatus() == QueryStatus.CLOSED) {
            throw ApiException.badRequest("This query is closed");
        }

        User from = userRepository.findById(actor.getId())
                .orElseThrow(() -> ApiException.notFound("User not found"));
        User asker = parent.getFromUser();

        queryRepository.save(ProjectQuery.builder()
                .project(parent.getProject())
                .team(parent.getTeam())
                .fromUser(from)
                .toUser(asker)
                .subject("Re: " + parent.getSubject())
                .body(body.trim())
                .status(QueryStatus.ANSWERED)
                .parentQuery(parent)
                .build());

        parent.setStatus(QueryStatus.ANSWERED);
        parent.setAnsweredAt(Instant.now());
        queryRepository.save(parent);

        auditService.record(from, parent.getProject(), "QUERY_ANSWERED", "QUERY", parent.getId(),
                from.getFirstName() + " answered query: " + parent.getSubject());
        auditService.notify(asker, parent.getProject(), "QUERY_ANSWERED", "Query answered",
                from.getFirstName() + " replied to: " + parent.getSubject(), "QUERY", parent.getId());
        return parent;
    }

    private void notifyTeamPocs(Long teamId, Project project, User from, ProjectQuery query) {
        assignmentRepository.findByTeamIdAndAssignmentType(teamId, AssignmentType.POC).stream()
                .map(ProjectAssignment::getUser)
                .filter(poc -> !poc.getId().equals(from.getId()))
                .forEach(poc -> auditService.notify(
                        poc,
                        project,
                        "QUERY_RAISED",
                        "Team query to verify",
                        from.getFirstName() + " raised a query for your team: " + query.getSubject(),
                        "QUERY",
                        query.getId()));
    }

    private void assertParticipant(User actor, ProjectQuery query) {
        Long actorId = actor.getId();
        boolean participant = query.getFromUser().getId().equals(actorId)
                || query.getToUser().getId().equals(actorId);
        if (!participant && query.getTeam() != null) {
            participant = hierarchyService.isPocOnTeam(actor, query.getTeam().getId())
                    || hierarchyService.isMentorOfTeam(actor, query.getTeam().getId());
        }
        if (!participant) {
            ProjectAssignment assignment = hierarchyService.currentAssignment(actor, query.getProject().getId());
            participant = assignment.getAssignmentType() == AssignmentType.SCRUM_MASTER;
        }
        if (!participant) {
            throw ApiException.forbidden("You cannot view this query");
        }
    }
}
