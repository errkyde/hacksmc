package com.hacksmc.service;

import com.hacksmc.entity.NetworkConnection;
import com.hacksmc.entity.NetworkDevice;
import com.hacksmc.entity.NetworkGroup;
import com.hacksmc.entity.TopologyView;
import com.hacksmc.repository.NetworkConnectionRepository;
import com.hacksmc.repository.NetworkDeviceRepository;
import com.hacksmc.repository.NetworkGroupRepository;
import com.hacksmc.repository.TopologyViewRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;
import java.util.stream.Collectors;

/**
 * Orchestrates the full automatic topology discovery pipeline for a given view:
 *
 *  1. ARP import     — discovers live devices on pfSense-managed networks
 *  2. NAT import     — creates INBOUND connections from NAT port-forward rules
 *  3. FW import      — creates INBOUND/OUTBOUND connections from firewall pass rules
 *  4. INTERNET node  — ensures a shared INTERNET gateway device exists in the view
 *  5. Inference      — builds the hierarchy: INTERNET → FIREWALL → subnets → hosts
 *  6. Auto-grouping  — assigns devices to Infrastruktur / Endgeräte / Drucker groups
 *
 * Always operates on the Auto view (id = 1) unless explicitly given a different viewId.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class AutoTopologyScanService {

    private final NetworkTopologyService topologyService;
    private final NetworkDeviceRepository deviceRepo;
    private final NetworkGroupRepository groupRepo;
    private final NetworkConnectionRepository connectionRepo;
    private final TopologyViewRepository viewRepo;
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

    /** Runs the full pipeline on the Auto view (viewId = 1). */
    @Transactional
    public AutoScanResult autoScan() {
        return autoScanForView(NetworkTopologyService.AUTO_VIEW_ID);
    }

    @Transactional
    public AutoScanResult autoScanForView(Long viewId) {
        int totalDevices     = 0;
        int totalConnections = 0;

        // Step 1 — ARP import (primary device discovery)
        try {
            int n = topologyService.importArpTable(viewId);
            totalDevices += n;
            log.info("Auto Scan [ARP] view={}: {} devices", viewId, n);
        } catch (Exception e) {
            log.warn("Auto Scan [ARP] view={} failed: {}", viewId, e.getMessage());
        }

        // Step 2 — NAT port-forward rules → INBOUND connections
        try {
            int n = topologyService.importNatRulesAsConnections(viewId);
            totalConnections += n;
            log.info("Auto Scan [NAT] view={}: {} connections", viewId, n);
        } catch (Exception e) {
            log.warn("Auto Scan [NAT] view={} failed: {}", viewId, e.getMessage());
        }

        // Step 3 — Firewall pass rules → INBOUND/OUTBOUND connections
        try {
            int n = topologyService.importFirewallRulesAsConnections(viewId);
            totalConnections += n;
            log.info("Auto Scan [FW] view={}: {} connections", viewId, n);
        } catch (Exception e) {
            log.warn("Auto Scan [FW] view={} failed: {}", viewId, e.getMessage());
        }

        // Step 4 — Topology inference: build INTERNET → FW → subnet hierarchy
        int inferred = inferTopologyConnections(viewId);
        totalConnections += inferred;
        log.info("Auto Scan [Inference] view={}: {} connections inferred", viewId, inferred);

        // Step 5 — Auto-group devices by type
        int grouped = autoGroupDevices(viewId);
        log.info("Auto Scan [Grouping] view={}: {} devices assigned", viewId, grouped);

        broadcastService.broadcast(
                "system", "SCAN_IMPORTED",
                totalDevices + " Geräte, " + totalConnections + " Verbindungen"
        );

        return new AutoScanResult(totalDevices, totalConnections, grouped);
    }

    // ── Step 4: topology inference ────────────────────────────────────────────

    private int inferTopologyConnections(Long viewId) {
        List<NetworkDevice> all = deviceRepo.findByViewIdOrderByCreatedAtAsc(viewId);
        int count = 0;

        NetworkDevice internet = all.stream()
                .filter(d -> "INTERNET".equals(d.getDeviceType()))
                .findFirst().orElse(null);

        NetworkDevice firewall = all.stream()
                .filter(d -> "FIREWALL".equals(d.getDeviceType()))
                .findFirst().orElse(null);

        if (internet == null || firewall == null) {
            log.warn("Auto Scan [Inference] view={}: skipped — no INTERNET or FIREWALL device", viewId);
            return 0;
        }

        // INTERNET → FIREWALL
        if (!connectionRepo.existsBySourceIdAndTargetId(internet.getId(), firewall.getId())) {
            saveConnection(internet, firewall, "INBOUND", "Internet → " + firewall.getName());
            count++;
        }

        Map<String, List<NetworkDevice>> byInterface = all.stream()
                .filter(d -> d.getPfSenseInterface() != null && !d.getPfSenseInterface().isBlank())
                .filter(d -> !"FIREWALL".equals(d.getDeviceType()) && !"INTERNET".equals(d.getDeviceType()))
                .collect(Collectors.groupingBy(NetworkDevice::getPfSenseInterface));

        for (Map.Entry<String, List<NetworkDevice>> entry : byInterface.entrySet()) {
            String iface = entry.getKey();
            List<NetworkDevice> peers = entry.getValue();

            Optional<NetworkDevice> switchOpt = peers.stream()
                    .filter(d -> "SWITCH".equals(d.getDeviceType()))
                    .findFirst();

            if (switchOpt.isPresent()) {
                NetworkDevice sw = switchOpt.get();
                if (!connectionRepo.existsBySourceIdAndTargetId(firewall.getId(), sw.getId())) {
                    saveConnection(firewall, sw, "INTERNAL", firewall.getName() + " → " + sw.getName());
                    count++;
                }
                for (NetworkDevice peer : peers) {
                    if (peer.getId().equals(sw.getId())) continue;
                    if (!connectionRepo.existsBySourceIdAndTargetId(sw.getId(), peer.getId())) {
                        saveConnection(sw, peer, "INTERNAL", sw.getName() + " → " + peer.getName());
                        count++;
                    }
                }
            } else {
                for (NetworkDevice peer : peers) {
                    if (!connectionRepo.existsBySourceIdAndTargetId(firewall.getId(), peer.getId())) {
                        saveConnection(firewall, peer, "INTERNAL",
                                firewall.getName() + " [" + iface + "] → " + peer.getName());
                        count++;
                    }
                }
            }
        }

        // Devices with no pfSenseInterface → connect directly to FIREWALL
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

    // ── Step 5: auto-group by device type ────────────────────────────────────

    private int autoGroupDevices(Long viewId) {
        TopologyView view = viewRepo.findById(viewId)
                .orElseThrow(() -> new NoSuchElementException("View not found: " + viewId));

        Map<String, NetworkGroup> groups = new HashMap<>();
        int layerOrder = 0;
        for (String name : List.of(GROUP_INFRA, GROUP_ENDPOINT, GROUP_PRINTER)) {
            String color = GROUP_COLORS.get(name);
            int order = layerOrder++;
            NetworkGroup g = groupRepo.findByNameAndViewId(name, viewId).orElseGet(() -> {
                NetworkGroup ng = new NetworkGroup();
                ng.setName(name);
                ng.setColor(color);
                ng.setLayerOrder(order);
                ng.setView(view);
                return groupRepo.save(ng);
            });
            groups.put(name, g);
        }

        int count = 0;
        for (NetworkDevice device : deviceRepo.findByViewIdOrderByCreatedAtAsc(viewId)) {
            if (device.isManual()) continue;
            if (device.getGroup() != null && device.getGroup().isScanBlocked()) continue;

            String targetName = TYPE_TO_GROUP.get(device.getDeviceType());
            if (targetName == null) continue;

            NetworkGroup target = groups.get(targetName);
            if (target == null) continue;

            if (device.getGroup() == null || !device.getGroup().getId().equals(target.getId())) {
                device.setGroup(target);
                deviceRepo.save(device);
                count++;
            }
        }

        return count;
    }
}
