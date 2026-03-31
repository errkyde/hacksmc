package com.hacksmc.service;

import com.hacksmc.dto.*;
import com.hacksmc.entity.*;
import com.hacksmc.exception.PolicyViolationException;
import com.hacksmc.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.NoSuchElementException;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
@Transactional
public class NetworkTopologyService {

    private final NetworkGroupRepository groupRepo;
    private final NetworkDeviceRepository deviceRepo;
    private final NetworkConnectionRepository connectionRepo;
    private final UserRepository userRepo;
    private final HostRepository hostRepo;
    private final PolicyRepository policyRepo;
    private final NatRuleRepository natRuleRepo;
    private final NatRuleService natRuleService;
    private final AdminService adminService;
    private final PfSenseApiClient pfSenseApiClient;
    private final DeviceTypeDetector deviceTypeDetector;

    @Value("${hacksmc.pfsense.base-url}")
    private String pfSenseBaseUrl;

    // ── Groups ────────────────────────────────────────────────────────────────

    public List<NetworkGroupDto> listGroups() {
        return groupRepo.findAllByOrderByLayerOrderAsc().stream().map(this::toDto).toList();
    }

    public NetworkGroupDto createGroup(CreateNetworkGroupRequest req) {
        NetworkGroup g = new NetworkGroup();
        g.setName(req.name());
        g.setColor(req.color() != null ? req.color() : "#64748b");
        g.setLayerOrder(req.layerOrder());
        return toDto(groupRepo.save(g));
    }

    public NetworkGroupDto updateGroup(Long id, UpdateNetworkGroupRequest req) {
        NetworkGroup g = groupRepo.findById(id)
                .orElseThrow(() -> new NoSuchElementException("Group not found: " + id));
        if (req.name() != null) g.setName(req.name());
        if (req.color() != null) g.setColor(req.color());
        if (req.layerOrder() != null) g.setLayerOrder(req.layerOrder());
        if (req.collapsed() != null) g.setCollapsed(req.collapsed());
        if (req.hidden() != null) g.setHidden(req.hidden());
        return toDto(groupRepo.save(g));
    }

    public void deleteGroup(Long id) {
        if (!groupRepo.existsById(id)) throw new NoSuchElementException("Group not found: " + id);
        groupRepo.deleteById(id);
    }

    // ── Devices (admin) ───────────────────────────────────────────────────────

    public List<NetworkDeviceDto> listAllDevices() {
        return deviceRepo.findAllByOrderByCreatedAtAsc().stream().map(this::toDto).toList();
    }

    public NetworkDeviceDto createDevice(CreateNetworkDeviceRequest req) {
        NetworkDevice d = new NetworkDevice();
        d.setName(req.name());
        d.setIpAddress(req.ipAddress());
        d.setMacAddress(req.macAddress());
        d.setHostname(req.hostname());
        d.setDescription(req.description());
        d.setDeviceType(req.deviceType() != null ? req.deviceType() : "UNKNOWN");
        d.setPosX(req.posX());
        d.setPosY(req.posY());
        d.setManual(true);
        d.setShared(req.isShared());
        if (req.groupId() != null) {
            d.setGroup(groupRepo.findById(req.groupId())
                    .orElseThrow(() -> new NoSuchElementException("Group not found: " + req.groupId())));
        }
        if (req.hostId() != null) {
            d.setHost(hostRepo.getReferenceById(req.hostId()));
        }
        return toDto(deviceRepo.save(d));
    }

    public NetworkDeviceDto patchDevice(Long id, PatchNetworkDeviceRequest req) {
        NetworkDevice d = deviceRepo.findById(id)
                .orElseThrow(() -> new NoSuchElementException("Device not found: " + id));
        if (req.name() != null) d.setName(req.name());
        if (req.description() != null) d.setDescription(req.description());
        if (req.deviceType() != null) d.setDeviceType(req.deviceType());
        if (req.posX() != null) d.setPosX(req.posX());
        if (req.posY() != null) d.setPosY(req.posY());
        if (req.isShared() != null) d.setShared(req.isShared());
        if (req.pfSenseInterface() != null) {
            d.setPfSenseInterface(req.pfSenseInterface().isBlank() ? null : req.pfSenseInterface());
        }
        if (req.groupId() != null) {
            if (req.groupId() == 0L) {
                d.setGroup(null);
            } else {
                d.setGroup(groupRepo.findById(req.groupId())
                        .orElseThrow(() -> new NoSuchElementException("Group not found: " + req.groupId())));
            }
        }
        return toDto(deviceRepo.save(d));
    }

    public void deleteDevice(Long id) {
        if (!deviceRepo.existsById(id)) throw new NoSuchElementException("Device not found: " + id);
        deviceRepo.deleteById(id);
    }

    public int importFromScan(List<ScannedHostResult> results) {
        int count = 0;
        for (ScannedHostResult r : results) {
            if (r.getIpAddress() == null) continue;
            if (deviceRepo.existsByIpAddress(r.getIpAddress())) continue;
            String type = deviceTypeDetector.detect(r.getIpAddress(), r.getOpenPorts(), pfSenseBaseUrl);
            NetworkDevice d = new NetworkDevice();
            d.setName(r.getHostname() != null ? r.getHostname() : r.getIpAddress());
            d.setIpAddress(r.getIpAddress());
            d.setHostname(r.getHostname());
            d.setDeviceType(type);
            d.setManual(false);
            d.setShared(false);
            deviceRepo.save(d);
            count++;
        }
        return count;
    }

    public int importArpTable() {
        List<ArpEntryDto> arpEntries = pfSenseApiClient.fetchArpTable();
        if (arpEntries.isEmpty()) {
            log.info("ARP import: no entries returned from pfSense");
            return 0;
        }

        // Build/find one NetworkGroup per unique interface — used for VLAN grouping.
        // pfSense REST v2 returns the human-readable name directly in the "interface" field
        // (e.g. "WAN", "LAN", "VLAN10") so no secondary interface-list API call is needed.
        Set<String> uniqueIfaces = arpEntries.stream()
                .map(ArpEntryDto::iface).filter(Objects::nonNull)
                .collect(Collectors.toCollection(LinkedHashSet::new));

        Map<String, NetworkGroup> ifaceGroupMap = new HashMap<>();
        for (String iface : uniqueIfaces) {
            final String gName = iface;
            NetworkGroup group = groupRepo.findByName(gName).orElseGet(() -> {
                NetworkGroup g = new NetworkGroup();
                g.setName(gName);
                g.setColor(pickIfaceColor(iface));
                g.setLayerOrder(0);
                return groupRepo.save(g);
            });
            ifaceGroupMap.put(iface, group);
        }

        int count = 0;
        for (ArpEntryDto entry : arpEntries) {
            if (entry.ip() == null) continue;
            final NetworkGroup group = entry.iface() != null ? ifaceGroupMap.get(entry.iface()) : null;
            deviceRepo.findByIpAddress(entry.ip()).ifPresentOrElse(
                    d -> {
                        if (entry.mac() != null) d.setMacAddress(entry.mac());
                        if (entry.hostname() != null && !entry.hostname().isBlank()) d.setHostname(entry.hostname());
                        if (entry.iface() != null && !entry.iface().isBlank()) d.setPfSenseInterface(entry.iface());
                        // Assign to group only if device has none yet
                        if (group != null && d.getGroup() == null) d.setGroup(group);
                        deviceRepo.save(d);
                    },
                    () -> {
                        NetworkDevice d = new NetworkDevice();
                        d.setName(entry.hostname() != null && !entry.hostname().isBlank() ? entry.hostname() : entry.ip());
                        d.setIpAddress(entry.ip());
                        d.setMacAddress(entry.mac());
                        d.setHostname(entry.hostname());
                        d.setPfSenseInterface(entry.iface());
                        d.setDeviceType("UNKNOWN");
                        d.setManual(false);
                        d.setShared(true); // ARP-imported devices are visible to all users
                        d.setGroup(group);
                        deviceRepo.save(d);
                    }
            );
            count++;
        }
        log.info("ARP import: {} devices upserted across {} VLAN groups", count, ifaceGroupMap.size());
        return count;
    }

    /**
     * Reads all active NAT rules from the DB and creates topology connections for them.
     * Each rule becomes a connection: "Internet" device → host device.
     * Skips rules where the target device (host IP) isn't in the topology yet.
     * Returns the number of newly created connections.
     */
    public int importNatRulesAsConnections() {
        List<NatRule> activeRules = natRuleRepo.findActiveWithHost();
        if (activeRules.isEmpty()) return 0;

        // Find or create the permanent "Internet/WAN" gateway node
        NetworkDevice internet = deviceRepo.findFirstByName("Internet").orElseGet(() -> {
            NetworkDevice d = new NetworkDevice();
            d.setName("Internet");
            d.setDescription("Externer Internetzugang / WAN");
            d.setDeviceType("INTERNET");
            d.setManual(true);
            d.setShared(true);
            d.setPfSenseInterface("wan");
            d.setPosX(50);
            d.setPosY(50);
            return deviceRepo.save(d);
        });

        int count = 0;
        for (NatRule rule : activeRules) {
            String hostIp = rule.getHost().getIpAddress();

            // Find or create a topology device for this host
            NetworkDevice target = deviceRepo.findByIpAddress(hostIp).orElseGet(() -> {
                NetworkDevice d = new NetworkDevice();
                d.setName(rule.getHost().getName());
                d.setIpAddress(hostIp);
                d.setDescription("Auto-importiert aus NAT-Regel");
                d.setDeviceType("HOST");
                d.setManual(false);
                d.setShared(true);
                d.setHost(rule.getHost());
                return deviceRepo.save(d);
            });

            // Skip if connection already exists for this source/target/port combination
            if (connectionRepo.existsBySourceIdAndTargetIdAndPortStart(
                    internet.getId(), target.getId(), rule.getPortStart())) continue;

            NetworkConnection c = new NetworkConnection();
            c.setSource(internet);
            c.setTarget(target);
            c.setProtocol(rule.getProtocol());
            c.setPortStart(rule.getPortStart());
            c.setPortEnd(rule.getPortEnd());
            c.setLabel(rule.getHost().getName() + " " + rule.getProtocol() + ":" +
                    (rule.getPortStart() == rule.getPortEnd() ? rule.getPortStart()
                            : rule.getPortStart() + "-" + rule.getPortEnd()));
            c.setNatRule(rule);
            c.setStatus("OK");
            connectionRepo.save(c);
            count++;
        }
        log.info("NAT import: {} new topology connections created", count);
        return count;
    }

    private static String pickIfaceColor(String iface) {
        if (iface == null) return "#64748b";
        String l = iface.toLowerCase();
        if (l.equals("wan") || l.startsWith("em0") || l.startsWith("igb0") || l.startsWith("re0")) return "#ef4444";
        if (l.equals("lan") || l.startsWith("em1") || l.startsWith("igb1")) return "#22c55e";
        // Deterministic color for VLAN/opt interfaces
        String[] palette = {"#3b82f6", "#a855f7", "#f59e0b", "#06b6d4", "#ec4899", "#84cc16", "#f97316"};
        return palette[Math.abs(iface.hashCode()) % palette.length];
    }

    // ── Devices (user-visible) ────────────────────────────────────────────────

    public List<NetworkDeviceDto> listVisibleDevices(String username) {
        User user = getUser(username);
        if (isAdmin(user)) return listAllDevices();
        List<Long> hostIds = policyRepo.findByUserIdWithHost(user.getId()).stream()
                .map(p -> p.getHost().getId()).toList();
        if (hostIds.isEmpty()) return deviceRepo.findAllShared().stream().map(this::toDto).toList();
        return deviceRepo.findVisibleForHosts(hostIds).stream().map(this::toDto).toList();
    }

    // ── Connections (admin) ───────────────────────────────────────────────────

    public List<NetworkConnectionDto> listAllConnections() {
        return connectionRepo.findAllByOrderByCreatedAtAsc().stream().map(this::toDto).toList();
    }

    public NetworkConnectionDto createAdminConnection(CreateNetworkConnectionRequest req) {
        NetworkDevice src = deviceRepo.findById(req.sourceDeviceId())
                .orElseThrow(() -> new NoSuchElementException("Source device not found: " + req.sourceDeviceId()));
        NetworkDevice tgt = deviceRepo.findById(req.targetDeviceId())
                .orElseThrow(() -> new NoSuchElementException("Target device not found: " + req.targetDeviceId()));
        NetworkConnection c = new NetworkConnection();
        c.setSource(src);
        c.setTarget(tgt);
        c.setProtocol(req.protocol());
        c.setPortStart(req.portStart());
        c.setPortEnd(req.portEnd());
        c.setLabel(req.label());
        connectionRepo.save(c);           // Phase 1: persist to get ID
        tryCreateFirewallRule(c);
        return toDto(connectionRepo.save(c));  // Phase 2: persist firewallRuleId / status
    }

    public void deleteAdminConnection(Long id) {
        NetworkConnection c = connectionRepo.findById(id)
                .orElseThrow(() -> new NoSuchElementException("Connection not found: " + id));
        tryDeleteFirewallRule(c);
        connectionRepo.deleteById(id);
    }

    // ── Connections (user) ────────────────────────────────────────────────────

    public List<NetworkConnectionDto> listVisibleConnections(String username) {
        User user = getUser(username);
        if (isAdmin(user)) return listAllConnections();
        List<NetworkDeviceDto> visibleDevices = listVisibleDevices(username);
        List<Long> deviceIds = visibleDevices.stream().map(NetworkDeviceDto::id).toList();
        if (deviceIds.isEmpty()) return List.of();
        return connectionRepo.findVisibleConnections(deviceIds).stream().map(this::toDto).toList();
    }

    public NetworkConnectionDto createUserConnection(String username, CreateNetworkConnectionRequest req) {
        User user = getUser(username);

        NetworkDevice src = deviceRepo.findById(req.sourceDeviceId())
                .orElseThrow(() -> new NoSuchElementException("Source device not found: " + req.sourceDeviceId()));
        NetworkDevice tgt = deviceRepo.findById(req.targetDeviceId())
                .orElseThrow(() -> new NoSuchElementException("Target device not found: " + req.targetDeviceId()));

        // Verify source device belongs to this user (via host assignment)
        if (!isAdmin(user)) {
            Set<Long> userHostIds = policyRepo.findByUserIdWithHost(user.getId()).stream()
                    .map(p -> p.getHost().getId()).collect(Collectors.toSet());
            if (src.getHost() == null || !userHostIds.contains(src.getHost().getId())) {
                throw new AccessDeniedException("Source device does not belong to your hosts");
            }
        }

        NetworkConnection c = new NetworkConnection();
        c.setSource(src);
        c.setTarget(tgt);
        c.setProtocol(req.protocol());
        c.setPortStart(req.portStart());
        c.setPortEnd(req.portEnd());
        c.setLabel(req.label());

        // If source has a host and protocol+port are set → create a NAT rule
        if (src.getHost() != null && req.protocol() != null && req.portStart() != null) {
            int portEnd = req.portEnd() != null ? req.portEnd() : req.portStart();
            try {
                String desc = req.label() != null ? req.label() : "Topology connection";
                CreateNatRuleRequest natReq = new CreateNatRuleRequest(
                        src.getHost().getId(), req.protocol(), req.portStart(), portEnd, desc, null);
                NatRule natRule = isAdmin(user)
                        ? natRuleService.createRuleAsAdmin(username, natReq)
                        : natRuleService.createRule(username, natReq);
                c.setNatRule(natRule);
                c.setStatus("OK");
            } catch (PolicyViolationException e) {
                throw e;
            } catch (Exception e) {
                log.warn("Could not create NAT rule for topology connection: {}", e.getMessage());
                c.setStatus("ISSUE");
            }
        }

        connectionRepo.save(c);           // Phase 1: persist NAT rule ref + initial status
        tryCreateFirewallRule(c);
        return toDto(connectionRepo.save(c));  // Phase 2: persist firewallRuleId / status
    }

    public void deleteUserConnection(String username, Long connectionId) {
        User user = getUser(username);
        NetworkConnection c = connectionRepo.findById(connectionId)
                .orElseThrow(() -> new NoSuchElementException("Connection not found: " + connectionId));

        if (!isAdmin(user)) {
            Set<Long> userHostIds = policyRepo.findByUserIdWithHost(user.getId()).stream()
                    .map(p -> p.getHost().getId()).collect(Collectors.toSet());
            if (c.getSource().getHost() == null || !userHostIds.contains(c.getSource().getHost().getId())) {
                throw new AccessDeniedException("You do not own this connection");
            }
        }

        // Delete the linked NAT rule if present
        if (c.getNatRule() != null) {
            try {
                if (isAdmin(user)) {
                    adminService.deleteRuleAsAdmin(c.getNatRule().getId());
                } else {
                    natRuleService.deleteRule(username, c.getNatRule().getId());
                }
            } catch (Exception e) {
                log.warn("Could not delete NAT rule {} for topology connection {}: {}",
                        c.getNatRule().getId(), connectionId, e.getMessage());
            }
        }

        tryDeleteFirewallRule(c);
        connectionRepo.deleteById(connectionId);
    }

    public void saveDevicePosition(String username, Long deviceId, double posX, double posY) {
        User user = getUser(username);
        NetworkDevice d = deviceRepo.findById(deviceId)
                .orElseThrow(() -> new NoSuchElementException("Device not found: " + deviceId));
        if (!isAdmin(user)) {
            Set<Long> userHostIds = policyRepo.findByUserIdWithHost(user.getId()).stream()
                    .map(p -> p.getHost().getId()).collect(Collectors.toSet());
            if (d.getHost() == null || !userHostIds.contains(d.getHost().getId())) {
                throw new AccessDeniedException("Cannot move this device");
            }
        }
        d.setPosX(posX);
        d.setPosY(posY);
        deviceRepo.save(d);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private NetworkGroupDto toDto(NetworkGroup g) {
        return new NetworkGroupDto(g.getId(), g.getName(), g.getColor(),
                g.getLayerOrder(), g.isCollapsed(), g.isHidden(), g.getCreatedAt());
    }

    private NetworkDeviceDto toDto(NetworkDevice d) {
        return new NetworkDeviceDto(
                d.getId(), d.getName(), d.getIpAddress(), d.getMacAddress(),
                d.getHostname(), d.getDescription(), d.getDeviceType(),
                d.getGroup() != null ? d.getGroup().getId() : null,
                d.getPosX(), d.getPosY(), d.isManual(), d.isShared(),
                d.getHost() != null ? d.getHost().getId() : null,
                d.getCreatedAt(), d.getUpdatedAt(), d.getPfSenseInterface());
    }

    private NetworkConnectionDto toDto(NetworkConnection c) {
        return new NetworkConnectionDto(
                c.getId(),
                c.getSource().getId(),
                c.getTarget().getId(),
                c.getProtocol(),
                c.getPortStart(),
                c.getPortEnd(),
                c.getLabel(),
                c.getStatus(),
                c.getNatRule() != null ? c.getNatRule().getId() : null,
                c.getFirewallRuleId(),
                c.getCreatedAt());
    }

    private void tryCreateFirewallRule(NetworkConnection c) {
        NetworkDevice src = c.getSource();
        NetworkDevice tgt = c.getTarget();

        String iface = src.getPfSenseInterface();
        if (iface == null || iface.isBlank()) {
            log.warn("Skipping firewall rule for connection {} — source device {} has no pfSenseInterface",
                    c.getId(), src.getId());
            c.setStatus("ISSUE");
            return;
        }
        String targetIp = tgt.getIpAddress();
        if (targetIp == null || targetIp.isBlank()) {
            log.warn("Skipping firewall rule for connection {} — target device {} has no IP address",
                    c.getId(), tgt.getId());
            c.setStatus("ISSUE");
            return;
        }
        try {
            String fwRuleId = pfSenseApiClient.createFirewallRule(
                    iface, targetIp, c.getProtocol(), c.getPortStart(), c.getPortEnd(), c.getId());
            c.setFirewallRuleId(fwRuleId);
            if (!"ISSUE".equals(c.getStatus())) c.setStatus("OK");
        } catch (Exception e) {
            log.warn("Could not create firewall rule for topology connection {}: {}", c.getId(), e.getMessage());
            c.setStatus("ISSUE");
        }
    }

    private void tryDeleteFirewallRule(NetworkConnection c) {
        if (c.getFirewallRuleId() == null || c.getFirewallRuleId().isBlank()) return;
        try {
            pfSenseApiClient.deleteFirewallRule(c.getFirewallRuleId());
        } catch (Exception e) {
            log.warn("Could not delete firewall rule {} for topology connection {}: {}",
                    c.getFirewallRuleId(), c.getId(), e.getMessage());
        }
    }

    private User getUser(String username) {
        return userRepo.findByUsername(username)
                .orElseThrow(() -> new NoSuchElementException("User not found: " + username));
    }

    private boolean isAdmin(User user) {
        return "ADMIN".equals(user.getRole());
    }
}
