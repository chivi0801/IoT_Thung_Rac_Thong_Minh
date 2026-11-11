package com.smartbin.dto.response;

/**
 * One row of the "recent activity" table on the overview dashboard.
 */
public record RecentActivityResponse(
        String time,
        String category,
        String catKey,
        String confidence,
        String status,
        String modelClass,
        String iconType) {
}
