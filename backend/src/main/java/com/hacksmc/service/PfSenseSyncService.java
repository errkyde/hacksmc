package com.hacksmc.service;

import com.hacksmc.entity.NatRule;
import com.hacksmc.entity.NatRuleStatus;
import com.hacksmc.repository.NatRuleRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
@Slf4j
public class PfSenseSyncService {

    private final NatRuleRepository natRuleRepository;
    private final PfSenseApiClient pfSenseApiClient;

    @Scheduled(fixedDelay = 60_000, initialDelay = 30_000)
    @Transactional
    public void syncNatRules() {
        // tracker -> array index (position in pfSense)
        Map<String, Integer> trackerToPosition;
        try {
            trackerToPosition = pfSenseApiClient.getHsmcRulePositions();
        } catch (Exception e) {
            log.warn("pfSense sync skipped (pfSense nicht erreichbar): {}", e.getMessage());
            return;
        }

        List<NatRule> activeRules = natRuleRepository.findByStatus(NatRuleStatus.ACTIVE);
        int marked = 0;
        int updated = 0;
        for (NatRule rule : activeRules) {
            String tracker = rule.getPfSenseRuleId();
            if (tracker == null || tracker.isBlank() || tracker.equals("null")) {
                // Never made it to pfSense — clean up
                rule.setStatus(NatRuleStatus.DELETED);
                rule.setDeletedAt(Instant.now());
                natRuleRepository.save(rule);
                marked++;
                log.warn("Sync: Regel {} hat keinen pfSense-Tracker — als DELETED markiert", rule.getId());
                continue;
            }

            if (!trackerToPosition.containsKey(tracker)) {
                rule.setStatus(NatRuleStatus.DELETED);
                rule.setDeletedAt(Instant.now());
                rule.setPfSensePosition(null);
                natRuleRepository.save(rule);
                marked++;
                log.warn("Sync: Regel {} (tracker={}) nicht mehr in pfSense — als DELETED markiert",
                        rule.getId(), tracker);
            } else {
                Integer pos = trackerToPosition.get(tracker);
                if (!pos.equals(rule.getPfSensePosition())) {
                    rule.setPfSensePosition(pos);
                    natRuleRepository.save(rule);
                    updated++;
                }
            }
        }

        log.info("pfSense Sync: {} aktiv, {} position(en) aktualisiert, {} als DELETED markiert",
                activeRules.size(), updated, marked);
    }
}
