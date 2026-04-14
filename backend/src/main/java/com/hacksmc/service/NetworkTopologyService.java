package com.hacksmc.service;

import com.hacksmc.dto.*;
import com.hacksmc.entity.*;
import com.hacksmc.exception.PolicyViolationException;
import com.hacksmc.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.context.SecurityContextHolder;
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
    private final TopologyBroadcastService broadcastService;

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
        NetworkGroupDto dto = toDto(groupRepo.save(g));
        broadcastService.broadcast(currentActor(), "GROUP_CREATED", g.getName());
        return dto;
    }

    public NetworkGroupDto updateGroup(Long id, UpdateNetworkGroupRequest req) {
        NetworkGroup g = groupRepo.findById(id)
                .orElseThrow(() -> new NoSuchElementException("Group not found: " + id));
        if (req.name() != null) g.setName(req.name());
        if (req.color() != null) g.setColor(req.color());
        if (req.layerOrder() != null) g.setLayerOrder(req.layerOrder());
        if (req.collapsed() != null) g.setCollapsed(req.collapsed());
        if (req.hidden() != null) g.setHidden(req.hidden());
        if (req.scanBlocked() != null) g.setScanBlocked(req.scanBlocked());
        NetworkGroupDto dto = toDto(groupRepo.save(g));
        broadcastService.broadcast(currentActor(), "GROUP_UPDATED", g.getName());
        return dto;
    }

    public void deleteGroup(Long id) {
        NetworkGroup g = groupRepo.findById(id)
                .orElseThrow(() -> new NoSuchElementException("Group not found: " + id));
        String name = g.getName();
        groupRepo.deleteById(id);
        broadcastService.broadcast(currentActor(), "GROUP_DELETED", name);
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
        NetworkDeviceDto dto = toDto(deviceRepo.save(d));
        broadcastService.broadcast(currentActor(), "DEVICE_CREATED", d.getName());
        return dto;
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
        NetworkDeviceDto dto = toDto(deviceRepo.save(d));
        broadcastService.broadcast(currentActor(), "DEVICE_UPDATED", d.getName());
        return dto;
    }

    public void deleteDevice(Long id) {
        NetworkDevice d = deviceRepo.findById(id)
                .orElseThrow(() -> new NoSuchElementException("Device not found: " + id));
        String name = d.getName();
        deviceRepo.deleteById(id);
        broadcastService.broadcast(currentActor(), "DEVICE_DELETED", name);
    }

    public int importFromScan(List<ScannedHostResult> results, Long targetGroupId) {
        NetworkGroup targetGroup = targetGroupId != null
                ? groupRepo.findById(targetGroupId).orElse(null)
                : null;
        int[] count = {0};
        for (ScannedHostResult r : results) {
            if (r.getIpAddress() == null) continue;
            String type = deviceTypeDetector.detect(r.getIpAddress(), r.getOpenPorts(), pfSenseBaseUrl);
            final NetworkGroup finalGroup = targetGroup;
            deviceRepo.findByIpAddress(r.getIpAddress()).ifPresentOrElse(
                    existing -> {
                        // Update existing device hostname and group if not already set
                        if (r.getHostname() != null && !r.getHostname().isBlank()) existing.setHostname(r.getHostname());
                        if (finalGroup != null && existing.getGroup() == null) existing.setGroup(finalGroup);
                        deviceRepo.save(existing);
                    },
                    () -> {
                        NetworkDevice d = new NetworkDevice();
                        d.setName(r.getHostname() != null && !r.getHostname().isBlank() ? r.getHostname() : r.getIpAddress());
                        d.setIpAddress(r.getIpAddress());
                        d.setHostname(r.getHostname());
                        d.setDeviceType(type);
                        d.setManual(false);
                        d.setShared(false);
                        d.setGroup(finalGroup);
                        deviceRepo.save(d);
                        count[0]++;
                    }
            );
        }
        if (count[0] > 0) broadcastService.broadcast(currentActor(), "SCAN_IMPORTED", count[0] + " Geräte");
        return count[0];
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

        // Build set of scan-blocked group names for fast lookup
        Set<String> scanBlockedIfaces = ifaceGroupMap.entrySet().stream()
                .filter(e -> e.getValue().isScanBlocked())
                .map(Map.Entry::getKey)
                .collect(Collectors.toSet());

        int count = 0;
        for (ArpEntryDto entry : arpEntries) {
            if (entry.ip() == null) continue;
            // Skip devices whose interface is in a scan-blocked group
            if (entry.iface() != null && scanBlockedIfaces.contains(entry.iface())) continue;
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
        if (count > 0) broadcastService.broadcast(currentActor(), "ARP_IMPORTED", count + " Geräte");
        return count;
    }

    /**
     * Reads ALL NAT port-forward rules directly from pfSense and creates INBOUND topology connections.
     * Also links HackSMC-managed rules via the [hsmc:id] tag in the description.
     * Returns the number of newly created connections.
     */
    @SuppressWarnings("unchecked")
    public int importNatRulesAsConnections() {
        List<Map<String, Object>> pfRules = pfSenseApiClient.fetchAllNatPortForwardRules();
        if (pfRules.isEmpty()) return 0;

        NetworkDevice internet = getOrCreateInternetDevice();

        // Build lookup: hsmc-tagged DB rules by their pfsense ID string
        Map<String, NatRule> hsmcRuleMap = new java.util.HashMap<>();
        natRuleRepo.findActiveWithHost().forEach(r -> {
            if (r.getPfSenseRuleId() != null) hsmcRuleMap.put(r.getPfSenseRuleId(), r);
        });

        int count = 0;
        for (Map<String, Object> rule : pfRules) {
            if (Boolean.TRUE.equals(rule.get("disabled"))) continue;

            // Extract target IP (internal host IP that receives forwarded traffic)
            String targetIp = toStr(rule.get("target"));
            if (targetIp == null || targetIp.isBlank()) continue;

            Integer portStart = toPort(rule.get("local_port"));
            Integer portEnd = portStart;
            String protocol = toStr(rule.get("protocol"));
            String descr = toStr(rule.get("descr"));

            // Try to match to a known topology device
            NetworkDevice target = deviceRepo.findByIpAddress(targetIp).orElse(null);
            if (target == null) continue; // only create connections for known devices

            if (connectionRepo.existsBySourceIdAndTargetIdAndPortStart(
                    internet.getId(), target.getId(), portStart)) continue;

            NetworkConnection c = new NetworkConnection();
            c.setSource(internet);
            c.setTarget(target);
            c.setProtocol(protocol);
            c.setPortStart(portStart);
            c.setPortEnd(portEnd);
            c.setDirection("INBOUND");
            c.setStatus("OK");

            // Link to HackSMC DB rule if tagged
            String hsmcId = com.hacksmc.service.PfSenseApiClient.extractHsmcId(descr);
            if (hsmcId != null && hsmcRuleMap.containsKey(hsmcId)) {
                c.setNatRule(hsmcRuleMap.get(hsmcId));
            }
            c.setLabel(descr != null && !descr.isBlank() ? descr : targetIp + " " + protocol + ":" + portStart);
            connectionRepo.save(c);
            count++;
        }
        log.info("NAT import: {} new topology connections created from {} pfSense rules", count, pfRules.size());
        if (count > 0) broadcastService.broadcast(currentActor(), "NAT_IMPORTED", count + " Verbindungen");
        return count;
    }

    /**
     * Reads all pfSense firewall pass rules and creates topology connections for rules
     * where the destination IP matches a known topology device.
     * Direction: WAN-interface rules → INBOUND, other interfaces → OUTBOUND.
     */
    @SuppressWarnings("unchecked")
    public int importFirewallRulesAsConnections() {
        List<Map<String, Object>> pfRules;
        try {
            pfRules = pfSenseApiClient.fetchAllFirewallPassRules();
        } catch (Exception e) {
            log.warn("Firewall import: pfSense API not accessible — {}: {}", e.getClass().getSimpleName(), e.getMessage());
            return 0;
        }
        log.info("Firewall import: {} pass rules received from pfSense", pfRules.size());
        if (pfRules.isEmpty()) return 0;

        // Build lookup maps from existing topology devices
        List<NetworkDevice> allDevices = deviceRepo.findAllByOrderByCreatedAtAsc();
        Map<String, NetworkDevice> ipToDevice = allDevices.stream()
                .filter(d -> d.getIpAddress() != null)
                .collect(Collectors.toMap(NetworkDevice::getIpAddress, d -> d, (a, b) -> a));
        // interface name (lowercase) → first representative device on that interface
        Map<String, NetworkDevice> ifaceToDevice = allDevices.stream()
                .filter(d -> d.getPfSenseInterface() != null)
                .collect(Collectors.toMap(
                        d -> d.getPfSenseInterface().toLowerCase(),
                        d -> d,
                        (a, b) -> a));   // keep first found per interface

        NetworkDevice internet = getOrCreateInternetDevice();
        int count = 0;

        for (Map<String, Object> rule : pfRules) {
            try {
                if (Boolean.TRUE.equals(rule.get("disabled"))) continue;

                // pfSense v2 API: "interface" is a List for floating rules, String otherwise
                Object ifaceRaw = rule.get("interface");
                String iface;
                if (ifaceRaw instanceof List<?> list) {
                    if (list.isEmpty()) continue;
                    iface = toStr(list.get(0));  // use first interface as representative
                } else {
                    iface = toStr(ifaceRaw);
                }
                if (iface == null) continue;

                String protocol = toStr(rule.get("protocol"));
                String descr = toStr(rule.get("descr"));

                boolean isWan = iface.equalsIgnoreCase("wan")
                        || iface.toLowerCase().startsWith("em0")
                        || iface.toLowerCase().startsWith("igb0")
                        || iface.toLowerCase().startsWith("re0");

                // pfSense v2 API uses "destination" and "destination_port" (not "dst"/"dstport")
                String dstIp = extractIpFromRuleEndpoint(rule.get("destination"));
                Integer dstPort = toPort(rule.get("destination_port"));

                NetworkDevice source;
                NetworkDevice target;
                String direction;

                if (isWan) {
                    // INBOUND: Internet → specific internal device
                    if (dstIp == null) continue;  // dst=any on WAN is too broad — skip
                    target = ipToDevice.get(dstIp);
                    if (target == null) continue;
                    source = internet;
                    direction = "INBOUND";
                } else {
                    // Internal / OUTBOUND rule on a LAN or VLAN interface
                    // Source representative = first device on this interface
                    source = ifaceToDevice.get(iface.toLowerCase());
                    if (source == null) continue;  // no known devices on this interface

                    if (dstIp != null) {
                        // Specific destination IP
                        target = ipToDevice.get(dstIp);
                        if (target == null) continue;
                        direction = source.getId().equals(target.getId()) ? "INTERNAL" : "INTERNAL";
                    } else {
                        // dst=any → OUTBOUND to Internet
                        target = internet;
                        direction = "OUTBOUND";
                    }
                }

                if (source.getId().equals(target.getId())) continue;

                if (connectionRepo.existsBySourceIdAndTargetIdAndPortStart(
                        source.getId(), target.getId(), dstPort)) continue;

                NetworkConnection c = new NetworkConnection();
                c.setSource(source);
                c.setTarget(target);
                c.setProtocol(protocol);
                c.setPortStart(dstPort);
                c.setPortEnd(dstPort);
                c.setDirection(direction);
                c.setStatus("OK");
                c.setLabel(descr != null && !descr.isBlank() ? descr
                        : iface + (dstPort != null ? ":" + dstPort : "→any"));
                connectionRepo.save(c);
                count++;
            } catch (Exception e) {
                log.warn("Firewall import: skipping rule — {}", e.getMessage());
            }
        }
        log.info("Firewall import: {} new topology connections created from pfSense pass rules", count);
        if (count > 0) broadcastService.broadcast(currentActor(), "FW_IMPORTED", count + " Verbindungen");
        return count;
    }

    private NetworkDevice getOrCreateInternetDevice() {
        return deviceRepo.findFirstByName("Internet").orElseGet(() -> {
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
    }

    @SuppressWarnings("unchecked")
    private static String extractIpFromRuleEndpoint(Object endpoint) {
        if (endpoint == null) return null;
        // pfSense v2: destination/source can be the string "any"
        if (endpoint instanceof String s) {
            return "any".equalsIgnoreCase(s.trim()) ? null : s.trim();
        }
        if (endpoint instanceof Map<?, ?> m) {
            // {address: "1.2.3.4", subnet: 32} — specific host/network
            Object addr = m.get("address");
            if (addr != null) return toStr(addr);
            // {network: "opt1"} or {any: true} — no specific IP
        }
        return null;
    }

    private static String toStr(Object val) {
        return val instanceof String s ? s : (val != null ? val.toString() : null);
    }

    private static Integer toPort(Object val) {
        if (val == null) return null;
        String s = val.toString().trim();
        if (s.isEmpty() || s.equals("any")) return null;
        // pfSense uses "startport:endport" — take start port
        int colon = s.indexOf(':');
        try {
            return Integer.parseInt(colon >= 0 ? s.substring(0, colon) : s);
        } catch (NumberFormatException e) {
            return null;
        }
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
        NetworkConnectionDto dto = toDto(connectionRepo.save(c));
        broadcastService.broadcast(currentActor(), "CONNECTION_CREATED", src.getName() + " → " + tgt.getName());
        return dto;
    }

    public void deleteAdminConnection(Long id) {
        NetworkConnection c = connectionRepo.findById(id)
                .orElseThrow(() -> new NoSuchElementException("Connection not found: " + id));
        String label = c.getSource().getName() + " → " + c.getTarget().getName();
        connectionRepo.deleteById(id);
        broadcastService.broadcast(currentActor(), "CONNECTION_DELETED", label);
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
        NetworkConnectionDto dto = toDto(connectionRepo.save(c));
        broadcastService.broadcast(currentActor(), "CONNECTION_CREATED", src.getName() + " → " + tgt.getName());
        return dto;
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

        String label = c.getSource().getName() + " → " + c.getTarget().getName();
        connectionRepo.deleteById(connectionId);
        broadcastService.broadcast(currentActor(), "CONNECTION_DELETED", label);
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
                g.getLayerOrder(), g.isCollapsed(), g.isHidden(), g.isScanBlocked(), g.getCreatedAt());
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
                c.getDirection(),
                c.getNatRule() != null ? c.getNatRule().getId() : null,
                c.getFirewallRuleId(),
                c.getCreatedAt());
    }

    private User getUser(String username) {
        return userRepo.findByUsername(username)
                .orElseThrow(() -> new NoSuchElementException("User not found: " + username));
    }

    private boolean isAdmin(User user) {
        return "ADMIN".equals(user.getRole());
    }

    /** Resolves the currently authenticated username from the security context. */
    private String currentActor() {
        var auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.isAuthenticated() && !"anonymousUser".equals(auth.getPrincipal())) {
            return auth.getName();
        }
        return null;
    }
}
