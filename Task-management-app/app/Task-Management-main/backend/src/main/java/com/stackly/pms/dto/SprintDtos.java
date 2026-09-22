package com.stackly.pms.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.time.LocalDate;

public class SprintDtos {
    public record CreateRequest(
            @NotNull Long projectId,
            @NotNull Long teamId,
            @NotBlank String name,
            String goal,
            @NotNull LocalDate startDate,
            @NotNull LocalDate endDate) {}

    public record EditRequest(
            @NotNull Long projectId,
            @NotNull Long teamId,
            @NotBlank String name,
            String goal,
            @NotNull LocalDate startDate,
            @NotNull LocalDate endDate) {}

    public record StatusRequest(@NotBlank String status) {}
}
