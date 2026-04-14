package com.hacksmc.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.Instant;

@Entity
@Table(name = "network_devices")
@Getter @Setter
public class NetworkDevice {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String name;

    @Column
    private String ipAddress;

    @Column
    private String macAddress;

    @Column
    private String hostname;

    @Column
    private String description;

    @Column(nullable = false)
    private String deviceType;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "group_id")
    private NetworkGroup group;

    @Column(name = "pos_x", nullable = false)
    private double posX;

    @Column(name = "pos_y", nullable = false)
    private double posY;

    @Column(nullable = false)
    private boolean isManual;

    @Column(nullable = false)
    private boolean isShared;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "host_id")
    private Host host;

    @Column(name = "pf_sense_interface")
    private String pfSenseInterface;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "view_id", nullable = false)
    private TopologyView view;

    @Column(nullable = false)
    private Instant createdAt;

    @Column(nullable = false)
    private Instant updatedAt;

    @PrePersist
    void prePersist() {
        createdAt = Instant.now();
        updatedAt = Instant.now();
        if (deviceType == null) deviceType = "UNKNOWN";
    }

    @PreUpdate
    void preUpdate() {
        updatedAt = Instant.now();
    }
}
