package com.hacksmc.dto;
public record UpdateSystemSettingsRequest(
    boolean siteMaintenance,
    boolean pfSenseMaintenance,
    String siteMaintenanceMessage,
    String discordWebhookUrl,
    boolean discordEnabled,
    boolean discordNotifyCreate,
    boolean discordNotifyDelete,
    boolean discordNotifyExpire
) {}
