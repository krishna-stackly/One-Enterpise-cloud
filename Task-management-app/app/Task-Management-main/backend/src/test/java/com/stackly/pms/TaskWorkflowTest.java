package com.stackly.pms;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.stackly.pms.entity.*;
import com.stackly.pms.exception.ApiException;
import com.stackly.pms.repository.*;
import com.stackly.pms.service.TaskService;
import java.math.BigDecimal;
import java.time.LocalDate;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

@SpringBootTest
@ActiveProfiles("test")
@Transactional
class TaskWorkflowTest {
    @Autowired private TaskService taskService;
    @Autowired private UserRepository userRepository;
    @Autowired private ProjectRepository projectRepository;
    @Autowired private TeamRepository teamRepository;
    @Autowired private ProjectAssignmentRepository assignmentRepository;

    private User mentor;
    private User poc;
    private User outsider;
    private Project project;
    private Team team;

    @BeforeEach
    void setUp() {
        project = projectRepository.save(Project.builder()
                .name("HRMS").code("HRMS").description("test")
                .status(ProjectStatus.ACTIVE)
                .startDate(LocalDate.now()).dueDate(LocalDate.now().plusMonths(6))
                .build());
        team = teamRepository.save(Team.builder().project(project).name("Backend").description("be").build());
        mentor = user("Suresh", "suresh@stackly.io");
        poc = user("Nikhil", "nikhil@stackly.io");
        outsider = user("Meera", "meera@stackly.io");
        assignmentRepository.save(ProjectAssignment.builder().user(mentor).project(project).assignmentType(AssignmentType.MENTOR).team(team).build());
        assignmentRepository.save(ProjectAssignment.builder().user(poc).project(project).assignmentType(AssignmentType.POC).team(team).build());
        assignmentRepository.save(ProjectAssignment.builder().user(outsider).project(project).assignmentType(AssignmentType.MENTOR)
                .team(teamRepository.save(Team.builder().project(project).name("Frontend").description("fe").build())).build());
    }

    @Test
    void mentorAssignsOnlyToPocOnTeam() {
        Task parent = taskService.assignToPoc(mentor, project.getId(), team.getId(), poc.getId(),
                "Employee Management Module", "desc", Priority.HIGH, LocalDate.now().plusDays(10), null);
        assertThat(parent.getAssignedTo().getId()).isEqualTo(poc.getId());
        assertThatThrownBy(() -> taskService.assignToPoc(mentor, project.getId(), team.getId(), outsider.getId(),
                "Illegal", "desc", Priority.HIGH, LocalDate.now().plusDays(10), null))
                .isInstanceOf(ApiException.class);
    }

    @Test
    void pocCreatesSubtasksOwnedBySelfWithDoneByName() {
        Task parent = taskService.assignToPoc(mentor, project.getId(), team.getId(), poc.getId(),
                "Employee Management Module", "desc", Priority.HIGH, LocalDate.now().plusDays(10), null);
        Task sub = taskService.createSubtask(poc, parent.getId(), "Employee CRUD API", "desc",
                Priority.HIGH, LocalDate.now().plusDays(5), BigDecimal.TEN, "Rahul Sharma");
        assertThat(sub.getParentTask().getId()).isEqualTo(parent.getId());
        assertThat(sub.getAssignedTo().getId()).isEqualTo(poc.getId());
        assertThat(sub.getDoneByName()).isEqualTo("Rahul Sharma");
    }

    @Test
    void pocSubmitsAndMentorApproves() {
        Task parent = taskService.assignToPoc(mentor, project.getId(), team.getId(), poc.getId(),
                "Employee Management Module", "desc", Priority.HIGH, LocalDate.now().plusDays(10), null);
        Task sub = taskService.createSubtask(poc, parent.getId(), "Employee CRUD API", "desc",
                Priority.HIGH, LocalDate.now().plusDays(5), BigDecimal.TEN, "Rahul Sharma");
        taskService.changeStatus(poc, sub.getId(), TaskStatus.IN_PROGRESS, project.getId());
        taskService.submitForReview(poc, sub.getId());
        Task approved = taskService.approve(mentor, sub.getId(), "Looks good");
        assertThat(approved.getStatus()).isEqualTo(TaskStatus.COMPLETED);
        assertThat(taskService.computedProgress(sub)).isEqualTo(100);
    }

    @Test
    void mentorRejectRequiresCommentAndReopens() {
        Task parent = taskService.assignToPoc(mentor, project.getId(), team.getId(), poc.getId(),
                "Employee Management Module", "desc", Priority.HIGH, LocalDate.now().plusDays(10), null);
        Task sub = taskService.createSubtask(poc, parent.getId(), "Employee CRUD API", "desc",
                Priority.HIGH, LocalDate.now().plusDays(5), BigDecimal.TEN, null);
        taskService.changeStatus(poc, sub.getId(), TaskStatus.IN_PROGRESS, project.getId());
        taskService.submitForReview(poc, sub.getId());
        assertThatThrownBy(() -> taskService.reject(mentor, sub.getId(), " "))
                .isInstanceOf(ApiException.class);
        Task rejected = taskService.reject(mentor, sub.getId(), "Duplicate email validation is missing.");
        assertThat(rejected.getStatus()).isEqualTo(TaskStatus.REOPENED);
    }

    @Test
    void unauthorizedUserCannotAccessTaskFlow() {
        Task parent = taskService.assignToPoc(mentor, project.getId(), team.getId(), poc.getId(),
                "Employee Management Module", "desc", Priority.HIGH, LocalDate.now().plusDays(10), null);
        assertThatThrownBy(() -> taskService.createSubtask(outsider, parent.getId(), "x", "y",
                Priority.LOW, LocalDate.now(), BigDecimal.ONE, null))
                .isInstanceOf(ApiException.class);
    }

    @Test
    void pocCannotApproveOwnWork() {
        Task parent = taskService.assignToPoc(mentor, project.getId(), team.getId(), poc.getId(),
                "Employee Management Module", "desc", Priority.HIGH, LocalDate.now().plusDays(10), null);
        Task self = taskService.createSubtask(poc, parent.getId(), "Login screen", "desc",
                Priority.HIGH, LocalDate.now().plusDays(5), BigDecimal.TEN, null);
        assertThat(self.getAssignedTo().getId()).isEqualTo(poc.getId());
        taskService.changeStatus(poc, self.getId(), TaskStatus.IN_PROGRESS, project.getId());
        taskService.submitForReview(poc, self.getId());
        assertThatThrownBy(() -> taskService.approve(poc, self.getId(), "Looks good"))
                .isInstanceOf(ApiException.class);
        Task approved = taskService.approve(mentor, self.getId(), "Looks good");
        assertThat(approved.getStatus()).isEqualTo(TaskStatus.COMPLETED);
    }

    @Test
    void pocReviewsAssociateWork() {
        User associate = user("Rahul", "rahul-review@stackly.io");
        assignmentRepository.save(ProjectAssignment.builder()
                .user(associate).project(project).assignmentType(AssignmentType.ASSOCIATE).team(team).poc(poc).build());
        Task parent = taskService.assignToPoc(mentor, project.getId(), team.getId(), poc.getId(),
                "Employee Management Module", "desc", Priority.HIGH, LocalDate.now().plusDays(10), null);
        Task sub = taskService.createSubtask(poc, parent.getId(), "Employee CRUD API", "desc",
                Priority.HIGH, LocalDate.now().plusDays(5), BigDecimal.TEN, null, associate.getId());
        taskService.changeStatus(poc, sub.getId(), TaskStatus.IN_PROGRESS, project.getId());
        taskService.submitForReview(poc, sub.getId());
        assertThatThrownBy(() -> taskService.approve(mentor, sub.getId(), "Looks good"))
                .isInstanceOf(ApiException.class);
        Task approved = taskService.approve(poc, sub.getId(), "Looks good");
        assertThat(approved.getStatus()).isEqualTo(TaskStatus.COMPLETED);
    }

    @Test
    void mentorReviewsOwnWork() {
        Task parent = taskService.assignToPoc(mentor, project.getId(), team.getId(), mentor.getId(),
                "Notification Service", "desc", Priority.HIGH, LocalDate.now().plusDays(10), null);
        taskService.changeStatus(mentor, parent.getId(), TaskStatus.IN_PROGRESS, project.getId());
        taskService.submitForReview(mentor, parent.getId());
        Task approved = taskService.approve(mentor, parent.getId(), "Self-checked");
        assertThat(approved.getStatus()).isEqualTo(TaskStatus.COMPLETED);
    }

    @Test
    void scrumMasterCannotReview() {
        User scrumMaster = user("Arun", "arun-review@stackly.io");
        assignmentRepository.save(ProjectAssignment.builder()
                .user(scrumMaster).project(project).assignmentType(AssignmentType.SCRUM_MASTER).team(null).build());
        Task parent = taskService.assignToPoc(mentor, project.getId(), team.getId(), poc.getId(),
                "Employee Management Module", "desc", Priority.HIGH, LocalDate.now().plusDays(10), null);
        taskService.changeStatus(poc, parent.getId(), TaskStatus.IN_PROGRESS, project.getId());
        taskService.submitForReview(poc, parent.getId());
        assertThatThrownBy(() -> taskService.approve(scrumMaster, parent.getId(), "Looks good"))
                .isInstanceOf(ApiException.class);
        Task approved = taskService.approve(mentor, parent.getId(), "Looks good");
        assertThat(approved.getStatus()).isEqualTo(TaskStatus.COMPLETED);
    }

    @Test
    void mentorAsPocCreatesOwnSubtasks() {
        Task parent = taskService.assignToPoc(mentor, project.getId(), team.getId(), mentor.getId(),
                "Notification Service", "desc", Priority.HIGH, LocalDate.now().plusDays(10), null);
        Task sub = taskService.createSubtask(mentor, parent.getId(), "Event payload", "desc",
                Priority.HIGH, LocalDate.now().plusDays(5), BigDecimal.TEN, "Ajay Menon");
        assertThat(sub.getAssignedTo().getId()).isEqualTo(mentor.getId());
        assertThat(sub.getDoneByName()).isEqualTo("Ajay Menon");
    }

    @Test
    void mentorAssignsSubtaskToTeamPoc() {
        Task parent = taskService.assignToPoc(mentor, project.getId(), team.getId(), mentor.getId(),
                "Notification Service", "desc", Priority.HIGH, LocalDate.now().plusDays(10), null);
        Task sub = taskService.createSubtask(mentor, parent.getId(), "API layer", "desc",
                Priority.HIGH, LocalDate.now().plusDays(5), BigDecimal.TEN, null, poc.getId());
        assertThat(sub.getAssignedTo().getId()).isEqualTo(poc.getId());
        Task whole = taskService.reassign(mentor, parent.getId(), poc.getId());
        assertThat(whole.getAssignedTo().getId()).isEqualTo(poc.getId());
    }

    @Test
    void pocAssignsSubtaskToOwnAssociate() {
        User associate = user("Rahul", "rahul@stackly.io");
        assignmentRepository.save(ProjectAssignment.builder()
                .user(associate).project(project).assignmentType(AssignmentType.ASSOCIATE).team(team).poc(poc).build());
        Task parent = taskService.assignToPoc(mentor, project.getId(), team.getId(), poc.getId(),
                "Employee Management Module", "desc", Priority.HIGH, LocalDate.now().plusDays(10), null);
        Task sub = taskService.createSubtask(poc, parent.getId(), "Employee CRUD API", "desc",
                Priority.HIGH, LocalDate.now().plusDays(5), BigDecimal.TEN, null, associate.getId());
        assertThat(sub.getAssignedTo().getId()).isEqualTo(associate.getId());
        assertThat(sub.getDoneByName()).isEqualTo("Rahul Test");
        taskService.changeStatus(poc, sub.getId(), TaskStatus.IN_PROGRESS, project.getId());
        assertThat(taskService.get(sub.getId()).getStatus()).isEqualTo(TaskStatus.IN_PROGRESS);
    }

    @Test
    void pocCannotAssignToSomeoneElsesAssociate() {
        User associate = user("Rahul", "rahul2@stackly.io");
        assignmentRepository.save(ProjectAssignment.builder()
                .user(associate).project(project).assignmentType(AssignmentType.ASSOCIATE).team(team).poc(outsider).build());
        Task parent = taskService.assignToPoc(mentor, project.getId(), team.getId(), poc.getId(),
                "Employee Management Module", "desc", Priority.HIGH, LocalDate.now().plusDays(10), null);
        assertThatThrownBy(() -> taskService.createSubtask(poc, parent.getId(), "Illegal", "desc",
                Priority.HIGH, LocalDate.now().plusDays(5), BigDecimal.TEN, null, associate.getId()))
                .isInstanceOf(ApiException.class);
    }

    private User user(String first, String email) {
        return userRepository.save(User.builder()
                .firstName(first).lastName("Test").email(email).passwordHash("hash")
                .title(first).systemRole(SystemRole.USER).avatarHue(1).enabled(true).build());
    }
}
