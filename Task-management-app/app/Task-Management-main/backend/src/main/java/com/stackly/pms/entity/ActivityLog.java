package com.stackly.pms.entity;

import jakarta.persistence.*;
import java.time.Instant;
import lombok.*;

@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "activity_logs")
public class ActivityLog {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    private User user;
    private String action;
    private String entityType;
    private Long entityId;
    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    private Project project;
    private String message;
    @Column(columnDefinition = "TEXT")
    private String metadataJson;
    private Instant createdAt;

    @PrePersist
    void onCreate() {
        createdAt = Instant.now();
    }
}
