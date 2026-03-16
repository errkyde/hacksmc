package com.hacksmc.dto;
import java.time.Instant;
public record SystemSettingsDto(
    boolean siteMaintenance,
    boolean pfSenseMaintenance,
    String siteMaintenanceMessage,
    String discordWebhookUrl,
    boolean discordEnabled,
    boolean discordNotifyCreate,
    boolean discordNotifyDelete,
    boolean discordNotifyExpire,
    String updatedBy,
    Instant updatedAt
) {}
