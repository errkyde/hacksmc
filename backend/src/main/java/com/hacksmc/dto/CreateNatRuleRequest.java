package com.hacksmc.dto;

import jakarta.validation.constraints.*;

public record CreateNatRuleRequest(
        @NotNull Long hostId,
        @NotBlank String protocol,
        @Min(1) @Max(65535) int port,
        String description
) {}
