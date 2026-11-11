package com.smartbin.dto.request;

import jakarta.validation.constraints.NotNull;

/**
 * Payload for updating point conversion rates and the event multiplier.
 */
public record RatesConfigRequest(
        @NotNull(message = "Điểm mỗi vật thể nhựa không được để trống")
        Integer plastic,

        @NotNull(message = "Điểm mỗi vật thể kim loại không được để trống")
        Integer metal,

        @NotNull(message = "Điểm mỗi vật thể hữu cơ không được để trống")
        Integer organic,

        @NotNull(message = "Hệ số sự kiện không được để trống")
        Double multiplier) {
}
