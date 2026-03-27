package com.hacksmc.dto;

import java.util.List;

public record ImportScanRequest(
        List<ScannedHostResult> devices
) {}
