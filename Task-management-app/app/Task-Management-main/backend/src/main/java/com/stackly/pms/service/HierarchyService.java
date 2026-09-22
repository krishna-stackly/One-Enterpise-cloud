package com.stackly.pms.service;

import com.stackly.pms.entity.AssignmentType;
import com.stackly.pms.entity.ProjectAssignment;
import com.stackly.pms.entity.SystemRole;
import com.stackly.pms.entity.User;
import com.stackly.pms.exception.ApiException;
import com.stackly.pms.repository.ProjectAssignmentRepository;
import java.util.Comparator;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class HierarchyService {
    private static final List<AssignmentType> RANK = List.of(
            AssignmentType.SCRUM_MASTER, AssignmentType.MENTOR, AssignmentType.POC, AssignmentType.ASSOCIATE);
    private static final List<AssignmentType> LOGIN_ROLES =
            List.of(AssignmentType.SCRUM_MASTER, AssignmentType.MENTOR, AssignmentType.POC);

    private final ProjectAssignmentRepository assignmentRepository;

    @Transactional(readOnly = true)
    public ProjectAssignment requireAssignment(User user, Long projectId) {
        return currentAssignment(user, projectId);
    }

    @Transactional(readOnly = true)
    public ProjectAssignment currentAssignment(User user, Long projectId) {
        return assignmentRepository.findByUserIdAndProjectId(user.getId(), projectId).stream()
                .min(Comparator.comparingInt(item -> RANK.indexOf(item.getAssignmentType())))
                .orElseThrow(() -> ApiException.forbidden("You are not assigned to this project"));
    }

    public boolean isMentorOfTeam(User user, Long teamId) {
        return assignmentRepository.findByTeamIdAndAssignmentType(teamId, AssignmentType.MENTOR).stream()
                .anyMatch(item -> item.getUser().getId().equals(user.getId()));
    }

    public boolean isPocOnTeam(User user, Long teamId) {
        return assignmentRepository.findByTeamIdAndAssignmentType(teamId, AssignmentType.POC).stream()
                .anyMatch(item -> item.getUser().getId().equals(user.getId()));
    }

    public boolean isAssociateOnTeam(User user, Long teamId) {
        return assignmentRepository.findByTeamIdAndAssignmentType(teamId, AssignmentType.ASSOCIATE).stream()
                .anyMatch(item -> item.getUser().getId().equals(user.getId()));
    }

    public boolean isWorkstreamLeadOnTeam(User user, Long teamId) {
        return isMentorOfTeam(user, teamId) || isPocOnTeam(user, teamId);
    }

    public boolean isAssociateOf(User lead, Long projectId, Long associateId) {
        if (lead.getId().equals(associateId)) {
            return true;
        }
        return hasAssociate(lead, projectId, associateId);
    }

    /** True only for directory associates reporting to this lead — not the lead themselves. */
    public boolean hasAssociate(User lead, Long projectId, Long associateId) {
        if (lead.getId().equals(associateId)) {
            return false;
        }
        return assignmentRepository
                .findByProjectIdAndPocIdAndAssignmentType(projectId, lead.getId(), AssignmentType.ASSOCIATE)
                .stream()
                .anyMatch(item -> item.getUser().getId().equals(associateId));
    }

    public void assertMentorCanAssignPoc(User mentor, Long teamId, Long pocId) {
        if (!isMentorOfTeam(mentor, teamId)) {
            throw ApiException.forbidden("You do not have permission to assign this task");
        }
        if (mentor.getId().equals(pocId)) {
            return;
        }
        boolean pocOnTeam = assignmentRepository.findByTeamIdAndAssignmentType(teamId, AssignmentType.POC).stream()
                .anyMatch(item -> item.getUser().getId().equals(pocId));
        if (!pocOnTeam) {
            throw ApiException.forbidden("You do not have permission to assign this task");
        }
    }

    public void assertPocCanAssignAssociate(User lead, Long projectId, Long teamId, Long associateId) {
        if (lead.getId().equals(associateId)) {
            return;
        }
        if (!isWorkstreamLeadOnTeam(lead, teamId)) {
            throw ApiException.forbidden("Only a POC or Mentor can assign work to associates");
        }
        if (!isAssociateOf(lead, projectId, associateId)) {
            throw ApiException.forbidden("You can assign work only to your associates");
        }
    }

    /** Mentor: self, team POC, or own associate. POC: self or own associate. */
    public void assertCanAssignSquadWork(User actor, Long projectId, Long teamId, Long assigneeId) {
        if (actor.getId().equals(assigneeId)) {
            return;
        }
        ProjectAssignment assignment = currentAssignment(actor, projectId);
        if (assignment.getAssignmentType() == AssignmentType.MENTOR) {
            if (!isMentorOfTeam(actor, teamId)) {
                throw ApiException.forbidden("You can assign work only on your team");
            }
            boolean pocOnTeam = assignmentRepository.findByTeamIdAndAssignmentType(teamId, AssignmentType.POC).stream()
                    .anyMatch(item -> item.getUser().getId().equals(assigneeId));
            if (pocOnTeam || hasAssociate(actor, projectId, assigneeId)) {
                return;
            }
            throw ApiException.forbidden("Assign this work to yourself, a POC on your team, or your associates");
        }
        assertPocCanAssignAssociate(actor, projectId, teamId, assigneeId);
    }

    public void assertCanReportTo(User lead, Long teamId) {
        if (isMentorOfTeam(lead, teamId) || isPocOnTeam(lead, teamId)) {
            return;
        }
        throw ApiException.badRequest("Select a Mentor / POC or POC on this team");
    }

    @Transactional(readOnly = true)
    public List<ProjectAssignment> assignmentsFor(User user) {
        return assignmentRepository.findByUserId(user.getId());
    }

    /** Associates never sign in; only Scrum Master, Mentor, and POC (or ADMIN) can. */
    @Transactional(readOnly = true)
    public boolean canSignIn(User user) {
        if (user.getSystemRole() == SystemRole.ADMIN) {
            return true;
        }
        return assignmentRepository.findByUserId(user.getId()).stream()
                .anyMatch(item -> LOGIN_ROLES.contains(item.getAssignmentType()));
    }

    public void assertCanAddPeople(User user, Long projectId) {
        ProjectAssignment assignment = currentAssignment(user, projectId);
        if (assignment.getAssignmentType() != AssignmentType.SCRUM_MASTER
                && assignment.getAssignmentType() != AssignmentType.MENTOR
                && assignment.getAssignmentType() != AssignmentType.POC) {
            throw ApiException.forbidden("Only a Scrum Master, Mentor, or POC can add people");
        }
    }

    public void assertCanRemovePeople(User user, Long projectId) {
        ProjectAssignment assignment = currentAssignment(user, projectId);
        if (assignment.getAssignmentType() != AssignmentType.SCRUM_MASTER
                && assignment.getAssignmentType() != AssignmentType.MENTOR
                && assignment.getAssignmentType() != AssignmentType.POC) {
            throw ApiException.forbidden("Only a Scrum Master, Mentor, or POC can remove people");
        }
    }

    /**
     * Validates that the actor may remove the target assignment from the project.
     * Mentors may remove POC and Associate rows on their own team.
     * POCs may remove only their own associates.
     */
    public void assertCanRemoveAssignment(User actor, Long projectId, ProjectAssignment target) {
        assertCanRemovePeople(actor, projectId);
        if (target.getAssignmentType() == AssignmentType.SCRUM_MASTER) {
            throw ApiException.badRequest("Cannot remove the Scrum Master from the project");
        }
        if (target.getUser().getId().equals(actor.getId())) {
            throw ApiException.badRequest("You cannot remove yourself from the project");
        }
        ProjectAssignment actorAssignment = currentAssignment(actor, projectId);
        if (actorAssignment.getAssignmentType() == AssignmentType.POC) {
            if (target.getAssignmentType() != AssignmentType.ASSOCIATE
                    || target.getPoc() == null
                    || !target.getPoc().getId().equals(actor.getId())) {
                throw ApiException.forbidden("A POC can remove only their associates");
            }
            return;
        }
        if (actorAssignment.getAssignmentType() == AssignmentType.MENTOR) {
            if (target.getAssignmentType() != AssignmentType.POC
                    && target.getAssignmentType() != AssignmentType.ASSOCIATE) {
                throw ApiException.forbidden("A Mentor can remove only POC and Associate");
            }
            if (actorAssignment.getTeam() == null
                    || target.getTeam() == null
                    || !actorAssignment.getTeam().getId().equals(target.getTeam().getId())) {
                throw ApiException.forbidden("You can remove people only from your team");
            }
        }
    }

    public void assertRoleAssignmentAllowed(User actor, Long projectId, AssignmentType type, Long teamId) {
        if (type == AssignmentType.SCRUM_MASTER) {
            throw ApiException.badRequest("Assign Mentor, POC, or Associate when adding a person");
        }
        ProjectAssignment assignment = currentAssignment(actor, projectId);
        if (assignment.getAssignmentType() == AssignmentType.POC) {
            if (type != AssignmentType.ASSOCIATE) {
                throw ApiException.forbidden("A POC can add only associates");
            }
            if (assignment.getTeam() == null || !assignment.getTeam().getId().equals(teamId)) {
                throw ApiException.forbidden("You can add people only to your team");
            }
            return;
        }
        if (assignment.getAssignmentType() == AssignmentType.MENTOR) {
            if (type != AssignmentType.POC && type != AssignmentType.ASSOCIATE) {
                throw ApiException.forbidden("A Mentor can assign only POC or Associate");
            }
            if (assignment.getTeam() == null || !assignment.getTeam().getId().equals(teamId)) {
                throw ApiException.forbidden("You can add people only to your team");
            }
            return;
        }
        if (assignment.getAssignmentType() != AssignmentType.SCRUM_MASTER) {
            throw ApiException.forbidden("Only a Scrum Master, Mentor, or POC can add people");
        }
    }

    public void assertAssociatePoc(User actor, Long projectId, Long teamId, Long pocId) {
        if (pocId == null) {
            throw ApiException.badRequest("Select the POC this associate reports to");
        }
        ProjectAssignment assignment = currentAssignment(actor, projectId);
        if (assignment.getAssignmentType() == AssignmentType.POC) {
            if (!actor.getId().equals(pocId)) {
                throw ApiException.forbidden("Associates must report to you");
            }
            return;
        }
        User pocHolder = assignmentRepository.findByUserIdAndProjectId(pocId, projectId).stream()
                .filter(item -> item.getTeam() != null && item.getTeam().getId().equals(teamId))
                .filter(item -> item.getAssignmentType() == AssignmentType.POC
                        || item.getAssignmentType() == AssignmentType.MENTOR)
                .findFirst()
                .map(ProjectAssignment::getUser)
                .orElse(null);
        if (pocHolder == null) {
            throw ApiException.badRequest("Select a Mentor or POC on this team");
        }
        if (assignment.getAssignmentType() == AssignmentType.MENTOR && !actor.getId().equals(pocId)) {
            boolean pocOnTeam = assignmentRepository.findByTeamIdAndAssignmentType(teamId, AssignmentType.POC).stream()
                    .anyMatch(item -> item.getUser().getId().equals(pocId));
            if (!pocOnTeam) {
                throw ApiException.forbidden("You can attach associates only to POCs on your team");
            }
        }
    }

    public User defaultTeamQueueOwner(Long teamId) {
        return assignmentRepository.findByTeamIdAndAssignmentType(teamId, AssignmentType.POC).stream()
                .findFirst()
                .map(ProjectAssignment::getUser)
                .or(() -> assignmentRepository.findByTeamIdAndAssignmentType(teamId, AssignmentType.MENTOR).stream()
                        .findFirst()
                        .map(ProjectAssignment::getUser))
                .orElseThrow(() -> ApiException.badRequest("This team has no POC or Mentor to receive the query"));
    }

    /** Login-capable recipient for a team member. Associates have no login, so their POC receives it. */
    public User loginRecipientForMember(Long projectId, Long teamId, Long memberId) {
        List<ProjectAssignment> rows = assignmentRepository.findByUserIdAndProjectId(memberId, projectId).stream()
                .filter(item -> item.getTeam() != null && item.getTeam().getId().equals(teamId))
                .toList();
        if (rows.isEmpty()) {
            throw ApiException.badRequest("Select a POC or Associate on this team");
        }
        ProjectAssignment row = rows.getFirst();
        if (row.getAssignmentType() == AssignmentType.POC || row.getAssignmentType() == AssignmentType.MENTOR) {
            return row.getUser();
        }
        if (row.getAssignmentType() == AssignmentType.ASSOCIATE) {
            if (row.getPoc() == null) {
                throw ApiException.badRequest("This associate has no POC");
            }
            return row.getPoc();
        }
        throw ApiException.badRequest("Select a POC or Associate on this team");
    }

    public List<Long> pocTeamIds(User user, Long projectId) {
        return assignmentRepository.findByUserIdAndProjectId(user.getId(), projectId).stream()
                .filter(item -> (item.getAssignmentType() == AssignmentType.POC
                        || item.getAssignmentType() == AssignmentType.MENTOR)
                        && item.getTeam() != null)
                .map(item -> item.getTeam().getId())
                .toList();
    }

    public void assertCanRouteQuery(User actor, Long projectId, Long currentTeamId) {
        ProjectAssignment assignment = currentAssignment(actor, projectId);
        if (assignment.getAssignmentType() == AssignmentType.SCRUM_MASTER) {
            return;
        }
        if (currentTeamId != null && (isPocOnTeam(actor, currentTeamId) || isMentorOfTeam(actor, currentTeamId))) {
            return;
        }
        throw ApiException.forbidden("Only a team POC, Mentor, or Scrum Master can assign this query");
    }

    public void assertCanManageOrg(User user) {
        if (user.getSystemRole() == SystemRole.ADMIN) {
            return;
        }
        boolean scrumMaster = assignmentRepository.findByUserId(user.getId()).stream()
                .anyMatch(item -> item.getAssignmentType() == AssignmentType.SCRUM_MASTER);
        if (!scrumMaster) {
            throw ApiException.forbidden("Only a Scrum Master can manage people, projects, and teams");
        }
    }
}
