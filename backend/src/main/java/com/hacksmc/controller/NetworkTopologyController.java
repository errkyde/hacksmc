package com.hacksmc.controller;

import com.hacksmc.dto.CreateNetworkConnectionRequest;
import com.hacksmc.dto.NetworkConnectionDto;
import com.hacksmc.dto.NetworkDeviceDto;
import com.hacksmc.dto.NetworkGroupDto;
import com.hacksmc.service.NetworkTopologyService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.security.Principal;
import java.util.List;
import java.util.Map;

/**
 * Topology endpoints accessible to all authenticated users.
 * Results are filtered by role: admins see everything, users see their hosts + shared devices.
 */
@RestController
@RequestMapping("/api/topology")
@RequiredArgsConstructor
public class NetworkTopologyController {

    private final NetworkTopologyService topologyService;

    @GetMapping("/groups")
    public List<NetworkGroupDto> getGroups() {
        return topologyService.listGroups();
    }

    @GetMapping("/devices")
    public List<NetworkDeviceDto> getDevices(Principal principal) {
        return topologyService.listVisibleDevices(principal.getName());
    }

    @GetMapping("/connections")
    public List<NetworkConnectionDto> getConnections(Principal principal) {
        return topologyService.listVisibleConnections(principal.getName());
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
