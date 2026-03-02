package com.hacksmc.service;

import com.hacksmc.dto.CreateNatRuleRequest;
import com.hacksmc.entity.Host;
import com.hacksmc.entity.NatRule;
import com.hacksmc.entity.NatRuleStatus;
import com.hacksmc.entity.Policy;
import com.hacksmc.entity.User;
import com.hacksmc.repository.NatRuleRepository;
import com.hacksmc.repository.PolicyRepository;
import com.hacksmc.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.NoSuchElementException;

@Service
@RequiredArgsConstructor
@Slf4j
public class NatRuleService {

    private final NatRuleRepository natRuleRepository;
    private final PolicyRepository policyRepository;
    private final UserRepository userRepository;
    private final PolicyEngine policyEngine;
    private final PfSenseApiClient pfSenseApiClient;
    private final AuditLogService auditLogService;

    @Transactional
    public List<NatRule> getRulesForUser(String username) {
        User user = getUser(username);
        List<NatRule> rules = natRuleRepository.findByUserIdWithHost(user.getId());

        // Fetch live pfSense state and reconcile before returning
        try {
            Map<String, Integer> pfSenseTrackers = pfSenseApiClient.getNatRuleTrackerPositions();
            for (NatRule rule : rules) {
                if (rule.getStatus() == NatRuleStatus.DELETED) continue;

                String tracker = rule.getPfSenseRuleId();
                boolean hasValidTracker = tracker != null && !tracker.isBlank() && !tracker.equals("null");

                if (!hasValidTracker) {
                    // Never made it to pfSense
                    rule.setStatus(NatRuleStatus.DELETED);
                    rule.setDeletedAt(Instant.now());
                    natRuleRepository.save(rule);
                } else if (!pfSenseTrackers.containsKey(tracker)) {
                    // Was in pfSense but is gone now (deleted directly in pfSense WebUI)
                    rule.setStatus(NatRuleStatus.DELETED);
                    rule.setDeletedAt(Instant.now());
                    rule.setPfSensePosition(null);
                    natRuleRepository.save(rule);
                } else {
                    // Still active — update position
                    Integer pos = pfSenseTrackers.get(tracker);
                    if (!pos.equals(rule.getPfSensePosition())) {
                        rule.setPfSensePosition(pos);
                        natRuleRepository.save(rule);
                    }
                }
            }
        } catch (Exception e) {
            log.warn("pfSense live-check beim GET fehlgeschlagen, zeige DB-Stand: {}", e.getMessage());
        }

        return rules;
    }

    @Transactional
    public NatRule createRule(String username, CreateNatRuleRequest request) {
        User user = getUser(username);

        // Verify user has a policy (assignment) for this host
        Policy policy = policyRepository.findByUserIdAndHostId(user.getId(), request.hostId())
                .orElseThrow(() -> new AccessDeniedException("Host not found or not assigned to user"));
        Host host = policy.getHost();

        // Policy check (throws PolicyViolationException -> 403)
        policyEngine.validateRule(policy, request.protocol(), request.port(), user.getId());

        // Persist as PENDING before calling pfSense
        NatRule rule = new NatRule();
        rule.setHost(host);
        rule.setUser(user);
        rule.setProtocol(request.protocol().toUpperCase());
        rule.setPort(request.port());
        rule.setDescription(request.description());
        rule.setStatus(NatRuleStatus.PENDING);
        natRuleRepository.save(rule);

        // Call pfSense
        String pfSenseId = pfSenseApiClient.createNatRule(
                host.getIpAddress(), request.protocol(), request.port(),
                request.description() != null ? request.description() : "HackSMC rule #" + rule.getId()
        );

        rule.setPfSenseRuleId(pfSenseId);
        rule.setStatus(NatRuleStatus.ACTIVE);
        natRuleRepository.save(rule);
        auditLogService.log(username, "NAT_RULE_CREATED", host.getName(),
                request.protocol().toUpperCase() + ":" + request.port());
        return rule;
    }

    @Transactional
    public void deleteRule(String username, Long ruleId) {
        User user = getUser(username);
        NatRule rule = natRuleRepository.findByIdAndUserId(ruleId, user.getId())
                .orElseThrow(() -> new AccessDeniedException("Rule not found or not owned by user"));

        if (rule.getStatus() == NatRuleStatus.DELETED) {
            throw new NoSuchElementException("Rule already deleted");
        }

        String pfSenseRuleId = rule.getPfSenseRuleId();
        if (pfSenseRuleId != null && !pfSenseRuleId.equals("null") && !pfSenseRuleId.isBlank()) {
            pfSenseApiClient.deleteNatRule(pfSenseRuleId);
        }

        rule.setStatus(NatRuleStatus.DELETED);
        rule.setDeletedAt(Instant.now());
        natRuleRepository.save(rule);
        auditLogService.log(username, "NAT_RULE_DELETED", rule.getHost().getName(),
                rule.getProtocol() + ":" + rule.getPort());
    }

    private User getUser(String username) {
        return userRepository.findByUsername(username)
                .orElseThrow(() -> new NoSuchElementException("User not found: " + username));
    }
}
