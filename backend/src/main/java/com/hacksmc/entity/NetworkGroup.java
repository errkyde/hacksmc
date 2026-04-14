package com.hacksmc.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.Instant;

@Entity
@Table(name = "network_groups")
@Getter @Setter
public class NetworkGroup {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String name;

    @Column(nullable = false)
    private String color;

    @Column(nullable = false)
    private int layerOrder;

    @Column(nullable = false)
    private boolean collapsed;

    @Column(nullable = false)
    private boolean hidden;

    @Column(nullable = false)
    private boolean scanBlocked;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "view_id", nullable = false)
    private TopologyView view;

    @Column(nullable = false)
    private Instant createdAt;

    @PrePersist
    void prePersist() {
        createdAt = Instant.now();
        if (color == null) color = "#64748b";
    }
}
