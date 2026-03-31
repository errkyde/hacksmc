package com.hacksmc.dto;

import java.time.Instant;

public record NetworkConnectionDto(
        Long id,
        Long sourceDeviceId,
        Long targetDeviceId,
        String protocol,
        Integer portStart,
        Integer portEnd,
        String label,
        String status,
        String direction,
        Long natRuleId,
        String firewallRuleId,
        Instant createdAt
) {}
