package com.smartbin.dto.response;

/**
 * One entry in the student's personal recycling history.
 */
public record StudentHistoryResponse(
        String type,
        String title,
        String meta,
        Integer pts,
        String status) {
}
