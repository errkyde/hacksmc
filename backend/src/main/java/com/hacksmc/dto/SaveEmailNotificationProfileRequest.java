package com.hacksmc.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import java.util.Set;

public record SaveEmailNotificationProfileRequest(
    @NotBlank @Email String email,
    boolean notifyOnCreate,
    boolean notifyOnDelete,
    boolean notifyOnExpire,
    @NotBlank String scope,
    Set<Long> userIds
) {}
