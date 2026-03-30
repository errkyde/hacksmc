package com.hacksmc.dto;

public record PatchNetworkDeviceRequest(
        String name,
        String description,
        String deviceType,
        Long groupId,
        Double posX,
        Double posY,
        Boolean isShared,
        String pfSenseInterface
) {}
