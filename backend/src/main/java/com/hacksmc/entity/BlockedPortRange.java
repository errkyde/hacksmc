package com.hacksmc.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import java.time.Instant;

@Entity
@Table(name = "blocked_port_ranges")
@Getter @Setter
public class BlockedPortRange {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(nullable = false) private int portStart;
    @Column(nullable = false) private int portEnd;
    @Column private String reason;
    @Column(nullable = false) private Instant createdAt;
    @PrePersist void prePersist() { createdAt = Instant.now(); }
}
