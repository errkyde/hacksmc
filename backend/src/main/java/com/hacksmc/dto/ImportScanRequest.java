package com.hacksmc.dto;

import java.util.List;

public record ImportScanRequest(
        List<ScannedHostResult> devices,
        Long targetGroupId          // optional: assign newly imported devices to this group
) {}
