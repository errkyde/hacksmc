package com.hacksmc;

import com.hacksmc.entity.Host;
import com.hacksmc.entity.NatRuleStatus;
import com.hacksmc.entity.Policy;
import com.hacksmc.exception.PolicyViolationException;
import com.hacksmc.repository.NatRuleRepository;
import com.hacksmc.service.PolicyEngine;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class PolicyEngineTest {

    @Mock NatRuleRepository natRuleRepository;
    @InjectMocks PolicyEngine policyEngine;

    private static final Long USER_ID = 1L;

    private Policy policy;

    @BeforeEach
    void setUp() {
        Host host = new Host();
        host.setId(10L);
        host.setName("minecraft-server");
        host.setIpAddress("192.168.10.50");

        policy = new Policy();
        policy.setId(1L);
        policy.setHost(host);
        policy.setAllowedProtocols("TCP");
        policy.setPortRangeMin(25565);
        policy.setPortRangeMax(25575);
        policy.setMaxRules(3);
    }

    @Test
    void happyPath_validRulePassesAllChecks() {
        when(natRuleRepository.countByUserIdAndHostIdAndStatus(USER_ID, 10L, NatRuleStatus.ACTIVE)).thenReturn(1L);
        when(natRuleRepository.existsByPortRangeOverlapAndStatusIn(25565, 25565, List.of(NatRuleStatus.PENDING, NatRuleStatus.ACTIVE))).thenReturn(false);

        assertThatNoException().isThrownBy(() ->
                policyEngine.validateRule(policy, "TCP", 25565, 25565, USER_ID));
    }

    @Test
    void happyPath_validRangePassesAllChecks() {
        when(natRuleRepository.countByUserIdAndHostIdAndStatus(USER_ID, 10L, NatRuleStatus.ACTIVE)).thenReturn(0L);
        when(natRuleRepository.existsByPortRangeOverlapAndStatusIn(25565, 25570, List.of(NatRuleStatus.PENDING, NatRuleStatus.ACTIVE))).thenReturn(false);

        assertThatNoException().isThrownBy(() ->
                policyEngine.validateRule(policy, "TCP", 25565, 25570, USER_ID));
    }

    @Test
    void rejectsDisallowedProtocol() {
        assertThatThrownBy(() -> policyEngine.validateRule(policy, "UDP", 25565, 25565, USER_ID))
                .isInstanceOf(PolicyViolationException.class)
                .hasMessageContaining("Protocol")
                .hasMessageContaining("UDP");
    }

    @Test
    void rejectsPortBelowRange() {
        assertThatThrownBy(() -> policyEngine.validateRule(policy, "TCP", 1000, 1000, USER_ID))
                .isInstanceOf(PolicyViolationException.class)
                .hasMessageContaining("Port")
                .hasMessageContaining("1000");
    }

    @Test
    void rejectsPortAboveRange() {
        assertThatThrownBy(() -> policyEngine.validateRule(policy, "TCP", 25576, 25576, USER_ID))
                .isInstanceOf(PolicyViolationException.class)
                .hasMessageContaining("Port");
    }

    @Test
    void rejectsRangeWhereEndExceedsMax() {
        assertThatThrownBy(() -> policyEngine.validateRule(policy, "TCP", 25570, 25580, USER_ID))
                .isInstanceOf(PolicyViolationException.class)
                .hasMessageContaining("Port range");
    }

    @Test
    void rejectsWhenMaxRulesReached() {
        when(natRuleRepository.countByUserIdAndHostIdAndStatus(USER_ID, 10L, NatRuleStatus.ACTIVE)).thenReturn(3L);

        assertThatThrownBy(() -> policyEngine.validateRule(policy, "TCP", 25565, 25565, USER_ID))
                .isInstanceOf(PolicyViolationException.class)
                .hasMessageContaining("Max rule limit");
    }

    @Test
    void rejectsWhenPortRangeOverlaps() {
        when(natRuleRepository.countByUserIdAndHostIdAndStatus(USER_ID, 10L, NatRuleStatus.ACTIVE)).thenReturn(0L);
        when(natRuleRepository.existsByPortRangeOverlapAndStatusIn(25565, 25565, List.of(NatRuleStatus.PENDING, NatRuleStatus.ACTIVE))).thenReturn(true);

        assertThatThrownBy(() -> policyEngine.validateRule(policy, "TCP", 25565, 25565, USER_ID))
                .isInstanceOf(PolicyViolationException.class)
                .hasMessageContaining("overlaps");
    }

    @Test
    void allowsMultipleProtocols() {
        policy.setAllowedProtocols("TCP,UDP");
        when(natRuleRepository.countByUserIdAndHostIdAndStatus(USER_ID, 10L, NatRuleStatus.ACTIVE)).thenReturn(0L);
        when(natRuleRepository.existsByPortRangeOverlapAndStatusIn(25565, 25565, List.of(NatRuleStatus.PENDING, NatRuleStatus.ACTIVE))).thenReturn(false);

        assertThatNoException().isThrownBy(() ->
                policyEngine.validateRule(policy, "UDP", 25565, 25565, USER_ID));
    }

    @Test
    void allowsTcpUdpWhenBothPermitted() {
        policy.setAllowedProtocols("TCP,UDP");
        when(natRuleRepository.countByUserIdAndHostIdAndStatus(USER_ID, 10L, NatRuleStatus.ACTIVE)).thenReturn(0L);
        when(natRuleRepository.existsByPortRangeOverlapAndStatusIn(25565, 25565, List.of(NatRuleStatus.PENDING, NatRuleStatus.ACTIVE))).thenReturn(false);

        assertThatNoException().isThrownBy(() ->
                policyEngine.validateRule(policy, "TCP/UDP", 25565, 25565, USER_ID));
    }

    @Test
    void rejectsTcpUdpWhenOnlyTcpPermitted() {
        // policy.allowedProtocols = "TCP" only
        assertThatThrownBy(() -> policyEngine.validateRule(policy, "TCP/UDP", 25565, 25565, USER_ID))
                .isInstanceOf(PolicyViolationException.class)
                .hasMessageContaining("Protocol")
                .hasMessageContaining("TCP/UDP");
    }

    @Test
    void protocolCheckIsCaseInsensitive() {
        when(natRuleRepository.countByUserIdAndHostIdAndStatus(USER_ID, 10L, NatRuleStatus.ACTIVE)).thenReturn(0L);
        when(natRuleRepository.existsByPortRangeOverlapAndStatusIn(25565, 25565, List.of(NatRuleStatus.PENDING, NatRuleStatus.ACTIVE))).thenReturn(false);

        assertThatNoException().isThrownBy(() ->
                policyEngine.validateRule(policy, "tcp", 25565, 25565, USER_ID));
    }
}
