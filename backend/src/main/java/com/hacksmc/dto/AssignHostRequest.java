package com.hacksmc.dto;

import jakarta.validation.constraints.*;

public record AssignHostRequest(
        /** Comma-separated, e.g. "TCP" or "TCP,UDP" */
        @NotBlank @Pattern(regexp = "^(TCP|UDP)(,(TCP|UDP))*$") String allowedProtocols,
        @Min(1) @Max(65535) int portRangeMin,
        @Min(1) @Max(65535) int portRangeMax,
        @Min(1) @Max(100) int maxRules
) {}
