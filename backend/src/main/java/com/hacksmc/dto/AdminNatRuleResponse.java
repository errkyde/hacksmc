package com.hacksmc.dto;

import java.time.Instant;

public record AdminNatRuleResponse(
    Long id,
    String username,
    String hostName,
    String hostIp,
    String protocol,
    int port,
    String description,
    String pfSenseRuleId,
    String status,
    Instant createdAt,
    Instant deletedAt
) {}
