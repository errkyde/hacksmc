package com.hacksmc.controller;

import com.hacksmc.dto.*;
import com.hacksmc.service.AutoTopologyScanService;
import com.hacksmc.service.NetworkTopologyService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * Admin-only topology management: devices, groups, connections, scanner import.
 */
@RestController
@RequestMapping("/api/admin/topology")
@RequiredArgsConstructor
public class NetworkTopologyAdminController {

    private final NetworkTopologyService topologyService;
    private final AutoTopologyScanService autoTopologyScanService;

    // ── Groups ────────────────────────────────────────────────────────────────

    @GetMapping("/groups")
    public List<NetworkGroupDto> getGroups() {
        return topologyService.listGroups();
    }

    @PostMapping("/groups")
    @ResponseStatus(HttpStatus.CREATED)
    public NetworkGroupDto createGroup(@Valid @RequestBody CreateNetworkGroupRequest req) {
        return topologyService.createGroup(req);
    }

    @PutMapping("/groups/{id}")
    public NetworkGroupDto updateGroup(@PathVariable Long id, @Valid @RequestBody UpdateNetworkGroupRequest req) {
        return topologyService.updateGroup(id, req);
    }

    @DeleteMapping("/groups/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteGroup(@PathVariable Long id) {
        topologyService.deleteGroup(id);
    }

    // ── Devices ───────────────────────────────────────────────────────────────

    @GetMapping("/devices")
    public List<NetworkDeviceDto> getDevices() {
        return topologyService.listAllDevices();
    }

    @PostMapping("/devices")
    @ResponseStatus(HttpStatus.CREATED)
    public NetworkDeviceDto createDevice(@Valid @RequestBody CreateNetworkDeviceRequest req) {
        return topologyService.createDevice(req);
    }

    @PatchMapping("/devices/{id}")
    public NetworkDeviceDto patchDevice(@PathVariable Long id, @Valid @RequestBody PatchNetworkDeviceRequest req) {
        return topologyService.patchDevice(id, req);
    }

    @DeleteMapping("/devices/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteDevice(@PathVariable Long id) {
        topologyService.deleteDevice(id);
    }

    @PostMapping("/devices/import-scan")
    public Map<String, Integer> importScan(@RequestBody ImportScanRequest req) {
        int imported = topologyService.importFromScan(req.devices(), req.targetGroupId());
        return Map.of("imported", imported);
    }

    // ── Connections ───────────────────────────────────────────────────────────

    @GetMapping("/connections")
    public List<NetworkConnectionDto> getConnections() {
        return topologyService.listAllConnections();
    }

    @PostMapping("/connections")
    @ResponseStatus(HttpStatus.CREATED)
    public NetworkConnectionDto createConnection(@Valid @RequestBody CreateNetworkConnectionRequest req) {
        return topologyService.createAdminConnection(req);
    }

    @DeleteMapping("/connections/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteConnection(@PathVariable Long id) {
        topologyService.deleteAdminConnection(id);
    }

    // ── ARP import ────────────────────────────────────────────────────────────

    @PostMapping("/scan/arp")
    public Map<String, Integer> importArp() {
        int upserted = topologyService.importArpTable();
        return Map.of("upserted", upserted);
    }

    // ── NAT rules → topology connections ─────────────────────────────────────

    @PostMapping("/scan/nat-connections")
    public Map<String, Integer> importNatConnections() {
        int imported = topologyService.importNatRulesAsConnections();
        return Map.of("imported", imported);
    }

    // ── Firewall pass rules → topology connections ────────────────────────────

    @PostMapping("/scan/firewall-connections")
    public Map<String, Integer> importFirewallConnections() {
        int imported = topologyService.importFirewallRulesAsConnections();
        return Map.of("imported", imported);
    }

    // ── Full automatic discovery pipeline ─────────────────────────────────────

    /**
     * Runs the complete Auto Scan pipeline in a single request:
     * ARP → NAT/FW connections → topology inference → auto-grouping.
     * Returns aggregate counts for the frontend summary toast.
     */
    @PostMapping("/scan/auto")
    public Map<String, Integer> autoScan() {
        AutoTopologyScanService.AutoScanResult result = autoTopologyScanService.autoScan();
        return Map.of(
                "devices",     result.devices(),
                "connections", result.connections(),
                "grouped",     result.grouped()
        );
    }
}
