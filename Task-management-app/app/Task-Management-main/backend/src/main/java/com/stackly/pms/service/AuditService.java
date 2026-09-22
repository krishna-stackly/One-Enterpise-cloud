package com.stackly.pms.service;

import com.stackly.pms.entity.ActivityLog;
import com.stackly.pms.entity.Notification;
import com.stackly.pms.entity.Project;
import com.stackly.pms.entity.User;
import com.stackly.pms.repository.ActivityLogRepository;
import com.stackly.pms.repository.NotificationRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class AuditService {
    private final ActivityLogRepository activityLogRepository;
    private final NotificationRepository notificationRepository;

    public void record(User user, Project project, String action, String entityType, Long entityId, String message) {
        activityLogRepository.save(ActivityLog.builder()
                .user(user)
                .project(project)
                .action(action)
                .entityType(entityType)
                .entityId(entityId)
                .message(message)
                .build());
    }

    public void notify(User user, Project project, String type, String title, String message, String entityType, Long entityId) {
        notificationRepository.save(Notification.builder()
                .user(user)
                .project(project)
                .type(type)
                .title(title)
                .message(message)
                .entityType(entityType)
                .entityId(entityId)
                .read(false)
                .build());
    }
}
