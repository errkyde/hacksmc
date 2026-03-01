package com.hacksmc.controller;

import com.hacksmc.dto.*;
import com.hacksmc.service.AdminService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/admin")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
public class AdminController {

    private final AdminService adminService;

    // ── Users ──────────────────────────────────────────────────────────────────

    @GetMapping("/users")
    public List<AdminUserResponse> getUsers() {
        return adminService.getAllUsers();
    }

    @PostMapping("/users")
    @ResponseStatus(HttpStatus.CREATED)
    public AdminUserResponse createUser(@Valid @RequestBody CreateUserRequest req) {
        return adminService.createUser(req);
    }

    @DeleteMapping("/users/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteUser(@PathVariable Long id) {
        adminService.deleteUser(id);
    }

    @PutMapping("/users/{id}/password")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void resetPassword(@PathVariable Long id, @Valid @RequestBody AdminResetPasswordRequest req) {
        adminService.resetPassword(id, req);
    }

    @PatchMapping("/users/{id}/enabled")
    public AdminUserResponse setUserEnabled(@PathVariable Long id,
                                            @RequestBody SetUserEnabledRequest req) {
        return adminService.setUserEnabled(id, req.enabled());
    }

    // ── Hosts ──────────────────────────────────────────────────────────────────

    @GetMapping("/users/{id}/hosts")
    public List<HostDto> getUserHosts(@PathVariable Long id) {
        return adminService.getHostsForUser(id);
    }

    @PostMapping("/users/{id}/hosts")
    @ResponseStatus(HttpStatus.CREATED)
    public HostDto createHost(@PathVariable Long id,
                              @Valid @RequestBody CreateHostRequest req) {
        return adminService.createHost(id, req);
    }

    @DeleteMapping("/hosts/{hostId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteHost(@PathVariable Long hostId) {
        adminService.deleteHost(hostId);
    }

    // ── NAT Rules ──────────────────────────────────────────────────────────────

    @GetMapping("/rules")
    public List<AdminNatRuleResponse> getAllNatRules() {
        return adminService.getAllNatRules();
    }

    // ── Audit Log ──────────────────────────────────────────────────────────────

    @GetMapping("/audit-log")
    public List<AuditLogEntry> getAuditLog() {
        return adminService.getAuditLog();
    }

    // ── pfSense Status ─────────────────────────────────────────────────────────

    @GetMapping("/pfsense/status")
    public PfSenseStatusResponse getPfSenseStatus() {
        return adminService.getPfSenseStatus();
    }

    // ── Policies ───────────────────────────────────────────────────────────────

    @PutMapping("/hosts/{hostId}/policy")
    public PolicyDto updatePolicy(@PathVariable Long hostId,
                                  @Valid @RequestBody UpdatePolicyRequest req) {
        return adminService.updatePolicy(hostId, req);
    }
}
