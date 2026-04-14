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
 * Admin-only topology management: views, devices, groups, connections, scanner import.
 * All data endpoints accept an optional ?viewId= parameter (defaults to Auto view, id=1).
 */
@RestController
@RequestMapping("/api/admin/topology")
@RequiredArgsConstructor
public class NetworkTopologyAdminController {

    private final NetworkTopologyService topologyService;
    private final AutoTopologyScanService autoTopologyScanService;

    // ── Views ─────────────────────────────────────────────────────────────────

    @GetMapping("/views")
    public List<TopologyViewDto> getViews() {
        return topologyService.listViews();
    }

    @PostMapping("/views")
    @ResponseStatus(HttpStatus.CREATED)
    public TopologyViewDto createView(@Valid @RequestBody CreateTopologyViewRequest req) {
        return topologyService.createView(req);
    }

    @PutMapping("/views/{id}")
    public TopologyViewDto updateView(@PathVariable Long id,
                                      @Valid @RequestBody UpdateTopologyViewRequest req) {
        return topologyService.updateView(id, req);
    }

    @DeleteMapping("/views/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteView(@PathVariable Long id) {
        topologyService.deleteView(id);
    }

    // ── Groups ────────────────────────────────────────────────────────────────

    @GetMapping("/groups")
    public List<NetworkGroupDto> getGroups(
            @RequestParam(defaultValue = "1") Long viewId) {
        return topologyService.listGroups(viewId);
    }

    @PostMapping("/groups")
    @ResponseStatus(HttpStatus.CREATED)
    public NetworkGroupDto createGroup(
            @Valid @RequestBody CreateNetworkGroupRequest req,
            @RequestParam(defaultValue = "1") Long viewId) {
        return topologyService.createGroup(req, viewId);
    }

    @PutMapping("/groups/{id}")
    public NetworkGroupDto updateGroup(@PathVariable Long id,
                                        @Valid @RequestBody UpdateNetworkGroupRequest req) {
        return topologyService.updateGroup(id, req);
    }

    @DeleteMapping("/groups/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteGroup(@PathVariable Long id) {
        topologyService.deleteGroup(id);
    }

    // ── Devices ───────────────────────────────────────────────────────────────

    @GetMapping("/devices")
    public List<NetworkDeviceDto> getDevices(
            @RequestParam(defaultValue = "1") Long viewId) {
        return topologyService.listAllDevices(viewId);
    }

    @PostMapping("/devices")
    @ResponseStatus(HttpStatus.CREATED)
    public NetworkDeviceDto createDevice(
            @Valid @RequestBody CreateNetworkDeviceRequest req,
            @RequestParam(defaultValue = "1") Long viewId) {
        return topologyService.createDevice(req, viewId);
    }

    @PatchMapping("/devices/{id}")
    public NetworkDeviceDto patchDevice(@PathVariable Long id,
                                         @Valid @RequestBody PatchNetworkDeviceRequest req) {
        return topologyService.patchDevice(id, req);
    }

    @DeleteMapping("/devices/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteDevice(@PathVariable Long id) {
        topologyService.deleteDevice(id);
    }

    @PostMapping("/devices/import-scan")
    public Map<String, Integer> importScan(
            @RequestBody ImportScanRequest req,
            @RequestParam(defaultValue = "1") Long viewId) {
        int imported = topologyService.importFromScan(req.devices(), req.targetGroupId(), viewId);
        return Map.of("imported", imported);
    }

    // ── Connections ───────────────────────────────────────────────────────────

    @GetMapping("/connections")
    public List<NetworkConnectionDto> getConnections(
            @RequestParam(defaultValue = "1") Long viewId) {
        return topologyService.listAllConnections(viewId);
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
    public Map<String, Integer> importArp(
            @RequestParam(defaultValue = "1") Long viewId) {
        int upserted = topologyService.importArpTable(viewId);
        return Map.of("upserted", upserted);
    }

    // ── NAT rules → topology connections ─────────────────────────────────────

    @PostMapping("/scan/nat-connections")
    public Map<String, Integer> importNatConnections(
            @RequestParam(defaultValue = "1") Long viewId) {
        int imported = topologyService.importNatRulesAsConnections(viewId);
        return Map.of("imported", imported);
    }

    // ── Firewall pass rules → topology connections ────────────────────────────

    @PostMapping("/scan/firewall-connections")
    public Map<String, Integer> importFirewallConnections(
            @RequestParam(defaultValue = "1") Long viewId) {
        int imported = topologyService.importFirewallRulesAsConnections(viewId);
        return Map.of("imported", imported);
    }

    // ── Full automatic discovery pipeline ─────────────────────────────────────

    @PostMapping("/scan/auto")
    public Map<String, Integer> autoScan(
            @RequestParam(defaultValue = "1") Long viewId) {
        AutoTopologyScanService.AutoScanResult result = autoTopologyScanService.autoScanForView(viewId);
        return Map.of(
                "devices",     result.devices(),
                "connections", result.connections(),
                "grouped",     result.grouped()
        );
    }
}
