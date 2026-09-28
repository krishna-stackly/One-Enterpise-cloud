package com.stackly.pms.controller;

import com.stackly.pms.dto.ApiResponse;
import com.stackly.pms.dto.QueryDtos;
import com.stackly.pms.entity.ProjectQuery;
import com.stackly.pms.entity.User;
import com.stackly.pms.service.QueryService;
import jakarta.validation.Valid;
import java.time.Instant;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/queries")
@RequiredArgsConstructor
public class QueryController {
    private final QueryService queryService;

    public record QueryView(
            Long id,
            Long projectId,
            Long teamId,
            Long fromUserId,
            String fromUserName,
            Long toUserId,
            String toUserName,
            String subject,
            String body,
            String status,
            Long parentQueryId,
            Instant createdAt,
            Instant answeredAt,
            List<QueryView> replies) {}

    @PostMapping
    public ApiResponse<QueryView> create(
            @AuthenticationPrincipal User user, @Valid @RequestBody QueryDtos.CreateRequest request) {
        ProjectQuery query = queryService.create(user, request.projectId(), request.teamId(), request.subject(), request.body());
        // Re-read with joins after commit-friendly associations were saved as managed entities.
        ProjectQuery loaded = queryService.get(user, query.getId());
        return ApiResponse.ok("Query created", toView(loaded, List.of()));
    }

    @GetMapping
    public ApiResponse<List<QueryView>> list(
            @AuthenticationPrincipal User user,
            @RequestParam Long projectId,
            @RequestParam(defaultValue = "inbox") String box) {
        List<QueryView> data = queryService.list(user, projectId, box).stream()
                .map(item -> toView(item, List.of()))
                .toList();
        return ApiResponse.ok("Queries loaded", data);
    }

    @GetMapping("/{id}")
    public ApiResponse<QueryView> get(@AuthenticationPrincipal User user, @PathVariable Long id) {
        ProjectQuery query = queryService.get(user, id);
        List<QueryView> replies = queryService.replies(id).stream()
                .map(item -> toView(item, List.of()))
                .toList();
        return ApiResponse.ok("Query loaded", toView(query, replies));
    }

    @PostMapping("/{id}/assign")
    public ApiResponse<QueryView> assign(
            @AuthenticationPrincipal User user,
            @PathVariable Long id,
            @Valid @RequestBody QueryDtos.AssignRequest request) {
        queryService.assign(user, id, request.teamId(), request.assigneeId());
        ProjectQuery query = queryService.get(user, id);
        List<QueryView> replies = queryService.replies(id).stream()
                .map(item -> toView(item, List.of()))
                .toList();
        return ApiResponse.ok("Query assigned", toView(query, replies));
    }

    @PostMapping("/{id}/reply")
    public ApiResponse<QueryView> reply(
            @AuthenticationPrincipal User user,
            @PathVariable Long id,
            @Valid @RequestBody QueryDtos.ReplyRequest request) {
        queryService.reply(user, id, request.body());
        ProjectQuery query = queryService.get(user, id);
        List<QueryView> replies = queryService.replies(id).stream()
                .map(item -> toView(item, List.of()))
                .toList();
        return ApiResponse.ok("Reply added", toView(query, replies));
    }

    private QueryView toView(ProjectQuery query, List<QueryView> replies) {
        return new QueryView(
                query.getId(),
                query.getProject().getId(),
                query.getTeam() == null ? null : query.getTeam().getId(),
                query.getFromUser().getId(),
                query.getFromUser().getFirstName() + " " + query.getFromUser().getLastName(),
                query.getToUser().getId(),
                query.getToUser().getFirstName() + " " + query.getToUser().getLastName(),
                query.getSubject(),
                query.getBody(),
                query.getStatus().name(),
                query.getParentQuery() == null ? null : query.getParentQuery().getId(),
                query.getCreatedAt(),
                query.getAnsweredAt(),
                replies);
    }
}
