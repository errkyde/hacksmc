package com.hacksmc.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import java.time.Instant;

@Entity
@Table(name = "error_log")
@Getter @Setter
public class ErrorLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Instant ts;

    @Column(length = 64)
    private String actor;

    @Column(length = 10)
    private String method;

    @Column(length = 255)
    private String path;

    @Column(nullable = false)
    private int httpStatus;

    @Column(length = 64)
    private String errorType;

    @Column(columnDefinition = "TEXT")
    private String message;

    @PrePersist
    void prePersist() {
        ts = Instant.now();
    }
}
