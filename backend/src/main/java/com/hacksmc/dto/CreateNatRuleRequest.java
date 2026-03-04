package com.hacksmc.dto;

import jakarta.validation.constraints.*;

public record CreateNatRuleRequest(
        @NotNull Long hostId,
        @NotBlank String protocol,
        @Min(1) @Max(65535) int port,
        @NotBlank @Size(max = 8) String description
) {}
