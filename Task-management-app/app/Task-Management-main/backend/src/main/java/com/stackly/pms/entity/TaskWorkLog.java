package com.stackly.pms.entity;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.LocalDate;
import lombok.*;

@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "task_work_logs")
public class TaskWorkLog {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    private Task task;
    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    private User user;
    @Column(name = "work_date")
    private LocalDate date;
    private BigDecimal hours;
    private String description;
}
