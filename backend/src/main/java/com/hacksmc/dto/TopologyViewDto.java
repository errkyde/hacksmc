package com.hacksmc.dto;

import java.time.Instant;

public record TopologyViewDto(
        Long id,
        String name,
        String description,
        boolean isAuto,
        Instant createdAt
) {}
