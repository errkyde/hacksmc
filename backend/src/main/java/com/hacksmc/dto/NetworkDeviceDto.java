package com.hacksmc.dto;

import java.time.Instant;

public record NetworkDeviceDto(
        Long id,
        String name,
        String ipAddress,
        String macAddress,
        String hostname,
        String description,
        String deviceType,
        Long groupId,
        double posX,
        double posY,
        boolean isManual,
        boolean isShared,
        Long hostId,
        Instant createdAt,
        Instant updatedAt,
        String pfSenseInterface
) {}
