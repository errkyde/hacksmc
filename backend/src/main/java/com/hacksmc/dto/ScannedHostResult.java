package com.hacksmc.dto;

import lombok.Getter;

import java.util.List;

@Getter
public class ScannedHostResult {
    private final String ipAddress;
    private final String hostname;   // null if reverse DNS failed or same as IP
    private final int latencyMs;
    private final List<Integer> openPorts;

    public ScannedHostResult(String ipAddress, String hostname, int latencyMs, List<Integer> openPorts) {
        this.ipAddress = ipAddress;
        this.hostname = hostname;
        this.latencyMs = latencyMs;
        this.openPorts = openPorts != null ? openPorts : List.of();
    }
}
