package com.smartbin.dto.response;

/**
 * Static hardware specifications combined with live telemetry.
 */
public record HardwareInfoResponse(
        String microcontroller,
        String camera,
        String aiModel,
        String lastSeen,
        Integer wifiRssi,
        String uptime,
        String firmwareVersion,
        Integer freeHeapKb,
        String status) {
}
