package com.smartbin.dto.request;

import jakarta.validation.constraints.NotBlank;

/**
 * Request to claim green points for a just-deposited waste item.
 *
 * @param wasteLogId optional id of an unassigned waste log to attach
 * @param wasteCategory optional category, defaults to plastic
 */
public record ClaimRewardRequest(
        @NotBlank(message = "MSSV không được để trống")
        String mssv,

        Long wasteLogId,

        String wasteCategory) {
}
