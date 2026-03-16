package com.hacksmc.dto;

import java.time.Instant;

public record AdminNatRuleResponse(
    Long id,
    String username,
    String hostName,
    String hostIp,
    String protocol,
    int portStart,
    int portEnd,
    String description,
    String pfSenseRuleId,
    String status,
    Instant createdAt,
    Instant deletedAt,
    Instant expiresAt
) {}
