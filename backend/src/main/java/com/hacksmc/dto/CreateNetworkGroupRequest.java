package com.hacksmc.dto;

import jakarta.validation.constraints.NotBlank;

public record CreateNetworkGroupRequest(
        @NotBlank String name,
        String color,
        int layerOrder
) {}
