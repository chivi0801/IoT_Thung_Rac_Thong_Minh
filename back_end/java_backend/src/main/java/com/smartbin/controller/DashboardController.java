package com.smartbin.controller;

import java.time.LocalDate;
import java.util.List;

import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.smartbin.dto.response.ApiResponse;
import com.smartbin.dto.response.DashboardKpiResponse;
import com.smartbin.dto.response.LatestDetectionResponse;
import com.smartbin.dto.response.RecentActivityResponse;
import com.smartbin.service.DashboardService;

/**
 * REST endpoints consumed by {@code tong-quan.html} / {@code tong-quan.js}.
 */
@RestController
@RequestMapping("/api/v1/dashboard")
public class DashboardController {

    private final DashboardService dashboardService;

    public DashboardController(DashboardService dashboardService) {
        this.dashboardService = dashboardService;
    }

    @GetMapping("/kpi")
    public ApiResponse<DashboardKpiResponse> getKpiOverview() {
        return ApiResponse.success(
                dashboardService.getKpiOverview(),
                "Lấy thống kê KPI thành công");
    }

    @GetMapping("/latest")
    public ApiResponse<LatestDetectionResponse> getLatestDetection() {
        return ApiResponse.success(
                dashboardService.getLatestDetection(),
                "Lấy kết quả nhận diện gần nhất thành công");
    }

    @GetMapping("/recent-activities")
    public ApiResponse<List<RecentActivityResponse>> getRecentActivities() {
        return ApiResponse.success(
                dashboardService.getRecentActivities(),
                "Lấy hoạt động gần đây thành công");
    }

    @GetMapping("/export-csv")
    public ResponseEntity<byte[]> exportCsvLog() {
        byte[] csvContent = dashboardService.exportCsvLog();

        HttpHeaders headers = new HttpHeaders();
        headers.set(
                HttpHeaders.CONTENT_DISPOSITION,
                "attachment; filename=\"lich_su_phan_loai_" + LocalDate.now() + ".csv\"");
        headers.setContentType(MediaType.parseMediaType("text/csv; charset=UTF-8"));
        headers.setContentLength(csvContent.length);

        return new ResponseEntity<>(csvContent, headers, HttpStatus.OK);
    }
}
