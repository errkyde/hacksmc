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
     * Throws PolicyViolationException (-> 403) if any check fails.
     */
    public void validateRule(Policy policy, String protocol, int port, Long userId) {
        String hostName = policy.getHost().getName();

        // Check protocol
        boolean protocolAllowed = Arrays.stream(policy.getAllowedProtocols().split(","))
                .map(String::trim)
                .anyMatch(p -> p.equalsIgnoreCase(protocol));
        if (!protocolAllowed) {
            throw new PolicyViolationException(
                    "Protocol '" + protocol + "' not allowed for host: " + hostName
                    + ". Allowed: " + policy.getAllowedProtocols());
        }

        // Check port range
        if (port < policy.getPortRangeMin() || port > policy.getPortRangeMax()) {
            throw new PolicyViolationException(
                    "Port " + port + " outside allowed range ["
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

        // Global port conflict check
        boolean portInUse = natRuleRepository.existsByPortAndStatusIn(
                port, List.of(NatRuleStatus.PENDING, NatRuleStatus.ACTIVE));
        if (portInUse) {
            throw new PolicyViolationException(
                    "Port " + port + " is already in use by another rule");
        }
    }
}
