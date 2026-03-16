package com.hacksmc.dto;

import java.util.List;

public record UserOverviewResponse(
        Long id,
        String username,
        String role,
        boolean enabled,
        int hostCount,
        int activeRuleCount,
        int pendingRuleCount,
        int deletedRuleCount,
        List<HostDto> hosts,
        List<AdminNatRuleResponse> recentRules
) {}
