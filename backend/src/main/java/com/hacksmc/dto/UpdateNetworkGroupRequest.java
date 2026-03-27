package com.hacksmc.dto;

public record UpdateNetworkGroupRequest(
        String name,
        String color,
        Integer layerOrder,
        Boolean collapsed
) {}
