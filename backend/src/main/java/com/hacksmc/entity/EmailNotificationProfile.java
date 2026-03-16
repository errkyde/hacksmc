package com.hacksmc.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import java.time.Instant;
import java.util.HashSet;
import java.util.Set;

@Entity
@Table(name = "email_notification_profiles")
@Getter @Setter
public class EmailNotificationProfile {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String email;

    @Column(nullable = false)
    private boolean notifyOnCreate = true;

    @Column(nullable = false)
    private boolean notifyOnDelete = true;

    @Column(nullable = false)
    private boolean notifyOnExpire = true;

    @Column(nullable = false, length = 20)
    private String scope = "ALL"; // "ALL" or "SPECIFIC"

    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "email_notification_profile_users",
                     joinColumns = @JoinColumn(name = "profile_id"))
    @Column(name = "user_id")
    private Set<Long> userIds = new HashSet<>();

    @Column(nullable = false)
    private Instant createdAt = Instant.now();
}
