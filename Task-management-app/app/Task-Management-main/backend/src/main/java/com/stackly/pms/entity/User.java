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
@Table(name = "users")
public class User {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    private String firstName;
    private String lastName;
    @Column(unique = true, nullable = false)
    private String email;
    @Column(nullable = false)
    private String passwordHash;
    private String title;
    @Enumerated(EnumType.STRING)
    private SystemRole systemRole;
    private Integer avatarHue;
    private boolean enabled;
    private Instant createdAt;
    private Instant updatedAt;

    @PrePersist
    void onCreate() {
        createdAt = Instant.now();
        updatedAt = createdAt;
        if (avatarHue == null) avatarHue = 200;
        enabled = true;
    }

    @PreUpdate
    void onUpdate() {
        updatedAt = Instant.now();
    }

    public String displayName() {
        return firstName + " " + lastName;
    }
}
