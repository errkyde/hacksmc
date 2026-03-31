package com.hacksmc.controller;

import com.hacksmc.dto.*;
import com.hacksmc.entity.ErrorLog;
import com.hacksmc.repository.BlockedPortRangeRepository;
import com.hacksmc.repository.EmailNotificationProfileRepository;
import com.hacksmc.repository.ErrorLogRepository;
import com.hacksmc.repository.NotificationSettingsRepository;
import com.hacksmc.service.AdminService;
import com.hacksmc.service.HostPingService;
import com.hacksmc.service.MaintenanceService;
import com.hacksmc.service.NatRuleService;
import com.hacksmc.service.NetworkScanService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.security.Principal;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/admin")
@RequiredArgsConstructor
public class AdminController {

    private final AdminService adminService;
    private final NetworkScanService networkScanService;
    private final HostPingService hostPingService;
    private final com.hacksmc.repository.HostRepository hostRepository;
    private final ErrorLogRepository errorLogRepository;
    private final MaintenanceService maintenanceService;
    private final NotificationSettingsRepository notificationSettingsRepository;
    private final BlockedPortRangeRepository blockedPortRangeRepository;
    private final NatRuleService natRuleService;
    private final EmailNotificationProfileRepository emailNotificationProfileRepository;

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

    @DeleteMapping("/rules/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteRule(@PathVariable Long id) {
        adminService.deleteRuleAsAdmin(id);
    }

    @DeleteMapping("/rules/bulk")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteRulesBulk(@RequestBody List<Long> ids) {
        adminService.deleteRulesAsAdmin(ids);
    }

    // ── Audit Log ──────────────────────────────────────────────────────────────

    @GetMapping("/audit-log")
    public AuditLogPage getAuditLog(
            @RequestParam(defaultValue = "0")  int page,
            @RequestParam(defaultValue = "25") int size,
            @RequestParam(required = false) String actor,
            @RequestParam(required = false) String action) {
        size = List.of(10, 25, 50).contains(size) ? size : 25;
        return adminService.getAuditLogPage(page, size, actor, action);
    }

    // ── Error Log ──────────────────────────────────────────────────────────────

    @GetMapping("/errors")
    public List<ErrorLogEntry> getErrors() {
        return errorLogRepository.findTop50ByOrderByTsDesc().stream()
                .map(e -> new ErrorLogEntry(e.getId(), e.getTs(), e.getActor(),
                        e.getMethod(), e.getPath(), e.getHttpStatus(),
                        e.getErrorType(), e.getMessage()))
                .toList();
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

    // ── System Settings ────────────────────────────────────────────────────────

    @GetMapping("/settings")
    public SystemSettingsDto getSettings() {
        return maintenanceService.toDto(maintenanceService.getSettings());
    }

    @PutMapping("/settings")
    public SystemSettingsDto updateSettings(
            @RequestBody UpdateSystemSettingsRequest req,
            Principal principal) {
        return maintenanceService.update(req, principal.getName());
    }

    // ── Test Mail ──────────────────────────────────────────────────────────────

    @PostMapping("/settings/test-mail")
    public Map<String, String> testMail(@Valid @RequestBody TestMailRequest req) {
        com.hacksmc.entity.SystemSettings s = maintenanceService.getSettings();
        org.springframework.mail.javamail.JavaMailSenderImpl sender = maintenanceService.buildMailSender(s);
        if (sender == null) {
            throw new org.springframework.web.server.ResponseStatusException(
                    org.springframework.http.HttpStatus.BAD_REQUEST, "SMTP not configured (mailHost missing)");
        }
        try {
            jakarta.mail.internet.MimeMessage msg = sender.createMimeMessage();
            org.springframework.mail.javamail.MimeMessageHelper helper =
                    new org.springframework.mail.javamail.MimeMessageHelper(msg, false, "UTF-8");
            String from = s.getMailFrom() != null ? s.getMailFrom() : s.getMailUsername();
            if (from != null && !from.isBlank()) helper.setFrom(from);
            helper.setTo(req.to());
            helper.setSubject("[HackSMC] Test-E-Mail");
            helper.setText("<html><body style=\"font-family:monospace;background:#0f1117;color:#e5e7eb;padding:32px\">"
                    + "<h2 style=\"color:#00B0F4\">HackSMC — Test-E-Mail</h2>"
                    + "<p>Die SMTP-Konfiguration funktioniert korrekt.</p>"
                    + "</body></html>", true);
            sender.send(msg);
            return Map.of("status", "ok", "message", "Test-Mail an " + req.to() + " gesendet");
        } catch (Exception e) {
            String msg = e.getMessage();
            if (msg == null) msg = e.getClass().getSimpleName();
            String friendly;
            if (msg.contains("UnknownHostException") || msg.contains("unknown host") || msg.contains("Couldn't connect to host")) {
                String host = s.getMailHost() != null ? s.getMailHost() : "?";
                friendly = "Host nicht auflösbar: " + host + " – mailHost und Netzwerk prüfen";
            } else if (msg.contains("Connection refused")) {
                friendly = "Verbindung abgelehnt – Host und Port prüfen";
            } else if (msg.contains("timeout") || msg.contains("timed out")) {
                friendly = "Verbindungs-Timeout – Host, Port und Firewall prüfen";
            } else if (msg.contains("Authentication") || msg.contains("authentication")) {
                friendly = "Authentifizierung fehlgeschlagen – Benutzername und Passwort prüfen";
            } else {
                friendly = msg.split("\n")[0];
            }
            throw new org.springframework.web.server.ResponseStatusException(
                    org.springframework.http.HttpStatus.BAD_GATEWAY, "SMTP-Fehler: " + friendly);
        }
    }

    // ── Blocked Port Ranges ────────────────────────────────────────────────────

    @GetMapping("/blocked-ranges")
    public List<BlockedPortRangeDto> getBlockedRanges() {
        return blockedPortRangeRepository.findAll().stream()
                .map(r -> new BlockedPortRangeDto(r.getId(), r.getPortStart(), r.getPortEnd(), r.getReason(), r.getCreatedAt()))
                .toList();
    }

    @PostMapping("/blocked-ranges")
    @ResponseStatus(HttpStatus.CREATED)
    public BlockedPortRangeDto createBlockedRange(
            @Valid @RequestBody CreateBlockedRangeRequest req) {
        com.hacksmc.entity.BlockedPortRange r = new com.hacksmc.entity.BlockedPortRange();
        r.setPortStart(req.portStart());
        r.setPortEnd(req.portEnd());
        r.setReason(req.reason());
        r = blockedPortRangeRepository.save(r);
        return new BlockedPortRangeDto(r.getId(), r.getPortStart(), r.getPortEnd(), r.getReason(), r.getCreatedAt());
    }

    @DeleteMapping("/blocked-ranges/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteBlockedRange(@PathVariable Long id) {
        if (!blockedPortRangeRepository.existsById(id)) {
            throw new org.springframework.web.server.ResponseStatusException(
                    org.springframework.http.HttpStatus.NOT_FOUND, "Blocked range not found");
        }
        blockedPortRangeRepository.deleteById(id);
    }

    // ── Notification Settings ──────────────────────────────────────────────────

    @GetMapping("/users/{userId}/notifications")
    public NotificationSettingsDto getNotificationSettings(@PathVariable Long userId) {
        return notificationSettingsRepository.findByUserId(userId)
                .map(ns -> toNotifDto(ns))
                .orElse(new NotificationSettingsDto(null, userId, null, false, true, true, true, true, "OWN", java.util.Set.of()));
    }

    @PutMapping("/users/{userId}/notifications")
    public NotificationSettingsDto updateNotificationSettings(
            @PathVariable Long userId,
            @RequestBody UpdateNotificationSettingsRequest req) {
        com.hacksmc.entity.User user = adminService.getUserEntity(userId);
        com.hacksmc.entity.NotificationSettings ns = notificationSettingsRepository.findByUserId(userId)
                .orElseGet(() -> {
                    com.hacksmc.entity.NotificationSettings n = new com.hacksmc.entity.NotificationSettings();
                    n.setUser(user);
                    return n;
                });
        ns.setEmail(req.email());
        ns.setEmailEnabled(req.emailEnabled());
        ns.setNotifyOnCreate(req.notifyOnCreate());
        ns.setNotifyOnDelete(req.notifyOnDelete());
        ns.setNotifyOnExpire(req.notifyOnExpire());
        ns.setNotifyAllHosts(req.notifyAllHosts());
        ns.setNotifyScope(req.notifyScope() != null ? req.notifyScope() : "OWN");
        ns.setHostFilter(req.hostFilter() != null ? req.hostFilter() : java.util.Set.of());
        ns = notificationSettingsRepository.save(ns);
        return toNotifDto(ns);
    }

    // ── Admin Expiry ───────────────────────────────────────────────────────────

    @PatchMapping("/rules/{id}/expiry")
    public com.hacksmc.entity.NatRule extendExpiryAsAdmin(@PathVariable Long id,
            @RequestBody UpdateExpiryRequest req) {
        return natRuleService.extendExpiryAsAdmin(id, req.expiresAt());
    }

    private NotificationSettingsDto toNotifDto(com.hacksmc.entity.NotificationSettings ns) {
        return new NotificationSettingsDto(
                ns.getId(), ns.getUser().getId(), ns.getEmail(), ns.isEmailEnabled(),
                ns.isNotifyOnCreate(), ns.isNotifyOnDelete(), ns.isNotifyOnExpire(),
                ns.isNotifyAllHosts(), ns.getNotifyScope(), new java.util.HashSet<>(ns.getHostFilter()));
    }

    // ── Email Notification Profiles ────────────────────────────────────────────

    @GetMapping("/email-profiles")
    public List<EmailNotificationProfileDto> getEmailProfiles() {
        return emailNotificationProfileRepository.findAllByOrderByCreatedAtAsc().stream()
                .map(this::toEmailProfileDto)
                .toList();
    }

    @PostMapping("/email-profiles")
    @ResponseStatus(HttpStatus.CREATED)
    public EmailNotificationProfileDto createEmailProfile(
            @Valid @RequestBody SaveEmailNotificationProfileRequest req) {
        com.hacksmc.entity.EmailNotificationProfile p = new com.hacksmc.entity.EmailNotificationProfile();
        applyEmailProfileRequest(p, req);
        p = emailNotificationProfileRepository.save(p);
        return toEmailProfileDto(p);
    }

    @PutMapping("/email-profiles/{id}")
    public EmailNotificationProfileDto updateEmailProfile(
            @PathVariable Long id,
            @Valid @RequestBody SaveEmailNotificationProfileRequest req) {
        com.hacksmc.entity.EmailNotificationProfile p = emailNotificationProfileRepository.findById(id)
                .orElseThrow(() -> new org.springframework.web.server.ResponseStatusException(
                        org.springframework.http.HttpStatus.NOT_FOUND, "Profile not found"));
        applyEmailProfileRequest(p, req);
        p = emailNotificationProfileRepository.save(p);
        return toEmailProfileDto(p);
    }

    @DeleteMapping("/email-profiles/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteEmailProfile(@PathVariable Long id) {
        if (!emailNotificationProfileRepository.existsById(id)) {
            throw new org.springframework.web.server.ResponseStatusException(
                    org.springframework.http.HttpStatus.NOT_FOUND, "Profile not found");
        }
        emailNotificationProfileRepository.deleteById(id);
    }

    private void applyEmailProfileRequest(com.hacksmc.entity.EmailNotificationProfile p, SaveEmailNotificationProfileRequest req) {
        p.setEmail(req.email());
        p.setNotifyOnCreate(req.notifyOnCreate());
        p.setNotifyOnDelete(req.notifyOnDelete());
        p.setNotifyOnExpire(req.notifyOnExpire());
        p.setScope(req.scope() != null ? req.scope() : "ALL");
        p.setUserIds(req.userIds() != null ? req.userIds() : java.util.Set.of());
    }

    private EmailNotificationProfileDto toEmailProfileDto(com.hacksmc.entity.EmailNotificationProfile p) {
        return new EmailNotificationProfileDto(
                p.getId(), p.getEmail(),
                p.isNotifyOnCreate(), p.isNotifyOnDelete(), p.isNotifyOnExpire(),
                p.getScope(), new java.util.HashSet<>(p.getUserIds()), p.getCreatedAt());
    }
}
