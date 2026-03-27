package com.hacksmc.dto;

public record ArpEntryDto(
        String ip,
        String mac,
        String iface,
        String hostname
) {}
