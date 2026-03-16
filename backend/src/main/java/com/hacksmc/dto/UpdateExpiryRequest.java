package com.hacksmc.dto;
import java.time.Instant;
public record UpdateExpiryRequest(Instant expiresAt) {}
