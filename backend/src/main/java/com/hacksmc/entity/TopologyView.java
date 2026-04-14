package com.hacksmc.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.Instant;

@Entity
@Table(name = "topology_views")
@Getter @Setter
public class TopologyView {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 100)
    private String name;

    @Column(length = 500)
    private String description;

    /** True for the built-in "Auto" view — populated by Auto Scan, cannot be deleted. */
    @Column(nullable = false)
    private boolean isAuto;

    @Column(nullable = false)
    private Instant createdAt;

    @PrePersist
    void prePersist() {
        createdAt = Instant.now();
    }
}
