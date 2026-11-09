package com.smartbin.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.smartbin.entity.WasteLog;

/**
 * Data access gateway for {@link WasteLog} dashboard and history queries.
 */
@Repository
public interface WasteLogRepository extends JpaRepository<WasteLog, Long> {

    long countByCategory(String category);

    long countByCatKey(String catKey);

    long countByCategoryIgnoreCase(String category);

    Optional<WasteLog> findTopByOrderByCreatedAtDesc();

    List<WasteLog> findTop4ByOrderByCreatedAtDesc();

    List<WasteLog> findAllByOrderByCreatedAtDesc();

    Page<WasteLog> findAllByOrderByCreatedAtDesc(Pageable pageable);

    Page<WasteLog> findByCategoryIgnoreCaseOrderByCreatedAtDesc(String category, Pageable pageable);

    long countByServoStatusContainingIgnoreCase(String keyword);
}
