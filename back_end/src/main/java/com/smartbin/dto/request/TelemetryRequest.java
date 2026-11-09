package com.smartbin.dto.request;

/**
 * Periodic hardware telemetry sent by the ESP32-S3 firmware.
 * Distances are measured in centimetres, RSSI in dBm and heap in kilobytes.
 */
public record TelemetryRequest(
        Double bin1Dist,
        Double bin2Dist,
        Double bin3Dist,
        Integer wifiRssi,
        Integer ping,
        Integer freeHeapKb,
        Integer packetsIn,
        Integer packetsOut) {
}
