package com.hacksmc.service;

import com.hacksmc.dto.*;
import com.hacksmc.entity.*;
import com.hacksmc.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
@Transactional
public class NetworkTopologyService {

    static final long AUTO_VIEW_ID = 1L;

    private final NetworkGroupRepository groupRepo;
    private final NetworkDeviceRepository deviceRepo;
    private final NetworkConnectionRepository connectionRepo;
    private final TopologyViewRepository viewRepo;
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

    // ── Views ─────────────────────────────────────────────────────────────────

    public List<TopologyViewDto> listViews() {
        return viewRepo.findAllByOrderByCreatedAtAsc().stream().map(this::toDto).toList();
    }

    public TopologyViewDto createView(CreateTopologyViewRequest req) {
        TopologyView v = new TopologyView();
        v.setName(req.name());
        v.setDescription(req.description());
        v.setAuto(false);
        return toDto(viewRepo.save(v));
    }

    public TopologyViewDto updateView(Long id, UpdateTopologyViewRequest req) {
        TopologyView v = viewRepo.findById(id)
                .orElseThrow(() -> new NoSuchElementException("View not found: " + id));
        if (req.name() != null && !req.name().isBlank()) v.setName(req.name());
        if (req.description() != null) v.setDescription(req.description());
        return toDto(viewRepo.save(v));
    }

    public void deleteView(Long id) {
        TopologyView v = viewRepo.findById(id)
                .orElseThrow(() -> new NoSuchElementException("View not found: " + id));
        if (v.isAuto()) throw new IllegalStateException("The Auto view cannot be deleted");
        viewRepo.deleteById(id);
    }

    // ── Groups ────────────────────────────────────────────────────────────────

    public List<NetworkGroupDto> listGroups(Long viewId) {
        return groupRepo.findByViewIdOrderByLayerOrderAsc(viewId).stream().map(this::toDto).toList();
    }

    public NetworkGroupDto createGroup(CreateNetworkGroupRequest req, Long viewId) {
        TopologyView view = getView(viewId);
        NetworkGroup g = new NetworkGroup();
        g.setName(req.name());
        g.setColor(req.color() != null ? req.color() : "#64748b");
        g.setLayerOrder(req.layerOrder());
        g.setView(view);
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

    public List<NetworkDeviceDto> listAllDevices(Long viewId) {
        return deviceRepo.findByViewIdOrderByCreatedAtAsc(viewId).stream().map(this::toDto).toList();
    }

    public NetworkDeviceDto createDevice(CreateNetworkDeviceRequest req, Long viewId) {
        TopologyView view = getView(viewId);
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
        d.setView(view);
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

    public int importFromScan(List<ScannedHostResult> results, Long targetGroupId, Long viewId) {
        TopologyView view = getView(viewId);
        NetworkGroup targetGroup = targetGroupId != null
                ? groupRepo.findById(targetGroupId).orElse(null)
                : null;
        int[] count = {0};
        for (ScannedHostResult r : results) {
            if (r.getIpAddress() == null) continue;
            String type = deviceTypeDetector.detect(r.getIpAddress(), r.getOpenPorts(), pfSenseBaseUrl);
            final NetworkGroup finalGroup = targetGroup;
            deviceRepo.findByIpAddressAndViewId(r.getIpAddress(), viewId).ifPresentOrElse(
                    existing -> {
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
                        d.setView(view);
                        deviceRepo.save(d);
                        count[0]++;
                    }
            );
        }
        if (count[0] > 0) broadcastService.broadcast(currentActor(), "SCAN_IMPORTED", count[0] + " Geräte");
        return count[0];
    }

    public int importArpTable(Long viewId) {
        TopologyView view = getView(viewId);
        List<ArpEntryDto> arpEntries = pfSenseApiClient.fetchArpTable();
        if (arpEntries.isEmpty()) {
            log.info("ARP import: no entries returned from pfSense");
            return 0;
        }

        Set<String> uniqueIfaces = arpEntries.stream()
                .map(ArpEntryDto::iface).filter(Objects::nonNull)
                .collect(Collectors.toCollection(LinkedHashSet::new));

        Map<String, NetworkGroup> ifaceGroupMap = new HashMap<>();
        for (String iface : uniqueIfaces) {
            NetworkGroup group = groupRepo.findByNameAndViewId(iface, viewId).orElseGet(() -> {
                NetworkGroup g = new NetworkGroup();
                g.setName(iface);
                g.setColor(pickIfaceColor(iface));
                g.setLayerOrder(0);
                g.setView(view);
                return groupRepo.save(g);
            });
            ifaceGroupMap.put(iface, group);
        }

        Set<String> scanBlockedIfaces = ifaceGroupMap.entrySet().stream()
                .filter(e -> e.getValue().isScanBlocked())
                .map(Map.Entry::getKey)
                .collect(Collectors.toSet());

        int count = 0;
        for (ArpEntryDto entry : arpEntries) {
            if (entry.ip() == null) continue;
            if (entry.iface() != null && scanBlockedIfaces.contains(entry.iface())) continue;
            final NetworkGroup group = entry.iface() != null ? ifaceGroupMap.get(entry.iface()) : null;
            deviceRepo.findByIpAddressAndViewId(entry.ip(), viewId).ifPresentOrElse(
                    d -> {
                        if (entry.mac() != null) d.setMacAddress(entry.mac());
                        if (entry.hostname() != null && !entry.hostname().isBlank()) d.setHostname(entry.hostname());
                        if (entry.iface() != null && !entry.iface().isBlank()) d.setPfSenseInterface(entry.iface());
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
                        d.setShared(true);
                        d.setGroup(group);
                        d.setView(view);
                        deviceRepo.save(d);
                    }
            );
            count++;
        }
        log.info("ARP import: {} devices upserted in view {}", count, viewId);
        if (count > 0) broadcastService.broadcast(currentActor(), "ARP_IMPORTED", count + " Geräte");
        return count;
    }

    @SuppressWarnings("unchecked")
    public int importNatRulesAsConnections(Long viewId) {
        List<Map<String, Object>> pfRules = pfSenseApiClient.fetchAllNatPortForwardRules();
        if (pfRules.isEmpty()) return 0;

        TopologyView view = getView(viewId);
        NetworkDevice internet = getOrCreateInternetDevice(viewId);

        Map<String, NatRule> hsmcRuleMap = new java.util.HashMap<>();
        natRuleRepo.findActiveWithHost().forEach(r -> {
            if (r.getPfSenseRuleId() != null) hsmcRuleMap.put(r.getPfSenseRuleId(), r);
        });

        int count = 0;
        for (Map<String, Object> rule : pfRules) {
            if (Boolean.TRUE.equals(rule.get("disabled"))) continue;
            String targetIp = toStr(rule.get("target"));
            if (targetIp == null || targetIp.isBlank()) continue;
            Integer portStart = toPort(rule.get("local_port"));
            String protocol = toStr(rule.get("protocol"));
            String descr = toStr(rule.get("descr"));

            // Find or auto-create the target device — all pfSense NAT rules are included,
            // not just those managed by HackSMC.
            NetworkDevice target = deviceRepo.findByIpAddressAndViewId(targetIp, viewId).orElseGet(() -> {
                NetworkDevice d = new NetworkDevice();
                d.setName(targetIp);
                d.setIpAddress(targetIp);
                d.setDeviceType("HOST");
                d.setManual(false);
                d.setShared(true);
                d.setView(view);
                return deviceRepo.save(d);
            });

            if (connectionRepo.existsBySourceIdAndTargetIdAndPortStart(
                    internet.getId(), target.getId(), portStart)) continue;

            NetworkConnection c = new NetworkConnection();
            c.setSource(internet);
            c.setTarget(target);
            c.setProtocol(protocol);
            c.setPortStart(portStart);
            c.setPortEnd(portStart);
            c.setDirection("INBOUND");
            c.setStatus("OK");

            String hsmcId = PfSenseApiClient.extractHsmcId(descr);
            if (hsmcId != null && hsmcRuleMap.containsKey(hsmcId)) {
                c.setNatRule(hsmcRuleMap.get(hsmcId));
            }
            c.setLabel(descr != null && !descr.isBlank() ? descr : targetIp + " " + protocol + ":" + portStart);
            connectionRepo.save(c);
            count++;
        }
        log.info("NAT import: {} new connections in view {}", count, viewId);
        if (count > 0) broadcastService.broadcast(currentActor(), "NAT_IMPORTED", count + " Verbindungen");
        return count;
    }

    @SuppressWarnings("unchecked")
    public int importFirewallRulesAsConnections(Long viewId) {
        List<Map<String, Object>> pfRules;
        try {
            pfRules = pfSenseApiClient.fetchAllFirewallPassRules();
        } catch (Exception e) {
            log.warn("Firewall import: pfSense not accessible — {}", e.getMessage());
            return 0;
        }
        if (pfRules.isEmpty()) return 0;

        List<NetworkDevice> allDevices = deviceRepo.findByViewIdOrderByCreatedAtAsc(viewId);
        Map<String, NetworkDevice> ipToDevice = allDevices.stream()
                .filter(d -> d.getIpAddress() != null)
                .collect(Collectors.toMap(NetworkDevice::getIpAddress, d -> d, (a, b) -> a));
        Map<String, NetworkDevice> ifaceToDevice = allDevices.stream()
                .filter(d -> d.getPfSenseInterface() != null)
                .collect(Collectors.toMap(
                        d -> d.getPfSenseInterface().toLowerCase(),
                        d -> d, (a, b) -> a));

        NetworkDevice internet = getOrCreateInternetDevice(viewId);
        int count = 0;

        for (Map<String, Object> rule : pfRules) {
            try {
                if (Boolean.TRUE.equals(rule.get("disabled"))) continue;
                Object ifaceRaw = rule.get("interface");
                String iface;
                if (ifaceRaw instanceof List<?> list) {
                    if (list.isEmpty()) continue;
                    iface = toStr(list.get(0));
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

                String dstIp = extractIpFromRuleEndpoint(rule.get("destination"));
                Integer dstPort = toPort(rule.get("destination_port"));

                NetworkDevice source;
                NetworkDevice target;
                String direction;

                if (isWan) {
                    if (dstIp == null) continue;
                    target = ipToDevice.get(dstIp);
                    if (target == null) continue;
                    source = internet;
                    direction = "INBOUND";
                } else {
                    source = ifaceToDevice.get(iface.toLowerCase());
                    if (source == null) continue;
                    if (dstIp != null) {
                        target = ipToDevice.get(dstIp);
                        if (target == null) continue;
                        direction = "INTERNAL";
                    } else {
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
        log.info("Firewall import: {} connections in view {}", count, viewId);
        if (count > 0) broadcastService.broadcast(currentActor(), "FW_IMPORTED", count + " Verbindungen");
        return count;
    }

    private NetworkDevice getOrCreateInternetDevice(Long viewId) {
        TopologyView view = getView(viewId);
        return deviceRepo.findFirstByNameAndViewId("Internet", viewId).orElseGet(() -> {
            NetworkDevice d = new NetworkDevice();
            d.setName("Internet");
            d.setDescription("Externer Internetzugang / WAN");
            d.setDeviceType("INTERNET");
            d.setManual(true);
            d.setShared(true);
            d.setPfSenseInterface("wan");
            d.setPosX(50);
            d.setPosY(50);
            d.setView(view);
            return deviceRepo.save(d);
        });
    }

    /**
     * Ensures a FIREWALL device exists for the pfSense host itself.
     * The pfSense appliance doesn't appear in its own ARP table, so it must be
     * created explicitly using the configured PFSENSE_BASE_URL host.
     */
    public NetworkDevice getOrCreateFirewallDevice(Long viewId) {
        TopologyView view = getView(viewId);
        // Check if any FIREWALL-typed device already exists in this view
        List<NetworkDevice> all = deviceRepo.findByViewIdOrderByCreatedAtAsc(viewId);
        return all.stream()
                .filter(d -> "FIREWALL".equals(d.getDeviceType()))
                .findFirst()
                .orElseGet(() -> {
                    // Extract IP from pfSense base URL
                    String host = pfSenseBaseUrl;
                    try {
                        host = java.net.URI.create(pfSenseBaseUrl).getHost();
                    } catch (Exception ignored) {}
                    NetworkDevice d = new NetworkDevice();
                    d.setName("pfSense");
                    d.setIpAddress(host);
                    d.setDescription("pfSense Firewall / Router");
                    d.setDeviceType("FIREWALL");
                    d.setManual(true);
                    d.setShared(true);
                    d.setPosX(400);
                    d.setPosY(150);
                    d.setView(view);
                    return deviceRepo.save(d);
                });
    }

    // ── Devices (user-visible) ────────────────────────────────────────────────

    public List<NetworkDeviceDto> listVisibleDevices(String username, Long viewId) {
        User user = getUser(username);
        if (isAdmin(user)) return listAllDevices(viewId);
        List<Long> hostIds = policyRepo.findByUserIdWithHost(user.getId()).stream()
                .map(p -> p.getHost().getId()).toList();
        if (hostIds.isEmpty()) return deviceRepo.findAllShared(viewId).stream().map(this::toDto).toList();
        return deviceRepo.findVisibleForHosts(viewId, hostIds).stream().map(this::toDto).toList();
    }

    // ── Connections (admin) ───────────────────────────────────────────────────

    public List<NetworkConnectionDto> listAllConnections(Long viewId) {
        return connectionRepo.findByViewId(viewId).stream().map(this::toDto).toList();
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

    public List<NetworkConnectionDto> listVisibleConnections(String username, Long viewId) {
        User user = getUser(username);
        if (isAdmin(user)) return listAllConnections(viewId);
        List<NetworkDeviceDto> visibleDevices = listVisibleDevices(username, viewId);
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

        if (c.getNatRule() != null) {
            try {
                if (isAdmin(user)) adminService.deleteRuleAsAdmin(c.getNatRule().getId());
                else natRuleService.deleteRule(username, c.getNatRule().getId());
            } catch (Exception e) {
                log.warn("Could not delete NAT rule {} for connection {}: {}",
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
            // Non-admins may only move their own host devices or shared devices
            Set<Long> userHostIds = policyRepo.findByUserIdWithHost(user.getId()).stream()
                    .map(p -> p.getHost().getId()).collect(Collectors.toSet());
            if (!d.isShared() && (d.getHost() == null || !userHostIds.contains(d.getHost().getId()))) {
                throw new AccessDeniedException("Cannot move this device");
            }
        }
        d.setPosX(posX);
        d.setPosY(posY);
        deviceRepo.save(d);
        // Broadcast so other connected clients refresh positions in real-time
        broadcastService.broadcast(currentActor(), "DEVICE_UPDATED", d.getName());
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private TopologyView getView(Long viewId) {
        return viewRepo.findById(viewId)
                .orElseThrow(() -> new NoSuchElementException("View not found: " + viewId));
    }

    private TopologyViewDto toDto(TopologyView v) {
        return new TopologyViewDto(v.getId(), v.getName(), v.getDescription(), v.isAuto(), v.getCreatedAt());
    }

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
                c.getId(), c.getSource().getId(), c.getTarget().getId(),
                c.getProtocol(), c.getPortStart(), c.getPortEnd(), c.getLabel(),
                c.getStatus(), c.getDirection(),
                c.getNatRule() != null ? c.getNatRule().getId() : null,
                c.getFirewallRuleId(), c.getCreatedAt());
    }

    private User getUser(String username) {
        return userRepo.findByUsername(username)
                .orElseThrow(() -> new NoSuchElementException("User not found: " + username));
    }

    private boolean isAdmin(User user) { return "ADMIN".equals(user.getRole()); }

    private String currentActor() {
        var auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.isAuthenticated() && !"anonymousUser".equals(auth.getPrincipal())) {
            return auth.getName();
        }
        return null;
    }

    @SuppressWarnings("unchecked")
    private static String extractIpFromRuleEndpoint(Object endpoint) {
        if (endpoint == null) return null;
        if (endpoint instanceof String s) return "any".equalsIgnoreCase(s.trim()) ? null : s.trim();
        if (endpoint instanceof Map<?, ?> m) {
            Object addr = m.get("address");
            if (addr != null) return toStr(addr);
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
        int colon = s.indexOf(':');
        try { return Integer.parseInt(colon >= 0 ? s.substring(0, colon) : s); }
        catch (NumberFormatException e) { return null; }
    }

    private static String pickIfaceColor(String iface) {
        if (iface == null) return "#64748b";
        String l = iface.toLowerCase();
        if (l.equals("wan") || l.startsWith("em0") || l.startsWith("igb0") || l.startsWith("re0")) return "#ef4444";
        if (l.equals("lan") || l.startsWith("em1") || l.startsWith("igb1")) return "#22c55e";
        String[] palette = {"#3b82f6", "#a855f7", "#f59e0b", "#06b6d4", "#ec4899", "#84cc16", "#f97316"};
        return palette[Math.abs(iface.hashCode()) % palette.length];
    }
}
