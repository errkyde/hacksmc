package com.hacksmc.dto;

import jakarta.validation.constraints.*;
import java.time.Instant;

public record CreateNatRuleRequest(
        @NotNull Long hostId,
        @NotBlank String protocol,
        @Min(1) @Max(65535) int portStart,
        @Min(1) @Max(65535) int portEnd,
        @NotBlank @Size(max = 16) String description,
        Instant expiresAt
) {
    @AssertTrue(message = "portEnd must be >= portStart")
    public boolean isPortRangeValid() { return portEnd >= portStart; }

    @AssertTrue(message = "expiresAt must be in the future")
    public boolean isExpiryValid() { return expiresAt == null || expiresAt.isAfter(Instant.now()); }
}
