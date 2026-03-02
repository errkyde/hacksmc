package com.hacksmc.controller;

import com.hacksmc.entity.Host;
import com.hacksmc.repository.PolicyRepository;
import com.hacksmc.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.security.Principal;
import java.util.List;

@RestController
@RequestMapping("/api/hosts")
@RequiredArgsConstructor
public class HostController {

    private final PolicyRepository policyRepository;
    private final UserRepository userRepository;

    @GetMapping
    public List<Host> getHosts(Principal principal) {
        return userRepository.findByUsername(principal.getName())
                .map(user -> policyRepository.findByUserIdWithHost(user.getId())
                        .stream().map(p -> p.getHost()).toList())
                .orElse(List.of());
    }
}
