package com.hacksmc.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import java.time.Instant;

@Entity
@Table(name = "nat_rules")
@Getter @Setter
public class NatRule {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "host_id", nullable = false)
    private Host host;

    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(nullable = false)
    private String protocol;

    @Column(nullable = false)
    private int port;

    @Column
    private String description;

    /** Rule ID returned by pfSense after creation */
    @Column
    private String pfSenseRuleId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private NatRuleStatus status;

    @Column(nullable = false)
    private Instant createdAt;

    @Column
    private Instant deletedAt;

    @PrePersist
    void prePersist() {
        createdAt = Instant.now();
        if (status == null) status = NatRuleStatus.PENDING;
    }
}
