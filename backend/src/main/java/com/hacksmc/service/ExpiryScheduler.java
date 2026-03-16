package com.hacksmc.service;

import com.hacksmc.entity.NatRule;
import com.hacksmc.entity.NatRuleStatus;
import com.hacksmc.repository.NatRuleRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;

@Component
@RequiredArgsConstructor
@Slf4j
public class ExpiryScheduler {

    private final NatRuleRepository natRuleRepository;
    private final PfSenseApiClient pfSenseApiClient;
    private final AuditLogService auditLogService;

    @Scheduled(fixedRate = 60_000)
    @Transactional
    public void expireRules() {
        List<NatRule> expired = natRuleRepository.findByExpiresAtBeforeAndStatusIn(
                Instant.now(), List.of(NatRuleStatus.ACTIVE, NatRuleStatus.PENDING));

        if (expired.isEmpty()) return;
        log.info("Expiry scheduler: {} rule(s) to delete", expired.size());

        for (NatRule rule : expired) {
            try {
                String pfSenseRuleId = rule.getPfSenseRuleId();
                if (pfSenseRuleId != null && !pfSenseRuleId.equals("null") && !pfSenseRuleId.isBlank()) {
                    pfSenseApiClient.deleteNatRule(pfSenseRuleId);
                }
                rule.setStatus(NatRuleStatus.DELETED);
                rule.setDeletedAt(Instant.now());
                natRuleRepository.save(rule);
                auditLogService.log("scheduler", "NAT_RULE_EXPIRED",
                        rule.getHost().getName(),
                        rule.getProtocol() + ":" + portRangeStr(rule.getPortStart(), rule.getPortEnd()));
                log.info("Expired rule id={} ({}:{})", rule.getId(), rule.getProtocol(),
                        portRangeStr(rule.getPortStart(), rule.getPortEnd()));
            } catch (Exception e) {
                log.error("Failed to expire rule id={}: {}", rule.getId(), e.getMessage());
            }
        }
    }

    private static String portRangeStr(int portStart, int portEnd) {
        return portStart == portEnd ? String.valueOf(portStart) : portStart + "-" + portEnd;
    }
}
