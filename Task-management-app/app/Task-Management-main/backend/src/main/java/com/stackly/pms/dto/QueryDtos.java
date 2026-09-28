package com.stackly.pms.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public final class QueryDtos {
    private QueryDtos() {}

    public record CreateRequest(
            @NotNull Long projectId,
            @NotNull Long teamId,
            @NotBlank @Size(max = 200) String subject,
            @NotBlank String body) {}

    public record ReplyRequest(@NotBlank String body) {}

    public record AssignRequest(@NotNull Long teamId, Long assigneeId) {}
}
