package com.hacksmc.dto;
public record UpdateSystemSettingsRequest(
    boolean siteMaintenance,
    boolean pfSenseMaintenance,
    String siteMaintenanceMessage,
    String discordWebhookUrl,
    boolean discordEnabled,
    boolean discordNotifyCreate,
    boolean discordNotifyDelete,
    boolean discordNotifyExpire,
    // SMTP — null means "leave existing password unchanged"
    String mailHost,
    Integer mailPort,
    String mailUsername,
    String mailPassword,
    Boolean mailTlsEnabled,
    String mailFrom
) {}
