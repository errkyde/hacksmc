package com.hacksmc.controller;

import com.hacksmc.dto.*;
import com.hacksmc.service.NetworkTopologyService;
import com.hacksmc.service.TopologyBroadcastService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.security.Principal;
import java.util.List;
import java.util.Map;

/**
 * Topology endpoints accessible to all authenticated users.
 * Results are filtered by role: admins see everything, users see their hosts + shared devices.
 * All data endpoints accept an optional ?viewId= parameter (defaults to the Auto view, id=1).
 */
@RestController
@RequestMapping("/api/topology")
@RequiredArgsConstructor
public class NetworkTopologyController {

    private final NetworkTopologyService topologyService;
    private final TopologyBroadcastService broadcastService;

    /** SSE stream for real-time topology_changed events. JWT via ?token= (EventSource limitation). */
    @GetMapping(value = "/events", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter subscribe() {
        return broadcastService.subscribe();
    }

    /** List all available topology views (non-admin users can switch views too). */
    @GetMapping("/views")
    public List<TopologyViewDto> getViews() {
        return topologyService.listViews();
    }

    @GetMapping("/groups")
    public List<NetworkGroupDto> getGroups(
            @RequestParam(defaultValue = "1") Long viewId) {
        return topologyService.listGroups(viewId);
    }

    @GetMapping("/devices")
    public List<NetworkDeviceDto> getDevices(
            Principal principal,
            @RequestParam(defaultValue = "1") Long viewId) {
        return topologyService.listVisibleDevices(principal.getName(), viewId);
    }

    @GetMapping("/connections")
    public List<NetworkConnectionDto> getConnections(
            Principal principal,
            @RequestParam(defaultValue = "1") Long viewId) {
        return topologyService.listVisibleConnections(principal.getName(), viewId);
    }

    @PostMapping("/connections")
    @ResponseStatus(HttpStatus.CREATED)
    public NetworkConnectionDto createConnection(
            Principal principal,
            @Valid @RequestBody CreateNetworkConnectionRequest req) {
        return topologyService.createUserConnection(principal.getName(), req);
    }

    @DeleteMapping("/connections/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteConnection(Principal principal, @PathVariable Long id) {
        topologyService.deleteUserConnection(principal.getName(), id);
    }

    @PatchMapping("/devices/{id}/position")
    public void savePosition(
            Principal principal,
            @PathVariable Long id,
            @RequestBody Map<String, Double> body) {
        double posX = body.getOrDefault("posX", 0.0);
        double posY = body.getOrDefault("posY", 0.0);
        topologyService.saveDevicePosition(principal.getName(), id, posX, posY);
    }
}
