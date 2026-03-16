package com.hacksmc.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record UpdateHostRequest(
        @NotBlank @Size(max = 128) String name,
        @Size(max = 255) String description
) {}
