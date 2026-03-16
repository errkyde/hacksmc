package com.hacksmc.dto;

import java.time.Instant;
import java.util.Set;

public record EmailNotificationProfileDto(
    Long id,
    String email,
    boolean notifyOnCreate,
    boolean notifyOnDelete,
    boolean notifyOnExpire,
    String scope,
    Set<Long> userIds,
    Instant createdAt
) {}
