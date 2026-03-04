package com.hacksmc.service;

import com.hacksmc.dto.*;
import com.hacksmc.entity.Host;
import com.hacksmc.entity.Policy;
import com.hacksmc.entity.User;
import com.hacksmc.repository.HostRepository;
import com.hacksmc.repository.NatRuleRepository;
import com.hacksmc.repository.PolicyRepository;
import com.hacksmc.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import com.hacksmc.entity.NatRuleStatus;

import java.util.List;

@Service
@RequiredArgsConstructor
@Transactional
public class AdminService {

    private final UserRepository userRepository;
    private final HostRepository hostRepository;
    private final PolicyRepository policyRepository;
    private final NatRuleRepository natRuleRepository;
    private final PasswordEncoder passwordEncoder;
    private final AuditLogService auditLogService;
    private final PfSenseApiClient pfSenseApiClient;

    // ── NAT Rules ──────────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public List<AdminNatRuleResponse> getAllNatRules() {
        return natRuleRepository.findAllWithUserAndHost().stream()
                .map(r -> new AdminNatRuleResponse(
                        r.getId(),
                        r.getUser().getUsername(),
                        r.getHost().getName(),
                        r.getHost().getIpAddress(),
                        r.getProtocol(),
                        r.getPort(),
                        r.getDescription(),
                        r.getPfSenseRuleId(),
                        r.getStatus().name(),
                        r.getCreatedAt(),
                        r.getDeletedAt()
                ))
                .toList();
    }

    // ── Users ──────────────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public List<AdminUserResponse> getAllUsers() {
        return userRepository.findAll().stream()
                .map(u -> new AdminUserResponse(
                        u.getId(),
                        u.getUsername(),
                        u.getRole(),
                        policyRepository.countByUserId(u.getId()),
                        u.isEnabled()))
                .toList();
    }

    public AdminUserResponse createUser(CreateUserRequest req) {
        if (userRepository.findByUsername(req.username()).isPresent()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Username already exists");
        }
        User user = new User();
        user.setUsername(req.username());
        user.setPasswordHash(passwordEncoder.encode(req.password()));
        user.setRole(req.role() != null ? req.role() : "USER");
        user = userRepository.save(user);
        auditLogService.log(currentAdmin(), "USER_CREATED", user.getUsername(), "ROLE: " + user.getRole());
        return new AdminUserResponse(user.getId(), user.getUsername(), user.getRole(), 0, user.isEnabled());
    }

    public void deleteUser(Long id) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));
        String username = user.getUsername();
        userRepository.deleteById(id);
        auditLogService.log(currentAdmin(), "USER_DELETED", username, null);
    }

    public AdminUserResponse resetPassword(Long id, AdminResetPasswordRequest req) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));
        user.setPasswordHash(passwordEncoder.encode(req.newPassword()));
        userRepository.save(user);
        auditLogService.log(currentAdmin(), "PASSWORD_RESET", user.getUsername(), null);
        return toAdminUserResponse(user);
    }

    public AdminUserResponse setUserEnabled(Long id, boolean enabled) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));
        user.setEnabled(enabled);
        userRepository.save(user);
        auditLogService.log(currentAdmin(), enabled ? "USER_ENABLED" : "USER_DISABLED", user.getUsername(), null);
        return toAdminUserResponse(user);
    }

    @Transactional(readOnly = true)
    public List<AuditLogEntry> getAuditLog() {
        return auditLogService.getRecent();
    }

    @Transactional(readOnly = true)
    public PfSenseStatusResponse getPfSenseStatus() {
        return pfSenseApiClient.checkHealth();
    }

    // ── Global Hosts ───────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public List<HostDto> getAllHosts() {
        return hostRepository.findAll().stream()
                .map(h -> toHostDtoWithStats(h, null))
                .toList();
    }

    public HostDto createHost(CreateHostRequest req) {
        Host host = new Host();
        host.setName(req.name());
        host.setIpAddress(req.ipAddress());
        host.setDescription(req.description());
        host = hostRepository.save(host);
        return toHostDto(host, null);
    }

    public void deleteHost(Long hostId) {
        if (!hostRepository.existsById(hostId)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Host not found");
        }
        hostRepository.deleteById(hostId);
    }

    // ── User-Host Assignments ──────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public List<HostDto> getHostsForUser(Long userId) {
        if (!userRepository.existsById(userId)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found");
        }
        return policyRepository.findByUserIdWithHost(userId).stream()
                .map(p -> toHostDto(p.getHost(), p))
                .toList();
    }

    public HostDto assignHostToUser(Long userId, Long hostId, AssignHostRequest req) {
        if (req.portRangeMin() > req.portRangeMax()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "portRangeMin must be ≤ portRangeMax");
        }
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));
        Host host = hostRepository.findById(hostId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Host not found"));
        if (policyRepository.existsByUserIdAndHostId(userId, hostId)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Host already assigned to user");
        }

        Policy policy = new Policy();
        policy.setUser(user);
        policy.setHost(host);
        policy.setAllowedProtocols(req.allowedProtocols());
        policy.setPortRangeMin(req.portRangeMin());
        policy.setPortRangeMax(req.portRangeMax());
        policy.setMaxRules(req.maxRules());
        policyRepository.save(policy);

        return toHostDto(host, policy);
    }

    public void unassignHostFromUser(Long userId, Long hostId) {
        Policy policy = policyRepository.findByUserIdAndHostId(userId, hostId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Assignment not found"));
        policyRepository.delete(policy);
    }

    // ── Policies ───────────────────────────────────────────────────────────────

    public PolicyDto updatePolicy(Long userId, Long hostId, UpdatePolicyRequest req) {
        if (req.portRangeMin() > req.portRangeMax()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "portRangeMin must be ≤ portRangeMax");
        }
        Policy policy = policyRepository.findByUserIdAndHostId(userId, hostId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Policy not found"));
        policy.setAllowedProtocols(req.allowedProtocols());
        policy.setPortRangeMin(req.portRangeMin());
        policy.setPortRangeMax(req.portRangeMax());
        policy.setMaxRules(req.maxRules());
        policy = policyRepository.save(policy);
        return toPolicyDto(policy);
    }

    // ── User Overview ──────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public UserOverviewResponse getUserOverview(Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));

        List<HostDto> hosts = policyRepository.findByUserIdWithHost(userId).stream()
                .map(p -> toHostDto(p.getHost(), p))
                .toList();

        List<AdminNatRuleResponse> allRules = natRuleRepository.findByUserIdWithHost(userId).stream()
                .map(r -> new AdminNatRuleResponse(
                        r.getId(),
                        user.getUsername(),
                        r.getHost().getName(),
                        r.getHost().getIpAddress(),
                        r.getProtocol(),
                        r.getPort(),
                        r.getDescription(),
                        r.getPfSenseRuleId(),
                        r.getStatus().name(),
                        r.getCreatedAt(),
                        r.getDeletedAt()
                ))
                .toList();

        long active  = allRules.stream().filter(r -> "ACTIVE".equals(r.status())).count();
        long pending = allRules.stream().filter(r -> "PENDING".equals(r.status())).count();
        long deleted = allRules.stream().filter(r -> "DELETED".equals(r.status())).count();

        List<AdminNatRuleResponse> recentRules = allRules.stream()
                .sorted((a, b) -> b.createdAt().compareTo(a.createdAt()))
                .limit(10)
                .toList();

        return new UserOverviewResponse(
                user.getId(),
                user.getUsername(),
                user.getRole(),
                user.isEnabled(),
                hosts.size(),
                (int) active,
                (int) pending,
                (int) deleted,
                hosts,
                recentRules
        );
    }

    // ── Helpers ────────────────────────────────────────────────────────────────

    private String currentAdmin() {
        return SecurityContextHolder.getContext().getAuthentication().getName();
    }

    private AdminUserResponse toAdminUserResponse(User user) {
        return new AdminUserResponse(user.getId(), user.getUsername(), user.getRole(),
                policyRepository.countByUserId(user.getId()), user.isEnabled());
    }

    private HostDto toHostDto(Host host, Policy policy) {
        return new HostDto(
                host.getId(),
                host.getName(),
                host.getIpAddress(),
                host.getDescription(),
                policy != null ? toPolicyDto(policy) : null,
                0, 0, List.<AssignedUserRef>of()
        );
    }

    private HostDto toHostDtoWithStats(Host host, Policy policy) {
        int userCount = (int) policyRepository.countByHostId(host.getId());
        int activeRuleCount = (int) natRuleRepository.countByHostIdAndStatus(host.getId(), NatRuleStatus.ACTIVE);
        List<AssignedUserRef> assignedUsers = policyRepository.findByHostIdWithUser(host.getId()).stream()
                .map(p -> new AssignedUserRef(p.getUser().getId(), p.getUser().getUsername()))
                .toList();
        return new HostDto(
                host.getId(),
                host.getName(),
                host.getIpAddress(),
                host.getDescription(),
                policy != null ? toPolicyDto(policy) : null,
                userCount,
                activeRuleCount,
                assignedUsers
        );
    }

    private PolicyDto toPolicyDto(Policy p) {
        return new PolicyDto(p.getId(), p.getAllowedProtocols(),
                p.getPortRangeMin(), p.getPortRangeMax(), p.getMaxRules());
    }
}
