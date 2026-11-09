package com.smartbin.dto.response;

/**
 * Current device threshold configuration.
 */
public record DeviceConfigResponse(
        Integer thFull,
        Integer thConf) {
}
