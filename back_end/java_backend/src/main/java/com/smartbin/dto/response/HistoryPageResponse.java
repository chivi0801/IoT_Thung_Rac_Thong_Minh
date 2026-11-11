package com.smartbin.dto.response;

import java.util.List;
import java.util.Map;

/**
 * Paginated history payload tailored for the frontend navigation controls.
 */
public record HistoryPageResponse(
        List<HistoryItemResponse> items,
        long totalElements,
        int totalPages,
        int currentPage,
        int pageSize,
        boolean hasNext,
        boolean hasPrevious,
        Map<String, Long> categoryCounts) {
}
