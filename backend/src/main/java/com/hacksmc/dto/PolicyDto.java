package com.hacksmc.dto;

public record PolicyDto(
        Long id,
        String allowedProtocols,
        int portRangeMin,
        int portRangeMax,
        int maxRules
) {}
