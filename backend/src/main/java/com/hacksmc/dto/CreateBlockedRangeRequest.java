package com.hacksmc.dto;
import jakarta.validation.constraints.*;
public record CreateBlockedRangeRequest(
    @Min(1) @Max(65535) int portStart,
    @Min(1) @Max(65535) int portEnd,
    String reason
) {
    @AssertTrue(message = "portEnd must be >= portStart")
    public boolean isRangeValid() { return portEnd >= portStart; }
}
