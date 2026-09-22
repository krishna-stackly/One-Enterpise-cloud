package com.stackly.pms.service;

import com.stackly.pms.entity.Task;
import com.stackly.pms.entity.TaskAttachment;
import com.stackly.pms.entity.TaskStatus;
import com.stackly.pms.entity.User;
import com.stackly.pms.exception.ApiException;
import com.stackly.pms.repository.TaskAttachmentRepository;
import com.stackly.pms.storage.FileStorage;
import java.io.IOException;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import org.springframework.core.io.Resource;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

@Service
@RequiredArgsConstructor
public class AttachmentService {
    private static final Set<String> ALLOWED_TYPES = Set.of(
            "image/jpeg", "image/png", "image/webp", "image/gif");

    private final TaskService taskService;
    private final TaskAttachmentRepository attachmentRepository;
    private final FileStorage fileStorage;
    private final AuditService auditService;

    @Transactional(readOnly = true)
    public List<TaskAttachment> list(User actor, Long taskId) {
        Task task = taskService.get(taskId);
        taskService.requireVisible(actor, task);
        return attachmentRepository.findByTaskIdOrderByUploadedAtDesc(taskId);
    }

    @Transactional
    public TaskAttachment upload(User actor, Long taskId, MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw ApiException.badRequest("Choose an image to upload");
        }
        Task task = taskService.get(taskId);
        assertCanUpload(actor, task);

        String contentType = file.getContentType() == null
                ? ""
                : file.getContentType().toLowerCase(Locale.ROOT);
        if (!ALLOWED_TYPES.contains(contentType)) {
            throw ApiException.badRequest("Only PNG, JPG, WebP, or GIF images are allowed");
        }

        try {
            var stored = fileStorage.store(
                    file.getOriginalFilename(), contentType, file.getInputStream(), file.getSize());
            TaskAttachment attachment = attachmentRepository.save(TaskAttachment.builder()
                    .task(task)
                    .fileName(stored.fileName())
                    .fileSize(stored.size())
                    .contentType(stored.contentType())
                    .storageKey(stored.key())
                    .url(stored.url())
                    .uploadedBy(actor)
                    .build());
            auditService.record(
                    actor,
                    task.getProject(),
                    "ATTACHMENT_UPLOADED",
                    "TASK",
                    task.getId(),
                    actor.getFirstName() + " uploaded " + attachment.getFileName() + ".");
            return attachment;
        } catch (IOException ex) {
            throw ApiException.badRequest("Could not store the uploaded file");
        }
    }

    @Transactional(readOnly = true)
    public Resource loadFile(User actor, String storageKey) {
        TaskAttachment attachment = attachmentRepository
                .findByStorageKey(storageKey)
                .orElseThrow(() -> ApiException.notFound("File not found"));
        taskService.requireVisible(actor, attachment.getTask());
        try {
            return fileStorage.load(storageKey);
        } catch (IOException ex) {
            throw ApiException.notFound("File not found");
        }
    }

    @Transactional(readOnly = true)
    public TaskAttachment metaByKey(String storageKey) {
        return attachmentRepository
                .findByStorageKey(storageKey)
                .orElseThrow(() -> ApiException.notFound("File not found"));
    }

    private void assertCanUpload(User actor, Task task) {
        if (task.getAssignedTo() == null || !task.getAssignedTo().getId().equals(actor.getId())) {
            throw ApiException.forbidden("Only the task assignee can upload review images");
        }
        TaskStatus status = task.getStatus();
        if (status != TaskStatus.IN_PROGRESS
                && status != TaskStatus.ASSIGNED
                && status != TaskStatus.REOPENED
                && status != TaskStatus.IN_REVIEW) {
            throw ApiException.badRequest("Images can only be uploaded while the task is in progress or in review");
        }
    }
}
