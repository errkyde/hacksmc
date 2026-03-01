package com.hacksmc.dto;

public record HostDto(
        Long id,
        String name,
        String ipAddress,
        String description,
        PolicyDto policy
) {}
