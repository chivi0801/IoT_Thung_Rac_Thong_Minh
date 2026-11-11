package com.smartbin.dto.response;

/**
 * One row (desktop) or card (mobile) of the classification history view.
 */
public record HistoryItemResponse(
        Long id,
        String time,
        String date,
        String category,
        String catKey,
        String port,
        String modelClass,
        String conf,
        Double confVal,
        String icon,
        String status) {
}
