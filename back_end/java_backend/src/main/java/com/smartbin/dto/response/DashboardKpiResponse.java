package com.smartbin.dto.response;

/**
 * Aggregated KPI figures rendered by the admin overview dashboard.
 */
public record DashboardKpiResponse(
        long totalCount,
        String successRate,
        long plasticCount,
        double plasticPercent,
        long metalCount,
        double metalPercent,
        long organicCount,
        double organicPercent) {
}
