package com.hacksmc.dto;

import java.time.Instant;

public record ErrorLogEntry(
        Long id,
        Instant ts,
        String actor,
        String method,
        String path,
        int httpStatus,
        String errorType,
        String message
) {}
