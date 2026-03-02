package com.hacksmc.dto;

public record PfSenseStatusResponse(String status, Long latencyMs, String url, String error) {}
