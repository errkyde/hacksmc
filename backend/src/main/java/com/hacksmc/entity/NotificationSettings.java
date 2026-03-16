package com.hacksmc.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import java.util.HashSet;
import java.util.Set;

@Entity
@Table(name = "notification_settings")
@Getter @Setter
public class NotificationSettings {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false, unique = true)
    private User user;

    @Column(length = 255) private String email;
    @Column(nullable = false) private boolean emailEnabled = false;
    @Column(nullable = false) private boolean notifyOnCreate = true;
    @Column(nullable = false) private boolean notifyOnDelete = true;
    @Column(nullable = false) private boolean notifyOnExpire = true;
    @Column(nullable = false) private boolean notifyAllHosts = true;
    @Column(nullable = false, length = 10) private String notifyScope = "OWN";

    @ElementCollection
    @CollectionTable(name = "notification_host_filters",
            joinColumns = @JoinColumn(name = "settings_id"))
    @Column(name = "host_id")
    private Set<Long> hostFilter = new HashSet<>();
}
