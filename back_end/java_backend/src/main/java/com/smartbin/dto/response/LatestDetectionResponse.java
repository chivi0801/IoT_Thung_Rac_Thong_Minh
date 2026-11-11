package com.smartbin.dto.response;

/**
 * Most recent AI detection shown inside the camera preview card.
 */
public record LatestDetectionResponse(
        Long id,
        String time,
        String category,
        String catKey,
        String modelClass,
        String confidence,
        Double confVal,
        String iconType,
        String status) {
}
