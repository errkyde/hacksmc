package com.hacksmc.service;

import com.hacksmc.entity.NatRuleStatus;
import com.hacksmc.entity.Policy;
import com.hacksmc.exception.PolicyViolationException;
import com.hacksmc.repository.NatRuleRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.Arrays;
import java.util.List;

@Service
@RequiredArgsConstructor
public class PolicyEngine {

    private final NatRuleRepository natRuleRepository;

    /**
     * Validates that a new NAT rule is allowed by the user's policy for this host.
     * Supports port ranges and TCP/UDP combined protocol.
     * Throws PolicyViolationException (-> 403) if any check fails.
     */
    public void validateRule(Policy policy, String protocol, int portStart, int portEnd, Long userId) {
        String hostName = policy.getHost().getName();

        // Check protocol — "TCP/UDP" requires both TCP and UDP to be individually allowed
        List<String> allowed = Arrays.stream(policy.getAllowedProtocols().split(","))
                .map(String::trim)
                .map(String::toUpperCase)
                .toList();

        boolean protocolAllowed;
        if ("TCP/UDP".equalsIgnoreCase(protocol)) {
            protocolAllowed = allowed.contains("TCP") && allowed.contains("UDP");
        } else {
            protocolAllowed = allowed.stream().anyMatch(p -> p.equalsIgnoreCase(protocol));
        }

        if (!protocolAllowed) {
            throw new PolicyViolationException(
                    "Protocol '" + protocol + "' not allowed for host: " + hostName
                    + ". Allowed: " + policy.getAllowedProtocols());
        }

        // Check port range — both bounds must fit within policy
        if (portStart < policy.getPortRangeMin() || portEnd > policy.getPortRangeMax()) {
            throw new PolicyViolationException(
                    "Port range " + portStart + "-" + portEnd + " outside allowed range ["
                    + policy.getPortRangeMin() + "-" + policy.getPortRangeMax()
                    + "] for host: " + hostName);
        }

        // Check active rule count per user per host
        long activeRules = natRuleRepository.countByUserIdAndHostIdAndStatus(
                userId, policy.getHost().getId(), NatRuleStatus.ACTIVE);
        if (activeRules >= policy.getMaxRules()) {
            throw new PolicyViolationException(
                    "Max rule limit (" + policy.getMaxRules() + ") reached for host: " + hostName);
        }

        // Global port-range conflict check
        boolean rangeInUse = natRuleRepository.existsByPortRangeOverlapAndStatusIn(
                portStart, portEnd, List.of(NatRuleStatus.PENDING, NatRuleStatus.ACTIVE));
        if (rangeInUse) {
            throw new PolicyViolationException(
                    "Port range " + portStart + "-" + portEnd + " overlaps with an existing rule");
        }
    }
}
