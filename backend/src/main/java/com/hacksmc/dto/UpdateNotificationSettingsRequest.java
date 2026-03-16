package com.hacksmc.dto;
import java.util.Set;
public record UpdateNotificationSettingsRequest(
    String email, boolean emailEnabled,
    boolean notifyOnCreate, boolean notifyOnDelete, boolean notifyOnExpire,
    boolean notifyAllHosts, String notifyScope, Set<Long> hostFilter
) {}
