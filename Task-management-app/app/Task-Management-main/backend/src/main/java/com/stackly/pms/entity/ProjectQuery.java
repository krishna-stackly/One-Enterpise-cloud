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
@Table(name = "queries")
public class ProjectQuery {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    private Project project;
    @ManyToOne(fetch = FetchType.LAZY)
    private Team team;
    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    @JoinColumn(name = "from_user_id")
    private User fromUser;
    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    @JoinColumn(name = "to_user_id")
    private User toUser;
    @Column(nullable = false, length = 200)
    private String subject;
    @Column(nullable = false, columnDefinition = "TEXT")
    private String body;
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private QueryStatus status;
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "parent_query_id")
    private ProjectQuery parentQuery;
    private Instant createdAt;
    private Instant answeredAt;

    @PrePersist
    void onCreate() {
        if (createdAt == null) {
            createdAt = Instant.now();
        }
        if (status == null) {
            status = QueryStatus.OPEN;
        }
    }
}
