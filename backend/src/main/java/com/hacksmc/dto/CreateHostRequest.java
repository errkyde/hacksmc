package com.hacksmc.dto;

import jakarta.validation.constraints.*;

public record CreateHostRequest(
        @NotBlank @Size(max = 128) String name,
        @NotBlank @Pattern(regexp = "^((25[0-5]|2[0-4]\\d|[01]?\\d\\d?)\\.){3}(25[0-5]|2[0-4]\\d|[01]?\\d\\d?)$") String ipAddress,
        @Size(max = 255) String description,

        /** Comma-separated, e.g. "TCP" or "TCP,UDP" */
        @NotBlank @Pattern(regexp = "^(TCP|UDP)(,(TCP|UDP))*$") String allowedProtocols,

        @Min(1) @Max(65535) int portRangeMin,
        @Min(1) @Max(65535) int portRangeMax,
        @Min(1) @Max(100) int maxRules
) {}
