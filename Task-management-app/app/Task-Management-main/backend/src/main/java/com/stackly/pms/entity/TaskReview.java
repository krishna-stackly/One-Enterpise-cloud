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
@Table(name = "task_reviews")
public class TaskReview {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    private Task task;
    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    private User reviewer;
    private String decision;
    @Column(columnDefinition = "TEXT")
    private String comment;
    private Instant createdAt;

    @PrePersist
    void onCreate() {
        createdAt = Instant.now();
    }
}
