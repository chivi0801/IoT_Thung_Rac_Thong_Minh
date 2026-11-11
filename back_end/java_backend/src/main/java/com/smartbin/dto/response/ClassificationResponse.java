package com.smartbin.dto.response;

/**
 * Immediate classification result returned to the ESP32 firmware so it can
 * actuate the SG90 servo motor.
 */
public record ClassificationResponse(
        String status,
        String category,
        String catKey,
        String modelClass,
        Double confidence,
        String confText,
        Integer servoAngle,
        Integer targetBin,
        String servoStatus,
        Long logId,
        String timestamp) {
}
