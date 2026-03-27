package com.hacksmc.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.Instant;

@Entity
@Table(name = "network_connections")
@Getter @Setter
public class NetworkConnection {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "source_device_id", nullable = false)
    private NetworkDevice source;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "target_device_id", nullable = false)
    private NetworkDevice target;

    @Column
    private String protocol;

    @Column
    private Integer portStart;

    @Column
    private Integer portEnd;

    @Column
    private String label;

    @Column(nullable = false)
    private String status;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "nat_rule_id")
    private NatRule natRule;

    @Column(nullable = false)
    private Instant createdAt;

    @PrePersist
    void prePersist() {
        createdAt = Instant.now();
        if (status == null) status = "OK";
    }
}
