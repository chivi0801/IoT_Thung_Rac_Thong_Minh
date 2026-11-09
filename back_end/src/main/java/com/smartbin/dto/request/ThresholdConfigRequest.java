package com.smartbin.dto.request;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

/**
 * Payload for updating the device warning thresholds.
 *
 * @param thFull full-warning threshold in percent (50..95)
 * @param thConf minimum AI confidence in percent (30..95)
 */
public record ThresholdConfigRequest(
        @NotNull(message = "Ngưỡng cảnh báo đầy không được để trống")
        @Min(value = 50, message = "Ngưỡng cảnh báo đầy phải từ 50% trở lên")
        @Max(value = 95, message = "Ngưỡng cảnh báo đầy không được vượt quá 95%")
        Integer thFull,

        @NotNull(message = "Độ tin cậy tối thiểu không được để trống")
        @Min(value = 30, message = "Độ tin cậy tối thiểu phải từ 30% trở lên")
        @Max(value = 95, message = "Độ tin cậy tối thiểu không được vượt quá 95%")
        Integer thConf) {
}
