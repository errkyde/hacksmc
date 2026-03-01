package com.hacksmc;

import com.hacksmc.entity.Host;
import com.hacksmc.entity.NatRuleStatus;
import com.hacksmc.entity.Policy;
import com.hacksmc.entity.User;
import com.hacksmc.exception.PolicyViolationException;
import com.hacksmc.repository.NatRuleRepository;
import com.hacksmc.repository.PolicyRepository;
import com.hacksmc.service.PolicyEngine;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class PolicyEngineTest {

    @Mock PolicyRepository policyRepository;
    @Mock NatRuleRepository natRuleRepository;
    @InjectMocks PolicyEngine policyEngine;

    private Host host;
    private Policy policy;

    @BeforeEach
    void setUp() {
        User user = new User();
        user.setId(1L);
        user.setUsername("phil");

        host = new Host();
        host.setId(10L);
        host.setName("minecraft-server");
        host.setIpAddress("192.168.10.50");
        host.setUser(user);

        policy = new Policy();
        policy.setId(1L);
        policy.setHost(host);
        policy.setAllowedProtocols("TCP");
        policy.setPortRangeMin(25565);
        policy.setPortRangeMax(25565);
        policy.setMaxRules(3);

        when(policyRepository.findByHostId(10L)).thenReturn(Optional.of(policy));
    }

    @Test
    void happyPath_validRulePassesAllChecks() {
        when(natRuleRepository.countByHostIdAndStatus(10L, NatRuleStatus.ACTIVE)).thenReturn(1L);

        assertThatNoException().isThrownBy(() ->
                policyEngine.validateRule(host, "TCP", 25565));
    }

    @Test
    void rejectsDisallowedProtocol() {
        // Protocol check throws before the rule-count query is ever reached
        assertThatThrownBy(() -> policyEngine.validateRule(host, "UDP", 25565))
                .isInstanceOf(PolicyViolationException.class)
                .hasMessageContaining("Protocol")
                .hasMessageContaining("UDP");
    }

    @Test
    void rejectsPortBelowRange() {
        // Port check throws before the rule-count query is ever reached
        assertThatThrownBy(() -> policyEngine.validateRule(host, "TCP", 1000))
                .isInstanceOf(PolicyViolationException.class)
                .hasMessageContaining("Port")
                .hasMessageContaining("1000");
    }

    @Test
    void rejectsPortAboveRange() {
        assertThatThrownBy(() -> policyEngine.validateRule(host, "TCP", 25570))
                .isInstanceOf(PolicyViolationException.class)
                .hasMessageContaining("Port");
    }

    @Test
    void rejectsWhenMaxRulesReached() {
        when(natRuleRepository.countByHostIdAndStatus(10L, NatRuleStatus.ACTIVE)).thenReturn(3L);

        assertThatThrownBy(() -> policyEngine.validateRule(host, "TCP", 25565))
                .isInstanceOf(PolicyViolationException.class)
                .hasMessageContaining("Max rule limit");
    }

    @Test
    void rejectsWhenNoPolicyDefined() {
        when(policyRepository.findByHostId(10L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> policyEngine.validateRule(host, "TCP", 25565))
                .isInstanceOf(PolicyViolationException.class)
                .hasMessageContaining("No policy");
    }

    @Test
    void allowsMultipleProtocols() {
        policy.setAllowedProtocols("TCP,UDP");
        when(natRuleRepository.countByHostIdAndStatus(10L, NatRuleStatus.ACTIVE)).thenReturn(0L);

        assertThatNoException().isThrownBy(() ->
                policyEngine.validateRule(host, "UDP", 25565));
    }

    @Test
    void protocolCheckIsCaseInsensitive() {
        when(natRuleRepository.countByHostIdAndStatus(10L, NatRuleStatus.ACTIVE)).thenReturn(0L);

        assertThatNoException().isThrownBy(() ->
                policyEngine.validateRule(host, "tcp", 25565));
    }
}
