package com.hacksmc.dto;

import jakarta.validation.constraints.*;

public record CreateHostRequest(
        @NotBlank @Size(max = 128) String name,
        @NotBlank @Pattern(regexp = "^((25[0-5]|2[0-4]\\d|[01]?\\d\\d?)\\.){3}(25[0-5]|2[0-4]\\d|[01]?\\d\\d?)$") String ipAddress,
        @Size(max = 255) String description
) {}
