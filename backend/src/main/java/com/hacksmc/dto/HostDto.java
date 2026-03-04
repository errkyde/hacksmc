package com.hacksmc.dto;

import java.util.List;

public record HostDto(
        Long id,
        String name,
        String ipAddress,
        String description,
        PolicyDto policy,
        int userCount,
        int activeRuleCount,
        List<AssignedUserRef> assignedUsers
) {}
