package com.hacksmc.controller;

import com.hacksmc.entity.Policy;
import com.hacksmc.repository.PolicyRepository;
import com.hacksmc.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.security.Principal;
import java.util.List;

@RestController
@RequestMapping("/api/policies")
@RequiredArgsConstructor
public class PolicyController {

    private final PolicyRepository policyRepository;
    private final UserRepository userRepository;

    @GetMapping
    public List<Policy> getPolicies(Principal principal) {
        return userRepository.findByUsername(principal.getName())
                .map(user -> policyRepository.findByHostUserIdWithHost(user.getId()))
                .orElse(List.of());
    }
}
