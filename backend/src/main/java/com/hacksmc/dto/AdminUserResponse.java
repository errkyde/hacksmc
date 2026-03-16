package com.hacksmc.dto;

public record AdminUserResponse(Long id, String username, String role, long hostCount, boolean enabled) {}
