package com.smartbin.dto.response;

/**
 * One row of the student gift redemption history table.
 */
public record RedemptionResponse(
        Long id,
        String code,
        String mssv,
        String name,
        String giftName,
        Integer points,
        String time,
        String status) {
}
