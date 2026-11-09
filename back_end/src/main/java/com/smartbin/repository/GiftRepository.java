package com.smartbin.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.smartbin.entity.Gift;

/**
 * Data access gateway for the reward shop inventory.
 */
@Repository
public interface GiftRepository extends JpaRepository<Gift, Long> {

    List<Gift> findAllByOrderByCreatedAtDesc();

    List<Gift> findAllByStatusOrderByPointsAsc(String status);

    long countByStatus(String status);
}
