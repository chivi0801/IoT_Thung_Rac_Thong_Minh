package com.smartbin.dto.request;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;

/**
 * Payload for creating or updating a reward gift.
 *
 * @param desc description / redemption instructions
 */
public record GiftRequest(
        @NotBlank(message = "Tên phần quà không được để trống")
        String name,

        String icon,

        @Min(value = 1, message = "Điểm quy đổi phải từ 1 trở lên")
        Integer points,

        @Min(value = 0, message = "Số lượng tồn kho không được âm")
        Integer stock,

        String desc,

        String status) {
}
