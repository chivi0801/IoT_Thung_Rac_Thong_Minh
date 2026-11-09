package com.smartbin.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

/**
 * Request to redeem a reward gift using accumulated green points.
 */
public record RedeemGiftRequest(
        @NotBlank(message = "MSSV không được để trống")
        String mssv,

        @NotNull(message = "Mã phần quà không được để trống")
        Long giftId) {
}
