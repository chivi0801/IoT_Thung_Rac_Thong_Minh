package com.smartbin.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import com.smartbin.entity.Gift;

import jakarta.persistence.LockModeType;

/**
 * Data access gateway for the reward shop inventory.
 */
@Repository
public interface GiftRepository extends JpaRepository<Gift, Long> {

    List<Gift> findAllByOrderByCreatedAtDesc();

    List<Gift> findAllByStatusOrderByPointsAsc(String status);

    long countByStatus(String status);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select g from Gift g where g.id = :id")
    Optional<Gift> findWithLockById(@Param("id") Long id);
}
