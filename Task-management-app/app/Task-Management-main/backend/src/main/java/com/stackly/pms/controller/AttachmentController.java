package com.stackly.pms.controller;

import com.stackly.pms.dto.ApiResponse;
import com.stackly.pms.entity.TaskAttachment;
import com.stackly.pms.entity.User;
import com.stackly.pms.service.AttachmentService;
import java.time.Instant;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequiredArgsConstructor
public class AttachmentController {
    private final AttachmentService attachmentService;

    public record AttachmentView(
            Long id,
            Long taskId,
            String fileName,
            Long fileSize,
            String contentType,
            String url,
            Long uploadedBy,
            Instant uploadedAt) {
        static AttachmentView from(TaskAttachment row) {
            return new AttachmentView(
                    row.getId(),
                    row.getTask().getId(),
                    row.getFileName(),
                    row.getFileSize(),
                    row.getContentType(),
                    row.getUrl(),
                    row.getUploadedBy().getId(),
                    row.getUploadedAt());
        }
    }

    @GetMapping("/api/tasks/{taskId}/attachments")
    public ApiResponse<List<AttachmentView>> list(
            @AuthenticationPrincipal User user, @PathVariable Long taskId) {
        var data = attachmentService.list(user, taskId).stream().map(AttachmentView::from).toList();
        return ApiResponse.ok("Attachments loaded", data);
    }

    @PostMapping(value = "/api/tasks/{taskId}/attachments", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ApiResponse<AttachmentView> upload(
            @AuthenticationPrincipal User user,
            @PathVariable Long taskId,
            @RequestPart("file") MultipartFile file) {
        return ApiResponse.ok("Attachment uploaded", AttachmentView.from(attachmentService.upload(user, taskId, file)));
    }

    @GetMapping("/api/files/{storageKey:.+}")
    public ResponseEntity<Resource> download(
            @AuthenticationPrincipal User user, @PathVariable String storageKey) {
        var meta = attachmentService.metaByKey(storageKey);
        Resource resource = attachmentService.loadFile(user, storageKey);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "inline; filename=\"" + meta.getFileName() + "\"")
                .contentType(MediaType.parseMediaType(meta.getContentType()))
                .body(resource);
    }
}
