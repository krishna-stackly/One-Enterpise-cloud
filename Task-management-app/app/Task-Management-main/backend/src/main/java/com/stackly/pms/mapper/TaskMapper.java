package com.stackly.pms.mapper;

import com.stackly.pms.dto.TaskDtos.TaskResponse;
import com.stackly.pms.entity.Task;

public final class TaskMapper {
    private TaskMapper() {}

    public static TaskResponse toResponse(Task task, int progress) {
        return TaskResponse.from(task, progress);
    }
}
