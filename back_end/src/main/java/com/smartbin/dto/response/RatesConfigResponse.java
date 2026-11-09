package com.smartbin.dto.response;

/**
 * Point conversion rates together with header statistic counters.
 */
public record RatesConfigResponse(
        Integer plastic,
        Integer metal,
        Integer organic,
        Double multiplier,
        long activeGiftsCount,
        long totalRedemptionsCount) {
}
