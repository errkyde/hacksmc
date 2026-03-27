package com.hacksmc.dto;

import jakarta.validation.constraints.NotNull;

public record CreateNetworkConnectionRequest(
        @NotNull Long sourceDeviceId,
        @NotNull Long targetDeviceId,
        String protocol,
        Integer portStart,
        Integer portEnd,
        String label
) {}
