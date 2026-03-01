package com.hacksmc.controller;

import com.hacksmc.dto.CreateNatRuleRequest;
import com.hacksmc.entity.NatRule;
import com.hacksmc.service.NatRuleService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.security.Principal;
import java.util.List;

@RestController
@RequestMapping("/api/nat/rules")
@RequiredArgsConstructor
public class NatRuleController {

    private final NatRuleService natRuleService;

    @GetMapping
    public List<NatRule> getRules(Principal principal) {
        return natRuleService.getRulesForUser(principal.getName());
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public NatRule createRule(Principal principal,
                              @Valid @RequestBody CreateNatRuleRequest request) {
        return natRuleService.createRule(principal.getName(), request);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteRule(Principal principal, @PathVariable Long id) {
        natRuleService.deleteRule(principal.getName(), id);
    }
}
