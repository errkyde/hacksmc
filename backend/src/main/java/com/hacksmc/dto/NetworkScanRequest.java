package com.hacksmc.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import lombok.Getter;
import lombok.Setter;

@Getter @Setter
public class NetworkScanRequest {

    @NotBlank
    @Pattern(regexp = "^(\\d{1,3}\\.){3}\\d{1,3}/\\d{1,2}$", message = "Must be a valid CIDR (e.g. 192.168.1.0/24)")
    private String subnet;
}
