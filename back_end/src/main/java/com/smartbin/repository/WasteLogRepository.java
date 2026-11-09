package com.smartbin.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.smartbin.entity.WasteLog;

/**
 * Data access gateway for {@link WasteLog} dashboard queries.
 */
@Repository
public interface WasteLogRepository extends JpaRepository<WasteLog, Long> {

    long countByCategory(String category);

    long countByCatKey(String catKey);

    Optional<WasteLog> findTopByOrderByCreatedAtDesc();

    List<WasteLog> findTop4ByOrderByCreatedAtDesc();

    List<WasteLog> findAllByOrderByCreatedAtDesc();

    long countByServoStatusContainingIgnoreCase(String keyword);
}
