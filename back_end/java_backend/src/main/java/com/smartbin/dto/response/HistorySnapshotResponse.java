package com.smartbin.dto.response;

import java.util.Map;

/**
 * Detailed data rendered inside the AI snapshot inspection modal.
 */
public record HistorySnapshotResponse(
        Long id,
        String time,
        String category,
        String catKey,
        String modelClass,
        String conf,
        String confidenceLevel,
        String status,
        String imageUrl,
        Map<String, Object> boundingBox) {
}
