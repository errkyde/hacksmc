package com.hacksmc.dto;

import jakarta.validation.constraints.*;

public record UpdatePolicyRequest(
        @NotBlank @Pattern(regexp = "^(TCP|UDP)(,(TCP|UDP))*$") String allowedProtocols,
        @Min(1) @Max(65535) int portRangeMin,
        @Min(1) @Max(65535) int portRangeMax,
        @Min(1) @Max(100) int maxRules
) {}
