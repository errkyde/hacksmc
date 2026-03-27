package com.hacksmc.dto;

import jakarta.validation.constraints.NotBlank;

public record CreateNetworkDeviceRequest(
        @NotBlank String name,
        String ipAddress,
        String macAddress,
        String hostname,
        String description,
        String deviceType,
        Long groupId,
        double posX,
        double posY,
        boolean isShared,
        Long hostId
) {}
