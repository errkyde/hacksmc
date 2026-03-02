package com.hacksmc.service;

import com.hacksmc.entity.NatRule;
import com.hacksmc.entity.NatRuleStatus;
import com.hacksmc.repository.NatRuleRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.List;
import java.util.Set;

@Service
@RequiredArgsConstructor
@Slf4j
public class PfSenseSyncService {

    private final NatRuleRepository natRuleRepository;
    private final PfSenseApiClient pfSenseApiClient;

    @Scheduled(fixedDelay = 60_000)
    public void syncNatRules() {
        Set<String> pfSenseTrackers;
        try {
            pfSenseTrackers = pfSenseApiClient.getNatRuleTrackers();
        } catch (Exception e) {
            log.warn("pfSense sync skipped (pfSense nicht erreichbar): {}", e.getMessage());
            return;
        }

        List<NatRule> activeRules = natRuleRepository.findByStatus(NatRuleStatus.ACTIVE);
        int marked = 0;
        for (NatRule rule : activeRules) {
            String tracker = rule.getPfSenseRuleId();
            if (tracker == null || tracker.isBlank() || tracker.equals("null")) continue;
            if (!pfSenseTrackers.contains(tracker)) {
                rule.setStatus(NatRuleStatus.DELETED);
                rule.setDeletedAt(Instant.now());
                natRuleRepository.save(rule);
                marked++;
                log.warn("Sync: Regel {} (tracker={}) nicht mehr in pfSense — als DELETED markiert",
                        rule.getId(), tracker);
            }
        }

        if (marked > 0) {
            log.info("pfSense Sync abgeschlossen: {} Regel(n) als DELETED markiert", marked);
        } else {
            log.debug("pfSense Sync: alle {} aktiven Regeln in pfSense bestätigt", activeRules.size());
        }
    }
}
