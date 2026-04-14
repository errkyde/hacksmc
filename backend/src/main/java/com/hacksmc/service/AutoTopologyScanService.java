package com.hacksmc.service;

import com.hacksmc.entity.NetworkConnection;
import com.hacksmc.entity.NetworkDevice;
import com.hacksmc.entity.NetworkGroup;
import com.hacksmc.repository.NetworkConnectionRepository;
import com.hacksmc.repository.NetworkDeviceRepository;
import com.hacksmc.repository.NetworkGroupRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;
import java.util.stream.Collectors;

/**
 * Orchestrates the full automatic topology discovery pipeline:
 *
 *  1. ARP import     — discovers live devices on pfSense-managed networks
 *  2. NAT import     — creates INBOUND connections from NAT port-forward rules
 *  3. FW import      — creates INBOUND/OUTBOUND connections from firewall pass rules
 *  4. INTERNET node  — ensures a shared INTERNET gateway device exists
 *  5. Inference      — builds the hierarchy: INTERNET → FIREWALL → subnets → hosts
 *  6. Auto-grouping  — assigns devices to Infrastruktur / Endgeräte / Drucker groups
 *
 * All steps are wrapped in a single transaction so the topology is always consistent.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class AutoTopologyScanService {

    private final NetworkTopologyService topologyService;
    private final NetworkDeviceRepository deviceRepo;
    private final NetworkGroupRepository groupRepo;
    private final NetworkConnectionRepository connectionRepo;
    private final TopologyBroadcastService broadcastService;

    // ── Group definitions ─────────────────────────────────────────────────────

    private static final String GROUP_INFRA    = "Infrastruktur";
    private static final String GROUP_ENDPOINT = "Endgeräte";
    private static final String GROUP_PRINTER  = "Drucker";

    private static final Map<String, String> GROUP_COLORS = Map.of(
            GROUP_INFRA,    "#ef4444",
            GROUP_ENDPOINT, "#3b82f6",
            GROUP_PRINTER,  "#6b7280"
    );

    /** Device type → group name for auto-grouping. */
    private static final Map<String, String> TYPE_TO_GROUP = Map.of(
            "INTERNET", GROUP_INFRA,
            "FIREWALL", GROUP_INFRA,
            "ROUTER",   GROUP_INFRA,
            "SWITCH",   GROUP_INFRA,
            "PRINTER",  GROUP_PRINTER,
            "HOST",     GROUP_ENDPOINT,
            "UNKNOWN",  GROUP_ENDPOINT
    );

    // ── Public API ─────────────────────────────────────────────────────────────

    public record AutoScanResult(int devices, int connections, int grouped) {}

    @Transactional
    public AutoScanResult autoScan() {
        int totalDevices     = 0;
        int totalConnections = 0;

        // Step 1 — ARP import (primary device discovery)
        try {
            int n = topologyService.importArpTable();
            totalDevices += n;
            log.info("Auto Scan [ARP]: {} devices upserted", n);
        } catch (Exception e) {
            log.warn("Auto Scan [ARP] failed: {}", e.getMessage());
        }

        // Step 2 — Ensure the shared INTERNET gateway device exists
        ensureInternetDevice();

        // Step 3 — NAT port-forward rules → INBOUND connections
        try {
            int n = topologyService.importNatRulesAsConnections();
            totalConnections += n;
            log.info("Auto Scan [NAT]: {} connections imported", n);
        } catch (Exception e) {
            log.warn("Auto Scan [NAT] failed: {}", e.getMessage());
        }

        // Step 4 — Firewall pass rules → INBOUND/OUTBOUND connections
        try {
            int n = topologyService.importFirewallRulesAsConnections();
            totalConnections += n;
            log.info("Auto Scan [FW]: {} connections imported", n);
        } catch (Exception e) {
            log.warn("Auto Scan [FW] failed: {}", e.getMessage());
        }

        // Step 5 — Topology inference: build INTERNET → FW → subnet hierarchy
        int inferred = inferTopologyConnections();
        totalConnections += inferred;
        log.info("Auto Scan [Inference]: {} connections inferred", inferred);

        // Step 6 — Auto-group devices by type
        int grouped = autoGroupDevices();
        log.info("Auto Scan [Grouping]: {} devices assigned to groups", grouped);

        // Broadcast a single consolidated event
        broadcastService.broadcast(
                "system", "SCAN_IMPORTED",
                totalDevices + " Geräte, " + totalConnections + " Verbindungen"
        );

        return new AutoScanResult(totalDevices, totalConnections, grouped);
    }

    // ── Step 2: ensure INTERNET device ────────────────────────────────────────

    private void ensureInternetDevice() {
        boolean exists = deviceRepo.findAllByOrderByCreatedAtAsc().stream()
                .anyMatch(d -> "INTERNET".equals(d.getDeviceType()));
        if (exists) return;

        NetworkDevice internet = new NetworkDevice();
        internet.setName("Internet");
        internet.setDeviceType("INTERNET");
        internet.setShared(true);
        internet.setManual(false);
        internet.setPosX(0);
        internet.setPosY(0);
        deviceRepo.save(internet);
        log.info("Auto Scan [INTERNET]: created shared INTERNET device");
    }

    // ── Step 5: topology inference ────────────────────────────────────────────

    private int inferTopologyConnections() {
        List<NetworkDevice> all = deviceRepo.findAllByOrderByCreatedAtAsc();
        int count = 0;

        NetworkDevice internet = all.stream()
                .filter(d -> "INTERNET".equals(d.getDeviceType()))
                .findFirst().orElse(null);

        NetworkDevice firewall = all.stream()
                .filter(d -> "FIREWALL".equals(d.getDeviceType()))
                .findFirst().orElse(null);

        if (internet == null || firewall == null) {
            log.warn("Auto Scan [Inference]: skipped — no INTERNET or FIREWALL device found");
            return 0;
        }

        // INTERNET → FIREWALL
        if (!connectionRepo.existsBySourceIdAndTargetId(internet.getId(), firewall.getId())) {
            saveConnection(internet, firewall, "INBOUND", "Internet → " + firewall.getName());
            count++;
        }

        // Group non-infrastructure devices by their pfSense interface
        Map<String, List<NetworkDevice>> byInterface = all.stream()
                .filter(d -> d.getPfSenseInterface() != null && !d.getPfSenseInterface().isBlank())
                .filter(d -> !"FIREWALL".equals(d.getDeviceType()) && !"INTERNET".equals(d.getDeviceType()))
                .collect(Collectors.groupingBy(NetworkDevice::getPfSenseInterface));

        for (Map.Entry<String, List<NetworkDevice>> entry : byInterface.entrySet()) {
            String iface = entry.getKey();
            List<NetworkDevice> peers = entry.getValue();

            // If a SWITCH exists on this interface, route other devices through it
            Optional<NetworkDevice> switchOpt = peers.stream()
                    .filter(d -> "SWITCH".equals(d.getDeviceType()))
                    .findFirst();

            if (switchOpt.isPresent()) {
                NetworkDevice sw = switchOpt.get();

                // FIREWALL → SWITCH
                if (!connectionRepo.existsBySourceIdAndTargetId(firewall.getId(), sw.getId())) {
                    saveConnection(firewall, sw, "INTERNAL", firewall.getName() + " → " + sw.getName());
                    count++;
                }

                // SWITCH → each other device on same interface
                for (NetworkDevice peer : peers) {
                    if (peer.getId().equals(sw.getId())) continue;
                    if (!connectionRepo.existsBySourceIdAndTargetId(sw.getId(), peer.getId())) {
                        saveConnection(sw, peer, "INTERNAL", sw.getName() + " → " + peer.getName());
                        count++;
                    }
                }

            } else {
                // No switch — FIREWALL connects directly to all devices on the interface
                for (NetworkDevice peer : peers) {
                    if (!connectionRepo.existsBySourceIdAndTargetId(firewall.getId(), peer.getId())) {
                        saveConnection(firewall, peer, "INTERNAL",
                                firewall.getName() + " [" + iface + "] → " + peer.getName());
                        count++;
                    }
                }
            }
        }

        // Devices with no pfSenseInterface but not infrastructure — connect directly to FIREWALL
        List<NetworkDevice> unassigned = all.stream()
                .filter(d -> d.getPfSenseInterface() == null || d.getPfSenseInterface().isBlank())
                .filter(d -> !"FIREWALL".equals(d.getDeviceType()) && !"INTERNET".equals(d.getDeviceType()))
                .toList();

        for (NetworkDevice peer : unassigned) {
            if (!connectionRepo.existsBySourceIdAndTargetId(firewall.getId(), peer.getId())) {
                saveConnection(firewall, peer, "INTERNAL", firewall.getName() + " → " + peer.getName());
                count++;
            }
        }

        return count;
    }

    private void saveConnection(NetworkDevice src, NetworkDevice tgt, String direction, String label) {
        NetworkConnection c = new NetworkConnection();
        c.setSource(src);
        c.setTarget(tgt);
        c.setDirection(direction);
        c.setLabel(label);
        c.setStatus("OK");
        connectionRepo.save(c);
    }

    // ── Step 6: auto-group by device type ────────────────────────────────────

    private int autoGroupDevices() {
        // Ensure the three standard groups exist
        Map<String, NetworkGroup> groups = new HashMap<>();
        int layerOrder = 0;
        for (String name : List.of(GROUP_INFRA, GROUP_ENDPOINT, GROUP_PRINTER)) {
            String color = GROUP_COLORS.get(name);
            int order = layerOrder++;
            NetworkGroup g = groupRepo.findByName(name).orElseGet(() -> {
                NetworkGroup ng = new NetworkGroup();
                ng.setName(name);
                ng.setColor(color);
                ng.setLayerOrder(order);
                ng.setCollapsed(false);
                ng.setHidden(false);
                ng.setScanBlocked(false);
                return groupRepo.save(ng);
            });
            groups.put(name, g);
        }

        int count = 0;
        for (NetworkDevice device : deviceRepo.findAllByOrderByCreatedAtAsc()) {
            // Never touch manually-created devices
            if (device.isManual()) continue;

            // Never touch devices in scan-blocked groups
            if (device.getGroup() != null && device.getGroup().isScanBlocked()) continue;

            String targetName = TYPE_TO_GROUP.get(device.getDeviceType());
            if (targetName == null) continue;

            NetworkGroup target = groups.get(targetName);
            if (target == null) continue;

            // Only reassign if not already in the correct group
            if (device.getGroup() == null || !device.getGroup().getId().equals(target.getId())) {
                device.setGroup(target);
                deviceRepo.save(device);
                count++;
            }
        }

        return count;
    }
}
