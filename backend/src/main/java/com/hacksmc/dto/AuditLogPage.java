package com.hacksmc.dto;

import java.util.List;

public record AuditLogPage(
        List<AuditLogEntry> content,
        long totalElements,
        int totalPages,
        int page,
        int size,
        List<String> availableActors,
        List<String> availableActions
) {}
