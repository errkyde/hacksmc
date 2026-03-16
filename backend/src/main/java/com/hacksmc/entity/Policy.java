package com.hacksmc.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

@Entity
@Table(name = "policies")
@Getter @Setter
public class Policy {

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

    /** Comma-separated allowed protocols, e.g. "TCP,UDP" */
    @Column(nullable = false)
    private String allowedProtocols;

    @Column(nullable = false)
    private int portRangeMin;

    @Column(nullable = false)
    private int portRangeMax;

    @Column(nullable = false)
    private int maxRules;
}
