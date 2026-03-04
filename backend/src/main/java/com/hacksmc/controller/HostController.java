package com.hacksmc.controller;

import com.hacksmc.entity.Host;
import com.hacksmc.repository.PolicyRepository;
import com.hacksmc.repository.UserRepository;
import com.hacksmc.service.HostPingService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.security.Principal;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/hosts")
@RequiredArgsConstructor
public class HostController {

    private final PolicyRepository policyRepository;
    private final UserRepository userRepository;
    private final HostPingService hostPingService;

    @GetMapping
    public List<Host> getHosts(Principal principal) {
        return userRepository.findByUsername(principal.getName())
                .map(user -> policyRepository.findByUserIdWithHost(user.getId())
                        .stream().map(p -> p.getHost()).toList())
                .orElse(List.of());
    }

    @GetMapping("/status")
    public Map<Long, Boolean> getHostStatus(Principal principal) {
        List<Host> hosts = userRepository.findByUsername(principal.getName())
                .map(user -> policyRepository.findByUserIdWithHost(user.getId())
                        .stream().map(p -> p.getHost()).toList())
                .orElse(List.of());
        return hostPingService.checkHosts(hosts);
    }
}
