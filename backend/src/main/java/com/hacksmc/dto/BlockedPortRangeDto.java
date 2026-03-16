package com.hacksmc.dto;
import java.time.Instant;
public record BlockedPortRangeDto(Long id, int portStart, int portEnd, String reason, Instant createdAt) {}
