package com.smartbin.dto.response;

/**
 * Lightweight heartbeat acknowledgement for the ESP32 connection check.
 */
public record PingResponse(
        String status,
        Long timestamp,
        Integer latencyMs,
        String message) {
}
