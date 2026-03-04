package com.hacksmc.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;

@Getter
@AllArgsConstructor
public class ScannedHostResult {
    private String ipAddress;
    private String hostname;   // null if reverse DNS failed or same as IP
    private int latencyMs;
}
