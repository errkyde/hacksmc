package com.hacksmc.dto;

import java.time.Instant;

public record AuditLogEntry(
    Long id,
    Instant ts,
    String actor,
    String action,
    String target,
    String detail
) {}
