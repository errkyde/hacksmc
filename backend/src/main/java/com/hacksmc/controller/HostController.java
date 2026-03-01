package com.hacksmc.controller;

import com.hacksmc.entity.Host;
import com.hacksmc.repository.HostRepository;
import com.hacksmc.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.security.Principal;
import java.util.List;

@RestController
@RequestMapping("/api/hosts")
@RequiredArgsConstructor
public class HostController {

    private final HostRepository hostRepository;
    private final UserRepository userRepository;

    @GetMapping
    public List<Host> getHosts(Principal principal) {
        return userRepository.findByUsername(principal.getName())
                .map(user -> hostRepository.findByUserId(user.getId()))
                .orElse(List.of());
    }
}
