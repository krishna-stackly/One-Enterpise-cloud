package com.stackly.pms.controller;

import com.stackly.pms.dto.ApiResponse;
import com.stackly.pms.entity.Notification;
import com.stackly.pms.entity.User;
import com.stackly.pms.repository.NotificationRepository;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/notifications")
@RequiredArgsConstructor
public class NotificationController {
    private final NotificationRepository notificationRepository;

    public record NotificationView(Long id, String title, String message, boolean read, String type) {}

    @GetMapping
    public ApiResponse<List<NotificationView>> list(@AuthenticationPrincipal User user) {
        return ApiResponse.ok(
                "Notifications loaded",
                notificationRepository.findByUserIdOrderByCreatedAtDesc(user.getId()).stream()
                        .map(item -> new NotificationView(item.getId(), item.getTitle(), item.getMessage(), item.isRead(), item.getType()))
                        .toList());
    }

    @PostMapping("/{id}/read")
    @Transactional
    public ApiResponse<Void> read(@AuthenticationPrincipal User user, @PathVariable Long id) {
        notificationRepository.findById(id).ifPresent(item -> {
            if (item.getUser().getId().equals(user.getId())) {
                item.setRead(true);
            }
        });
        return ApiResponse.ok("Marked as read");
    }

    @PostMapping("/read-all")
    @Transactional
    public ApiResponse<Void> readAll(@AuthenticationPrincipal User user) {
        List<Notification> notes = notificationRepository.findByUserIdOrderByCreatedAtDesc(user.getId());
        notes.forEach(item -> item.setRead(true));
        notificationRepository.saveAll(notes);
        return ApiResponse.ok("All marked as read");
    }
}
