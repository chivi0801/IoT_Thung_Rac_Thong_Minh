package com.smartbin.controller;

import java.util.List;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.smartbin.dto.request.ThresholdConfigRequest;
import com.smartbin.dto.response.ApiResponse;
import com.smartbin.dto.response.CompartmentResponse;
import com.smartbin.dto.response.DeviceConfigResponse;
import com.smartbin.dto.response.HardwareInfoResponse;
import com.smartbin.service.DeviceService;

import jakarta.validation.Valid;

/**
 * REST endpoints consumed by {@code thiet-bi.html} / {@code thiet-bi.js}.
 */
@RestController
@RequestMapping("/api/v1/devices")
public class DeviceController {

    private final DeviceService deviceService;

    public DeviceController(DeviceService deviceService) {
        this.deviceService = deviceService;
    }

    @GetMapping("/compartments")
    public ApiResponse<List<CompartmentResponse>> getCompartments() {
        return ApiResponse.success(
                deviceService.getCompartmentStatuses(),
                "Lấy trạng thái các ngăn rác thành công");
    }

    @PostMapping("/compartments/{id}/reset")
    public ApiResponse<CompartmentResponse> resetCompartment(@PathVariable Integer id) {
        return ApiResponse.success(
                deviceService.resetCompartment(id),
                "Đã đặt lại ngăn " + id);
    }

    @GetMapping("/configs")
    public ApiResponse<DeviceConfigResponse> getConfigs() {
        return ApiResponse.success(
                deviceService.getDeviceConfigs(),
                "Lấy cấu hình thiết bị thành công");
    }

    @PutMapping("/configs")
    public ApiResponse<DeviceConfigResponse> updateConfigs(
            @Valid @RequestBody ThresholdConfigRequest request) {
        return ApiResponse.success(
                deviceService.updateDeviceConfigs(request),
                "Cập nhật cấu hình thiết bị thành công");
    }

    @GetMapping("/hardware-info")
    public ApiResponse<HardwareInfoResponse> getHardwareInfo() {
        return ApiResponse.success(
                deviceService.getHardwareInfo(),
                "Lấy thông tin phần cứng thành công");
    }
}
