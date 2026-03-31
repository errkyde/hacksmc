package com.hacksmc.dto;

import java.time.Instant;

public record NetworkGroupDto(
        Long id,
        String name,
        String color,
        int layerOrder,
        boolean collapsed,
        boolean hidden,
        boolean scanBlocked,
        Instant createdAt
) {}
