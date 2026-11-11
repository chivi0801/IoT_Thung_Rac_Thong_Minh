package com.smartbin.dto.response;

/**
 * Voucher details rendered inside the congratulations modal.
 */
public record VoucherResponse(
        String voucherCode,
        String giftName,
        String studentName,
        String mssv,
        Integer pointsSpent,
        String time,
        String message) {
}
