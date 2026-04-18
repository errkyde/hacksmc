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
 *  4. Inference      — builds the hierarchy: INTERNET → (ROUTER →) FIREWALL → subnets → hosts
 *  5. Auto-grouping  — groups infrastructure devices together; each pfSense interface
 *                      becomes its own VLAN group with a distinct color
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

    // ── Constants ──────────────────────────────────────────────────────────────

    /** Device types that always belong to the infrastructure group. */
    private static final Set<String> INFRA_TYPES = Set.of("INTERNET", "FIREWALL", "ROUTER", "SWITCH");

    private static final String GROUP_INFRA    = "Infrastruktur";
    private static final String GROUP_FALLBACK = "Endgeräte";

    private static final String INFRA_COLOR    = "#ef4444";
    private static final String FALLBACK_COLOR = "#6b7280";

    /**
     * Rotating color palette for per-interface (VLAN) groups.
     * Colors are chosen to be visually distinct on a dark background.
     */
    private static final String[] IFACE_COLORS = {
            "#3b82f6",  // blue
            "#22c55e",  // green
            "#f59e0b",  // amber
            "#8b5cf6",  // violet
            "#ec4899",  // pink
            "#06b6d4",  // cyan
            "#f97316",  // orange
            "#84cc16",  // lime
            "#14b8a6",  // teal
            "#a78bfa",  // purple
            "#fb7185",  // rose
            "#34d399",  // emerald
    };

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

        // Step 4 — Ensure FIREWALL device exists (pfSense itself is not in its own ARP table)
        try {
            topologyService.getOrCreateFirewallDevice(viewId);
        } catch (Exception e) {
            log.warn("Auto Scan [FIREWALL] view={} failed: {}", viewId, e.getMessage());
        }

        // Step 4b — Ensure ROUTER device exists (WAN gateway / upstream router)
        try {
            topologyService.getOrCreateRouterDevice(viewId);
        } catch (Exception e) {
            log.warn("Auto Scan [ROUTER] view={} failed: {}", viewId, e.getMessage());
        }

        // Step 5 — Topology inference: build INTERNET → (ROUTER →) FIREWALL → subnets hierarchy
        int inferred = inferTopologyConnections(viewId);
        totalConnections += inferred;
        log.info("Auto Scan [Inference] view={}: {} connections inferred", viewId, inferred);

        // Step 5 — Auto-group: infrastructure + one group per pfSense interface (VLAN)
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

        // ── WAN chain: INTERNET → (ROUTER →) FIREWALL ────────────────────────
        // If a ROUTER exists, chain through it; otherwise connect directly.
        Optional<NetworkDevice> routerOpt = all.stream()
                .filter(d -> "ROUTER".equals(d.getDeviceType()))
                .findFirst();

        if (routerOpt.isPresent()) {
            NetworkDevice router = routerOpt.get();
            if (!connectionRepo.existsBySourceIdAndTargetId(internet.getId(), router.getId())) {
                saveConnection(internet, router, "INBOUND", "Internet → " + router.getName());
                count++;
            }
            if (!connectionRepo.existsBySourceIdAndTargetId(router.getId(), firewall.getId())) {
                saveConnection(router, firewall, "INBOUND", router.getName() + " → " + firewall.getName());
                count++;
            }
        } else {
            if (!connectionRepo.existsBySourceIdAndTargetId(internet.getId(), firewall.getId())) {
                saveConnection(internet, firewall, "INBOUND", "Internet → " + firewall.getName());
                count++;
            }
        }

        // ── Per-interface (VLAN) subnet connections ───────────────────────────
        // Devices sharing the same pfSenseInterface are on the same subnet.
        // Route: FIREWALL → [SWITCH if present] → device
        Map<String, List<NetworkDevice>> byInterface = all.stream()
                .filter(d -> d.getPfSenseInterface() != null && !d.getPfSenseInterface().isBlank())
                .filter(d -> !INFRA_TYPES.contains(d.getDeviceType()))
                .collect(Collectors.groupingBy(NetworkDevice::getPfSenseInterface));

        for (Map.Entry<String, List<NetworkDevice>> entry : byInterface.entrySet()) {
            String iface = entry.getKey();
            List<NetworkDevice> peers = entry.getValue();

            // If a SWITCH exists on this interface, route through it
            Optional<NetworkDevice> switchOpt = peers.stream()
                    .filter(d -> "SWITCH".equals(d.getDeviceType()))
                    .findFirst();

            if (switchOpt.isPresent()) {
                NetworkDevice sw = switchOpt.get();
                if (!connectionRepo.existsBySourceIdAndTargetId(firewall.getId(), sw.getId())) {
                    saveConnection(firewall, sw, "INTERNAL", firewall.getName() + " [" + iface + "] → " + sw.getName());
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

        // ── Fallback: devices with no pfSenseInterface → directly to FIREWALL ──
        List<NetworkDevice> unassigned = all.stream()
                .filter(d -> d.getPfSenseInterface() == null || d.getPfSenseInterface().isBlank())
                .filter(d -> !INFRA_TYPES.contains(d.getDeviceType()))
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

    // ── Step 5: auto-group by pfSense interface (VLAN-aware) ─────────────────
    //
    // Strategy:
    //   • Infrastructure devices (INTERNET, FIREWALL, ROUTER, SWITCH) → "Infrastruktur"
    //   • Non-infrastructure devices with a pfSenseInterface → one group per interface,
    //     named after the interface, with a rotating color from IFACE_COLORS
    //   • Remaining devices (no interface) → "Endgeräte" fallback
    //
    // Groups that already exist with isScanBlocked=true are never reassigned.
    // Manual devices (isManual=true) are never reassigned.

    private int autoGroupDevices(Long viewId) {
        TopologyView view = viewRepo.findById(viewId)
                .orElseThrow(() -> new NoSuchElementException("View not found: " + viewId));

        List<NetworkDevice> all = deviceRepo.findByViewIdOrderByCreatedAtAsc(viewId);

        // ── Ensure Infrastruktur group (layer 0) ──────────────────────────────
        NetworkGroup infraGroup = ensureGroup(GROUP_INFRA, INFRA_COLOR, 0, view, viewId);

        // ── Collect unique interfaces from non-infra, non-manual devices ──────
        List<String> orderedIfaces = all.stream()
                .filter(d -> !INFRA_TYPES.contains(d.getDeviceType()))
                .filter(d -> !d.isManual())
                .filter(d -> d.getPfSenseInterface() != null && !d.getPfSenseInterface().isBlank())
                .map(NetworkDevice::getPfSenseInterface)
                .distinct()
                .sorted()   // stable order across runs
                .collect(Collectors.toList());

        // ── Create/find one group per interface ───────────────────────────────
        Map<String, NetworkGroup> ifaceGroups = new LinkedHashMap<>();
        for (int i = 0; i < orderedIfaces.size(); i++) {
            String iface = orderedIfaces.get(i);
            String color = IFACE_COLORS[i % IFACE_COLORS.length];
            NetworkGroup g = ensureGroup(iface, color, i + 1, view, viewId);
            ifaceGroups.put(iface, g);
        }

        // ── Ensure fallback Endgeräte group (last layer) ──────────────────────
        NetworkGroup fallbackGroup = ensureGroup(GROUP_FALLBACK, FALLBACK_COLOR,
                orderedIfaces.size() + 1, view, viewId);

        // ── Assign devices ────────────────────────────────────────────────────
        int count = 0;
        for (NetworkDevice device : all) {
            if (device.isManual()) continue;
            if (device.getGroup() != null && device.getGroup().isScanBlocked()) continue;

            NetworkGroup target;
            if (INFRA_TYPES.contains(device.getDeviceType())) {
                target = infraGroup;
            } else if (device.getPfSenseInterface() != null
                    && ifaceGroups.containsKey(device.getPfSenseInterface())) {
                target = ifaceGroups.get(device.getPfSenseInterface());
            } else {
                target = fallbackGroup;
            }

            if (device.getGroup() == null || !device.getGroup().getId().equals(target.getId())) {
                device.setGroup(target);
                deviceRepo.save(device);
                count++;
            }
        }

        return count;
    }

    /** Find an existing group by name+viewId, or create it with the given defaults. */
    private NetworkGroup ensureGroup(String name, String color, int layerOrder,
                                     TopologyView view, Long viewId) {
        return groupRepo.findByNameAndViewId(name, viewId).orElseGet(() -> {
            NetworkGroup g = new NetworkGroup();
            g.setName(name);
            g.setColor(color);
            g.setLayerOrder(layerOrder);
            g.setView(view);
            return groupRepo.save(g);
        });
    }
}
