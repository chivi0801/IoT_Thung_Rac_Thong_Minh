package com.smartbin.dto.response;

/**
 * Rendered status of a single compartment consumed by {@code thiet-bi.js}.
 */
public record CompartmentResponse(
        Integer id,
        String key,
        String name,
        Integer level,
        Integer count,
        Double dist,
        String statusClass,
        String statusText) {
}
