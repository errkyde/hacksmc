package com.hacksmc.service;

import com.hacksmc.entity.Host;
import com.hacksmc.entity.NatRuleStatus;
import com.hacksmc.entity.Policy;
import com.hacksmc.exception.PolicyViolationException;
import com.hacksmc.repository.NatRuleRepository;
import com.hacksmc.repository.PolicyRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.Arrays;
import java.util.List;

@Service
@RequiredArgsConstructor
public class PolicyEngine {

    private final PolicyRepository policyRepository;
    private final NatRuleRepository natRuleRepository;

    /**
     * Validates that a new NAT rule is allowed by the host's policy.
     * Throws PolicyViolationException (-> 403) if any check fails.
     */
    public void validateRule(Host host, String protocol, int port) {
        Policy policy = policyRepository.findByHostId(host.getId())
                .orElseThrow(() -> new PolicyViolationException(
                        "No policy defined for host: " + host.getName()));

        // Check protocol
        boolean protocolAllowed = Arrays.stream(policy.getAllowedProtocols().split(","))
                .map(String::trim)
                .anyMatch(p -> p.equalsIgnoreCase(protocol));
        if (!protocolAllowed) {
            throw new PolicyViolationException(
                    "Protocol '" + protocol + "' not allowed for host: " + host.getName()
                    + ". Allowed: " + policy.getAllowedProtocols());
        }

        // Check port range
        if (port < policy.getPortRangeMin() || port > policy.getPortRangeMax()) {
            throw new PolicyViolationException(
                    "Port " + port + " outside allowed range ["
                    + policy.getPortRangeMin() + "-" + policy.getPortRangeMax()
                    + "] for host: " + host.getName());
        }

        // Check active rule count
        long activeRules = natRuleRepository.countByHostIdAndStatus(host.getId(), NatRuleStatus.ACTIVE);
        if (activeRules >= policy.getMaxRules()) {
            throw new PolicyViolationException(
                    "Max rule limit (" + policy.getMaxRules() + ") reached for host: " + host.getName());
        }

        // Global port conflict check — port must be free across all users and hosts
        boolean portInUse = natRuleRepository.existsByPortAndStatusIn(
                port, List.of(NatRuleStatus.PENDING, NatRuleStatus.ACTIVE));
        if (portInUse) {
            throw new PolicyViolationException(
                    "Port " + port + " is already in use by another rule");
        }
    }
}
