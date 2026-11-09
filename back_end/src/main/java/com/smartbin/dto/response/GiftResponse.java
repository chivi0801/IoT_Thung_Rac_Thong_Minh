package com.smartbin.dto.response;

import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * Reward gift shown in the admin inventory table.
 */
public record GiftResponse(
        Long id,
        String name,
        String icon,
        Integer points,
        Integer stock,
        String desc,
        String status,
        @JsonProperty("isLow") boolean isLow) {
}
