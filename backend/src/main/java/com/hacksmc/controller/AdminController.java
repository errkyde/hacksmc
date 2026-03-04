package com.hacksmc.controller;

import com.hacksmc.dto.*;
import com.hacksmc.service.AdminService;
import com.hacksmc.service.HostPingService;
import com.hacksmc.service.NetworkScanService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/admin")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
public class AdminController {

    private final AdminService adminService;
    private final NetworkScanService networkScanService;
    private final HostPingService hostPingService;
    private final com.hacksmc.repository.HostRepository hostRepository;

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

    // ── Global Hosts ───────────────────────────────────────────────────────────

    @GetMapping("/hosts")
    public List<HostDto> getAllHosts() {
        return adminService.getAllHosts();
    }

    @PostMapping("/hosts")
    @ResponseStatus(HttpStatus.CREATED)
    public HostDto createHost(@Valid @RequestBody CreateHostRequest req) {
        return adminService.createHost(req);
    }

    @PatchMapping("/hosts/{hostId}")
    public HostDto updateHost(@PathVariable Long hostId, @Valid @RequestBody UpdateHostRequest req) {
        return adminService.updateHost(hostId, req);
    }

    @DeleteMapping("/hosts/{hostId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteHost(@PathVariable Long hostId,
                           @RequestParam(defaultValue = "false") boolean deleteRules) {
        adminService.deleteHost(hostId, deleteRules);
    }

    // ── User-Host Assignments ──────────────────────────────────────────────────

    @GetMapping("/users/{id}/hosts")
    public List<HostDto> getUserHosts(@PathVariable Long id) {
        return adminService.getHostsForUser(id);
    }

    @PostMapping("/users/{userId}/hosts/{hostId}")
    @ResponseStatus(HttpStatus.CREATED)
    public HostDto assignHost(@PathVariable Long userId,
                              @PathVariable Long hostId,
                              @Valid @RequestBody AssignHostRequest req) {
        return adminService.assignHostToUser(userId, hostId, req);
    }

    @DeleteMapping("/users/{userId}/hosts/{hostId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void unassignHost(@PathVariable Long userId, @PathVariable Long hostId) {
        adminService.unassignHostFromUser(userId, hostId);
    }

    @PutMapping("/users/{userId}/hosts/{hostId}/policy")
    public PolicyDto updatePolicy(@PathVariable Long userId,
                                  @PathVariable Long hostId,
                                  @Valid @RequestBody UpdatePolicyRequest req) {
        return adminService.updatePolicy(userId, hostId, req);
    }

    @GetMapping("/users/{id}/overview")
    public UserOverviewResponse getUserOverview(@PathVariable Long id) {
        return adminService.getUserOverview(id);
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

    // ── Host Status ────────────────────────────────────────────────────────────

    @GetMapping("/hosts/status")
    public Map<Long, Boolean> getHostStatus() {
        return hostPingService.checkHosts(hostRepository.findAll());
    }

    // ── Network Scan ───────────────────────────────────────────────────────────

    @PostMapping("/hosts/scan")
    public List<ScannedHostResult> scanNetwork(@Valid @RequestBody NetworkScanRequest req) {
        return networkScanService.scan(req.getSubnet());
    }
}
